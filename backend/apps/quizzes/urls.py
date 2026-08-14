from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CertificatViewSet, OptionViewSet, QuestionViewSet, QuizViewSet, TentativeQuizViewSet

router = DefaultRouter()
router.register(r'quizzes', QuizViewSet, basename='quiz')
router.register(r'questions', QuestionViewSet, basename='question')
router.register(r'options', OptionViewSet, basename='option')
router.register(r'tentatives', TentativeQuizViewSet, basename='tentative-quiz')
router.register(r'certificats', CertificatViewSet, basename='certificat')

urlpatterns = [
    path('', include(router.urls)),
]
