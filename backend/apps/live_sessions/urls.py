from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import SessionLiveViewSet

router = DefaultRouter()
router.register(r'sessions', SessionLiveViewSet, basename='session-live')

urlpatterns = [
    path('', include(router.urls)),
]
