from datetime import timedelta

from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import PresenceSession, RoomPeer, SessionLive, SignalMessage, StatutSession
from .permissions import IsAdminOrFormateur, IsSessionOwnerOrAdmin
from .serializers import SessionLiveSerializer, build_join_payload

PEER_TTL_SECONDS = 20
SIGNAL_TTL_SECONDS = 60


class SessionLiveViewSet(viewsets.ModelViewSet):
    serializer_class = SessionLiveSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdminOrFormateur(), IsSessionOwnerOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        qs = (
            SessionLive.objects.select_related('formateur', 'parcours')
            .annotate(_participants_count=Count('presences', distinct=True))
            .order_by('date_debut')
        )

        if role in ('ADMIN',) or user.is_staff:
            return qs
        if role == 'FORMATEUR':
            return qs.filter(formateur=user)
        qs = qs.filter(
            statut__in=[
                StatutSession.PLANIFIEE,
                StatutSession.EN_COURS,
                StatutSession.TERMINEE,
            ]
        )
        profil = getattr(user, 'profil_professionnel', None)
        if profil:
            qs = qs.filter(profil_cible=profil)
        return qs

    def _sync_session(self, session):
        if session.sync_runtime_statut():
            session.save(update_fields=['statut', 'updated_at'])
        return session

    def _purge_stale_peers(self, session):
        cutoff = timezone.now() - timedelta(seconds=PEER_TTL_SECONDS)
        RoomPeer.objects.filter(session=session, last_seen__lt=cutoff).delete()
        signal_cutoff = timezone.now() - timedelta(seconds=SIGNAL_TTL_SECONDS)
        SignalMessage.objects.filter(session=session, created_at__lt=signal_cutoff).delete()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        self._sync_session(instance)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user = self.request.user
        if user.is_authenticated:
            context['joined_session_ids'] = set(
                PresenceSession.objects.filter(apprenant=user).values_list(
                    'session_id', flat=True
                )
            )
        return context

    def perform_create(self, serializer):
        serializer.save(formateur=self.request.user)

    def list(self, request, *args, **kwargs):
        # Marque automatiquement les sessions dépassées comme TERMINEE
        now = timezone.now()
        SessionLive.objects.filter(
            date_fin__lt=now,
            statut__in=[StatutSession.PLANIFIEE, StatutSession.EN_COURS],
        ).update(statut=StatutSession.TERMINEE)
        return super().list(request, *args, **kwargs)

    def _assert_can_use_room(self, request, session):
        role = getattr(request.user, 'role', None)
        is_owner = session.formateur_id == request.user.id
        now = timezone.now()

        if session.statut in (
            StatutSession.BROUILLON,
            StatutSession.ANNULEE,
            StatutSession.TERMINEE,
        ) or now > session.date_fin:
            # Force TERMINEE if past end
            if now > session.date_fin and session.statut != StatutSession.TERMINEE:
                session.statut = StatutSession.TERMINEE
                session.save(update_fields=['statut', 'updated_at'])
            return Response(
                {
                    'detail': 'La session est terminée.',
                    'session_ended': True,
                    'date_fin': session.date_fin,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if role == 'APPRENANT':
            profil = getattr(request.user, 'profil_professionnel', None)
            if profil and session.profil_cible != profil:
                return Response(
                    {'detail': 'Accès refusé pour ce profil.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        if is_owner:
            return None
        if not session.is_joinable_now:
            return Response(
                {'detail': 'La salle n’est pas encore ouverte.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    @action(detail=False, methods=['get'], url_path='upcoming')
    def upcoming(self, request):
        now = timezone.now()
        qs = list(
            self.get_queryset()
            .filter(
                statut__in=[StatutSession.PLANIFIEE, StatutSession.EN_COURS],
                date_fin__gte=now,
            )
            .order_by('date_debut')[:12]
        )
        for session in qs:
            self._sync_session(session)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='join')
    def join(self, request, pk=None):
        session = self._sync_session(self.get_object())
        role = getattr(request.user, 'role', None)
        is_owner = session.formateur_id == request.user.id

        if role == 'APPRENANT':
            profil = getattr(request.user, 'profil_professionnel', None)
            if profil and session.profil_cible != profil:
                return Response(
                    {'detail': 'Cette session ne cible pas votre profil professionnel.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if session.statut == StatutSession.BROUILLON:
                return Response(
                    {'detail': 'Cette session n’est pas encore publiée.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        if not is_owner and not session.is_joinable_now:
            return Response(
                {
                    'detail': (
                        'La session n’est pas encore ouverte. '
                        'Vous pourrez rejoindre 15 minutes avant le début.'
                    ),
                    'date_debut': session.date_debut,
                    'peut_rejoindre': False,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if is_owner and session.statut in (
            StatutSession.BROUILLON,
            StatutSession.ANNULEE,
            StatutSession.TERMINEE,
        ):
            return Response(
                {'detail': 'Publiez la session pour ouvrir la salle vidéo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if timezone.now() > session.date_fin:
            if session.statut != StatutSession.TERMINEE:
                session.statut = StatutSession.TERMINEE
                session.save(update_fields=['statut', 'updated_at'])
            return Response(
                {
                    'detail': 'La session est terminée.',
                    'session_ended': True,
                    'date_fin': session.date_fin,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not session.room_name:
            session.room_name = f'emc{str(session.id).replace("-", "")}'
            session.save(update_fields=['room_name', 'updated_at'])

        if role == 'APPRENANT':
            PresenceSession.objects.get_or_create(
                session=session, apprenant=request.user
            )

        return Response(build_join_payload(session, request.user))

    @action(detail=True, methods=['post'], url_path='webrtc/heartbeat')
    def webrtc_heartbeat(self, request, pk=None):
        session = self._sync_session(self.get_object())
        denied = self._assert_can_use_room(request, session)
        if denied:
            return denied

        peer_id = (request.data.get('peer_id') or '').strip()
        display_name = (request.data.get('display_name') or '').strip()[:150]
        camera_on = request.data.get('camera_on', True)
        mic_on = request.data.get('mic_on', True)
        if not peer_id or len(peer_id) > 64:
            return Response({'detail': 'peer_id invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        self._purge_stale_peers(session)
        is_moderator = (
            session.formateur_id == request.user.id
            or getattr(request.user, 'role', None) == 'ADMIN'
            or request.user.is_staff
        )

        RoomPeer.objects.filter(session=session, user=request.user).exclude(
            peer_id=peer_id
        ).delete()

        peer, _ = RoomPeer.objects.update_or_create(
            session=session,
            peer_id=peer_id,
            defaults={
                'user': request.user,
                'display_name': display_name
                or f'{request.user.first_name} {request.user.last_name}'.strip()
                or request.user.email,
                'is_moderator': is_moderator,
                'camera_on': bool(camera_on),
                'mic_on': bool(mic_on),
            },
        )
        peer.save(
            update_fields=[
                'last_seen',
                'display_name',
                'is_moderator',
                'user',
                'camera_on',
                'mic_on',
            ]
        )

        peers = list(
            RoomPeer.objects.filter(session=session)
            .exclude(peer_id=peer_id)
            .values('peer_id', 'display_name', 'is_moderator', 'camera_on', 'mic_on')
        )
        remaining = max(0, int((session.date_fin - timezone.now()).total_seconds()))
        return Response(
            {
                'ok': True,
                'peers': peers,
                'date_fin': session.date_fin,
                'remaining_seconds': remaining,
                'session_ended': remaining <= 0,
            }
        )

    @action(detail=True, methods=['get'], url_path='webrtc/peers')
    def webrtc_peers(self, request, pk=None):
        session = self._sync_session(self.get_object())
        denied = self._assert_can_use_room(request, session)
        if denied:
            return denied
        self._purge_stale_peers(session)
        my_peer = (request.query_params.get('peer_id') or '').strip()
        qs = RoomPeer.objects.filter(session=session)
        if my_peer:
            qs = qs.exclude(peer_id=my_peer)
        return Response({'peers': list(qs.values('peer_id', 'display_name', 'is_moderator', 'camera_on', 'mic_on'))})

    @action(detail=True, methods=['post'], url_path='webrtc/signal')
    def webrtc_signal(self, request, pk=None):
        session = self._sync_session(self.get_object())
        denied = self._assert_can_use_room(request, session)
        if denied:
            return denied

        from_peer = (request.data.get('from_peer_id') or '').strip()
        to_peer = (request.data.get('to_peer_id') or '').strip()
        payload = request.data.get('payload')
        if not from_peer or not to_peer or not isinstance(payload, dict):
            return Response({'detail': 'Signal invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        if not RoomPeer.objects.filter(
            session=session, peer_id=from_peer, user=request.user
        ).exists():
            return Response(
                {'detail': 'Peer non enregistré. Envoyez un heartbeat d’abord.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        SignalMessage.objects.create(
            session=session,
            from_peer_id=from_peer,
            to_peer_id=to_peer,
            payload=payload,
        )
        return Response({'ok': True})

    @action(detail=True, methods=['get'], url_path='webrtc/signals')
    def webrtc_signals(self, request, pk=None):
        session = self._sync_session(self.get_object())
        denied = self._assert_can_use_room(request, session)
        if denied:
            return denied

        peer_id = (request.query_params.get('peer_id') or '').strip()
        if not peer_id:
            return Response({'detail': 'peer_id requis.'}, status=status.HTTP_400_BAD_REQUEST)

        self._purge_stale_peers(session)
        messages = list(
            SignalMessage.objects.filter(
                session=session, to_peer_id=peer_id, consumed=False
            ).order_by('created_at')[:50]
        )
        ids = [m.id for m in messages]
        if ids:
            SignalMessage.objects.filter(id__in=ids).update(consumed=True)

        return Response(
            {
                'signals': [
                    {'from_peer_id': m.from_peer_id, 'payload': m.payload}
                    for m in messages
                ]
            }
        )

    @action(detail=True, methods=['post'], url_path='webrtc/leave')
    def webrtc_leave(self, request, pk=None):
        session = self.get_object()
        peer_id = (request.data.get('peer_id') or '').strip()
        qs = RoomPeer.objects.filter(session=session, user=request.user)
        if peer_id:
            qs = qs.filter(peer_id=peer_id)
        qs.delete()
        if peer_id:
            SignalMessage.objects.filter(session=session, to_peer_id=peer_id).delete()
            SignalMessage.objects.filter(session=session, from_peer_id=peer_id).delete()
        return Response({'ok': True})
