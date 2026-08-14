import uuid

from django.core.exceptions import ValidationError
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.courses.models import Lecon, Module, Parcours


class TypeQuestion(models.TextChoices):
    QCU = 'QCU', _('Choix unique')
    QCM = 'QCM', _('Choix multiple')


class Quiz(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name='quizzes',
        null=True,
        blank=True,
        verbose_name=_('Module'),
    )
    lecon = models.ForeignKey(
        Lecon,
        on_delete=models.CASCADE,
        related_name='quizzes_for_lecon',
        null=True,
        blank=True,
        verbose_name=_('Leçon'),
    )
    titre = models.CharField(max_length=255, verbose_name=_('Titre'))
    description = models.TextField(blank=True, verbose_name=_('Description'))
    note_de_passage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=80,
        verbose_name=_('Note de passage (%)'),
    )
    duree_minutes = models.PositiveIntegerField(
        default=30,
        verbose_name=_('Durée limite (minutes)'),
    )
    max_tentatives = models.PositiveIntegerField(default=3, verbose_name=_('Nombre max de tentatives'))
    melange_questions = models.BooleanField(default=True, verbose_name=_('Mélanger les questions'))
    date_creation = models.DateTimeField(auto_now_add=True, verbose_name=_('Date de création'))

    class Meta:
        verbose_name = _('Quiz')
        verbose_name_plural = _('Quizzes')
        ordering = ['-date_creation']

    def __str__(self):
        return self.titre

    def save(self, *args, **kwargs):
        if self.lecon and not self.module:
            self.module = self.lecon.module
        super().save(*args, **kwargs)

    def clean(self):
        if not self.module and not self.lecon:
            raise ValidationError('Un quiz doit être rattaché à un module ou à une leçon.')
        if self.module and self.lecon and self.lecon.module_id != self.module_id:
            raise ValidationError('La leçon sélectionnée doit appartenir au module du quiz.')

    @property
    def parcours(self):
        if self.module_id:
            return self.module.parcours
        if self.lecon_id:
            return self.lecon.module.parcours
        return None


class Question(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='questions', verbose_name=_('Quiz'))
    texte = models.TextField(verbose_name=_('Texte'))
    type_question = models.CharField(max_length=3, choices=TypeQuestion.choices, verbose_name=_('Type'))
    explication = models.TextField(blank=True, verbose_name=_('Explication'))
    points = models.PositiveIntegerField(default=1, verbose_name=_('Points'))
    ordre = models.PositiveIntegerField(default=1, verbose_name=_('Ordre'))

    class Meta:
        verbose_name = _('Question')
        verbose_name_plural = _('Questions')
        ordering = ['ordre', 'id']

    def __str__(self):
        return f'{self.quiz.titre} - Q{self.ordre}'


class Option(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options', verbose_name=_('Question'))
    texte = models.CharField(max_length=500, verbose_name=_('Texte'))
    est_correcte = models.BooleanField(default=False, verbose_name=_('Est correcte'))

    class Meta:
        verbose_name = _('Option')
        verbose_name_plural = _('Options')
        ordering = ['id']

    def __str__(self):
        return self.texte


class TentativeQuiz(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    apprenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tentatives_quiz',
        verbose_name=_('Apprenant'),
    )
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='tentatives', verbose_name=_('Quiz'))
    score_obtenu = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name=_('Score obtenu (%)'))
    points_obtenus = models.DecimalField(max_digits=8, decimal_places=2, default=0, verbose_name=_('Points obtenus'))
    est_reussi = models.BooleanField(default=False, verbose_name=_('Réussi'))
    reponses_json = models.JSONField(default=list, blank=True, verbose_name=_('Réponses fournies'))
    temps_reponse_secondes = models.PositiveIntegerField(default=0, verbose_name=_('Temps de réponse (s)'))
    date_soumission = models.DateTimeField(auto_now_add=True, verbose_name=_('Date de soumission'))

    class Meta:
        verbose_name = _('Tentative de quiz')
        verbose_name_plural = _('Tentatives de quiz')
        ordering = ['-date_soumission']
        constraints = [
            models.UniqueConstraint(
                fields=['apprenant', 'quiz', 'date_soumission'],
                name='unique_attempt_per_timestamp',
            )
        ]

    def __str__(self):
        return f'{self.apprenant} - {self.quiz.titre} ({self.score_obtenu}%)'


class Certificat(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    apprenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='certificats',
        verbose_name=_('Apprenant'),
    )
    parcours = models.ForeignKey(Parcours, on_delete=models.CASCADE, related_name='certificats', verbose_name=_('Parcours'))
    code_verification = models.CharField(max_length=64, unique=True, db_index=True, verbose_name=_('Code de vérification'))
    fichier_pdf = models.FileField(upload_to='certificats/', blank=True, null=True, verbose_name=_('Fichier PDF'))
    date_emission = models.DateTimeField(auto_now_add=True, verbose_name=_('Date d’émission'))

    class Meta:
        verbose_name = _('Certificat')
        verbose_name_plural = _('Certificats')
        ordering = ['-date_emission']
        constraints = [
            models.UniqueConstraint(fields=['apprenant', 'parcours'], name='unique_certificate_per_parcours')
        ]

    def __str__(self):
        return f'Certificat {self.parcours.titre} - {self.apprenant}'
