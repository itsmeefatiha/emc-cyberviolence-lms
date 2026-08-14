from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.chat.factories import ChatMessageFactory, ConversationFactory
from apps.courses.factories import ParcoursFactory
from apps.courses.models import StatutPublication
from apps.live_sessions.factories import SessionLiveFactory
from apps.live_sessions.models import StatutSession
from apps.notifications.factories import NotificationFactory
from apps.notifications.models import Notification, TypeNotification
from apps.notifications.services import (
    notify_admin_parcours_cree,
    notify_formateur_inscription,
    notify_formateur_nouveau_message,
    notify_formateur_session_rappel,
    notify_parcours_published,
    notify_session_live_published,
    send_upcoming_session_reminders,
)
from apps.progression.factories import InscriptionFactory
from apps.users.factories import UserFactory

pytestmark = pytest.mark.django_db

NOTIFICATIONS_URL = '/api/v1/notifications/'


@pytest.fixture
def api_client():
    return APIClient()


class TestNotificationModel:
    def test_str(self):
        notif = NotificationFactory(titre='Alerte')
        assert 'Alerte' in str(notif)


class TestNotificationServices:
    def test_notify_parcours_published_targets_matching_profil(self):
        matching = UserFactory(profil_professionnel='EDUCATEUR', is_active=True)
        other = UserFactory(profil_professionnel='MAGISTRAT', is_active=True)
        parcours = ParcoursFactory(brouillon=True, profil_cible='EDUCATEUR')
        parcours.statut = StatutPublication.PUBLIE
        created = notify_parcours_published(parcours)
        assert created >= 1
        assert Notification.objects.filter(
            destinataire=matching,
            type_notification=TypeNotification.PARCOURS_PUBLIE,
            parcours=parcours,
        ).exists()
        assert not Notification.objects.filter(destinataire=other, parcours=parcours).exists()

    def test_notify_parcours_published_skips_draft(self):
        UserFactory(profil_professionnel='EDUCATEUR', is_active=True)
        parcours = ParcoursFactory(brouillon=True, profil_cible='EDUCATEUR')
        assert notify_parcours_published(parcours) == 0

    def test_notify_parcours_published_dedupes(self):
        UserFactory(profil_professionnel='EDUCATEUR', is_active=True)
        parcours = ParcoursFactory(brouillon=True, profil_cible='EDUCATEUR')
        parcours.statut = StatutPublication.PUBLIE
        first = notify_parcours_published(parcours)
        second = notify_parcours_published(parcours)
        assert first >= 1
        assert second == 0

    def test_notify_session_live_published(self):
        UserFactory(profil_professionnel='EDUCATEUR', is_active=True)
        session = SessionLiveFactory(
            profil_cible='EDUCATEUR',
            brouillon=True,
        )
        session.statut = StatutSession.PLANIFIEE
        created = notify_session_live_published(session)
        assert created >= 1
        assert Notification.objects.filter(
            type_notification=TypeNotification.SESSION_LIVE,
            lien=f'/live-sessions?session={session.id}',
        ).exists()

    def test_notify_formateur_inscription(self):
        formateur = UserFactory(formateur=True)
        apprenant = UserFactory(first_name='Sara', last_name='Alami')
        parcours = ParcoursFactory(formateur=formateur, brouillon=True)
        inscription = InscriptionFactory(apprenant=apprenant, parcours=parcours)
        notif = notify_formateur_inscription(inscription)
        assert notif is not None
        assert notif.destinataire_id == formateur.id
        assert notif.type_notification == TypeNotification.INSCRIPTION
        assert 'Sara' in notif.message

    def test_notify_formateur_message_from_apprenant_only(self):
        conversation = ConversationFactory()
        msg_from_learner = ChatMessageFactory(
            conversation=conversation,
            sender=conversation.apprenant,
            body='Bonjour formateur',
        )
        notif = notify_formateur_nouveau_message(msg_from_learner)
        assert notif is not None
        assert notif.destinataire_id == conversation.formateur_id
        assert notif.type_notification == TypeNotification.MESSAGE

        msg_from_formateur = ChatMessageFactory(
            conversation=conversation,
            sender=conversation.formateur,
            body='Réponse',
        )
        assert notify_formateur_nouveau_message(msg_from_formateur) is None

    def test_notify_admin_parcours_cree(self):
        admin = UserFactory(admin=True, email='admin.notif@example.com', username='admin_notif')
        formateur = UserFactory(formateur=True, first_name='Karim', last_name='Tazi')
        before = Notification.objects.filter(
            destinataire=admin, type_notification=TypeNotification.PARCOURS_CREE
        ).count()
        parcours = ParcoursFactory(formateur=formateur, brouillon=True, titre='À modérer')
        after = Notification.objects.filter(
            destinataire=admin,
            type_notification=TypeNotification.PARCOURS_CREE,
            parcours=parcours,
        ).count()
        assert after == before + 1
        assert notify_admin_parcours_cree(parcours) == 0

    def test_session_rappel_and_command_window(self):
        formateur = UserFactory(formateur=True)
        session = SessionLiveFactory(
            formateur=formateur,
            statut=StatutSession.PLANIFIEE,
            date_debut=timezone.now() + timedelta(minutes=15),
            date_fin=timezone.now() + timedelta(hours=1),
        )
        notif = notify_formateur_session_rappel(session)
        assert notif is not None
        assert notif.type_notification == TypeNotification.SESSION_RAPPEL
        assert notify_formateur_session_rappel(session) is None

        session2 = SessionLiveFactory(
            formateur=formateur,
            statut=StatutSession.PLANIFIEE,
            date_debut=timezone.now() + timedelta(minutes=15),
            date_fin=timezone.now() + timedelta(hours=1),
        )
        sent = send_upcoming_session_reminders(window_minutes=15, skew_minutes=2)
        assert sent >= 1
        assert Notification.objects.filter(
            destinataire=formateur,
            type_notification=TypeNotification.SESSION_RAPPEL,
            lien=f'/instructor/live-sessions?session={session2.id}',
        ).exists()


