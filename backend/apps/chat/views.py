from django.contrib.auth import get_user_model
from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.progression.models import Inscription

from .models import ChatMessage, Conversation
from .serializers import (
    ChatMessageSerializer,
    ConversationSerializer,
    FormateurContactSerializer,
    SendMessageSerializer,
    StartConversationSerializer,
)

User = get_user_model()


class ConversationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        user = self.request.user
        qs = (
            Conversation.objects.select_related('apprenant', 'formateur')
            .prefetch_related(
                Prefetch(
                    'messages',
                    queryset=ChatMessage.objects.order_by('-created_at')[:1],
                    to_attr='_prefetched_latest',
                )
            )
            .order_by('-updated_at')
        )
        role = getattr(user, 'role', None)
        if role == 'ADMIN' or user.is_staff:
            return qs
        return qs.filter(Q(apprenant=user) | Q(formateur=user))

    def _attach_latest(self, items):
        for conv in items:
            pref = getattr(conv, '_prefetched_latest', None)
            conv.latest_message = pref[0] if pref else None
        return items

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        items = page if page is not None else list(queryset)
        self._attach_latest(items)
        serializer = self.get_serializer(items, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        pref = list(instance.messages.order_by('-created_at')[:1])
        instance.latest_message = pref[0] if pref else None
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='start')
    def start(self, request):
        serializer = StartConversationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        role = getattr(user, 'role', None)

        formateur_id = serializer.validated_data.get('formateur_id')
        apprenant_id = serializer.validated_data.get('apprenant_id')

        if role == 'APPRENANT':
            if not formateur_id:
                return Response(
                    {'detail': 'formateur_id est requis.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            formateur = User.objects.filter(
                id=formateur_id, role='FORMATEUR', is_active=True
            ).first()
            if not formateur:
                return Response(
                    {'detail': 'Formateur introuvable.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            conversation, _ = Conversation.objects.get_or_create(
                apprenant=user, formateur=formateur
            )
        elif role in ('FORMATEUR', 'ADMIN') or user.is_staff:
            if not apprenant_id:
                return Response(
                    {'detail': 'apprenant_id est requis.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            apprenant = User.objects.filter(
                id=apprenant_id, role='APPRENANT', is_active=True
            ).first()
            if not apprenant:
                return Response(
                    {'detail': 'Apprenant introuvable.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            formateur = user
            if role == 'ADMIN' and formateur_id:
                formateur = (
                    User.objects.filter(id=formateur_id, role='FORMATEUR').first() or user
                )
            conversation, _ = Conversation.objects.get_or_create(
                apprenant=apprenant, formateur=formateur
            )
        else:
            return Response({'detail': 'Action non autorisée.'}, status=status.HTTP_403_FORBIDDEN)

        conversation.latest_message = conversation.messages.order_by('-created_at').first()
        return Response(
            ConversationSerializer(conversation, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        conversation = self.get_object()
        user = request.user
        if user.id not in (conversation.apprenant_id, conversation.formateur_id) and not (
            getattr(user, 'role', None) == 'ADMIN' or user.is_staff
        ):
            return Response({'detail': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)

        if request.method == 'GET':
            conversation.messages.filter(est_lu=False).exclude(sender=user).update(est_lu=True)
            msgs = conversation.messages.select_related('sender').order_by('created_at')
            return Response(
                ChatMessageSerializer(msgs, many=True, context={'request': request}).data
            )

        payload = SendMessageSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        message = ChatMessage.objects.create(
            conversation=conversation,
            sender=user,
            body=payload.validated_data['body'],
        )
        Conversation.objects.filter(pk=conversation.pk).update(updated_at=timezone.now())

        try:
            from apps.notifications.services import notify_formateur_nouveau_message

            notify_formateur_nouveau_message(message)
        except Exception:
            pass

        return Response(
            ChatMessageSerializer(message, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class FormateurContactsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        role = getattr(user, 'role', None)

        if role == 'APPRENANT':
            formateur_ids = set(
                Inscription.objects.filter(apprenant=user)
                .exclude(parcours__formateur__isnull=True)
                .values_list('parcours__formateur_id', flat=True)
            )
            qs = User.objects.filter(role='FORMATEUR', is_active=True)
            if formateur_ids:
                qs = qs.filter(id__in=formateur_ids)
            qs = qs.order_by('first_name', 'last_name', 'email')
            return Response(FormateurContactSerializer(qs, many=True).data)

        if role in ('FORMATEUR', 'ADMIN') or user.is_staff:
            if role == 'FORMATEUR':
                apprenant_ids = list(
                    Inscription.objects.filter(parcours__formateur=user).values_list(
                        'apprenant_id', flat=True
                    )
                )
                if not apprenant_ids:
                    return Response([])
                qs = User.objects.filter(
                    role='APPRENANT', is_active=True, id__in=apprenant_ids
                )
            else:
                qs = User.objects.filter(role='APPRENANT', is_active=True)
            qs = qs.order_by('first_name', 'last_name', 'email')[:100]
            return Response(FormateurContactSerializer(qs, many=True).data)

        return Response([])
