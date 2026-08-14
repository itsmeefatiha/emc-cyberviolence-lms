import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.courses.models import Parcours


class TypeNotification(models.TextChoices):
    # Apprenant
    PARCOURS_PUBLIE = 'PARCOURS_PUBLIE', _('Nouveau parcours publié')
    SESSION_LIVE = 'SESSION_LIVE', _('Session live')
    CERTIFICAT = 'CERTIFICAT', _('Certificat disponible')
    QUIZ = 'QUIZ', _('Quiz')
    SYSTEME = 'SYSTEME', _('Système')
    # Formateur
    INSCRIPTION = 'INSCRIPTION', _('Nouvelle inscription')
    MESSAGE = 'MESSAGE', _('Nouveau message')
    SESSION_RAPPEL = 'SESSION_RAPPEL', _('Rappel session live')
    # Administrateur
    PARCOURS_CREE = 'PARCOURS_CREE', _('Parcours créé (modération)')


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    destinataire = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name=_('Destinataire'),
    )
    titre = models.CharField(max_length=255, verbose_name=_('Titre'))
    message = models.TextField(verbose_name=_('Message'))
    type_notification = models.CharField(
        max_length=30,
        choices=TypeNotification.choices,
        default=TypeNotification.SYSTEME,
        verbose_name=_('Type'),
    )
    parcours = models.ForeignKey(
        Parcours,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
        verbose_name=_('Parcours'),
    )
    lien = models.CharField(max_length=500, blank=True, default='', verbose_name=_('Lien'))
    est_lue = models.BooleanField(default=False, verbose_name=_('Lue'))
    date_creation = models.DateTimeField(auto_now_add=True, verbose_name=_('Date'))

    class Meta:
        verbose_name = _('Notification')
        verbose_name_plural = _('Notifications')
        ordering = ['-date_creation']

    def __str__(self):
        return f'{self.titre} → {self.destinataire}'
