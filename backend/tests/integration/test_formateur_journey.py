"""Intégration formateur : construire un parcours publiable + quiz + session live."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from apps.courses.models import ContenuTexte, Parcours, StatutPublication
from apps.live_sessions.models import SessionLive
from apps.notifications.models import Notification, TypeNotification
from apps.quizzes.models import Option, Question, Quiz
from apps.users.factories import UserFactory
from tests.integration.conftest import (
    LECONS_URL,
    MODULES_URL,
    OPTIONS_URL,
    PARCOURS_URL,
    QUESTIONS_URL,
    QUIZZES_URL,
    SESSIONS_URL,
    jwt_login,
    results,
)

pytestmark = pytest.mark.django_db


class TestFormateurCourseBuilderIntegration:
    def test_build_publish_quiz_and_live_session(self, api_client, formateur):
        # Apprenant ciblé pour recevoir les notifications de publication
        learner = UserFactory(
            email='notif.target@example.com',
            username='notif_target',
            profil_professionnel='EDUCATEUR',
            is_active=True,
        )

        jwt_login(api_client, formateur.email)

        # 1) Créer parcours brouillon
        parcours_resp = api_client.post(
            PARCOURS_URL,
            {
                'titre': 'Parcours Intégration Cyber',
                'description': 'Formation test E2E',
                'profil_cible': 'EDUCATEUR',
                'statut': 'BROUILLON',
            },
            format='json',
        )
        assert parcours_resp.status_code == status.HTTP_201_CREATED
        parcours_id = parcours_resp.data['id']

        # 2) Module
        module_resp = api_client.post(
            MODULES_URL,
            {
                'parcours': parcours_id,
                'titre': 'Module 1 — Bases',
                'description': 'Intro',
                'ordre': 1,
            },
            format='json',
        )
        assert module_resp.status_code == status.HTTP_201_CREATED
        module_id = module_resp.data['id']

        # 3) Leçon avec contenu texte
        lecon_resp = api_client.post(
            LECONS_URL,
            {
                'module': module_id,
                'titre': 'Leçon 1 — Concepts',
                'duree_estimee': 20,
                'ordre': 1,
                'contenu_type': 'TEXTE',
                'contenu_titre_fichier': 'Concepts',
                'contenu_corps': 'Contenu pédagogique de test.',
            },
            format='json',
        )
        assert lecon_resp.status_code == status.HTTP_201_CREATED
        lecon_id = lecon_resp.data['id']
        assert ContenuTexte.objects.filter(lecon_id=lecon_id).exists()

        # 4) Publier
        publish = api_client.patch(
            f'{PARCOURS_URL}{parcours_id}/',
            {'statut': 'PUBLIE'},
            format='json',
        )
        assert publish.status_code == status.HTTP_200_OK
        parcours = Parcours.objects.get(id=parcours_id)
        assert parcours.statut == StatutPublication.PUBLIE

        # Notification cross-app (signal → notifications)
        assert Notification.objects.filter(
            destinataire=learner,
            type_notification=TypeNotification.PARCOURS_PUBLIE,
            parcours_id=parcours_id,
        ).exists()

        # 5) Quiz + question + options
        quiz_resp = api_client.post(
            QUIZZES_URL,
            {
                'module': module_id,
                'titre': 'Quiz Module 1',
                'note_de_passage': 50,
                'duree_minutes': 15,
                'max_tentatives': 3,
                'melange_questions': False,
            },
            format='json',
        )
        assert quiz_resp.status_code == status.HTTP_201_CREATED
        quiz_id = quiz_resp.data['id']

        question_resp = api_client.post(
            QUESTIONS_URL,
            {
                'quiz': quiz_id,
                'texte': 'La cyberviolence concerne uniquement les mineurs ?',
                'type_question': 'QCU',
                'points': 1,
                'ordre': 1,
            },
            format='json',
        )
        assert question_resp.status_code == status.HTTP_201_CREATED
        question_id = question_resp.data['id']

        correct = api_client.post(
            OPTIONS_URL,
            {'question': question_id, 'texte': 'Non', 'est_correcte': True},
            format='json',
        )
        wrong = api_client.post(
            OPTIONS_URL,
            {'question': question_id, 'texte': 'Oui', 'est_correcte': False},
            format='json',
        )
        assert correct.status_code == status.HTTP_201_CREATED
        assert wrong.status_code == status.HTTP_201_CREATED
        assert Quiz.objects.filter(id=quiz_id).exists()
        assert Question.objects.filter(id=question_id).count() == 1
        assert Option.objects.filter(question_id=question_id).count() == 2

        # 6) Session live planifiée
        debut = timezone.now() + timedelta(days=2)
        fin = debut + timedelta(hours=2)
        session_resp = api_client.post(
            SESSIONS_URL,
            {
                'titre': 'Visio de suivi',
                'description': 'Session live intégration',
                'profil_cible': 'EDUCATEUR',
                'statut': 'PLANIFIEE',
                'parcours': parcours_id,
                'date_debut': debut.isoformat(),
                'date_fin': fin.isoformat(),
            },
            format='json',
        )
        assert session_resp.status_code == status.HTTP_201_CREATED
        session = SessionLive.objects.get(id=session_resp.data['id'])
        assert session.formateur_id == formateur.id
        assert session.room_name

        assert Notification.objects.filter(
            destinataire=learner,
            type_notification=TypeNotification.SESSION_LIVE,
            lien=f'/live-sessions?session={session.id}',
        ).exists()

        # 7) Formateur liste ses parcours / sessions
        listed = api_client.get(PARCOURS_URL)
        assert listed.status_code == status.HTTP_200_OK
        titres = [p['titre'] for p in results(listed)]
        assert 'Parcours Intégration Cyber' in titres

        sessions = api_client.get(SESSIONS_URL)
        assert sessions.status_code == status.HTTP_200_OK
        session_titres = [s['titre'] for s in results(sessions)]
        assert 'Visio de suivi' in session_titres
