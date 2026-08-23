import pytest
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APIClient

from apps.courses.factories import LeconFactory, ParcoursFactory
from apps.progression.factories import FavoriFactory, InscriptionFactory, ProgressionFactory
from apps.progression.models import Favori, Inscription, Progression, StatutProgression
from apps.users.factories import UserFactory

pytestmark = pytest.mark.django_db

ENROLL_URL = '/api/v1/progression/enroll/'
TRACK_URL = '/api/v1/progression/track/'
FAVORITES_TOGGLE_URL = '/api/v1/progression/favorites/toggle/'
SUMMARY_URL = '/api/v1/progression/me/summary/'
LEARNING_URL = '/api/v1/progression/me/learning/'
ACTIVITY_URL = '/api/v1/progression/me/activity/'


@pytest.fixture
def api_client():
    return APIClient()


class TestProgressionModels:
    def test_inscription_unique(self):
        apprenant = UserFactory()
        parcours = ParcoursFactory()
        InscriptionFactory(apprenant=apprenant, parcours=parcours)
        with pytest.raises(Exception):
            InscriptionFactory(apprenant=apprenant, parcours=parcours)

    def test_progression_defaults(self):
        progression = ProgressionFactory()
        assert progression.statut == StatutProgression.NON_COMMENCE
        assert progression.temps_passe == 0
        assert 'NON_COMMENCE' in str(progression)

    def test_favori_str(self):
        favori = FavoriFactory()
        assert '♥' in str(favori)


class TestProgressionAPI:
    def test_enroll_creates_inscription_and_progressions(self, api_client):
        apprenant = UserFactory()
        parcours = ParcoursFactory()
        LeconFactory(module__parcours=parcours)
        LeconFactory(module__parcours=parcours)
        api_client.force_authenticate(user=apprenant)

        response = api_client.post(ENROLL_URL, {'parcours_id': str(parcours.id)}, format='json')
        assert response.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        assert Inscription.objects.filter(apprenant=apprenant, parcours=parcours).exists()
        assert Progression.objects.filter(apprenant=apprenant, lecon__module__parcours=parcours).count() >= 1

    def test_enroll_draft_forbidden_for_apprenant(self, api_client):
        apprenant = UserFactory()
        parcours = ParcoursFactory(brouillon=True)
        api_client.force_authenticate(user=apprenant)
        response = api_client.post(ENROLL_URL, {'parcours_id': str(parcours.id)}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_track_updates_time_and_status(self, api_client):
        apprenant = UserFactory()
        lecon = LeconFactory()
        ProgressionFactory(apprenant=apprenant, lecon=lecon)
        api_client.force_authenticate(user=apprenant)

        response = api_client.post(
            TRACK_URL,
            {
                'lecon_id': str(lecon.id),
                'temps_passe_ajoute': 90,
                'statut': 'EN_COURS',
            },
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK
        progression = Progression.objects.get(apprenant=apprenant, lecon=lecon)
        assert progression.temps_passe >= 90
        assert progression.statut == StatutProgression.EN_COURS

    def test_track_does_not_downgrade_termine(self, api_client):
        apprenant = UserFactory()
        lecon = LeconFactory()
        ProgressionFactory(
            apprenant=apprenant,
            lecon=lecon,
            statut=StatutProgression.TERMINE,
            temps_passe=100,
        )
        api_client.force_authenticate(user=apprenant)
        # Évite l'import reportlab (génération PDF certificat) hors scope de ce test
        with patch('apps.quizzes.services.issue_certificate_if_completed'):
            response = api_client.post(
                TRACK_URL,
                {'lecon_id': str(lecon.id), 'statut': 'EN_COURS'},
                format='json',
            )
        assert response.status_code == status.HTTP_200_OK
        progression = Progression.objects.get(apprenant=apprenant, lecon=lecon)
        assert progression.statut == StatutProgression.TERMINE

    def test_favorite_toggle(self, api_client):
        apprenant = UserFactory()
        parcours = ParcoursFactory()
        api_client.force_authenticate(user=apprenant)

        add = api_client.post(FAVORITES_TOGGLE_URL, {'parcours_id': str(parcours.id)}, format='json')
        assert add.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        assert Favori.objects.filter(apprenant=apprenant, parcours=parcours).exists()
        assert add.data.get('is_favorite') is True

        remove = api_client.post(FAVORITES_TOGGLE_URL, {'parcours_id': str(parcours.id)}, format='json')
        assert remove.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        assert not Favori.objects.filter(apprenant=apprenant, parcours=parcours).exists()
        assert remove.data.get('is_favorite') is False

    def test_me_summary(self, api_client):
        apprenant = UserFactory()
        parcours = ParcoursFactory()
        InscriptionFactory(apprenant=apprenant, parcours=parcours)
        api_client.force_authenticate(user=apprenant)
        response = api_client.get(SUMMARY_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_me_summary_hides_draft_and_archived_parcours(self, api_client):
        apprenant = UserFactory()
        published = ParcoursFactory()
        draft = ParcoursFactory(brouillon=True)
        archived = ParcoursFactory(archive=True)
        InscriptionFactory(apprenant=apprenant, parcours=published)
        InscriptionFactory(apprenant=apprenant, parcours=draft)
        InscriptionFactory(apprenant=apprenant, parcours=archived)
        ProgressionFactory(apprenant=apprenant, lecon=LeconFactory(module__parcours=draft))
        ProgressionFactory(apprenant=apprenant, lecon=LeconFactory(module__parcours=archived))
        api_client.force_authenticate(user=apprenant)

        response = api_client.get(SUMMARY_URL)
        assert response.status_code == status.HTTP_200_OK
        parcours_ids = {item['parcours_id'] for item in response.data['parcours']}
        assert str(published.id) in parcours_ids
        assert str(draft.id) not in parcours_ids
        assert str(archived.id) not in parcours_ids
        assert Progression.objects.filter(apprenant=apprenant).count() >= 2

    def test_me_learning_hides_draft_and_archived_parcours(self, api_client):
        apprenant = UserFactory()
        published = ParcoursFactory()
        draft = ParcoursFactory(brouillon=True)
        archived = ParcoursFactory(archive=True)
        InscriptionFactory(apprenant=apprenant, parcours=published)
        InscriptionFactory(apprenant=apprenant, parcours=draft)
        ProgressionFactory(
            apprenant=apprenant,
            lecon=LeconFactory(module__parcours=archived),
            statut=StatutProgression.EN_COURS,
        )
        FavoriFactory(apprenant=apprenant, parcours=archived)
        api_client.force_authenticate(user=apprenant)

        response = api_client.get(LEARNING_URL)
        assert response.status_code == status.HTTP_200_OK
        visible_ids = {
            item['parcours_id']
            for item in (
                response.data.get('enrolled', [])
                + response.data.get('completed', [])
                + response.data.get('favorites', [])
            )
        }
        assert str(published.id) in visible_ids
        assert str(draft.id) not in visible_ids
        assert str(archived.id) not in visible_ids

    def test_activity_endpoint(self, api_client):
        apprenant = UserFactory()
        api_client.force_authenticate(user=apprenant)
        response = api_client.get(ACTIVITY_URL, {'period': 'weekly'})
        assert response.status_code == status.HTTP_200_OK
        assert 'days' in response.data or isinstance(response.data, (dict, list))
