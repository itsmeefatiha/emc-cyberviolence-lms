from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.courses.models import Parcours, StatutPublication


@receiver(pre_save, sender=Parcours)
def parcours_capture_previous_statut(sender, instance, **kwargs):
    if not instance.pk:
        instance._notif_previous_statut = None
        return
    try:
        previous = (
            Parcours.objects.filter(pk=instance.pk)
            .values_list('statut', flat=True)
            .first()
        )
        instance._notif_previous_statut = previous
    except Exception:
        instance._notif_previous_statut = None


@receiver(post_save, sender=Parcours)
def parcours_notify_on_publish(sender, instance, created, **kwargs):
    """Déclenche les notifications dès qu'un parcours passe à PUBLIE."""
    previous = getattr(instance, '_notif_previous_statut', None)
    just_published = instance.statut == StatutPublication.PUBLIE and (
        created or previous != StatutPublication.PUBLIE
    )
    if not just_published:
        return

    from .services import notify_parcours_published

    notify_parcours_published(instance)


@receiver(post_save, sender=Parcours)
def parcours_notify_admins_on_create(sender, instance, created, **kwargs):
    """Alerte les admins quand un formateur crée un nouveau parcours."""
    if not created:
        return

    from .services import notify_admin_parcours_cree

    notify_admin_parcours_cree(instance)
