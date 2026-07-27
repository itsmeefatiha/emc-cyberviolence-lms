from django.db import transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import (
    Contenu,
    ContenuDocument,
    ContenuSCORM,
    ContenuVideo,
    Lecon,
    Module,
    Parcours,
    StatutPublication,
)
from .services import process_scorm_package, process_video_content

CONTENT_TYPE_DOCUMENT = 'DOCUMENT'
CONTENT_TYPE_VIDEO = 'VIDEO'
CONTENT_TYPE_SCORM = 'SCORM'
CONTENT_TYPE_CHOICES = (
    (CONTENT_TYPE_DOCUMENT, _('Document')),
    (CONTENT_TYPE_VIDEO, _('Vidéo')),
    (CONTENT_TYPE_SCORM, _('SCORM')),
)


def _user_is_admin(user):
    return bool(
        user and user.is_authenticated and (user.is_staff or getattr(user, 'role', None) == 'ADMIN')
    )


def _user_is_formateur(user):
    return bool(user and user.is_authenticated and getattr(user, 'role', None) == 'FORMATEUR')


def _can_manage_parcours(user, parcours):
    if _user_is_admin(user):
        return True
    return _user_is_formateur(user) and parcours.formateur_id == getattr(user, 'id', None)


def _can_manage_module(user, module):
    return _can_manage_parcours(user, module.parcours)


def _can_manage_lecon(user, lecon):
    return _can_manage_parcours(user, lecon.module.parcours)


def _publication_issues(parcours):
    issues = []
    modules = list(parcours.modules.prefetch_related('lecons__contenu').all())

    if not modules:
        return ['Impossible de publier ce parcours : il doit contenir au moins un module.']

    for module in modules:
        lecons = list(module.lecons.all())
        if not lecons:
            issues.append(
                f'Impossible de publier ce parcours : le module « {module.titre} » doit contenir au moins une leçon.'
            )
            continue

        for lecon in lecons:
            if not hasattr(lecon, 'contenu'):
                issues.append(
                    f'Impossible de publier ce parcours : la leçon « {lecon.titre} » doit avoir un contenu attaché.'
                )

    return issues


class ContenuDocumentSerializer(serializers.ModelSerializer):
    lecon = serializers.PrimaryKeyRelatedField(queryset=Lecon.objects.all())

    class Meta:
        model = ContenuDocument
        fields = ['id', 'lecon', 'titre_fichier', 'fichier', 'format', 'date_creation']
        read_only_fields = ['id', 'date_creation']

    def validate(self, attrs):
        if self.instance is None:
            missing = []
            if not attrs.get('titre_fichier'):
                missing.append('titre_fichier')
            if not attrs.get('fichier'):
                missing.append('fichier')
            if not attrs.get('format'):
                missing.append('format')
            if missing:
                raise serializers.ValidationError(
                    {
                        field: _('Ce champ est requis pour créer un contenu document.')
                        for field in missing
                    }
                )
        return attrs

    def validate_lecon(self, value):
        request = self.context.get('request')
        if request and not _can_manage_lecon(request.user, value):
            raise serializers.ValidationError(
                _('Vous ne pouvez pas rattacher ce contenu à cette leçon.')
            )
        return value


class ContenuVideoSerializer(serializers.ModelSerializer):
    lecon = serializers.PrimaryKeyRelatedField(queryset=Lecon.objects.all())

    class Meta:
        model = ContenuVideo
        fields = [
            'id',
            'lecon',
            'titre_fichier',
            'fichier_source',
            'url_stream',
            'duree',
            'statut_encodage',
            'date_creation',
        ]
        read_only_fields = ['id', 'url_stream', 'duree', 'statut_encodage', 'date_creation']

    def validate(self, attrs):
        if self.instance is None:
            missing = []
            if not attrs.get('titre_fichier'):
                missing.append('titre_fichier')
            if not attrs.get('fichier_source'):
                missing.append('fichier_source')
            if missing:
                raise serializers.ValidationError(
                    {
                        field: _('Ce champ est requis pour créer une vidéo.')
                        for field in missing
                    }
                )
        return attrs

    def validate_lecon(self, value):
        request = self.context.get('request')
        if request and not _can_manage_lecon(request.user, value):
            raise serializers.ValidationError(
                _('Vous ne pouvez pas rattacher ce contenu à cette leçon.')
            )
        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        fichier_source = validated_data.get('fichier_source')
        instance = super().update(instance, validated_data)
        if fichier_source is not None:
            process_video_content(instance)
        return instance


