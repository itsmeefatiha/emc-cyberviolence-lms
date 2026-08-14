import uuid
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.courses.models import Lecon, Parcours


class StatutProgression(models.TextChoices):
    NON_COMMENCE = 'NON_COMMENCE', _('Non commencé')
    EN_COURS = 'EN_COURS', _('En cours')
    TERMINE = 'TERMINE', _('Terminé')


class Inscription(models.Model):
    """Inscription formelle d'un apprenant à un parcours."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    apprenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='inscriptions',
        verbose_name=_('Apprenant'),
    )
    parcours = models.ForeignKey(
        Parcours,
        on_delete=models.CASCADE,
        related_name='inscriptions',
        verbose_name=_('Parcours'),
    )
    date_inscription = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_("Date d'inscription"),
    )

    class Meta:
        verbose_name = _('Inscription')
        verbose_name_plural = _('Inscriptions')
        unique_together = ('apprenant', 'parcours')
        ordering = ['-date_inscription']

    def __str__(self):
        return f'{self.apprenant} → {self.parcours.titre}'


class Favori(models.Model):
    """Parcours marqué comme favori par un apprenant."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    apprenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='favoris',
        verbose_name=_('Apprenant'),
    )
    parcours = models.ForeignKey(
        Parcours,
        on_delete=models.CASCADE,
        related_name='favoris',
        verbose_name=_('Parcours'),
    )
    date_ajout = models.DateTimeField(auto_now_add=True, verbose_name=_("Date d'ajout"))

    class Meta:
        verbose_name = _('Favori')
        verbose_name_plural = _('Favoris')
        unique_together = ('apprenant', 'parcours')
        ordering = ['-date_ajout']

    def __str__(self):
        return f'{self.apprenant} ♥ {self.parcours.titre}'


class ActiviteJournaliere(models.Model):
    """Cumul journalier du temps d'apprentissage (secondes) par apprenant."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    apprenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='activites_journalieres',
        verbose_name=_('Apprenant'),
    )
    date = models.DateField(verbose_name=_('Date'), db_index=True)
    secondes = models.PositiveIntegerField(
        default=0,
        verbose_name=_('Temps (s)'),
        help_text=_("Secondes d'apprentissage cumulées ce jour"),
    )

    class Meta:
        verbose_name = _('Activité journalière')
        verbose_name_plural = _('Activités journalières')
        unique_together = ('apprenant', 'date')
        ordering = ['-date']

    def __str__(self):
        return f'{self.apprenant} — {self.date}: {self.secondes}s'


class Progression(models.Model):
    """Suit l'état d'avancement d'un apprenant sur une leçon spécifique."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    apprenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='progressions',
        verbose_name=_('Apprenant'),
    )
    lecon = models.ForeignKey(
        Lecon,
        on_delete=models.CASCADE,
        related_name='progressions',
        verbose_name=_('Leçon'),
    )
    statut = models.CharField(
        max_length=20,
        choices=StatutProgression.choices,
        default=StatutProgression.NON_COMMENCE,
        verbose_name=_('Statut'),
    )
    temps_passe = models.PositiveIntegerField(
        default=0,
        help_text=_('Temps passé en secondes'),
        verbose_name=_('Temps passé (s)'),
    )
    date_dernier_activite = models.DateTimeField(
        null=True,
        blank=True,
        auto_now=True,
        verbose_name=_('Dernière activité'),
    )
    date_debut = models.DateTimeField(
        auto_now_add=True, verbose_name=_('Date de début')
    )
    date_fin = models.DateTimeField(
        null=True, blank=True, verbose_name=_('Date de fin')
    )

    class Meta:
        verbose_name = _('Progression')
        verbose_name_plural = _('Progressions')
        # Un apprenant ne peut avoir qu'une seule entrée de progression par leçon
        unique_together = ('apprenant', 'lecon')

    def __str__(self):
        return f'{self.apprenant} - {self.lecon.titre} [{self.statut}]'