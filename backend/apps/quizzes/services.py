from __future__ import annotations

import json
import os
import random
import secrets
import uuid
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from apps.courses.models import Lecon, Module, Parcours
from apps.progression.models import Progression, StatutProgression

from .models import Certificat, Quiz, TentativeQuiz, TypeQuestion


def _get_user_role(user):
    return getattr(user, 'role', None)


def user_can_manage_quiz(user, quiz: Quiz | None = None, module: Module | None = None, parcours: Parcours | None = None):
    if not user or not user.is_authenticated:
        return False

    if user.is_staff or _get_user_role(user) == 'ADMIN':
        return True

    if _get_user_role(user) != 'FORMATEUR':
        return False

    target_parcours = parcours
    if quiz is not None:
        target_parcours = quiz.parcours
    elif module is not None:
        target_parcours = module.parcours

    if target_parcours is None:
        return False

    # Parcours sans formateur assigné : le formateur connecté peut le prendre en charge
    if target_parcours.formateur_id is None:
        return True

    # Comparaison robuste UUID / str
    return str(target_parcours.formateur_id) == str(getattr(user, 'id', ''))


def quiz_total_points(quiz: Quiz) -> int:
    return sum(question.points for question in quiz.questions.all()) or 0


def normalize_question_type(type_question):
    if type_question in (TypeQuestion.QCU, TypeQuestion.QCM):
        return type_question
    return TypeQuestion.QCU


def shuffle_quiz_payload(quiz: Quiz, include_correct_answers: bool = False):
    questions = list(quiz.questions.prefetch_related('options').all())
    if quiz.melange_questions:
        random.shuffle(questions)

    payload = []
    for question in questions:
        options = list(question.options.all())
        random.shuffle(options)
        payload.append(
            {
                'id': str(question.id),
                'texte': question.texte,
                'type_question': question.type_question,
                'explication': question.explication,
                'points': question.points,
                'ordre': question.ordre,
                'options': [
                    {
                        'id': str(option.id),
                        'texte': option.texte,
                        **({'est_correcte': option.est_correcte} if include_correct_answers else {}),
                    }
                    for option in options
                ],
            }
        )
    return payload


def calculate_quiz_attempt(quiz: Quiz, answers: list[dict]):
    questions = list(quiz.questions.prefetch_related('options').all())
    question_map = {str(question.id): question for question in questions}
    total_points = sum(question.points for question in questions)
    obtained_points = 0
    details = []

    for answer in answers:
        question_id = str(answer.get('question_id') or '')
        selected_option_ids = {str(option_id) for option_id in (answer.get('option_ids') or [])}
        question = question_map.get(question_id)
        if question is None:
            continue

        correct_option_ids = {str(option.id) for option in question.options.all() if option.est_correcte}
        is_correct = selected_option_ids == correct_option_ids

        if is_correct:
            obtained_points += question.points

        details.append(
            {
                'question_id': question_id,
                'is_correct': is_correct,
                'selected_option_ids': sorted(selected_option_ids),
                'correct_option_ids': sorted(correct_option_ids),
                'points_awarded': question.points if is_correct else 0,
            }
        )

    score = round((obtained_points / total_points) * 100, 2) if total_points else 0.0
    est_reussi = score >= float(quiz.note_de_passage)
    return {
        'score_obtenu': score,
        'points_obtenus': obtained_points,
        'est_reussi': est_reussi,
        'details': details,
        'total_points': total_points,
    }


@transaction.atomic
def mark_module_progression_complete(apprenant, module: Module):
    now = timezone.now()
    lecons = module.lecons.all()
    progressions = []

    for lecon in lecons:
        progression, _created = Progression.objects.get_or_create(
            apprenant=apprenant,
            lecon=lecon,
            defaults={'statut': StatutProgression.EN_COURS},
        )
        progression.statut = StatutProgression.TERMINE
        progression.date_fin = progression.date_fin or now
        progression.date_dernier_activite = now
        progression.save(update_fields=['statut', 'date_fin', 'date_dernier_activite'])
        progressions.append(progression)

    return progressions