class ContenuSCORMSerializer(serializers.ModelSerializer):
    lecon = serializers.PrimaryKeyRelatedField(queryset=Lecon.objects.all())

    class Meta:
        model = ContenuSCORM
        fields = [
            'id',
            'lecon',
            'titre_fichier',
            'package_url',
            'standard',
            'version',
            'launch_path_url',
            'date_creation',
        ]
        read_only_fields = ['id', 'launch_path_url', 'date_creation']

    def validate(self, attrs):
        if self.instance is None:
            missing = []
            if not attrs.get('titre_fichier'):
                missing.append('titre_fichier')
            if not attrs.get('package_url'):
                missing.append('package_url')
            if missing:
                raise serializers.ValidationError(
                    {
                        field: _('Ce champ est requis pour créer un package SCORM.')
                        for field in missing
                    }
                )
        return attrs

    def validate_lecon(self, value):
        request = self.context.get('request')
        if request and not _can_manage_lecon(request.user, value):
            raise serializers.ValidationError(
                _('Vous ne pouvez pas rattacher ce contenu à cette leçon.')
            )
        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        package_url = validated_data.get('package_url')
        instance = super().update(instance, validated_data)
        if package_url is not None:
            process_scorm_package(instance)
        return instance


class ContenuPolymorphicSerializer(serializers.ModelSerializer):
    """Identifie le sous-type réel de Contenu (Document, Video, SCORM)."""

    type_contenu = serializers.SerializerMethodField()
    details = serializers.SerializerMethodField()

    class Meta:
        model = Contenu
        fields = ['id', 'titre_fichier', 'type_contenu', 'details']

    def get_type_contenu(self, obj):
        if hasattr(obj, 'contenudocument'):
            return CONTENT_TYPE_DOCUMENT
        if hasattr(obj, 'contenuvideo'):
            return CONTENT_TYPE_VIDEO
        if hasattr(obj, 'contenuscorm'):
            return CONTENT_TYPE_SCORM
        return 'GENERIC'

    def get_details(self, obj):
        if hasattr(obj, 'contenudocument'):
            return ContenuDocumentSerializer(obj.contenudocument, context=self.context).data
        if hasattr(obj, 'contenuvideo'):
            return ContenuVideoSerializer(obj.contenuvideo, context=self.context).data
        if hasattr(obj, 'contenuscorm'):
            return ContenuSCORMSerializer(obj.contenuscorm, context=self.context).data
        return None


