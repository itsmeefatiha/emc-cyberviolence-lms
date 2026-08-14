from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .models import PresenceSession, SessionLive, StatutSession


class SessionLiveSerializer(serializers.ModelSerializer):
    formateur_nom = serializers.SerializerMethodField()
    formateur_photo = serializers.SerializerMethodField()
    profil_cible_display = serializers.CharField(
        source='get_profil_cible_display', read_only=True
    )
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    parcours_titre = serializers.CharField(
        source='parcours.titre', read_only=True, default=None
    )
    peut_rejoindre = serializers.SerializerMethodField()
    est_terminee = serializers.SerializerMethodField()
    participants_count = serializers.SerializerMethodField()
    deja_rejoint = serializers.SerializerMethodField()
    room_path = serializers.SerializerMethodField()

    class Meta:
        model = SessionLive
        fields = [
            'id',
            'titre',
            'description',
            'profil_cible',
            'profil_cible_display',
            'formateur',
            'formateur_nom',
            'formateur_photo',
            'parcours',
            'parcours_titre',
            'statut',
            'statut_display',
            'date_debut',
            'date_fin',
            'room_name',
            'room_path',
            'peut_rejoindre',
            'est_terminee',
            'participants_count',
            'deja_rejoint',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'formateur',
            'room_name',
            'created_at',
            'updated_at',
        ]

    def get_formateur_nom(self, obj):
        user = obj.formateur
        if not user:
            return ''
        full = f'{user.first_name or ""} {user.last_name or ""}'.strip()
        return full or user.email

    def get_formateur_photo(self, obj):
        user = obj.formateur
        if not user or not getattr(user, 'photo', None):
            return None
        try:
            url = user.photo.url
        except (ValueError, AttributeError):
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_peut_rejoindre(self, obj):
        if self._is_terminee(obj):
            return False
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if obj.formateur_id == request.user.id:
                return obj.statut not in (
                    StatutSession.BROUILLON,
                    StatutSession.ANNULEE,
                    StatutSession.TERMINEE,
                )
        return obj.is_joinable_now

    def _is_terminee(self, obj):
        if obj.statut == StatutSession.TERMINEE:
            return True
        if obj.date_fin and timezone.now() > obj.date_fin:
            return True
        return False

    def get_est_terminee(self, obj):
        return self._is_terminee(obj)

    def get_participants_count(self, obj):
        return getattr(obj, '_participants_count', None) or obj.presences.count()

    def get_deja_rejoint(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        joined_ids = self.context.get('joined_session_ids')
        if joined_ids is not None:
            return obj.id in joined_ids
        return PresenceSession.objects.filter(
            session=obj, apprenant=request.user
        ).exists()

    def get_room_path(self, obj):
        return f'/live-sessions/{obj.id}/room'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if self._is_terminee(instance):
            data['statut'] = StatutSession.TERMINEE
            data['statut_display'] = 'Terminée'
            data['peut_rejoindre'] = False
            data['est_terminee'] = True
        return data

    def validate(self, attrs):
        date_debut = attrs.get('date_debut', getattr(self.instance, 'date_debut', None))
        date_fin = attrs.get('date_fin', getattr(self.instance, 'date_fin', None))
        if date_debut and date_fin and date_fin <= date_debut:
            raise serializers.ValidationError(
                {'date_fin': 'La date de fin doit être postérieure au début.'}
            )

        statut = attrs.get('statut', getattr(self.instance, 'statut', StatutSession.BROUILLON))
        if statut == StatutSession.PLANIFIEE and date_debut and date_debut < timezone.now():
            if not self.instance or self.instance.statut == StatutSession.BROUILLON:
                raise serializers.ValidationError(
                    {'date_debut': 'La session doit être programmée dans le futur.'}
                )
        return attrs


def build_join_payload(session, user):
    full_name = f'{user.first_name or ""} {user.last_name or ""}'.strip() or user.email
    is_moderator = (
        session.formateur_id == user.id
        or getattr(user, 'role', None) in ('ADMIN', 'FORMATEUR')
        or user.is_staff
    )
    return {
        'session_id': str(session.id),
        'titre': session.titre,
        'room_name': session.room_name or f'emc{str(session.id).replace("-", "")}',
        'room_path': f'/live-sessions/{session.id}/room',
        'display_name': full_name,
        'is_moderator': is_moderator,
        'date_debut': session.date_debut,
        'date_fin': session.date_fin,
        'ice_servers': getattr(
            settings,
            'LIVE_SESSION_ICE_SERVERS',
            [
                {'urls': 'stun:stun.l.google.com:19302'},
                {'urls': 'stun:stun1.l.google.com:19302'},
            ],
        ),
        'peut_rejoindre': True,
        'message': 'Salle WebRTC native prête.',
    }

