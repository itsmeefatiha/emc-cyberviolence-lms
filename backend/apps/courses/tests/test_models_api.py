import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.courses.factories import LeconFactory, ModuleFactory, ParcoursFactory
from apps.courses.models import Parcours, StatutPublication
from apps.courses.permissions import IsAdminOrFormateur, IsOwnerFormateurOrAdmin
from apps.users.factories import UserFactory

pytestmark = pytest.mark.django_db

PARCOURS_URL = '/api/v1/courses/parcours/'
MODULES_URL = '/api/v1/courses/modules/'
LECONS_URL = '/api/v1/courses/lecons/'


@pytest.fixture
def api_client():
    return APIClient()


class TestParcoursModel:
    def test_str(self):
        parcours = ParcoursFactory(titre='Cyberviolence')
        assert 'Cyberviolence' in str(parcours)

    def test_default_statut_via_create(self):
        formateur = UserFactory(formateur=True)
        parcours = Parcours.objects.create(
            titre='Draft course',
            formateur=formateur,
        )
        assert parcours.statut == StatutPublication.BROUILLON

    def test_module_and_lecon_hierarchy(self):
        lecon = LeconFactory(titre='Intro')
        assert lecon.module.parcours_id == lecon.module.parcours.id
        assert 'Intro' in str(lecon)


class TestCoursesPermissions:
    def test_admin_or_formateur_allows_managers(self):
        perm = IsAdminOrFormateur()
        request = type('R', (), {})()
        request.user = UserFactory(formateur=True)
        assert perm.has_permission(request, None) is True

        request.user = UserFactory()
        assert perm.has_permission(request, None) is False

    def test_owner_can_edit_own_parcours(self):
        formateur = UserFactory(formateur=True)
        parcours = ParcoursFactory(formateur=formateur)
        perm = IsOwnerFormateurOrAdmin()
        request = type('R', (), {'method': 'PATCH', 'user': formateur})()
        assert perm.has_object_permission(request, None, parcours) is True

        other = UserFactory(formateur=True)
        request.user = other
        assert perm.has_object_permission(request, None, parcours) is False


class TestParcoursAPI:
    def test_list_requires_auth(self, api_client):
        response = api_client.get(PARCOURS_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_apprenant_sees_only_published_matching_profil(self, api_client):
        formateur = UserFactory(formateur=True)
        ParcoursFactory(
            formateur=formateur,
            profil_cible='EDUCATEUR',
            statut=StatutPublication.PUBLIE,
            titre='Visible',
        )
        ParcoursFactory(
            formateur=formateur,
            profil_cible='MAGISTRAT',
            statut=StatutPublication.PUBLIE,
            titre='Hidden profil',
        )
        ParcoursFactory(
            formateur=formateur,
            profil_cible='EDUCATEUR',
            brouillon=True,
            titre='Draft',
        )
        apprenant = UserFactory(profil_professionnel='EDUCATEUR')
        api_client.force_authenticate(user=apprenant)
        response = api_client.get(PARCOURS_URL)
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        titres = [item['titre'] for item in results]
        assert 'Visible' in titres
        assert 'Hidden profil' not in titres
        assert 'Draft' not in titres

    def test_formateur_can_create_parcours(self, api_client):
        formateur = UserFactory(formateur=True)
        api_client.force_authenticate(user=formateur)
        response = api_client.post(
            PARCOURS_URL,
            {
                'titre': 'Nouveau parcours',
                'description': 'Desc',
                'profil_cible': 'EDUCATEUR',
                'statut': 'BROUILLON',
            },
            format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert Parcours.objects.filter(titre='Nouveau parcours', formateur=formateur).exists()

    def test_apprenant_cannot_create_parcours(self, api_client):
        api_client.force_authenticate(user=UserFactory())
        response = api_client.post(
            PARCOURS_URL,
            {'titre': 'Hack', 'profil_cible': 'EDUCATEUR', 'statut': 'BROUILLON'},
            format='json',
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_formateur_can_create_module_and_lecon(self, api_client):
        formateur = UserFactory(formateur=True)
        parcours = ParcoursFactory(formateur=formateur, brouillon=True)
        api_client.force_authenticate(user=formateur)

        module_resp = api_client.post(
            MODULES_URL,
            {'parcours': str(parcours.id), 'titre': 'M1', 'description': '', 'ordre': 1},
            format='json',
        )
        assert module_resp.status_code == status.HTTP_201_CREATED
        module_id = module_resp.data['id']

        lecon_resp = api_client.post(
            LECONS_URL,
            {'module': module_id, 'titre': 'L1', 'duree_estimee': 10, 'ordre': 1},
            format='json',
        )
        assert lecon_resp.status_code == status.HTTP_201_CREATED
