from __future__ import annotations

from django.db import transaction
from rest_framework import serializers

from apps.courses.models import Lecon, Module, Parcours

from .models import Certificat, Option, Question, Quiz, TentativeQuiz, TypeQuestion


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'question', 'texte', 'est_correcte']
        read_only_fields = ['id']


class OptionPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'texte']
        read_only_fields = ['id', 'texte']


class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'quiz', 'texte', 'type_question', 'explication', 'points', 'ordre', 'options']
        read_only_fields = ['id']


class QuestionPublicSerializer(serializers.ModelSerializer):
    options = OptionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'texte', 'type_question', 'points', 'ordre', 'options']
        read_only_fields = ['id']


class QuestionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['id', 'quiz', 'texte', 'type_question', 'explication', 'points', 'ordre']
        read_only_fields = ['id']


class QuizListSerializer(serializers.ModelSerializer):
    module_titre = serializers.CharField(source='module.titre', read_only=True)
    lecon_titre = serializers.CharField(source='lecon.titre', read_only=True)
    questions_count = serializers.IntegerField(source='questions.count', read_only=True)

    class Meta:
        model = Quiz
        fields = [
            'id',
            'module',
            'module_titre',
            'lecon',
            'lecon_titre',
            'titre',
            'description',
            'note_de_passage',
            'duree_minutes',
            'max_tentatives',
            'melange_questions',
            'questions_count',
            'date_creation',
        ]


class QuizDetailSerializer(serializers.ModelSerializer):
    module_titre = serializers.CharField(source='module.titre', read_only=True)
    lecon_titre = serializers.CharField(source='lecon.titre', read_only=True)
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Quiz
        fields = [
            'id',
            'module',
            'module_titre',
            'lecon',
            'lecon_titre',
            'titre',
            'description',
            'note_de_passage',
            'duree_minutes',
            'max_tentatives',
            'melange_questions',
            'questions',
            'date_creation',
        ]


