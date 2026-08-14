from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    parcours_titre = serializers.CharField(source='parcours.titre', read_only=True, allow_null=True)

    class Meta:
        model = Notification
        fields = [
            'id',
            'titre',
            'message',
            'type_notification',
            'parcours',
            'parcours_titre',
            'lien',
            'est_lue',
            'date_creation',
        ]
        read_only_fields = fields
