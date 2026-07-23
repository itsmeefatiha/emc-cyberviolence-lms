from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ProgressionViewSet

router = DefaultRouter()
router.register(r'progression', ProgressionViewSet, basename='progression')

urlpatterns = [
    path('', include(router.urls)),
]