from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ConversationViewSet, FormateurContactsView

router = DefaultRouter()
router.register(r'conversations', ConversationViewSet, basename='chat-conversation')

urlpatterns = [
    path('contacts/', FormateurContactsView.as_view(), name='chat-contacts'),
    path('', include(router.urls)),
]
