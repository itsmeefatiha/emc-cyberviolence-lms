import factory

from apps.courses.factories import LeconFactory, ModuleFactory
from apps.quizzes.models import Option, Question, Quiz, TentativeQuiz, TypeQuestion
from apps.users.factories import UserFactory


class QuizFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Quiz

    module = factory.SubFactory(ModuleFactory)
    titre = factory.Sequence(lambda n: f'Quiz {n}')
    description = 'Quiz de test'
    note_de_passage = 80
    duree_minutes = 20
    max_tentatives = 3
    melange_questions = False


class QuestionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Question

    quiz = factory.SubFactory(QuizFactory)
    texte = factory.Sequence(lambda n: f'Question {n} ?')
    type_question = TypeQuestion.QCU
    points = 1
    ordre = factory.Sequence(lambda n: n + 1)


class OptionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Option

    question = factory.SubFactory(QuestionFactory)
    texte = factory.Sequence(lambda n: f'Option {n}')
    est_correcte = False


class TentativeQuizFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = TentativeQuiz

    apprenant = factory.SubFactory(UserFactory)
    quiz = factory.SubFactory(QuizFactory)
    score_obtenu = 0
    points_obtenus = 0
    est_reussi = False
    reponses_json = factory.LazyFunction(list)
