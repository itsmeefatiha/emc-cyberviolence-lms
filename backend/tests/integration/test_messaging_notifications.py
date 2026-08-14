"""Intégration messagerie apprenant ↔ formateur + notifications."""

import pytest
from rest_framework import status

from apps.chat.models import ChatMessage, Conversation
from apps.courses.factories import ParcoursFactory
from apps.courses.models import StatutPublication
from apps.notifications.factories import NotificationFactory
from apps.notifications.models import Notification
from apps.progression.factories import InscriptionFactory
from tests.integration.conftest import (
    CHAT_CONTACTS_URL,
    CHAT_CONVERSATIONS_URL,
    NOTIFICATIONS_URL,
    jwt_login,
    results,
)

pytestmark = pytest.mark.django_db


class TestChatIntegration:
    def test_apprenant_formateur_conversation_thread(
        self, api_client, formateur, apprenant
    ):
        # Lien pédagogique : inscription sur un parcours du formateur
        parcours = ParcoursFactory(
            formateur=formateur,
            statut=StatutPublication.PUBLIE,
            profil_cible='EDUCATEUR',
        )
        InscriptionFactory(apprenant=apprenant, parcours=parcours)

        # Apprenant démarre la conversation
        jwt_login(api_client, apprenant.email)

        contacts = api_client.get(CHAT_CONTACTS_URL)
        assert contacts.status_code == status.HTTP_200_OK
        contact_ids = [str(c['id']) for c in results(contacts)]
        assert str(formateur.id) in contact_ids

        start = api_client.post(
            f'{CHAT_CONVERSATIONS_URL}start/',
            {'formateur_id': str(formateur.id)},
            format='json',
        )
        assert start.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        conversation_id = start.data['id']
        assert Conversation.objects.filter(
            id=conversation_id, apprenant=apprenant, formateur=formateur
        ).exists()

        send = api_client.post(
            f'{CHAT_CONVERSATIONS_URL}{conversation_id}/messages/',
            {'body': 'Bonjour, j’ai une question sur le module 1.'},
            format='json',
        )
        assert send.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        assert ChatMessage.objects.filter(
            conversation_id=conversation_id,
            sender=apprenant,
            body__icontains='question',
        ).exists()

        # Formateur répond
        api_client.credentials()
        jwt_login(api_client, formateur.email)

        inbox = api_client.get(CHAT_CONVERSATIONS_URL)
        assert inbox.status_code == status.HTTP_200_OK
        inbox_ids = [str(c['id']) for c in results(inbox)]
        assert str(conversation_id) in inbox_ids

        reply = api_client.post(
            f'{CHAT_CONVERSATIONS_URL}{conversation_id}/messages/',
            {'body': 'Bien sûr, je peux vous aider.'},
            format='json',
        )
        assert reply.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)

        thread = api_client.get(f'{CHAT_CONVERSATIONS_URL}{conversation_id}/messages/')
        assert thread.status_code == status.HTTP_200_OK
        bodies = [m['body'] for m in results(thread)]
        assert any('question' in b for b in bodies)
        assert any('aider' in b for b in bodies)
        assert ChatMessage.objects.filter(conversation_id=conversation_id).count() == 2


class TestNotificationsIntegration:
    def test_unread_mark_read_and_mark_all(self, api_client, apprenant):
        n1 = NotificationFactory(destinataire=apprenant, titre='N1', est_lue=False)
        n2 = NotificationFactory(destinataire=apprenant, titre='N2', est_lue=False)
        NotificationFactory(destinataire=apprenant, titre='N3', est_lue=True)

        jwt_login(api_client, apprenant.email)

        listed = api_client.get(NOTIFICATIONS_URL)
        assert listed.status_code == status.HTTP_200_OK
        titres = [n['titre'] for n in results(listed)]
        assert 'N1' in titres and 'N2' in titres

        unread = api_client.get(f'{NOTIFICATIONS_URL}unread-count/')
        assert unread.status_code == status.HTTP_200_OK
        assert unread.data['count'] == 2

        mark = api_client.post(f'{NOTIFICATIONS_URL}{n1.id}/mark-read/')
        assert mark.status_code == status.HTTP_200_OK
        n1.refresh_from_db()
        assert n1.est_lue is True

        unread2 = api_client.get(f'{NOTIFICATIONS_URL}unread-count/')
        assert unread2.data['count'] == 1

        mark_all = api_client.post(f'{NOTIFICATIONS_URL}mark-all-read/')
        assert mark_all.status_code == status.HTTP_200_OK
        assert Notification.objects.filter(destinataire=apprenant, est_lue=False).count() == 0
        # n2 was the remaining unread
        n2.refresh_from_db()
        assert n2.est_lue is True
