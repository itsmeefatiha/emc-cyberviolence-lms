from rest_framework import permissions


class IsAdminOrFormateur(permissions.BasePermission):
    """Permission vérifiant si l'utilisateur est Admin ou Formateur pour créer des cours."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Si le modèle User possède un champ 'role' ou 'is_staff'
        user_role = getattr(request.user, 'role', None)
        return user_role in ['ADMIN', 'FORMATEUR'] or request.user.is_staff


class IsOwnerFormateurOrAdmin(permissions.BasePermission):
    """Permission vérifiant que seul le propriétaire (Formateur) ou un Admin

    peut modifier/supprimer un cours, module ou leçon.
    """

    def has_object_permission(self, request, view, obj):
        # Accès en lecture autorisée (le filtrage du queryset s'occupe de la visibilité)
        if request.method in permissions.SAFE_METHODS:
            return True

        # Les Admins ont tous les droits
        user_role = getattr(request.user, 'role', None)
        if user_role == 'ADMIN' or request.user.is_staff:
            return True

        # Vérification de la propriété selon le modèle manipulé
        if hasattr(obj, 'formateur'):  # Modèle Parcours
            return obj.formateur == request.user
        elif hasattr(obj, 'parcours'):  # Modèle Module
            return obj.parcours.formateur == request.user
        elif hasattr(obj, 'module'):  # Modèle Lecon
            return obj.module.parcours.formateur == request.user

        return False