class TestNotificationAPI:
    def test_list_only_own_notifications(self, api_client):
        user = UserFactory()
        other = UserFactory()
        mine = NotificationFactory(destinataire=user, titre='Mine')
        NotificationFactory(destinataire=other, titre='Other')
        api_client.force_authenticate(user=user)
        response = api_client.get(NOTIFICATIONS_URL)
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        titres = [item['titre'] for item in results]
        assert 'Mine' in titres
        assert 'Other' not in titres
        assert str(mine.id) in [str(item['id']) for item in results]

    def test_unread_count(self, api_client):
        user = UserFactory()
        NotificationFactory(destinataire=user, est_lue=False)
        NotificationFactory(destinataire=user, est_lue=False)
        NotificationFactory(destinataire=user, est_lue=True)
        api_client.force_authenticate(user=user)
        response = api_client.get(f'{NOTIFICATIONS_URL}unread-count/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 2

    def test_mark_read(self, api_client):
        user = UserFactory()
        notif = NotificationFactory(destinataire=user, est_lue=False)
        api_client.force_authenticate(user=user)
        response = api_client.post(f'{NOTIFICATIONS_URL}{notif.id}/mark-read/')
        assert response.status_code == status.HTTP_200_OK
        notif.refresh_from_db()
        assert notif.est_lue is True

    def test_mark_all_read(self, api_client):
        user = UserFactory()
        NotificationFactory(destinataire=user, est_lue=False)
        NotificationFactory(destinataire=user, est_lue=False)
        api_client.force_authenticate(user=user)
        response = api_client.post(f'{NOTIFICATIONS_URL}mark-all-read/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data.get('marked', 0) >= 2
        assert Notification.objects.filter(destinataire=user, est_lue=False).count() == 0
