from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import SessionLive, StatutSession


@receiver(pre_save, sender=SessionLive)
def session_capture_previous_statut(sender, instance, **kwargs):
    if not instance.pk:
        instance._notif_previous_statut = None
        return
    try:
        previous = (
            SessionLive.objects.filter(pk=instance.pk)
            .values_list('statut', flat=True)
            .first()
        )
        instance._notif_previous_statut = previous
    except Exception:
        instance._notif_previous_statut = None


@receiver(post_save, sender=SessionLive)
def session_notify_on_publish(sender, instance, created, **kwargs):
    """Notifie les apprenants quand une session passe en PLANIFIEE."""
    previous = getattr(instance, '_notif_previous_statut', None)
    just_published = instance.statut == StatutSession.PLANIFIEE and (
        created or previous != StatutSession.PLANIFIEE
    )
    if not just_published:
        return

    from apps.notifications.services import notify_session_live_published

    notify_session_live_published(instance)
