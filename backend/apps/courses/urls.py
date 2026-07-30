from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ContenuDocumentViewSet,
    ContenuSCORMViewSet,
    ContenuVideoViewSet,
    LeconViewSet,
    ModuleViewSet,
    ParcoursViewSet,
)

router = DefaultRouter()
router.register(r'parcours', ParcoursViewSet, basename='parcours')
router.register(r'modules', ModuleViewSet, basename='module')
router.register(r'lecons', LeconViewSet, basename='lecon')
router.register(r'documents', ContenuDocumentViewSet, basename='contenu-document')
router.register(r'videos', ContenuVideoViewSet, basename='contenu-video')
router.register(r'scorm', ContenuSCORMViewSet, basename='contenu-scorm')

urlpatterns = [
    path('', include(router.urls)),
]