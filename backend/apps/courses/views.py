from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Lecon, Module, Parcours, StatutPublication
from .permissions import IsAdminOrFormateur, IsOwnerFormateurOrAdmin
from .serializers import (
    LeconSerializer,
    ModuleSerializer,
    ParcoursDetailSerializer,
    ParcoursListSerializer,
)


class ParcoursViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOwnerFormateurOrAdmin]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ParcoursDetailSerializer
        return ParcoursListSerializer

    def get_permissions(self):
        # Création réservée aux Admins et Formateurs
        if self.action == 'create':
            return [IsAuthenticated(), IsAdminOrFormateur()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        user_role = getattr(user, 'role', None)

        # 1. Administrateur : voit TOUS les parcours
        if user_role == 'ADMIN' or user.is_staff:
            return Parcours.objects.all().prefetch_related(
                'modules__lecons__contenu'
            )

        # 2. Formateur : voit ses propres parcours (même brouillons) + tous les parcours publiés
        if user_role == 'FORMATEUR':
            return (
                Parcours.objects.filter(
                    formateur=user  # Ses propres cours
                )
                | Parcours.objects.filter(statut=StatutPublication.PUBLIE)
            ).distinct().prefetch_related('modules__lecons__contenu')

        # 3. Apprenant : voit uniquement les parcours publiés ciblés pour son profil
        user_profil = getattr(user, 'profil_professionnel', None)
        queryset = Parcours.objects.filter(statut=StatutPublication.PUBLIE)

        if user_profil:
            queryset = queryset.filter(profil_cible=user_profil)

        return queryset.prefetch_related('modules__lecons__contenu')

    def perform_create(self, serializer):
        serializer.save(formateur=self.request.user)


class ModuleViewSet(viewsets.ModelViewSet):
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated, IsOwnerFormateurOrAdmin]

    def get_queryset(self):
        user = self.request.user
        user_role = getattr(user, 'role', None)

        if user_role == 'ADMIN' or user.is_staff:
            return Module.objects.all()

        if user_role == 'FORMATEUR':
            return Module.objects.filter(parcours__formateur=user)

        # Les apprenants accèdent aux modules via la vue de détail du Parcours
        return Module.objects.filter(
            parcours__statut=StatutPublication.PUBLIE
        )


class LeconViewSet(viewsets.ModelViewSet):
    serializer_class = LeconSerializer
    permission_classes = [IsAuthenticated, IsOwnerFormateurOrAdmin]

    def get_queryset(self):
        user = self.request.user
        user_role = getattr(user, 'role', None)

        if user_role == 'ADMIN' or user.is_staff:
            return Lecon.objects.all()

        if user_role == 'FORMATEUR':
            return Lecon.objects.filter(module__parcours__formateur=user)

        return Lecon.objects.filter(
            module__parcours__statut=StatutPublication.PUBLIE
        )