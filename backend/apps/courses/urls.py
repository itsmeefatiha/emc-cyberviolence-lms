from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import LeconViewSet, ModuleViewSet, ParcoursViewSet

router = DefaultRouter()
router.register(r'parcours', ParcoursViewSet, basename='parcours')
router.register(r'modules', ModuleViewSet, basename='module')
router.register(r'lecons', LeconViewSet, basename='lecon')

urlpatterns = [
    path('', include(router.urls)),
]