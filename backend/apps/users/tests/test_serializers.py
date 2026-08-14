import io

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIRequestFactory

from apps.users.factories import UserFactory
from apps.users.serializers import (
    CustomTokenObtainPairSerializer,
    CustomUserCreateSerializer,
    CustomUserSerializer,
)

User = get_user_model()
pytestmark = pytest.mark.django_db


def _tiny_png():
    buffer = io.BytesIO()
    Image.new('RGB', (8, 8), color=(36, 52, 145)).save(buffer, format='PNG')
    return SimpleUploadedFile('avatar.png', buffer.getvalue(), content_type='image/png')


class TestCustomUserCreateSerializer:
    def test_create_apprenant_valid(self):
        data = {
            'username': 'learner01',
            'email': 'learner01@example.com',
            'password': 'Secret123!',
            'first_name': 'Youssef',
            'last_name': 'Idrissi',
            'telephone': '0612345678',
            'role': User.RoleChoices.APPRENANT,
            'profil_professionnel': User.ProfilProfessionnel.EDUCATEUR,
        }
        serializer = CustomUserCreateSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        user = serializer.save()
        assert user.email == 'learner01@example.com'
        assert user.role == 'APPRENANT'
        assert user.check_password('Secret123!')
        assert user.is_active is False

    def test_create_rejects_duplicate_email(self):
        UserFactory(email='taken@example.com', username='taken')
        data = {
            'username': 'other',
            'email': 'taken@example.com',
            'password': 'Secret123!',
            'first_name': 'A',
            'last_name': 'B',
        }
        serializer = CustomUserCreateSerializer(data=data)
        assert serializer.is_valid() is False
        assert 'email' in serializer.errors

    def test_create_formateur_with_specialite(self):
        data = {
            'username': 'formateur01',
            'email': 'formateur01@example.com',
            'password': 'Secret123!',
            'first_name': 'Karim',
            'last_name': 'Tazi',
            'role': User.RoleChoices.FORMATEUR,
            'specialite': 'Droit du numérique',
        }
        serializer = CustomUserCreateSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        user = serializer.save()
        assert user.role == 'FORMATEUR'
        assert user.specialite == 'Droit du numérique'


class TestCustomUserSerializer:
    def test_serialization_fields(self):
        user = UserFactory(
            first_name='Nadia',
            last_name='Amrani',
            role=User.RoleChoices.APPRENANT,
            profil_professionnel=User.ProfilProfessionnel.ASSISTANT_SOCIAL,
        )
        data = CustomUserSerializer(user).data
        assert data['email'] == user.email
        assert data['role'] == 'APPRENANT'
        assert data['profil_professionnel'] == 'ASSISTANT_SOCIAL'
        assert 'password' not in data
        assert set(data.keys()) >= {
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'telephone',
            'role',
            'specialite',
            'profil_professionnel',
            'photo',
            'is_active',
            'created_at',
            'updated_at',
            'last_login',
        }

    def test_update_profile_fields(self):
        user = UserFactory()
        serializer = CustomUserSerializer(
            user,
            data={
                'first_name': 'Nouveau',
                'last_name': 'Nom',
                'telephone': '0699887766',
            },
            partial=True,
        )
        assert serializer.is_valid(), serializer.errors
        updated = serializer.save()
        assert updated.first_name == 'Nouveau'
        assert updated.telephone == '0699887766'

    def test_update_photo(self):
        user = UserFactory()
        serializer = CustomUserSerializer(
            user,
            data={'photo': _tiny_png()},
            partial=True,
        )
        assert serializer.is_valid(), serializer.errors
        updated = serializer.save()
        assert updated.photo.name
        assert 'avatars/' in updated.photo.name


class TestCustomTokenObtainPairSerializer:
    def test_token_contains_custom_claims(self):
        user = UserFactory(
            first_name='Hassan',
            last_name='Bennani',
            role=User.RoleChoices.FORMATEUR,
            profil_professionnel=None,
        )
        token = CustomTokenObtainPairSerializer.get_token(user)
        assert token['role'] == 'FORMATEUR'
        assert token['profil_professionnel'] is None
        assert token['full_name'] == 'Hassan Bennani'

    def test_token_obtain_valid_credentials(self):
        user = UserFactory(email='login@example.com', username='loginuser')
        factory_req = APIRequestFactory()
        request = factory_req.post('/api/auth/jwt/create/')
        serializer = CustomTokenObtainPairSerializer(
            data={'email': 'login@example.com', 'password': 'Testpass123!'},
            context={'request': request},
        )
        assert serializer.is_valid(), serializer.errors
        assert 'access' in serializer.validated_data
        assert 'refresh' in serializer.validated_data