class LeconSerializer(serializers.ModelSerializer):
    module = serializers.PrimaryKeyRelatedField(queryset=Module.objects.all())
    contenu = ContenuPolymorphicSerializer(read_only=True)
    contenu_type = serializers.ChoiceField(
        choices=CONTENT_TYPE_CHOICES, required=False, write_only=True
    )
    contenu_titre_fichier = serializers.CharField(required=False, write_only=True)
    contenu_fichier = serializers.FileField(required=False, write_only=True)
    contenu_format = serializers.CharField(required=False, write_only=True)
    contenu_video_source = serializers.FileField(required=False, write_only=True)
    contenu_package_url = serializers.FileField(required=False, write_only=True)
    contenu_standard = serializers.CharField(required=False, write_only=True)
    contenu_version = serializers.CharField(required=False, write_only=True)

    class Meta:
        model = Lecon
        fields = [
            'id',
            'module',
            'titre',
            'duree_estimee',
            'ordre',
            'contenu',
            'contenu_type',
            'contenu_titre_fichier',
            'contenu_fichier',
            'contenu_format',
            'contenu_video_source',
            'contenu_package_url',
            'contenu_standard',
            'contenu_version',
        ]

    def validate_module(self, value):
        request = self.context.get('request')
        if request and not _can_manage_module(request.user, value):
            raise serializers.ValidationError(
                _('Vous ne pouvez pas rattacher cette leçon à ce module.')
            )
        return value

    def validate(self, attrs):
        content_field_names = [
            'contenu_titre_fichier',
            'contenu_fichier',
            'contenu_format',
            'contenu_video_source',
            'contenu_package_url',
            'contenu_standard',
            'contenu_version',
        ]
        content_present = any(field in attrs for field in content_field_names)

        existing_instance = None
        existing_type = None
        if self.instance is not None:
            existing_content = self._current_contenu(self.instance)
            existing_instance, existing_type = self._subclass_from_contenu(existing_content)

        content_type = attrs.get('contenu_type') or self.initial_data.get('contenu_type') or existing_type

        if content_present and not content_type:
            raise serializers.ValidationError(
                {'contenu_type': _('Veuillez préciser le type de contenu à créer ou mettre à jour.')}
            )

        is_new_content = existing_instance is None or existing_type != content_type

        if content_type == CONTENT_TYPE_DOCUMENT and is_new_content:
            errors = {}
            if not attrs.get('contenu_titre_fichier'):
                errors['contenu_titre_fichier'] = _('Le titre du document est requis.')
            if not attrs.get('contenu_fichier'):
                errors['contenu_fichier'] = _('Le fichier document est requis.')
            if not attrs.get('contenu_format'):
                errors['contenu_format'] = _('Le format du document est requis.')
            if errors:
                raise serializers.ValidationError(errors)

        if content_type == CONTENT_TYPE_VIDEO and is_new_content:
            errors = {}
            if not attrs.get('contenu_titre_fichier'):
                errors['contenu_titre_fichier'] = _('Le titre de la vidéo est requis.')
            if not attrs.get('contenu_video_source'):
                errors['contenu_video_source'] = _('Le fichier vidéo source est requis.')
            if errors:
                raise serializers.ValidationError(errors)

        if content_type == CONTENT_TYPE_SCORM and is_new_content:
            errors = {}
            if not attrs.get('contenu_titre_fichier'):
                errors['contenu_titre_fichier'] = _('Le titre du package SCORM est requis.')
            if not attrs.get('contenu_package_url'):
                errors['contenu_package_url'] = _('L’archive SCORM est requise.')
            if errors:
                raise serializers.ValidationError(errors)

        return attrs

    def _current_contenu(self, lecon):
        try:
            return lecon.contenu
        except Contenu.DoesNotExist:
            return None

    def _subclass_from_contenu(self, contenu):
        if contenu is None:
            return None, None
        if hasattr(contenu, 'contenudocument'):
            return contenu.contenudocument, CONTENT_TYPE_DOCUMENT
        if hasattr(contenu, 'contenuvideo'):
            return contenu.contenuvideo, CONTENT_TYPE_VIDEO
        if hasattr(contenu, 'contenuscorm'):
            return contenu.contenuscorm, CONTENT_TYPE_SCORM
        return None, None

    def _extract_content_payload(self, validated_data):
        content_type = validated_data.pop('contenu_type', None) or self.initial_data.get('contenu_type')
        content_payload = {}
        for field in [
            'contenu_titre_fichier',
            'contenu_fichier',
            'contenu_format',
            'contenu_video_source',
            'contenu_package_url',
            'contenu_standard',
            'contenu_version',
        ]:
            if field in validated_data:
                content_payload[field] = validated_data.pop(field)
        return content_type, content_payload

    def _create_or_update_contenu(self, lecon, content_type, content_payload, is_update=False):
        content_model_map = {
            CONTENT_TYPE_DOCUMENT: ContenuDocument,
            CONTENT_TYPE_VIDEO: ContenuVideo,
            CONTENT_TYPE_SCORM: ContenuSCORM,
        }

        model = content_model_map[content_type]
        existing_content = self._current_contenu(lecon)
        existing_instance, existing_type = self._subclass_from_contenu(existing_content)

        if existing_instance is not None and existing_type != content_type:
            existing_instance.delete()
            existing_instance = None

        title = content_payload.get('contenu_titre_fichier')
        if existing_instance is not None and not title:
            title = existing_instance.titre_fichier

        payload = {'lecon': lecon, 'titre_fichier': title or ''}

        if content_type == CONTENT_TYPE_DOCUMENT:
            fichier = content_payload.get('contenu_fichier')
            format_ = content_payload.get('contenu_format')
            if existing_instance is not None:
                fichier = fichier or existing_instance.fichier
                format_ = format_ or existing_instance.format
            payload.update({'fichier': fichier, 'format': format_})
        elif content_type == CONTENT_TYPE_VIDEO:
            fichier_source = content_payload.get('contenu_video_source')
            if existing_instance is not None:
                fichier_source = fichier_source or existing_instance.fichier_source
            payload.update({'fichier_source': fichier_source})
        elif content_type == CONTENT_TYPE_SCORM:
            package_url = content_payload.get('contenu_package_url')
            standard = content_payload.get('contenu_standard')
            version = content_payload.get('contenu_version')
            if existing_instance is not None:
                package_url = package_url or existing_instance.package_url
                standard = standard or existing_instance.standard
                version = version or existing_instance.version
            payload.update(
                {
                    'package_url': package_url,
                    'standard': standard or 'SCORM 1.2',
                    'version': version or '1.2',
                }
            )

        if existing_instance is not None:
            for attr, value in payload.items():
                if attr != 'lecon':
                    setattr(existing_instance, attr, value)
            existing_instance.save()
            instance = existing_instance
        else:
            instance = model.objects.create(**payload)

        if is_update:
            if content_type == CONTENT_TYPE_VIDEO and content_payload.get('contenu_video_source'):
                process_video_content(instance)
            elif content_type == CONTENT_TYPE_SCORM and content_payload.get('contenu_package_url'):
                process_scorm_package(instance)

        return instance

    @transaction.atomic
    def create(self, validated_data):
        content_type, content_payload = self._extract_content_payload(validated_data)
        lecon = super().create(validated_data)
        if content_type:
            self._create_or_update_contenu(
                lecon,
                content_type,
                content_payload,
                is_update=False,
            )
        return lecon

    @transaction.atomic
    def update(self, instance, validated_data):
        content_type, content_payload = self._extract_content_payload(validated_data)
        lecon = super().update(instance, validated_data)
        if content_type:
            self._create_or_update_contenu(
                lecon,
                content_type,
                content_payload,
                is_update=True,
            )
        return lecon


