from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    ContenuDocument,
    ContenuSCORM,
    ContenuVideo,
    Lecon,
    Module,
    Parcours,
    StatutPublication,
)
from .permissions import IsAdminOrFormateur, IsOwnerFormateurOrAdmin
from .serializers import (
    ContenuDocumentSerializer,
    ContenuSCORMSerializer,
    ContenuVideoSerializer,
    LeconSerializer,
    ModuleSerializer,
    ParcoursDetailSerializer,
    ParcoursListSerializer,
    ParcoursWriteSerializer,
)


class ReorderActionMixin:
    ordering_model = None

    def _reorder_queryset(self, queryset):
        payload = self.request.data
        if not isinstance(payload, list):
            raise ValidationError(
                {'detail': 'Le corps de requête doit contenir une liste JSON d’éléments à réordonner.'}
            )

        updates = {}
        for item in payload:
            if not isinstance(item, dict):
                raise ValidationError(
                    {'detail': 'Chaque élément doit être un objet avec les clés id et ordre.'}
                )
            item_id = item.get('id')
            ordre = item.get('ordre')
            if not item_id or ordre is None:
                raise ValidationError({'detail': 'Chaque élément doit contenir id et ordre.'})
            updates[str(item_id)] = ordre

        if not updates:
            return Response({'detail': 'Aucun élément à réordonner.'}, status=status.HTTP_200_OK)

        objects = list(queryset.filter(id__in=updates.keys()))
        found_ids = {str(obj.id) for obj in objects}
        missing_ids = sorted(set(updates.keys()) - found_ids)
        if missing_ids:
            raise ValidationError(
                {
                    'detail': f'Certains éléments sont introuvables ou non accessibles: {", ".join(missing_ids)}.'
                }
            )

        for obj in objects:
            obj.ordre = updates[str(obj.id)]

        with transaction.atomic():
            self.ordering_model.objects.bulk_update(objects, ['ordre'])

        return Response({'detail': 'Ordre mis à jour avec succès.'}, status=status.HTTP_200_OK)