class QuizTakeSerializer(serializers.ModelSerializer):
    module_titre = serializers.CharField(source='module.titre', read_only=True)
    lecon_titre = serializers.CharField(source='lecon.titre', read_only=True)
    questions = serializers.SerializerMethodField()
    deja_reussi = serializers.SerializerMethodField()
    meilleur_score = serializers.SerializerMethodField()
    tentatives_fenetre = serializers.SerializerMethodField()
    tentatives_restantes = serializers.SerializerMethodField()
    prochaine_tentative_at = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            'id',
            'titre',
            'description',
            'note_de_passage',
            'duree_minutes',
            'max_tentatives',
            'melange_questions',
            'module_titre',
            'lecon_titre',
            'questions',
            'deja_reussi',
            'meilleur_score',
            'tentatives_fenetre',
            'tentatives_restantes',
            'prochaine_tentative_at',
        ]

    def _window_attempts(self, obj):
        from datetime import timedelta

        from django.utils import timezone

        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return TentativeQuiz.objects.none()
        window_start = timezone.now() - timedelta(hours=24)
        return TentativeQuiz.objects.filter(
            apprenant=request.user,
            quiz=obj,
            date_soumission__gte=window_start,
        )

    def _all_attempts(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return TentativeQuiz.objects.none()
        return TentativeQuiz.objects.filter(apprenant=request.user, quiz=obj)

    def get_questions(self, obj):
        from .services import shuffle_quiz_payload

        # Si déjà réussi, pas besoin d'envoyer les questions
        if self.get_deja_reussi(obj):
            return []
        return shuffle_quiz_payload(obj, include_correct_answers=False)

    def get_deja_reussi(self, obj):
        return self._all_attempts(obj).filter(est_reussi=True).exists()

    def get_meilleur_score(self, obj):
        best = self._all_attempts(obj).order_by('-score_obtenu').first()
        return float(best.score_obtenu) if best else None

    def get_tentatives_fenetre(self, obj):
        return self._window_attempts(obj).count()

    def get_tentatives_restantes(self, obj):
        if self.get_deja_reussi(obj):
            return 0
        used = self._window_attempts(obj).count()
        return max(0, (obj.max_tentatives or 3) - used)

    def get_prochaine_tentative_at(self, obj):
        from datetime import timedelta

        if self.get_deja_reussi(obj):
            return None
        if self.get_tentatives_restantes(obj) > 0:
            return None
        oldest = self._window_attempts(obj).order_by('date_soumission').first()
        if not oldest:
            return None
        return oldest.date_soumission + timedelta(hours=24)


class QuizWriteSerializer(serializers.ModelSerializer):
    module = serializers.PrimaryKeyRelatedField(queryset=Module.objects.all(), required=False, allow_null=True)
    lecon = serializers.PrimaryKeyRelatedField(queryset=Lecon.objects.all(), required=False, allow_null=True)

    class Meta:
        model = Quiz
        fields = [
            'id',
            'module',
            'lecon',
            'titre',
            'description',
            'note_de_passage',
            'duree_minutes',
            'max_tentatives',
            'melange_questions',
            'date_creation',
        ]
        read_only_fields = ['id', 'date_creation']

    def validate(self, attrs):
        module = attrs.get('module', getattr(self.instance, 'module', None))
        lecon = attrs.get('lecon', getattr(self.instance, 'lecon', None))

        if not module and not lecon:
            raise serializers.ValidationError({'module': 'Un quiz doit être lié à un module ou à une leçon.'})

        if lecon and not module:
            module = lecon.module
            attrs['module'] = module

        if module and lecon and lecon.module_id != module.id:
            raise serializers.ValidationError({'lecon': 'La leçon doit appartenir au module sélectionné.'})

        request = self.context.get('request')
        if request and self.instance is None:
            from .services import user_can_manage_quiz

            if not user_can_manage_quiz(request.user, module=module):
                raise serializers.ValidationError(
                    {
                        'detail': (
                            "Vous ne pouvez pas créer un quiz pour ce module. "
                            "Seuls l'administrateur et le formateur propriétaire du parcours sont autorisés."
                        )
                    }
                )

            # Auto-claim si parcours orphelin
            if module and module.parcours_id and module.parcours.formateur_id is None:
                module.parcours.formateur = request.user
                module.parcours.save(update_fields=['formateur'])

        return attrs


class QuestionAnswerSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    option_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=True)


class QuizSubmissionSerializer(serializers.Serializer):
    answers = QuestionAnswerSerializer(many=True)
    temps_reponse_secondes = serializers.IntegerField(min_value=0, required=False, default=0)


class QuizGenerationSerializer(serializers.Serializer):
    module_id = serializers.UUIDField(required=False)
    module_titre = serializers.CharField(required=False, allow_blank=True)
    module_resume = serializers.CharField(required=False, allow_blank=True)
    nombre_questions = serializers.IntegerField(min_value=1, max_value=20, default=5)
    model_name = serializers.CharField(required=False, allow_blank=True, default='gemini-1.5-flash')


class TentativeQuizSerializer(serializers.ModelSerializer):
    quiz_titre = serializers.CharField(source='quiz.titre', read_only=True)

    class Meta:
        model = TentativeQuiz
        fields = [
            'id',
            'apprenant',
            'quiz',
            'quiz_titre',
            'score_obtenu',
            'points_obtenus',
            'est_reussi',
            'reponses_json',
            'temps_reponse_secondes',
            'date_soumission',
        ]
        read_only_fields = ['id', 'date_soumission', 'points_obtenus']


class CertificatSerializer(serializers.ModelSerializer):
    parcours_titre = serializers.CharField(source='parcours.titre', read_only=True)
    apprenant_nom = serializers.SerializerMethodField()

    class Meta:
        model = Certificat
        fields = [
            'id',
            'apprenant',
            'apprenant_nom',
            'parcours',
            'parcours_titre',
            'code_verification',
            'fichier_pdf',
            'date_emission',
        ]
        read_only_fields = ['id', 'date_emission']

    def get_apprenant_nom(self, obj):
        return obj.apprenant.get_full_name() or obj.apprenant.email
