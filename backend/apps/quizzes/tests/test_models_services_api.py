import pytest
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.test import APIClient

from apps.courses.factories import ModuleFactory, ParcoursFactory
from apps.quizzes.factories import OptionFactory, QuestionFactory, QuizFactory
from apps.quizzes.models import Quiz, TypeQuestion
from apps.quizzes.services import (
    calculate_quiz_attempt,
    normalize_question_type,
    shuffle_quiz_payload,
    user_can_manage_quiz,
)
from apps.users.factories import UserFactory

pytestmark = pytest.mark.django_db

QUIZZES_URL = '/api/v1/quizzes/quizzes/'


@pytest.fixture
def api_client():
    return APIClient()


def _build_scored_quiz():
    quiz = QuizFactory(note_de_passage=50, melange_questions=False)
    q1 = QuestionFactory(quiz=quiz, type_question=TypeQuestion.QCU, points=1, ordre=1)
    correct = OptionFactory(question=q1, texte='Bonne', est_correcte=True)
    OptionFactory(question=q1, texte='Mauvaise', est_correcte=False)
    return quiz, q1, correct


class TestQuizModel:
    def test_save_sets_module_from_lecon(self):
        from apps.courses.factories import LeconFactory

        lecon = LeconFactory()
        quiz = Quiz(titre='Q', lecon=lecon)
        quiz.save()
        assert quiz.module_id == lecon.module_id

    def test_clean_requires_module_or_lecon(self):
        quiz = Quiz(titre='Orphan')
        with pytest.raises(ValidationError):
            quiz.clean()

    def test_parcours_property(self):
        quiz = QuizFactory()
        assert quiz.parcours.id == quiz.module.parcours_id


class TestQuizServices:
    def test_user_can_manage_quiz_owner_formateur(self):
        formateur = UserFactory(formateur=True)
        parcours = ParcoursFactory(formateur=formateur)
        quiz = QuizFactory(module__parcours=parcours)
        assert user_can_manage_quiz(formateur, quiz=quiz) is True
        assert user_can_manage_quiz(UserFactory(formateur=True), quiz=quiz) is False
        assert user_can_manage_quiz(UserFactory(), quiz=quiz) is False
        assert user_can_manage_quiz(UserFactory(admin=True), quiz=quiz) is True

    def test_normalize_question_type(self):
        assert normalize_question_type('QCM') == 'QCM'
        assert normalize_question_type('unknown') == 'QCU'

    def test_calculate_quiz_attempt_perfect_score(self):
        quiz, q1, correct = _build_scored_quiz()
        result = calculate_quiz_attempt(
            quiz,
            [{'question_id': str(q1.id), 'option_ids': [str(correct.id)]}],
        )
        assert result['score_obtenu'] == 100.0
        assert result['est_reussi'] is True
        assert result['details'][0]['is_correct'] is True

    def test_calculate_quiz_attempt_wrong_answer(self):
        quiz, q1, correct = _build_scored_quiz()
        wrong = q1.options.filter(est_correcte=False).first()
        result = calculate_quiz_attempt(
            quiz,
            [{'question_id': str(q1.id), 'option_ids': [str(wrong.id)]}],
        )
        assert result['score_obtenu'] == 0.0
        assert result['est_reussi'] is False

    def test_shuffle_hides_correct_answers_by_default(self):
        quiz, _, _ = _build_scored_quiz()
        payload = shuffle_quiz_payload(quiz, include_correct_answers=False)
        assert 'est_correcte' not in payload[0]['options'][0]


class TestQuizAPI:
    def test_formateur_can_create_quiz(self, api_client):
        formateur = UserFactory(formateur=True)
        module = ModuleFactory(parcours__formateur=formateur)
        api_client.force_authenticate(user=formateur)
        response = api_client.post(
            QUIZZES_URL,
            {
                'module': str(module.id),
                'titre': 'Quiz API',
                'note_de_passage': 80,
                'duree_minutes': 15,
                'max_tentatives': 2,
            },
            format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_apprenant_cannot_create_quiz(self, api_client):
        module = ModuleFactory()
        api_client.force_authenticate(user=UserFactory())
        response = api_client.post(
            QUIZZES_URL,
            {'module': str(module.id), 'titre': 'Hack'},
            format='json',
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_submit_quiz_attempt(self, api_client):
        quiz, q1, correct = _build_scored_quiz()
        quiz.module.parcours.statut = 'PUBLIE'
        quiz.module.parcours.save()
        apprenant = UserFactory()
        api_client.force_authenticate(user=apprenant)
        response = api_client.post(
            f'{QUIZZES_URL}{quiz.id}/submit/',
            {
                'answers': [{'question_id': str(q1.id), 'option_ids': [str(correct.id)]}],
                'temps_reponse_secondes': 30,
            },
            format='json',
        )
        assert response.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        tentative = response.data.get('tentative') or response.data
        assert tentative.get('est_reussi') is True or 'score_obtenu' in tentative
