from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import Quiz
from .services import user_can_manage_quiz


class IsManagerOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        return bool(user and user.is_authenticated and (user.is_staff or getattr(user, 'role', None) in ['ADMIN', 'FORMATEUR']))


class CanManageRelatedQuiz(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if isinstance(obj, Quiz):
            return user_can_manage_quiz(request.user, quiz=obj)
        return user_can_manage_quiz(request.user, module=getattr(obj, 'module', None), parcours=getattr(obj, 'parcours', None))
