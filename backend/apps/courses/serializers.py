from django.db import transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import (
    Contenu,
    ContenuDocument,
    ContenuSCORM,
    ContenuTexte,
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
CONTENT_TYPE_TEXTE = 'TEXTE'
CONTENT_TYPE_CHOICES = (
    (CONTENT_TYPE_DOCUMENT, _('Document')),
    (CONTENT_TYPE_VIDEO, _('Vidéo')),
    (CONTENT_TYPE_SCORM, _('SCORM')),
    (CONTENT_TYPE_TEXTE, _('Texte simple')),
)


def _filename_stem(name):
    if not name:
        return ''
    base = getattr(name, 'name', name)
    base = str(base).replace('\\', '/').split('/')[-1]
    if '.' in base:
        return base.rsplit('.', 1)[0]
    return base


def _filename_extension(name):
    if not name:
        return ''
    base = getattr(name, 'name', name)
    base = str(base).replace('\\', '/').split('/')[-1]
    if '.' in base:
        return base.rsplit('.', 1)[-1].upper()
    return ''


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
            if not attrs.get('fichier'):
                raise serializers.ValidationError(
                    {'fichier': _('Ce champ est requis pour créer un contenu document.')}
                )
            if not attrs.get('titre_fichier') and attrs.get('fichier'):
                attrs['titre_fichier'] = _filename_stem(attrs['fichier']) or 'Document'
            if not attrs.get('format') and attrs.get('fichier'):
                attrs['format'] = _filename_extension(attrs['fichier']) or 'PDF'
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
    url_stream = serializers.SerializerMethodField()

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

    def get_url_stream(self, obj):
        """Retourne une URL de lecture réelle (évite les faux chemins .m3u8)."""
        stream = (obj.url_stream or '').strip()
        if stream and not stream.lower().endswith('.m3u8'):
            return stream
        if obj.fichier_source:
            try:
                return obj.fichier_source.url
            except ValueError:
                return ''
        return stream

    def validate(self, attrs):
        if self.instance is None:
            if not attrs.get('fichier_source'):
                raise serializers.ValidationError(
                    {'fichier_source': _('Ce champ est requis pour créer une vidéo.')}
                )
            if not attrs.get('titre_fichier') and attrs.get('fichier_source'):
                attrs['titre_fichier'] = _filename_stem(attrs['fichier_source']) or 'Vidéo'
        return attrs

    def validate_lecon(self, value):
        request = self.context.get('request')
        if request and not _can_manage_lecon(request.user, value):
            raise serializers.ValidationError(
                _('Vous ne pouvez pas rattacher ce contenu à cette leçon.')
            )
        return value

    @transaction.atomic
    def create(self, validated_data):
        instance = super().create(validated_data)
        process_video_content(instance)
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        fichier_source = validated_data.get('fichier_source')
        instance = super().update(instance, validated_data)
        if fichier_source is not None:
            process_video_content(instance)
        elif not instance.url_stream and instance.fichier_source:
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



class ContenuTexteSerializer(serializers.ModelSerializer):
    lecon = serializers.PrimaryKeyRelatedField(queryset=Lecon.objects.all())

    class Meta:
        model = ContenuTexte
        fields = ['id', 'lecon', 'titre_fichier', 'corps', 'date_creation']
        read_only_fields = ['id', 'date_creation']

    def validate(self, attrs):
        if self.instance is None and not attrs.get('corps'):
            raise serializers.ValidationError(
                {'corps': _('Le texte du contenu est requis.')}
            )
        return attrs

    def validate_lecon(self, value):
        request = self.context.get('request')
        if request and not _can_manage_lecon(request.user, value):
            raise serializers.ValidationError(
                _('Vous ne pouvez pas rattacher ce contenu à cette leçon.')
            )
        return value


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
        if hasattr(obj, 'contenutexte'):
            return CONTENT_TYPE_TEXTE
        return 'GENERIC'

    def get_details(self, obj):
        if hasattr(obj, 'contenudocument'):
            return ContenuDocumentSerializer(obj.contenudocument, context=self.context).data
        if hasattr(obj, 'contenuvideo'):
            return ContenuVideoSerializer(obj.contenuvideo, context=self.context).data
        if hasattr(obj, 'contenuscorm'):
            return ContenuSCORMSerializer(obj.contenuscorm, context=self.context).data
        if hasattr(obj, 'contenutexte'):
            return ContenuTexteSerializer(obj.contenutexte, context=self.context).data
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
    contenu_corps = serializers.CharField(required=False, write_only=True, allow_blank=True)

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
            'contenu_corps',
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
            'contenu_corps',
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
            if not attrs.get('contenu_fichier'):
                raise serializers.ValidationError(
                    {'contenu_fichier': _('Le fichier document est requis.')}
                )

        if content_type == CONTENT_TYPE_VIDEO and is_new_content:
            if not attrs.get('contenu_video_source'):
                raise serializers.ValidationError(
                    {'contenu_video_source': _('Le fichier vidéo source est requis.')}
                )

        if content_type == CONTENT_TYPE_SCORM and is_new_content:
            if not attrs.get('contenu_package_url'):
                raise serializers.ValidationError(
                    {'contenu_package_url': _('L’archive SCORM est requise.')}
                )

        if content_type == CONTENT_TYPE_TEXTE and is_new_content:
            if not (attrs.get('contenu_corps') or '').strip():
                raise serializers.ValidationError(
                    {'contenu_corps': _('Le texte du contenu est requis.')}
                )

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
        if hasattr(contenu, 'contenutexte'):
            return contenu.contenutexte, CONTENT_TYPE_TEXTE
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
            'contenu_corps',
        ]:
            if field in validated_data:
                content_payload[field] = validated_data.pop(field)
        return content_type, content_payload

    def _create_or_update_contenu(self, lecon, content_type, content_payload, is_update=False):
        content_model_map = {
            CONTENT_TYPE_DOCUMENT: ContenuDocument,
            CONTENT_TYPE_VIDEO: ContenuVideo,
            CONTENT_TYPE_SCORM: ContenuSCORM,
            CONTENT_TYPE_TEXTE: ContenuTexte,
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

        uploaded = (
            content_payload.get('contenu_fichier')
            or content_payload.get('contenu_video_source')
            or content_payload.get('contenu_package_url')
        )
        if uploaded and not title:
            title = _filename_stem(uploaded) or lecon.titre

        payload = {'lecon': lecon, 'titre_fichier': title or lecon.titre or 'Contenu'}

        if content_type == CONTENT_TYPE_DOCUMENT:
            fichier = content_payload.get('contenu_fichier')
            format_ = content_payload.get('contenu_format')
            if existing_instance is not None:
                fichier = fichier or existing_instance.fichier
                format_ = format_ or existing_instance.format
            if fichier and not format_:
                format_ = _filename_extension(fichier) or 'PDF'
            payload.update({'fichier': fichier, 'format': format_ or 'PDF'})
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
        elif content_type == CONTENT_TYPE_TEXTE:
            corps = content_payload.get('contenu_corps')
            if existing_instance is not None and corps is None:
                corps = existing_instance.corps
            payload.update({'corps': corps or ''})
            if not payload.get('titre_fichier'):
                payload['titre_fichier'] = lecon.titre or 'Texte'


        if existing_instance is not None:
            for attr, value in payload.items():
                if attr != 'lecon':
                    setattr(existing_instance, attr, value)
            existing_instance.save()
            instance = existing_instance
        else:
            instance = model.objects.create(**payload)

        # Toujours finaliser vidéo/SCORM après create ou update fichier
        if content_type == CONTENT_TYPE_VIDEO and (
            content_payload.get('contenu_video_source') or not is_update
        ):
            if instance.fichier_source:
                process_video_content(instance)
        elif content_type == CONTENT_TYPE_SCORM and (
            content_payload.get('contenu_package_url') or not is_update
        ):
            if getattr(instance, 'package_url', None):
                process_scorm_package(instance)

        return instance

    @transaction.atomic
    def create(self, validated_data):
        if not validated_data.get('ordre'):
            module = validated_data.get('module')
            if module is not None:
                max_ordre = (
                    Lecon.objects.filter(module=module)
                    .order_by('-ordre')
                    .values_list('ordre', flat=True)
                    .first()
                )
                validated_data['ordre'] = (max_ordre or 0) + 1
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
    quizzes = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ['id', 'parcours', 'titre', 'description', 'ordre', 'lecons', 'quizzes']

    def get_quizzes(self, obj):
        quizzes = getattr(obj, 'quizzes', None)
        if quizzes is None:
            return []
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        passed_ids = set()
        if user and user.is_authenticated:
            from apps.quizzes.models import TentativeQuiz

            quiz_ids = [quiz.id for quiz in quizzes.all()]
            if quiz_ids:
                passed_ids = set(
                    TentativeQuiz.objects.filter(
                        apprenant=user,
                        quiz_id__in=quiz_ids,
                        est_reussi=True,
                    ).values_list('quiz_id', flat=True)
                )
        return [
            {
                'id': str(quiz.id),
                'titre': quiz.titre,
                'description': quiz.description,
                'note_de_passage': float(quiz.note_de_passage),
                'duree_minutes': quiz.duree_minutes,
                'max_tentatives': quiz.max_tentatives,
                'lecon': str(quiz.lecon_id) if quiz.lecon_id else None,
                'questions_count': quiz.questions.count(),
                'deja_reussi': quiz.id in passed_ids,
            }
            for quiz in quizzes.all()
        ]

    def validate_parcours(self, value):
        request = self.context.get('request')
        if request and not _can_manage_parcours(request.user, value):
            raise serializers.ValidationError(
                _('Vous ne pouvez pas rattacher ce module à ce parcours.')
            )
        return value

    def create(self, validated_data):
        if not validated_data.get('ordre'):
            parcours = validated_data.get('parcours')
            if parcours is not None:
                max_ordre = (
                    Module.objects.filter(parcours=parcours)
                    .order_by('-ordre')
                    .values_list('ordre', flat=True)
                    .first()
                )
                validated_data['ordre'] = (max_ordre or 0) + 1
        return super().create(validated_data)


def _user_is_enrolled(user, parcours):
    if not user or not user.is_authenticated:
        return False
    from apps.progression.models import Inscription, Progression

    if Inscription.objects.filter(apprenant=user, parcours=parcours).exists():
        return True
    return Progression.objects.filter(
        apprenant=user,
        lecon__module__parcours=parcours,
    ).exists()


def _user_has_favorite(user, parcours):
    if not user or not user.is_authenticated:
        return False
    from apps.progression.models import Favori

    return Favori.objects.filter(apprenant=user, parcours=parcours).exists()



def _formateur_display_name(user):
    """Nom affichable du créateur (admin ou formateur)."""
    if not user:
        return ''
    full = (user.get_full_name() or '').strip()
    if full:
        return full
    email = (getattr(user, 'email', None) or '').strip()
    if email:
        return email
    username = (getattr(user, 'username', None) or '').strip()
    return username or 'Utilisateur'


def _publie_par_label(user):
    """Libellé « Publié par l'administrateur/formateur … »."""
    if not user:
        return 'Équipe pédagogique'
    name = _formateur_display_name(user)
    role = getattr(user, 'role', None)
    if role == 'ADMIN' or getattr(user, 'is_staff', False):
        return f"Publié par l'administrateur {name}"
    if role == 'FORMATEUR':
        return f'Publié par le formateur {name}'
    return f'Publié par {name}'


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
            'image',
            'ordre',
            'date_creation',
            'date_modification',
        ]
        read_only_fields = ['id', 'formateur', 'date_creation', 'date_modification']

    def create(self, validated_data):
        if not validated_data.get('ordre'):
            max_ordre = (
                Parcours.objects.order_by('-ordre').values_list('ordre', flat=True).first()
            )
            validated_data['ordre'] = (max_ordre or 0) + 1
        return super().create(validated_data)

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

    formateur_nom = serializers.SerializerMethodField()
    formateur_role = serializers.SerializerMethodField()
    publie_par = serializers.SerializerMethodField()
    profil_cible_display = serializers.CharField(
        source='get_profil_cible_display', read_only=True
    )
    nombre_modules = serializers.IntegerField(
        source='modules.count', read_only=True
    )
    nombre_lecons = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()
    is_favorite = serializers.SerializerMethodField()

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
            'formateur_role',
            'publie_par',
            'image',
            'nombre_modules',
            'nombre_lecons',
            'is_enrolled',
            'is_favorite',
            'ordre',
            'date_creation',
        ]

    def get_nombre_lecons(self, obj):
        return sum(module.lecons.count() for module in obj.modules.all())

    def get_is_enrolled(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        return _user_is_enrolled(request.user, obj)

    def get_is_favorite(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        return _user_has_favorite(request.user, obj)

    def get_formateur_nom(self, obj):
        return _formateur_display_name(obj.formateur)

    def get_formateur_role(self, obj):
        if not obj.formateur:
            return None
        return getattr(obj.formateur, 'role', None)

    def get_publie_par(self, obj):
        return _publie_par_label(obj.formateur)


class ParcoursDetailSerializer(serializers.ModelSerializer):
    """Serializer détaillé renvoyant l'intégralité de l'arbre pédagogique."""

    formateur_nom = serializers.SerializerMethodField()
    formateur_role = serializers.SerializerMethodField()
    publie_par = serializers.SerializerMethodField()
    modules = ModuleSerializer(many=True, read_only=True)
    is_enrolled = serializers.SerializerMethodField()
    is_favorite = serializers.SerializerMethodField()

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
            'formateur_role',
            'publie_par',
            'image',
            'ordre',
            'modules',
            'is_enrolled',
            'is_favorite',
            'date_creation',
            'date_modification',
        ]

    def get_is_enrolled(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        return _user_is_enrolled(request.user, obj)

    def get_is_favorite(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        return _user_has_favorite(request.user, obj)

    def get_formateur_nom(self, obj):
        return _formateur_display_name(obj.formateur)

    def get_formateur_role(self, obj):
        if not obj.formateur:
            return None
        return getattr(obj.formateur, 'role', None)

    def get_publie_par(self, obj):
        return _publie_par_label(obj.formateur)
