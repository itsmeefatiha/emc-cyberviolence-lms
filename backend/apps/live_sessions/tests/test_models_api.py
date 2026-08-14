from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.live_sessions.factories import SessionLiveFactory
from apps.live_sessions.models import SessionLive, StatutSession
from apps.users.factories import UserFactory

pytestmark = pytest.mark.django_db

SESSIONS_URL = '/api/v1/live/sessions/'


@pytest.fixture
def api_client():
    return APIClient()


class TestSessionLiveModel:
    def test_room_name_auto_generated(self):
        session = SessionLiveFactory()
        assert session.room_name
        assert session.room_name.startswith('emc')

    def test_is_joinable_now_within_window(self):
        session = SessionLiveFactory(live_now=True)
        assert session.is_joinable_now is True

    def test_is_joinable_false_for_brouillon(self):
        session = SessionLiveFactory(brouillon=True)
        assert session.is_joinable_now is False

    def test_is_joinable_false_when_ended(self):
        session = SessionLiveFactory(ended=True)
        assert session.is_joinable_now is False

    def test_sync_runtime_statut_to_terminee(self):
        session = SessionLiveFactory(
            statut=StatutSession.EN_COURS,
            date_debut=timezone.now() - timedelta(hours=2),
            date_fin=timezone.now() - timedelta(minutes=5),
        )
        changed = session.sync_runtime_statut()
        assert changed is True
        assert session.statut == StatutSession.TERMINEE

    def test_sync_runtime_statut_to_en_cours(self):
        session = SessionLiveFactory(
            statut=StatutSession.PLANIFIEE,
            date_debut=timezone.now() - timedelta(minutes=5),
            date_fin=timezone.now() + timedelta(hours=1),
        )
        changed = session.sync_runtime_statut()
        assert changed is True
        assert session.statut == StatutSession.EN_COURS


class TestLiveSessionsAPI:
    def test_formateur_can_create_session(self, api_client):
        formateur = UserFactory(formateur=True)
        api_client.force_authenticate(user=formateur)
        response = api_client.post(
            SESSIONS_URL,
            {
                'titre': 'Visio EMC',
                'description': 'Test',
                'profil_cible': 'EDUCATEUR',
                'statut': 'PLANIFIEE',
                'date_debut': (timezone.now() + timedelta(days=1)).isoformat(),
                'date_fin': (timezone.now() + timedelta(days=1, hours=2)).isoformat(),
            },
            format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert SessionLive.objects.filter(titre='Visio EMC', formateur=formateur).exists()

    def test_apprenant_cannot_create_session(self, api_client):
        api_client.force_authenticate(user=UserFactory())
        response = api_client.post(
            SESSIONS_URL,
            {
                'titre': 'Hack',
                'profil_cible': 'EDUCATEUR',
                'statut': 'PLANIFIEE',
                'date_debut': (timezone.now() + timedelta(days=1)).isoformat(),
                'date_fin': (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            },
            format='json',
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_apprenant_lists_matching_profil_sessions(self, api_client):
        SessionLiveFactory(profil_cible='EDUCATEUR', titre='For educ')
        SessionLiveFactory(profil_cible='MAGISTRAT', titre='For mag')
        apprenant = UserFactory(profil_professionnel='EDUCATEUR')
        api_client.force_authenticate(user=apprenant)
        response = api_client.get(SESSIONS_URL)
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        titres = [item['titre'] for item in results]
        assert 'For educ' in titres
        assert 'For mag' not in titres

    def test_upcoming_endpoint(self, api_client):
        SessionLiveFactory(live_now=True)
        apprenant = UserFactory(profil_professionnel='EDUCATEUR')
        api_client.force_authenticate(user=apprenant)
        response = api_client.get(f'{SESSIONS_URL}upcoming/')
        assert response.status_code == status.HTTP_200_OK

    def test_join_live_session(self, api_client):
        session = SessionLiveFactory(live_now=True, profil_cible='EDUCATEUR')
        apprenant = UserFactory(profil_professionnel='EDUCATEUR')
        api_client.force_authenticate(user=apprenant)
        response = api_client.post(f'{SESSIONS_URL}{session.id}/join/')
        assert response.status_code == status.HTTP_200_OK
        assert 'room_name' in response.data or 'room_path' in response.data