class ModuleSerializer(serializers.ModelSerializer):
    parcours = serializers.PrimaryKeyRelatedField(queryset=Parcours.objects.all())
    lecons = LeconSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ['id', 'parcours', 'titre', 'description', 'ordre', 'lecons']

    def validate_parcours(self, value):
        request = self.context.get('request')
        if request and not _can_manage_parcours(request.user, value):
            raise serializers.ValidationError(
                _('Vous ne pouvez pas rattacher ce module à ce parcours.')
            )
        return value


class ParcoursWriteSerializer(serializers.ModelSerializer):
    formateur = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Parcours
        fields = [
            'id',
            'titre',
            'description',
            'profil_cible',
            'statut',
            'formateur',
            'ordre',
            'date_creation',
            'date_modification',
        ]
        read_only_fields = ['id', 'formateur', 'date_creation', 'date_modification']

    def validate(self, attrs):
        target_status = attrs.get(
            'statut', getattr(self.instance, 'statut', StatutPublication.BROUILLON)
        )

        if target_status == StatutPublication.PUBLIE:
            if self.instance is None:
                raise serializers.ValidationError(
                    {
                        'statut': [
                            'Impossible de publier ce parcours : il doit contenir au moins un module.'
                        ]
                    }
                )

            issues = _publication_issues(self.instance)
            if issues:
                raise serializers.ValidationError({'statut': issues})

        return attrs


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