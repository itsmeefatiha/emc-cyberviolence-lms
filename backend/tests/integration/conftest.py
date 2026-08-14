"""Fixtures et helpers partagés pour les tests d'intégration API."""

import pytest
from rest_framework.test import APIClient

from apps.users.factories import UserFactory

USERS_URL = '/api/auth/users/'
JWT_CREATE_URL = '/api/auth/jwt/create/'
ME_URL = '/api/auth/users/me/'

PARCOURS_URL = '/api/v1/courses/parcours/'
MODULES_URL = '/api/v1/courses/modules/'
LECONS_URL = '/api/v1/courses/lecons/'

ENROLL_URL = '/api/v1/progression/enroll/'
TRACK_URL = '/api/v1/progression/track/'
SUMMARY_URL = '/api/v1/progression/me/summary/'
LEARNING_URL = '/api/v1/progression/me/learning/'
FAVORITES_TOGGLE_URL = '/api/v1/progression/favorites/toggle/'

QUIZZES_URL = '/api/v1/quizzes/quizzes/'
QUESTIONS_URL = '/api/v1/quizzes/questions/'
OPTIONS_URL = '/api/v1/quizzes/options/'
CERTIFICATS_URL = '/api/v1/quizzes/certificats/'

SESSIONS_URL = '/api/v1/live/sessions/'
CHAT_CONVERSATIONS_URL = '/api/v1/chat/conversations/'
CHAT_CONTACTS_URL = '/api/v1/chat/contacts/'
NOTIFICATIONS_URL = '/api/v1/notifications/'


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def formateur(db):
    return UserFactory(
        formateur=True,
        email='formateur.integration@example.com',
        username='formateur_int',
        first_name='Karim',
        last_name='Formateur',
    )


@pytest.fixture
def apprenant(db):
    return UserFactory(
        email='apprenant.integration@example.com',
        username='apprenant_int',
        first_name='Imane',
        last_name='Apprenante',
        profil_professionnel='EDUCATEUR',
    )


@pytest.fixture
def formateur_client(api_client, formateur):
    api_client.force_authenticate(user=formateur)
    return api_client


@pytest.fixture
def apprenant_client(api_client, apprenant):
    api_client.force_authenticate(user=apprenant)
    return api_client


def jwt_login(client, email, password='Testpass123!'):
    """Authentifie le client via JWT (intégration auth réelle)."""
    response = client.post(
        JWT_CREATE_URL,
        {'email': email, 'password': password},
        format='json',
    )
    assert response.status_code == 200, response.data
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
    return response.data


def results(response):
    """Normalise listes paginées / non paginées."""
    data = response.data
    if isinstance(data, dict) and 'results' in data:
        return data['results']
    return data
