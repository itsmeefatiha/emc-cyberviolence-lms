import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from apps.users.factories import UserFactory

User = get_user_model()
pytestmark = pytest.mark.django_db


class TestUtilisateurModel:
    def test_create_apprenant_defaults(self):
        user = User.objects.create_user(
            username='apprenant1',
            email='apprenant1@example.com',
            password='Secret123!',
            first_name='Amina',
            last_name='Benali',
        )
        assert user.role == User.RoleChoices.APPRENANT
        assert user.is_active is False
        assert user.email == 'apprenant1@example.com'
        assert user.check_password('Secret123!')
        assert isinstance(user.id, type(UserFactory().id))

    def test_str_representation(self):
        user = UserFactory(
            first_name='Sara',
            last_name='Alaoui',
            role=User.RoleChoices.FORMATEUR,
        )
        assert str(user) == 'Sara Alaoui (FORMATEUR)'

    def test_email_must_be_unique(self):
        UserFactory(email='unique@example.com', username='u1')
        with pytest.raises(IntegrityError):
            UserFactory(email='unique@example.com', username='u2')

    def test_username_field_is_email(self):
        assert User.USERNAME_FIELD == 'email'
        assert 'username' in User.REQUIRED_FIELDS

    def test_role_choices(self):
        assert User.RoleChoices.ADMIN == 'ADMIN'
        assert User.RoleChoices.FORMATEUR == 'FORMATEUR'
        assert User.RoleChoices.APPRENANT == 'APPRENANT'

    def test_profil_professionnel_choices(self):
        user = UserFactory(profil_professionnel=User.ProfilProfessionnel.MAGISTRAT)
        assert user.profil_professionnel == 'MAGISTRAT'

    def test_formateur_trait(self):
        formateur = UserFactory(formateur=True)
        assert formateur.role == 'FORMATEUR'
        assert formateur.specialite == 'Cyberviolence'
        assert formateur.profil_professionnel is None

    def test_admin_trait(self):
        admin = UserFactory(admin=True)
        assert admin.role == 'ADMIN'
        assert admin.is_staff is True
        assert admin.is_superuser is True

    def test_inactive_trait(self):
        user = UserFactory(inactive=True)
        assert user.is_active is False

    def test_updated_at_changes_on_save(self):
        user = UserFactory()
        previous = user.updated_at
        user.first_name = 'Updated'
        user.save()
        user.refresh_from_db()
        assert user.updated_at >= previous
        assert user.first_name == 'Updated'
