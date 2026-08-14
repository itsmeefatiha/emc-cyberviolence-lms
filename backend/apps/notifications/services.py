import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone as dj_timezone

from apps.courses.models import StatutPublication

from .models import Notification, TypeNotification


def _display_name(user):
    if not user:
        return 'Utilisateur'
    full = f'{user.first_name or ""} {user.last_name or ""}'.strip()
    return full or user.email or 'Utilisateur'


def _create_notification(
    *,
    destinataire,
    titre,
    message,
    type_notification,
    parcours=None,
    lien='',
):
    if not destinataire or not getattr(destinataire, 'is_active', True):
        return None
    return Notification.objects.create(
        id=uuid.uuid4(),
        destinataire=destinataire,
        titre=titre,
        message=message,
        type_notification=type_notification,
        parcours=parcours,
        lien=lien or '',
    )


def notify_parcours_published(parcours):
    """Notifie les apprenants ciblés qu'un nouveau parcours est publié.

    Destinataires : apprenants actifs dont le profil correspond au parcours,
    ou sans profil renseigné. Évite les doublons pour un même parcours.
    """
    if not parcours or parcours.statut != StatutPublication.PUBLIE:
        return 0

    User = get_user_model()
    recipients = User.objects.filter(role='APPRENANT', is_active=True)

    if parcours.profil_cible:
        recipients = recipients.filter(
            Q(profil_professionnel=parcours.profil_cible)
            | Q(profil_professionnel__isnull=True)
            | Q(profil_professionnel='')
        )

    already_notified = set(
        Notification.objects.filter(
            parcours=parcours,
            type_notification=TypeNotification.PARCOURS_PUBLIE,
        ).values_list('destinataire_id', flat=True)
    )

    notifications = []
    for user in recipients.iterator():
        if user.id in already_notified:
            continue
        notifications.append(
            Notification(
                id=uuid.uuid4(),
                destinataire=user,
                titre='Nouveau parcours disponible',
                message=(
                    f'Le parcours « {parcours.titre} » vient d\'être publié. '
                    f'Inscrivez-vous pour commencer votre formation.'
                ),
                type_notification=TypeNotification.PARCOURS_PUBLIE,
                parcours=parcours,
                lien=f'/courses/{parcours.id}',
            )
        )

    if not notifications:
        return 0

    Notification.objects.bulk_create(notifications)
    return len(notifications)


def notify_session_live_published(session):
    """Notifie les apprenants ciblés qu'une session live est planifiée."""
    from apps.live_sessions.models import StatutSession

    if not session or session.statut != StatutSession.PLANIFIEE:
        return 0

    User = get_user_model()
    recipients = User.objects.filter(role='APPRENANT', is_active=True)

    if session.profil_cible:
        recipients = recipients.filter(
            Q(profil_professionnel=session.profil_cible)
            | Q(profil_professionnel__isnull=True)
            | Q(profil_professionnel='')
        )

    already_notified = set(
        Notification.objects.filter(
            type_notification=TypeNotification.SESSION_LIVE,
            lien=f'/live-sessions?session={session.id}',
        ).values_list('destinataire_id', flat=True)
    )

    debut = timezone_format(session.date_debut)
    notifications = []
    for user in recipients.iterator():
        if user.id in already_notified:
            continue
        notifications.append(
            Notification(
                id=uuid.uuid4(),
                destinataire=user,
                titre='Nouvelle session live',
                message=(
                    f'La session « {session.titre} » est programmée le {debut}. '
                    f'Rejoignez-la depuis vos sessions live.'
                ),
                type_notification=TypeNotification.SESSION_LIVE,
                lien=f'/live-sessions?session={session.id}',
            )
        )

    if not notifications:
        return 0

    Notification.objects.bulk_create(notifications)
    return len(notifications)


def notify_formateur_inscription(inscription):
    """Alerte le formateur qu'un apprenant s'est inscrit à son parcours."""
    parcours = getattr(inscription, 'parcours', None)
    apprenant = getattr(inscription, 'apprenant', None)
    formateur = getattr(parcours, 'formateur', None) if parcours else None
    if not formateur or not apprenant or not parcours:
        return None
    if formateur.id == apprenant.id:
        return None

    return _create_notification(
        destinataire=formateur,
        titre='Nouvelle inscription',
        message=(
            f'{_display_name(apprenant)} s\'est inscrit au parcours « {parcours.titre} ».'
        ),
        type_notification=TypeNotification.INSCRIPTION,
        parcours=parcours,
        lien='/instructor/analytics',
    )


