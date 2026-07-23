import uuid
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.courses.models import Lecon


class StatutProgression(models.TextChoices):
    NON_COMMENCE = 'NON_COMMENCE', _('Non commencé')
    EN_COURS = 'EN_COURS', _('En cours')
    TERMINE = 'TERMINE', _('Terminé')


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