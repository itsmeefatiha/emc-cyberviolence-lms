import pytest
from rest_framework.test import APIClient

from apps.users.factories import UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def formateur(db):
    return UserFactory(formateur=True)


@pytest.fixture
def admin_user(db):
    return UserFactory(admin=True)


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client