class ParcoursViewSet(ReorderActionMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOwnerFormateurOrAdmin]
    ordering_model = Parcours

    def get_serializer_class(self):
        if self.action in {'create', 'update', 'partial_update'}:
            return ParcoursWriteSerializer
        if self.action == 'retrieve':
            return ParcoursDetailSerializer
        return ParcoursListSerializer

    def get_permissions(self):
        if self.action in {'create', 'reorder'}:
            return [IsAuthenticated(), IsAdminOrFormateur()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        user_role = getattr(user, 'role', None)

        if user_role == 'ADMIN' or user.is_staff:
            return Parcours.objects.all().select_related('formateur').prefetch_related(
                'modules__lecons__contenu'
            )

        if user_role == 'FORMATEUR':
            return (
                Parcours.objects.filter(formateur=user)
                | Parcours.objects.filter(statut=StatutPublication.PUBLIE)
            ).distinct().select_related('formateur').prefetch_related('modules__lecons__contenu')

        user_profil = getattr(user, 'profil_professionnel', None)
        queryset = Parcours.objects.filter(statut=StatutPublication.PUBLIE)

        if user_profil:
            queryset = queryset.filter(profil_cible=user_profil)

        return queryset.select_related('formateur').prefetch_related('modules__lecons__contenu')

    def perform_create(self, serializer):
        serializer.save(formateur=self.request.user)

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        user = request.user
        user_role = getattr(user, 'role', None)

        if user_role == 'ADMIN' or user.is_staff:
            queryset = Parcours.objects.all()
        elif user_role == 'FORMATEUR':
            queryset = Parcours.objects.filter(formateur=user)
        else:
            queryset = Parcours.objects.none()

        return self._reorder_queryset(queryset)


class ModuleViewSet(ReorderActionMixin, viewsets.ModelViewSet):
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated, IsOwnerFormateurOrAdmin]
    ordering_model = Module

    def get_permissions(self):
        if self.action in {'create', 'reorder'}:
            return [IsAuthenticated(), IsAdminOrFormateur()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        user_role = getattr(user, 'role', None)

        if user_role == 'ADMIN' or user.is_staff:
            return Module.objects.select_related('parcours', 'parcours__formateur')

        if user_role == 'FORMATEUR':
            return Module.objects.filter(parcours__formateur=user).select_related(
                'parcours', 'parcours__formateur'
            )

        return Module.objects.filter(
            parcours__statut=StatutPublication.PUBLIE
        ).select_related('parcours', 'parcours__formateur')

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        user = request.user
        user_role = getattr(user, 'role', None)

        if user_role == 'ADMIN' or user.is_staff:
            queryset = Module.objects.all()
        elif user_role == 'FORMATEUR':
            queryset = Module.objects.filter(parcours__formateur=user)
        else:
            queryset = Module.objects.none()

        return self._reorder_queryset(queryset)


class LeconViewSet(ReorderActionMixin, viewsets.ModelViewSet):
    serializer_class = LeconSerializer
    permission_classes = [IsAuthenticated, IsOwnerFormateurOrAdmin]
    ordering_model = Lecon

    def get_permissions(self):
        if self.action in {'create', 'reorder'}:
            return [IsAuthenticated(), IsAdminOrFormateur()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        user_role = getattr(user, 'role', None)

        if user_role == 'ADMIN' or user.is_staff:
            return Lecon.objects.select_related('module', 'module__parcours', 'module__parcours__formateur')

        if user_role == 'FORMATEUR':
            return Lecon.objects.filter(module__parcours__formateur=user).select_related(
                'module', 'module__parcours', 'module__parcours__formateur'
            )

        return Lecon.objects.filter(
            module__parcours__statut=StatutPublication.PUBLIE
        ).select_related('module', 'module__parcours', 'module__parcours__formateur')

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        user = request.user
        user_role = getattr(user, 'role', None)

        if user_role == 'ADMIN' or user.is_staff:
            queryset = Lecon.objects.all()
        elif user_role == 'FORMATEUR':
            queryset = Lecon.objects.filter(module__parcours__formateur=user)
        else:
            queryset = Lecon.objects.none()

        return self._reorder_queryset(queryset)


class ContenuDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = ContenuDocumentSerializer
    permission_classes = [IsAuthenticated, IsOwnerFormateurOrAdmin]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), IsAdminOrFormateur()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        user_role = getattr(user, 'role', None)

        if user_role == 'ADMIN' or user.is_staff:
            return ContenuDocument.objects.select_related(
                'lecon', 'lecon__module', 'lecon__module__parcours'
            )

        if user_role == 'FORMATEUR':
            return ContenuDocument.objects.filter(
                lecon__module__parcours__formateur=user
            ).select_related('lecon', 'lecon__module', 'lecon__module__parcours')

        return ContenuDocument.objects.none()


class ContenuVideoViewSet(viewsets.ModelViewSet):
    serializer_class = ContenuVideoSerializer
    permission_classes = [IsAuthenticated, IsOwnerFormateurOrAdmin]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), IsAdminOrFormateur()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        user_role = getattr(user, 'role', None)

        if user_role == 'ADMIN' or user.is_staff:
            return ContenuVideo.objects.select_related(
                'lecon', 'lecon__module', 'lecon__module__parcours'
            )

        if user_role == 'FORMATEUR':
            return ContenuVideo.objects.filter(
                lecon__module__parcours__formateur=user
            ).select_related('lecon', 'lecon__module', 'lecon__module__parcours')

        return ContenuVideo.objects.none()


class ContenuSCORMViewSet(viewsets.ModelViewSet):
    serializer_class = ContenuSCORMSerializer
    permission_classes = [IsAuthenticated, IsOwnerFormateurOrAdmin]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), IsAdminOrFormateur()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        user_role = getattr(user, 'role', None)

        if user_role == 'ADMIN' or user.is_staff:
            return ContenuSCORM.objects.select_related(
                'lecon', 'lecon__module', 'lecon__module__parcours'
            )

        if user_role == 'FORMATEUR':
            return ContenuSCORM.objects.filter(
                lecon__module__parcours__formateur=user
            ).select_related('lecon', 'lecon__module', 'lecon__module__parcours')

        return ContenuSCORM.objects.none()