def notify_formateur_nouveau_message(message):
    """Alerte le formateur lorsqu'un apprenant lui envoie un message."""
    conversation = getattr(message, 'conversation', None)
    sender = getattr(message, 'sender', None)
    if not conversation or not sender:
        return None

    # Uniquement apprenant → formateur
    if sender.id != conversation.apprenant_id:
        return None

    formateur = conversation.formateur
    preview = (message.body or '').strip()
    if len(preview) > 120:
        preview = preview[:117] + '…'

    return _create_notification(
        destinataire=formateur,
        titre='Nouveau message',
        message=(
            f'{_display_name(sender)} vous a écrit : « {preview} »'
            if preview
            else f'{_display_name(sender)} vous a envoyé un message.'
        ),
        type_notification=TypeNotification.MESSAGE,
        lien='/chat',
    )


def notify_admin_parcours_cree(parcours):
    """Alerte les administrateurs qu'un formateur a créé un nouveau parcours."""
    if not parcours:
        return 0

    formateur = parcours.formateur
    if not formateur or getattr(formateur, 'role', None) != 'FORMATEUR':
        return 0

    User = get_user_model()
    admins = User.objects.filter(is_active=True).filter(
        Q(role='ADMIN') | Q(is_staff=True)
    )

    lien = f'/admin/courses'
    already = set(
        Notification.objects.filter(
            type_notification=TypeNotification.PARCOURS_CREE,
            parcours=parcours,
        ).values_list('destinataire_id', flat=True)
    )

    notifications = []
    for admin in admins.iterator():
        if admin.id in already:
            continue
        if formateur and admin.id == formateur.id:
            continue
        notifications.append(
            Notification(
                id=uuid.uuid4(),
                destinataire=admin,
                titre='Nouveau parcours à modérer',
                message=(
                    f'Le formateur {_display_name(formateur)} a créé le parcours '
                    f'« {parcours.titre} ».'
                ),
                type_notification=TypeNotification.PARCOURS_CREE,
                parcours=parcours,
                lien=lien,
            )
        )

    if not notifications:
        return 0
    Notification.objects.bulk_create(notifications)
    return len(notifications)


def notify_formateur_session_rappel(session):
    """Rappel formateur 15 minutes avant le début de sa session live."""
    from apps.live_sessions.models import StatutSession

    if not session or not session.formateur_id:
        return None
    if session.statut not in (StatutSession.PLANIFIEE, StatutSession.EN_COURS):
        return None

    lien = f'/instructor/live-sessions?session={session.id}'
    already = Notification.objects.filter(
        destinataire_id=session.formateur_id,
        type_notification=TypeNotification.SESSION_RAPPEL,
        lien=lien,
    ).exists()
    if already:
        return None

    debut = timezone_format(session.date_debut)
    return _create_notification(
        destinataire=session.formateur,
        titre='Rappel visioconférence',
        message=(
            f'Votre session « {session.titre} » commence dans 15 minutes'
            f'{f" ({debut})" if debut else ""}.'
        ),
        type_notification=TypeNotification.SESSION_RAPPEL,
        parcours=getattr(session, 'parcours', None),
        lien=lien,
    )


def send_upcoming_session_reminders(*, window_minutes=15, skew_minutes=1):
    """Envoie les rappels formateur pour les sessions dans la fenêtre -15 min.

    À exécuter périodiquement (ex. chaque minute) :
    ``python manage.py send_session_reminders``
    """
    from apps.live_sessions.models import SessionLive, StatutSession

    now = dj_timezone.now()
    window_start = now + timedelta(minutes=max(window_minutes - skew_minutes, 0))
    window_end = now + timedelta(minutes=window_minutes + skew_minutes)

    sessions = (
        SessionLive.objects.filter(
            statut__in=[StatutSession.PLANIFIEE, StatutSession.EN_COURS],
            date_debut__gte=window_start,
            date_debut__lte=window_end,
        )
        .select_related('formateur', 'parcours')
    )

    sent = 0
    for session in sessions:
        if notify_formateur_session_rappel(session):
            sent += 1
    return sent


def timezone_format(dt):
    if not dt:
        return ''
    try:
        local = dj_timezone.localtime(dt) if dj_timezone.is_aware(dt) else dt
        return local.strftime('%d/%m/%Y à %H:%M')
    except Exception:
        return str(dt)
