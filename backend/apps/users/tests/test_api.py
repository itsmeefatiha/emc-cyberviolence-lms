import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.factories import UserFactory

User = get_user_model()
pytestmark = pytest.mark.django_db

USERS_URL = '/api/auth/users/'
ME_URL = '/api/auth/users/me/'
JWT_CREATE_URL = '/api/auth/jwt/create/'
JWT_REFRESH_URL = '/api/auth/jwt/refresh/'


@pytest.fixture
def api_client():
    return APIClient()


class TestUserRegistrationAPI:
    def test_register_apprenant_success(self, api_client):
        payload = {
            'username': 'newlearner',
            'email': 'newlearner@example.com',
            'password': 'Secret123!',
            're_password': 'Secret123!',
            'first_name': 'Imane',
            'last_name': 'Fassi',
            'role': User.RoleChoices.APPRENANT,
            'profil_professionnel': User.ProfilProfessionnel.FORCES_ORDRE,
        }
        response = api_client.post(USERS_URL, payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['email'] == 'newlearner@example.com'
        assert 'password' not in response.data

        user = User.objects.get(email='newlearner@example.com')
        assert user.role == 'APPRENANT'
        assert user.profil_professionnel == 'FORCES_ORDRE'
        assert user.is_active is False
        assert len(mail.outbox) >= 1

    def test_register_password_mismatch(self, api_client):
        payload = {
            'username': 'badpwd',
            'email': 'badpwd@example.com',
            'password': 'Secret123!',
            're_password': 'Other123!',
            'first_name': 'A',
            'last_name': 'B',
        }
        response = api_client.post(USERS_URL, payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_duplicate_email(self, api_client):
        UserFactory(email='dup@example.com', username='dupuser')
        payload = {
            'username': 'another',
            'email': 'dup@example.com',
            'password': 'Secret123!',
            're_password': 'Secret123!',
            'first_name': 'A',
            'last_name': 'B',
        }
        response = api_client.post(USERS_URL, payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestJWTAuthAPI:
    def test_login_active_user(self, api_client):
        UserFactory(email='active@example.com', username='activeuser', is_active=True)
        response = api_client.post(
            JWT_CREATE_URL,
            {'email': 'active@example.com', 'password': 'Testpass123!'},
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data

    def test_login_inactive_user_rejected(self, api_client):
        UserFactory(email='inactive@example.com', username='inactiveuser', inactive=True)
        response = api_client.post(
            JWT_CREATE_URL,
            {'email': 'inactive@example.com', 'password': 'Testpass123!'},
            format='json',
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_wrong_password(self, api_client):
        UserFactory(email='wrongpwd@example.com', username='wrongpwd')
        response = api_client.post(
            JWT_CREATE_URL,
            {'email': 'wrongpwd@example.com', 'password': 'BadPassword1!'},
            format='json',
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_token(self, api_client):
        UserFactory(email='refresh@example.com', username='refreshuser')
        login = api_client.post(
            JWT_CREATE_URL,
            {'email': 'refresh@example.com', 'password': 'Testpass123!'},
            format='json',
        )
        assert login.status_code == status.HTTP_200_OK
        response = api_client.post(
            JWT_REFRESH_URL,
            {'refresh': login.data['refresh']},
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data


class TestCurrentUserAPI:
    def test_me_requires_authentication(self, api_client):
        response = api_client.get(ME_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_returns_profile(self, api_client):
        user = UserFactory(
            email='me@example.com',
            username='meuser',
            first_name='Omar',
            last_name='Chraibi',
            role=User.RoleChoices.APPRENANT,
        )
        api_client.force_authenticate(user=user)
        response = api_client.get(ME_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['email'] == 'me@example.com'
        assert response.data['first_name'] == 'Omar'
        assert response.data['role'] == 'APPRENANT'

    def test_me_partial_update(self, api_client):
        user = UserFactory(email='patch@example.com', username='patchuser')
        api_client.force_authenticate(user=user)
        response = api_client.patch(
            ME_URL,
            {'first_name': 'Patched', 'telephone': '0611223344'},
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.first_name == 'Patched'
        assert user.telephone == '0611223344'
