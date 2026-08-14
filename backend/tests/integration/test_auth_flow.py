"""Intégration : inscription → JWT → profil."""

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework import status

from tests.integration.conftest import JWT_CREATE_URL, ME_URL, USERS_URL, jwt_login

User = get_user_model()
pytestmark = pytest.mark.django_db


class TestAuthIntegration:
    def test_register_then_cannot_login_until_active(self, api_client):
        payload = {
            'username': 'new_learner_int',
            'email': 'new_learner_int@example.com',
            'password': 'Secret123!',
            're_password': 'Secret123!',
            'first_name': 'Nora',
            'last_name': 'Ben',
            'role': 'APPRENANT',
            'profil_professionnel': 'EDUCATEUR',
        }
        created = api_client.post(USERS_URL, payload, format='json')
        assert created.status_code == status.HTTP_201_CREATED
        user = User.objects.get(email='new_learner_int@example.com')
        assert user.is_active is False
        assert len(mail.outbox) >= 1

        login = api_client.post(
            JWT_CREATE_URL,
            {'email': 'new_learner_int@example.com', 'password': 'Secret123!'},
            format='json',
        )
        assert login.status_code == status.HTTP_401_UNAUTHORIZED

        user.is_active = True
        user.save(update_fields=['is_active'])

        tokens = jwt_login(api_client, 'new_learner_int@example.com', 'Secret123!')
        assert 'access' in tokens
        assert 'refresh' in tokens

        me = api_client.get(ME_URL)
        assert me.status_code == status.HTTP_200_OK
        assert me.data['email'] == 'new_learner_int@example.com'
        assert me.data['role'] == 'APPRENANT'

    def test_jwt_me_and_profile_update(self, api_client, apprenant):
        jwt_login(api_client, apprenant.email)
        me = api_client.get(ME_URL)
        assert me.status_code == status.HTTP_200_OK
        assert me.data['first_name'] == apprenant.first_name

        patched = api_client.patch(
            ME_URL,
            {'telephone': '0611223344', 'first_name': 'ImaneMaj'},
            format='json',
        )
        assert patched.status_code == status.HTTP_200_OK
        apprenant.refresh_from_db()
        assert apprenant.telephone == '0611223344'
        assert apprenant.first_name == 'ImaneMaj'
