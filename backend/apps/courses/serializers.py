from rest_framework import serializers

from .models import (
    Contenu,
    ContenuDocument,
    ContenuSCORM,
    ContenuVideo,
    Lecon,
    Module,
    Parcours,
)

# ==========================================
# 1. SERIALIZERS DE CONTENU (POLYMORPHISME)
# ==========================================


class ContenuDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContenuDocument
        fields = ['id', 'titre_fichier', 'fichier', 'format', 'date_creation']


class ContenuVideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContenuVideo
        fields = [
            'id',
            'titre_fichier',
            'url_stream',
            'duree',
            'statut_encodage',
            'date_creation',
        ]


class ContenuSCORMSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContenuSCORM
        fields = [
            'id',
            'titre_fichier',
            'package_url',
            'standard',
            'version',
            'date_creation',
        ]


class ContenuPolymorphicSerializer(serializers.ModelSerializer):
    """Serializer dynamique identifiant le sous-type réel de Contenu (Document,

    Video, SCORM).
    """

    type_contenu = serializers.SerializerMethodField()
    details = serializers.SerializerMethodField()

    class Meta:
        model = Contenu
        fields = ['id', 'titre_fichier', 'type_contenu', 'details']

    def get_type_contenu(self, obj):
        if hasattr(obj, 'contenudocument'):
            return 'DOCUMENT'
        elif hasattr(obj, 'contenuvideo'):
            return 'VIDEO'
        elif hasattr(obj, 'contenuscorm'):
            return 'SCORM'
        return 'GENERIC'

    def get_details(self, obj):
        if hasattr(obj, 'contenudocument'):
            return ContenuDocumentSerializer(
                obj.contenudocument, context=self.context
            ).data
        elif hasattr(obj, 'contenuvideo'):
            return ContenuVideoSerializer(
                obj.contenuvideo, context=self.context
            ).data
        elif hasattr(obj, 'contenuscorm'):
            return ContenuSCORMSerializer(
                obj.contenuscorm, context=self.context
            ).data
        return None


# ==========================================
# 2. SERIALIZERS HIERARCHIQUES (LECON, MODULE, PARCOURS)
# ==========================================


class LeconSerializer(serializers.ModelSerializer):
    contenu = ContenuPolymorphicSerializer(read_only=True)

    class Meta:
        model = Lecon
        fields = ['id', 'titre', 'duree_estimee', 'ordre', 'contenu']


class ModuleSerializer(serializers.ModelSerializer):
    lecons = LeconSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ['id', 'titre', 'description', 'ordre', 'lecons']


class ParcoursListSerializer(serializers.ModelSerializer):
    """Serializer pour le catalogue / la liste des parcours (vue synthétique)."""

    formateur_nom = serializers.CharField(
        source='formateur.get_full_name', read_only=True
    )
    profil_cible_display = serializers.CharField(
        source='get_profil_cible_display', read_only=True
    )
    nombre_modules = serializers.IntegerField(
        source='modules.count', read_only=True
    )

    class Meta:
        model = Parcours
        fields = [
            'id',
            'titre',
            'description',
            'profil_cible',
            'profil_cible_display',
            'statut',
            'formateur',
            'formateur_nom',
            'nombre_modules',
            'ordre',
            'date_creation',
        ]


class ParcoursDetailSerializer(serializers.ModelSerializer):
    """Serializer détaillé renvoyant l'intégralité de l'arbre pédagogique."""

    formateur_nom = serializers.CharField(
        source='formateur.get_full_name', read_only=True
    )
    modules = ModuleSerializer(many=True, read_only=True)

    class Meta:
        model = Parcours
        fields = [
            'id',
            'titre',
            'description',
            'profil_cible',
            'statut',
            'formateur',
            'formateur_nom',
            'ordre',
            'modules',
            'date_creation',
            'date_modification',
        ]