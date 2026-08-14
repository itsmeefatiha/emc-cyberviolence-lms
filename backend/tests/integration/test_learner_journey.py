"""Intégration apprenant : catalogue → inscription → tracking → quiz → certificat."""

from unittest.mock import patch

import pytest
from rest_framework import status

from apps.courses.factories import LeconFactory, ModuleFactory, ParcoursFactory
from apps.courses.models import ContenuTexte, StatutPublication
from apps.live_sessions.factories import SessionLiveFactory
from apps.progression.models import Inscription, Progression, StatutProgression
from apps.quizzes.factories import OptionFactory, QuestionFactory, QuizFactory
from apps.quizzes.models import Certificat, TentativeQuiz, TypeQuestion
from tests.integration.conftest import (
    CERTIFICATS_URL,
    ENROLL_URL,
    FAVORITES_TOGGLE_URL,
    LEARNING_URL,
    PARCOURS_URL,
    QUIZZES_URL,
    SESSIONS_URL,
    SUMMARY_URL,
    TRACK_URL,
    jwt_login,
    results,
)

pytestmark = pytest.mark.django_db


def _seed_published_course(formateur):
    parcours = ParcoursFactory(
        formateur=formateur,
        titre='Parcours Apprenant E2E',
        profil_cible='EDUCATEUR',
        statut=StatutPublication.PUBLIE,
    )
    module = ModuleFactory(parcours=parcours, titre='Module E2E', ordre=1)
    lecon = LeconFactory(module=module, titre='Leçon E2E', ordre=1)
    ContenuTexte.objects.create(
        lecon=lecon,
        titre_fichier='Texte',
        corps='Contenu pour intégration apprenant.',
    )
    quiz = QuizFactory(
        module=module,
        titre='Quiz E2E',
        note_de_passage=50,
        melange_questions=False,
        max_tentatives=3,
    )
    question = QuestionFactory(
        quiz=quiz,
        type_question=TypeQuestion.QCU,
        points=1,
        ordre=1,
        texte='Question E2E ?',
    )
    correct = OptionFactory(question=question, texte='Correcte', est_correcte=True)
    OptionFactory(question=question, texte='Fausse', est_correcte=False)
    return parcours, module, lecon, quiz, question, correct


class TestLearnerLearningJourney:
    def test_full_learning_path_to_certificate(
        self, api_client, formateur, apprenant
    ):
        parcours, module, lecon, quiz, question, correct = _seed_published_course(formateur)

        # Live session joinable pour le même profil
        session = SessionLiveFactory(
            formateur=formateur,
            parcours=parcours,
            profil_cible='EDUCATEUR',
            live_now=True,
            titre='Live E2E',
        )

        jwt_login(api_client, apprenant.email)

        # 1) Voit le parcours publié correspondant à son profil
        catalogue = api_client.get(PARCOURS_URL)
        assert catalogue.status_code == status.HTTP_200_OK
        titres = [p['titre'] for p in results(catalogue)]
        assert 'Parcours Apprenant E2E' in titres

        # 2) Favori
        fav = api_client.post(
            FAVORITES_TOGGLE_URL,
            {'parcours_id': str(parcours.id)},
            format='json',
        )
        assert fav.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        assert fav.data['is_favorite'] is True

        # 3) Inscription
        enroll = api_client.post(
            ENROLL_URL,
            {'parcours_id': str(parcours.id)},
            format='json',
        )
        assert enroll.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        assert Inscription.objects.filter(apprenant=apprenant, parcours=parcours).exists()
        assert Progression.objects.filter(
            apprenant=apprenant, lecon=lecon
        ).exists()

        # 4) Tracking leçon → TERMINE
        track = api_client.post(
            TRACK_URL,
            {
                'lecon_id': str(lecon.id),
                'temps_passe_ajoute': 120,
                'statut': 'TERMINE',
            },
            format='json',
        )
        assert track.status_code == status.HTTP_200_OK
        progression = Progression.objects.get(apprenant=apprenant, lecon=lecon)
        assert progression.statut == StatutProgression.TERMINE
        assert progression.temps_passe >= 120

        # 5) My Learning + summary
        learning = api_client.get(LEARNING_URL)
        assert learning.status_code == status.HTTP_200_OK
        assert 'enrolled' in learning.data or 'favorites' in learning.data

        summary = api_client.get(SUMMARY_URL)
        assert summary.status_code == status.HTTP_200_OK
        assert summary.data['lecons_terminees'] >= 1

        # 6) Take + submit quiz
        take = api_client.get(f'{QUIZZES_URL}{quiz.id}/take/')
        assert take.status_code == status.HTTP_200_OK

        with patch('apps.quizzes.services.generate_certificate_pdf'):
            submit = api_client.post(
                f'{QUIZZES_URL}{quiz.id}/submit/',
                {
                    'answers': [
                        {
                            'question_id': str(question.id),
                            'option_ids': [str(correct.id)],
                        }
                    ],
                    'temps_reponse_secondes': 45,
                },
                format='json',
            )
        assert submit.status_code == status.HTTP_201_CREATED
        assert submit.data['score_detail']['est_reussi'] is True
        assert TentativeQuiz.objects.filter(
            apprenant=apprenant, quiz=quiz, est_reussi=True
        ).exists()

        # Module validé via réussite quiz
        assert submit.data.get('module_validation', {}).get('est_valide') is True

        # Certificat si parcours complet (1 leçon + 1 quiz)
        assert Certificat.objects.filter(apprenant=apprenant, parcours=parcours).exists()
        assert submit.data.get('certificat') is not None

        certs = api_client.get(CERTIFICATS_URL)
        assert certs.status_code == status.HTTP_200_OK
        assert len(results(certs)) >= 1

        # 7) Rejoindre session live
        join = api_client.post(f'{SESSIONS_URL}{session.id}/join/')
        assert join.status_code == status.HTTP_200_OK
        assert join.data.get('room_name') or join.data.get('room_path')

        # 8) Upcoming sessions
        upcoming = api_client.get(f'{SESSIONS_URL}upcoming/')
        assert upcoming.status_code == status.HTTP_200_OK