@transaction.atomic
def generate_certificate_pdf(certificat: Certificat):
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError(
            'ReportLab n\'est pas installé. Ajoutez reportlab au projet pour générer les certificats.'
        ) from exc

    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=18 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CertificateTitle',
        parent=styles['Title'],
        fontName='Helvetica-Bold',
        fontSize=24,
        textColor=colors.HexColor('#243491'),
        alignment=1,
        leading=30,
        spaceAfter=12,
    )
    body_style = ParagraphStyle(
        'CertificateBody',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=12,
        textColor=colors.HexColor('#1f2937'),
        alignment=1,
        leading=18,
    )
    small_style = ParagraphStyle(
        'CertificateSmall',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=9,
        textColor=colors.HexColor('#6b7280'),
        alignment=1,
        leading=13,
    )

    parcours = certificat.parcours
    apprenant = certificat.apprenant

    story = [
        Spacer(1, 18 * mm),
        Paragraph('Attestation de Réussite', title_style),
        Spacer(1, 8 * mm),
        Paragraph(
            f'Le présent certificat atteste que <b>{apprenant.get_full_name() or apprenant.email}</b> ' 
            f'a validé avec succès le parcours <b>{parcours.titre}</b> sur la plateforme EMC E-Formation.',
            body_style,
        ),
        Spacer(1, 8 * mm),
        Table(
            [
                ['Code de vérification', certificat.code_verification],
                ['Date d\'émission', certificat.date_emission.strftime('%d/%m/%Y %H:%M')],
                ['Parcours', parcours.titre],
            ],
            colWidths=[55 * mm, 110 * mm],
            style=TableStyle(
                [
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eef2ff')),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#111827')),
                    ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('LEADING', (0, 0), (-1, -1), 14),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ]
            ),
        ),
        Spacer(1, 8 * mm),
        Paragraph(
            'Ce document est généré automatiquement. Le code de vérification permet de contrôler l\'authenticité de l\'attestation.',
            small_style,
        ),
    ]

    document.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    filename = f"certificat_{certificat.code_verification}.pdf"
    certificat.fichier_pdf.save(filename, ContentFile(pdf_bytes), save=False)
    certificat.save(update_fields=['fichier_pdf'])
    return certificat


def is_parcours_completed(apprenant, parcours: Parcours) -> bool:
    """True si toutes les leçons sont terminées et tous les quiz validés."""
    if not apprenant or not parcours:
        return False

    total_lecons = Lecon.objects.filter(module__parcours=parcours).count()
    if total_lecons == 0:
        return False

    completed_lecons = Progression.objects.filter(
        apprenant=apprenant,
        lecon__module__parcours=parcours,
        statut=StatutProgression.TERMINE,
    ).count()

    if completed_lecons < total_lecons:
        return False

    quizzes = Quiz.objects.filter(module__parcours=parcours)
    quiz_ids = list(quizzes.values_list('id', flat=True))
    if quiz_ids:
        passed_quiz_ids = set(
            TentativeQuiz.objects.filter(
                apprenant=apprenant,
                quiz_id__in=quiz_ids,
                est_reussi=True,
            ).values_list('quiz_id', flat=True)
        )
        if len(passed_quiz_ids) < len(quiz_ids):
            return False

    return True


@transaction.atomic
def issue_certificate_if_completed(apprenant, parcours: Parcours):
    if not is_parcours_completed(apprenant, parcours):
        return None

    certificat, created = Certificat.objects.get_or_create(
        apprenant=apprenant,
        parcours=parcours,
        defaults={'code_verification': uuid_token()},
    )

    if created or not certificat.fichier_pdf:
        generate_certificate_pdf(certificat)

    return certificat


def uuid_token():
    return secrets.token_hex(16).upper()


def build_gemini_quiz(module_title: str, module_summary: str, nombre_questions: int, model_name: str = 'gemini-1.5-flash'):
    api_key = os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise RuntimeError('La clé GOOGLE_API_KEY est requise pour la génération Gemini.')

    try:
        from google import genai
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError(
            'Le SDK google-genai n\'est pas installé. Ajoutez google-genai au projet.'
        ) from exc

    client = genai.Client(api_key=api_key)
    prompt = f"""
Tu es un concepteur pédagogique expert.
Génère un quiz strictement au format JSON pour le module suivant.

Module: {module_title}
Résumé: {module_summary}
Nombre de questions: {nombre_questions}

Contraintes:
- Retourne uniquement du JSON valide, sans texte autour.
- Chaque question doit avoir:
  - texte
  - type_question (QCU ou QCM)
  - explication
  - points
  - ordre
  - options: liste de 4 réponses minimum
- Chaque option doit avoir: texte, est_correcte
- Au moins 1 bonne réponse par question.
- Pour QCU, une seule réponse correcte.
- Pour QCM, plusieurs réponses possibles.
- Structure attendue:
{{
  "titre": "...",
  "description": "...",
  "questions": [ ... ]
}}
""".strip()

    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
    )

    raw_text = getattr(response, 'text', '') or ''
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError('La réponse Gemini n\'est pas un JSON valide.') from exc

    return data
