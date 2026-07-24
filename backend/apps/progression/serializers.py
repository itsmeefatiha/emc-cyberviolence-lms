from rest_framework import serializers
from .models import Progression


class ProgressionSerializer(serializers.ModelSerializer):
    apprenant = serializers.HiddenField(
        default=serializers.CurrentUserDefault()
    )

    class Meta:
        model = Progression
        fields = [
            'id',
            'apprenant',
            'lecon',
            'statut',
            'temps_passe',
            'date_debut',
            'date_fin',
        ]
        read_only_fields = ['id', 'date_debut', 'date_fin']