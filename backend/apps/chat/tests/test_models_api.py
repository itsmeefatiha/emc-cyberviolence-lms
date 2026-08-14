import pytest
from django.db import IntegrityError
from rest_framework import status
from rest_framework.test import APIClient

from apps.chat.factories import ChatMessageFactory, ConversationFactory
from apps.chat.models import ChatMessage, Conversation
from apps.users.factories import UserFactory

pytestmark = pytest.mark.django_db

CONVERSATIONS_URL = '/api/v1/chat/conversations/'
CONTACTS_URL = '/api/v1/chat/contacts/'


@pytest.fixture
def api_client():
    return APIClient()


class TestChatModels:
    def test_conversation_unique_pair(self):
        apprenant = UserFactory()
        formateur = UserFactory(formateur=True)
        ConversationFactory(apprenant=apprenant, formateur=formateur)
        with pytest.raises(IntegrityError):
            ConversationFactory(apprenant=apprenant, formateur=formateur)

    def test_message_str(self):
        message = ChatMessageFactory(body='Bonjour formateur')
        assert 'Bonjour' in str(message)


class TestChatAPI:
    def test_start_conversation_as_apprenant(self, api_client):
        apprenant = UserFactory()
        formateur = UserFactory(formateur=True)
        api_client.force_authenticate(user=apprenant)
        response = api_client.post(
            f'{CONVERSATIONS_URL}start/',
            {'formateur_id': str(formateur.id)},
            format='json',
        )
        assert response.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        assert Conversation.objects.filter(apprenant=apprenant, formateur=formateur).exists()

    def test_start_conversation_idempotent(self, api_client):
        apprenant = UserFactory()
        formateur = UserFactory(formateur=True)
        existing = ConversationFactory(apprenant=apprenant, formateur=formateur)
        api_client.force_authenticate(user=apprenant)
        response = api_client.post(
            f'{CONVERSATIONS_URL}start/',
            {'formateur_id': str(formateur.id)},
            format='json',
        )
        assert response.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        assert Conversation.objects.filter(apprenant=apprenant, formateur=formateur).count() == 1
        assert str(response.data['id']) == str(existing.id)

    def test_send_and_list_messages(self, api_client):
        conversation = ConversationFactory()
        apprenant = conversation.apprenant
        api_client.force_authenticate(user=apprenant)

        send = api_client.post(
            f'{CONVERSATIONS_URL}{conversation.id}/messages/',
            {'body': 'Salut !'},
            format='json',
        )
        assert send.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        assert ChatMessage.objects.filter(conversation=conversation, body='Salut !').exists()

        listed = api_client.get(f'{CONVERSATIONS_URL}{conversation.id}/messages/')
        assert listed.status_code == status.HTTP_200_OK
        results = listed.data if isinstance(listed.data, list) else listed.data.get('results', listed.data)
        bodies = [m['body'] for m in results]
        assert 'Salut !' in bodies

    def test_outsider_cannot_access_messages(self, api_client):
        conversation = ConversationFactory()
        stranger = UserFactory()
        api_client.force_authenticate(user=stranger)
        response = api_client.get(f'{CONVERSATIONS_URL}{conversation.id}/messages/')
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    def test_contacts_for_apprenant(self, api_client):
        apprenant = UserFactory()
        api_client.force_authenticate(user=apprenant)
        response = api_client.get(CONTACTS_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_list_conversations(self, api_client):
        conversation = ConversationFactory()
        api_client.force_authenticate(user=conversation.apprenant)
        response = api_client.get(CONVERSATIONS_URL)
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        ids = [str(item['id']) for item in results]
        assert str(conversation.id) in ids
