from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ChatMessage, Conversation

User = get_user_model()


def _display_name(user):
    if not user:
        return ''
    full = f'{user.first_name or ""} {user.last_name or ""}'.strip()
    return full or user.email or str(user.pk)


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_nom = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = [
            'id',
            'conversation',
            'sender',
            'sender_nom',
            'body',
            'est_lu',
            'created_at',
            'is_mine',
        ]
        read_only_fields = ['id', 'sender', 'est_lu', 'created_at', 'conversation']

    def get_sender_nom(self, obj):
        return _display_name(obj.sender)

    def get_is_mine(self, obj):
        request = self.context.get('request')
        return bool(request and request.user and obj.sender_id == request.user.id)


class ConversationSerializer(serializers.ModelSerializer):
    apprenant_nom = serializers.SerializerMethodField()
    formateur_nom = serializers.SerializerMethodField()
    peer_id = serializers.SerializerMethodField()
    peer_nom = serializers.SerializerMethodField()
    peer_role = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id',
            'apprenant',
            'formateur',
            'apprenant_nom',
            'formateur_nom',
            'peer_id',
            'peer_nom',
            'peer_role',
            'last_message',
            'unread_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_apprenant_nom(self, obj):
        return _display_name(obj.apprenant)

    def get_formateur_nom(self, obj):
        return _display_name(obj.formateur)

    def _peer(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        if obj.apprenant_id == request.user.id:
            return obj.formateur
        return obj.apprenant

    def get_peer_id(self, obj):
        peer = self._peer(obj)
        return str(peer.id) if peer else None

    def get_peer_nom(self, obj):
        return _display_name(self._peer(obj))

    def get_peer_role(self, obj):
        peer = self._peer(obj)
        return getattr(peer, 'role', None) if peer else None

    def get_last_message(self, obj):
        msg = getattr(obj, 'latest_message', None)
        if msg is None:
            msg = obj.messages.order_by('-created_at').first()
        if not msg:
            return None
        return {
            'id': str(msg.id),
            'body': msg.body,
            'sender_id': str(msg.sender_id),
            'created_at': msg.created_at,
        }

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        return obj.messages.filter(est_lu=False).exclude(sender=request.user).count()


class StartConversationSerializer(serializers.Serializer):
    formateur_id = serializers.UUIDField(required=False)
    apprenant_id = serializers.UUIDField(required=False)


class SendMessageSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=5000, allow_blank=False)

    def validate_body(self, value):
        text = (value or '').strip()
        if not text:
            raise serializers.ValidationError('Le message ne peut pas être vide.')
        return text


class FormateurContactSerializer(serializers.ModelSerializer):
    nom = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'nom', 'specialite', 'role']

    def get_nom(self, obj):
        return _display_name(obj)
