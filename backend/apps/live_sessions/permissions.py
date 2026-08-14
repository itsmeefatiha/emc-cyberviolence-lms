from rest_framework import permissions


class IsAdminOrFormateur(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = getattr(request.user, 'role', None)
        return role in ['ADMIN', 'FORMATEUR'] or request.user.is_staff


class IsSessionOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        role = getattr(request.user, 'role', None)
        if role == 'ADMIN' or request.user.is_staff:
            return True
        return obj.formateur_id == request.user.id
