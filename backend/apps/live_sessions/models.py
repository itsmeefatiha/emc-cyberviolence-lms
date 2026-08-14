import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.users.models import Utilisateur


class StatutSession(models.TextChoices):
    BROUILLON = 'BROUILLON', _('Brouillon')
    PLANIFIEE = 'PLANIFIEE', _('Planifiée')
    EN_COURS = 'EN_COURS', _('En cours')
    TERMINEE = 'TERMINEE', _('Terminée')
    ANNULEE = 'ANNULEE', _('Annulée')


class SessionLive(models.Model):
    """Session de formation en visioconférence, programmée et ciblée par profil."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    titre = models.CharField(max_length=255, verbose_name=_('Titre'))
    description = models.TextField(blank=True, default='', verbose_name=_('Description'))
    profil_cible = models.CharField(
        max_length=50,
        choices=Utilisateur.ProfilProfessionnel.choices,
        default=Utilisateur.ProfilProfessionnel.EDUCATEUR,
        verbose_name=_('Profil cible'),
    )
    formateur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sessions_live',
        verbose_name=_('Formateur'),
    )
    parcours = models.ForeignKey(
        'courses.Parcours',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sessions_live',
        verbose_name=_('Parcours lié'),
    )
    statut = models.CharField(
        max_length=20,
        choices=StatutSession.choices,
        default=StatutSession.BROUILLON,
        verbose_name=_('Statut'),
    )
    date_debut = models.DateTimeField(verbose_name=_('Date de début'))
    date_fin = models.DateTimeField(verbose_name=_('Date de fin'))
    room_name = models.CharField(
        max_length=120,
        unique=True,
        blank=True,
        default='',
        verbose_name=_('Identifiant de salle'),
        help_text=_('Salle vidéo intégrée générée automatiquement'),
    )
    url_visio = models.URLField(
        max_length=500,
        blank=True,
        default='',
        verbose_name=_('Lien externe (obsolète)'),
        help_text=_('Conservé pour compatibilité — la visio est désormais intégrée.'),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Session live')
        verbose_name_plural = _('Sessions live')
        ordering = ['date_debut']

    def __str__(self):
        return f'{self.titre} ({self.date_debut:%d/%m/%Y %H:%M})'

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = uuid.uuid4()
        if not self.room_name:
            self.room_name = f'emc{str(self.id).replace("-", "")}'
        super().save(*args, **kwargs)

    @property
    def is_joinable_now(self):
        """Rejoindre autorisé 15 min avant le début jusqu'à la fin."""
        if self.statut in (StatutSession.ANNULEE, StatutSession.TERMINEE, StatutSession.BROUILLON):
            return False
        now = timezone.now()
        window_start = self.date_debut - timedelta(minutes=15)
        return window_start <= now <= self.date_fin

    def sync_runtime_statut(self):
        """Passe PLANIFIEE → EN_COURS → TERMINEE selon l'horloge."""
        if self.statut in (StatutSession.BROUILLON, StatutSession.ANNULEE):
            return False
        now = timezone.now()
        new_statut = self.statut
        if now > self.date_fin:
            new_statut = StatutSession.TERMINEE
        elif self.date_debut <= now <= self.date_fin:
            new_statut = StatutSession.EN_COURS
        elif now < self.date_debut and self.statut == StatutSession.EN_COURS:
            new_statut = StatutSession.PLANIFIEE
        if new_statut != self.statut:
            self.statut = new_statut
            return True
        return False


class PresenceSession(models.Model):
    """Trace qu'un apprenant a rejoint une session."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        SessionLive,
        on_delete=models.CASCADE,
        related_name='presences',
        verbose_name=_('Session'),
    )
    apprenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='presences_sessions',
        verbose_name=_('Apprenant'),
    )
    date_join = models.DateTimeField(auto_now_add=True, verbose_name=_('Date de join'))

    class Meta:
        verbose_name = _('Présence session')
        verbose_name_plural = _('Présences sessions')
        unique_together = ('session', 'apprenant')
        ordering = ['-date_join']

    def __str__(self):
        return f'{self.apprenant} → {self.session.titre}'


class RoomPeer(models.Model):
    """Participant actuellement connecté à la salle WebRTC native."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        SessionLive,
        on_delete=models.CASCADE,
        related_name='room_peers',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='live_room_peers',
    )
    peer_id = models.CharField(max_length=64, db_index=True)
    display_name = models.CharField(max_length=150, blank=True, default='')
    is_moderator = models.BooleanField(default=False)
    camera_on = models.BooleanField(default=True)
    mic_on = models.BooleanField(default=True)
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Pair WebRTC')
        verbose_name_plural = _('Pairs WebRTC')
        unique_together = ('session', 'peer_id')
        ordering = ['-last_seen']

    def __str__(self):
        return f'{self.display_name or self.peer_id} @ {self.session.titre}'


class SignalMessage(models.Model):
    """File de messages de signalisation WebRTC (offer/answer/ICE)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        SessionLive,
        on_delete=models.CASCADE,
        related_name='signals',
    )
    from_peer_id = models.CharField(max_length=64, db_index=True)
    to_peer_id = models.CharField(max_length=64, db_index=True)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    consumed = models.BooleanField(default=False)

    class Meta:
        verbose_name = _('Signal WebRTC')
        verbose_name_plural = _('Signals WebRTC')
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['session', 'to_peer_id', 'consumed']),
        ]
