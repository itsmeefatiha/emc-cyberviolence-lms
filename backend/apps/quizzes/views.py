from __future__ import annotations

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.courses.models import Module, Parcours
from apps.progression.models import Progression, StatutProgression

from .models import Certificat, Option, Question, Quiz, TentativeQuiz
from .permissions import IsManagerOrReadOnly
from .serializers import (
    CertificatSerializer,
    OptionSerializer,
    QuestionSerializer,
    QuestionWriteSerializer,
    QuizDetailSerializer,
    QuizGenerationSerializer,
    QuizListSerializer,
    QuizSubmissionSerializer,
    QuizTakeSerializer,
    QuizWriteSerializer,
    TentativeQuizSerializer,
)
from .services import build_gemini_quiz, calculate_quiz_attempt, issue_certificate_if_completed, mark_module_progression_complete, user_can_manage_quiz


class QuizViewSet(viewsets.ModelViewSet):
    queryset = Quiz.objects.select_related('module', 'lecon', 'module__parcours', 'lecon__module__parcours').prefetch_related(
        'questions__options'
    )
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in {'create', 'update', 'partial_update', 'destroy', 'generate_ai'}:
            return [IsAuthenticated(), IsManagerOrReadOnly()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action in {'create', 'update', 'partial_update'}:
            return QuizWriteSerializer
        if self.action == 'retrieve':
            return QuizDetailSerializer
        if self.action == 'take':
            return QuizTakeSerializer
        if self.action == 'generate_ai':
            return QuizGenerationSerializer
        return QuizListSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        user_role = getattr(user, 'role', None)

        if user.is_staff or user_role in ['ADMIN', 'FORMATEUR']:
            return queryset

        # Les apprenants ne voient que les quiz liés aux modules publiés.
        return queryset.filter(module__parcours__statut='PUBLIE')

    def perform_create(self, serializer):
        quiz = serializer.save()
        if quiz.lecon_id and not quiz.module_id:
            quiz.module = quiz.lecon.module
            quiz.save(update_fields=['module'])

        # Si le parcours n'a pas encore de formateur, on l'assigne au créateur du quiz
        parcours = quiz.parcours
        if parcours and parcours.formateur_id is None and self.request.user.is_authenticated:
            parcours.formateur = self.request.user
            parcours.save(update_fields=['formateur'])

    def perform_update(self, serializer):
        if not user_can_manage_quiz(self.request.user, quiz=serializer.instance):
            raise PermissionDenied('Vous ne pouvez pas modifier ce quiz.')
        quiz = serializer.save()
        if quiz.lecon_id and not quiz.module_id:
            quiz.module = quiz.lecon.module
            quiz.save(update_fields=['module'])

    def perform_destroy(self, instance):
        if not user_can_manage_quiz(self.request.user, quiz=instance):
            raise PermissionDenied('Vous ne pouvez pas supprimer ce quiz.')
        instance.delete()

    @action(detail=True, methods=['get'])
    def take(self, request, pk=None):
        quiz = self.get_object()
        serializer = QuizTakeSerializer(quiz, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='generate-ai')
    def generate_ai(self, request):
        serializer = QuizGenerationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.is_staff and getattr(user, 'role', None) != 'FORMATEUR':
            return Response({'detail': 'Réservé aux formateurs et administrateurs.'}, status=status.HTTP_403_FORBIDDEN)

        module = None
        module_id = serializer.validated_data.get('module_id')
        if module_id:
            module = get_object_or_404(Module.objects.select_related('parcours'), id=module_id)
            if not user_can_manage_quiz(user, module=module):
                return Response({'detail': 'Vous ne pouvez pas générer un quiz pour ce module.'}, status=status.HTTP_403_FORBIDDEN)

        module_title = serializer.validated_data.get('module_titre') or (module.titre if module else '')
        module_resume = serializer.validated_data.get('module_resume') or (module.description if module else '')
        nombre_questions = serializer.validated_data['nombre_questions']
        model_name = serializer.validated_data.get('model_name') or 'gemini-1.5-flash'

        try:
            generated = build_gemini_quiz(module_title, module_resume, nombre_questions, model_name=model_name)
        except RuntimeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response(generated)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        from datetime import timedelta

        quiz = self.get_object()
        serializer = QuizSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Déjà réussi → pas de nouvelle tentative
        if TentativeQuiz.objects.filter(apprenant=request.user, quiz=quiz, est_reussi=True).exists():
            return Response(
                {'detail': 'Vous avez déjà validé ce quiz.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fenêtre glissante de 24h pour le quota de tentatives
        window_start = timezone.now() - timedelta(hours=24)
        recent_attempts = TentativeQuiz.objects.filter(
            apprenant=request.user,
            quiz=quiz,
            date_soumission__gte=window_start,
        )
        max_attempts = quiz.max_tentatives or 3
        if recent_attempts.count() >= max_attempts:
            oldest = recent_attempts.order_by('date_soumission').first()
            next_at = oldest.date_soumission + timedelta(hours=24) if oldest else None
            return Response(
                {
                    'detail': (
                        'Nombre maximal de tentatives atteint. '
                        'Vos tentatives se rechargent 24 heures après la première de la série.'
                    ),
                    'prochaine_tentative_at': next_at,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = calculate_quiz_attempt(quiz, serializer.validated_data['answers'])
        attempt = TentativeQuiz.objects.create(
            apprenant=request.user,
            quiz=quiz,
            score_obtenu=result['score_obtenu'],
            points_obtenus=result['points_obtenus'],
            est_reussi=result['est_reussi'],
            reponses_json=request.data.get('answers', []),
            temps_reponse_secondes=serializer.validated_data.get('temps_reponse_secondes', 0),
        )

        module_validation = None
        certificate = None

        if result['est_reussi'] and quiz.module_id:
            # La réussite du quiz valide automatiquement la progression du module.
            mark_module_progression_complete(request.user, quiz.module)
            module_validation = {
                'module_id': str(quiz.module.id),
                'module_titre': quiz.module.titre,
                'est_valide': True,
            }
            certificate = issue_certificate_if_completed(request.user, quiz.module.parcours)

        response_payload = {
            'tentative': TentativeQuizSerializer(attempt).data,
            'score_detail': result,
            'module_validation': module_validation,
            'certificat': CertificatSerializer(certificate).data if certificate else None,
        }
        return Response(response_payload, status=status.HTTP_201_CREATED)


class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.select_related('quiz', 'quiz__module', 'quiz__lecon').prefetch_related('options')
    permission_classes = [IsAuthenticated, IsManagerOrReadOnly]

    def get_serializer_class(self):
        if self.action in {'create', 'update', 'partial_update'}:
            return QuestionWriteSerializer
        return QuestionSerializer

    def perform_create(self, serializer):
        quiz = serializer.validated_data['quiz']
        if not user_can_manage_quiz(self.request.user, quiz=quiz):
            raise PermissionDenied('Vous ne pouvez pas modifier ce quiz.')
        serializer.save()

    def perform_update(self, serializer):
        quiz = serializer.validated_data.get('quiz') or serializer.instance.quiz
        if not user_can_manage_quiz(self.request.user, quiz=quiz):
            raise PermissionDenied('Vous ne pouvez pas modifier ce quiz.')
        serializer.save()

    def perform_destroy(self, instance):
        if not user_can_manage_quiz(self.request.user, quiz=instance.quiz):
            raise PermissionDenied('Vous ne pouvez pas modifier ce quiz.')
        instance.delete()


class OptionViewSet(viewsets.ModelViewSet):
    queryset = Option.objects.select_related('question', 'question__quiz')
    serializer_class = OptionSerializer
    permission_classes = [IsAuthenticated, IsManagerOrReadOnly]

    def perform_create(self, serializer):
        question = serializer.validated_data['question']
        if not user_can_manage_quiz(self.request.user, quiz=question.quiz):
            raise PermissionDenied('Vous ne pouvez pas modifier ce quiz.')
        serializer.save()

    def perform_update(self, serializer):
        question = serializer.validated_data.get('question') or serializer.instance.question
        if not user_can_manage_quiz(self.request.user, quiz=question.quiz):
            raise PermissionDenied('Vous ne pouvez pas modifier ce quiz.')
        serializer.save()

    def perform_destroy(self, instance):
        if not user_can_manage_quiz(self.request.user, quiz=instance.question.quiz):
            raise PermissionDenied('Vous ne pouvez pas modifier ce quiz.')
        instance.delete()


class TentativeQuizViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TentativeQuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        user_role = getattr(user, 'role', None)
        queryset = TentativeQuiz.objects.select_related('apprenant', 'quiz', 'quiz__module', 'quiz__module__parcours')

        if user.is_staff or user_role in ['ADMIN', 'FORMATEUR']:
            return queryset

        return queryset.filter(apprenant=user)


class CertificatViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CertificatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        user_role = getattr(user, 'role', None)
        queryset = Certificat.objects.select_related('apprenant', 'parcours', 'parcours__formateur')

        if user.is_staff or user_role in ['ADMIN', 'FORMATEUR']:
            return queryset

        return queryset.filter(apprenant=user)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        certificat = self.get_object()
        if not certificat.fichier_pdf:
            return Response({'detail': 'Le certificat PDF n\'a pas encore été généré.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({'download_url': certificat.fichier_pdf.url, 'code_verification': certificat.code_verification})
