import uuid
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.users.models import ProfilProfessionnel

# ==========================================
# 1. ENUMS / CHOICES
# ==========================================



class StatutPublication(models.TextChoices):
    BROUILLON = 'BROUILLON', _('Brouillon')
    PUBLIE = 'PUBLIE', _('Publié')
    ARCHIVE = 'ARCHIVE', _('Archivé')


# ==========================================
# 2. CORE HIERARCHY MODELS
# ==========================================


class Parcours(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    titre = models.CharField(max_length=255, verbose_name=_('Titre'))
    description = models.TextField(blank=True, verbose_name=_('Description'))

    profil_cible = models.CharField(
        max_length=50,
        choices=ProfilProfessionnel.choices,
        default=ProfilProfessionnel.EDUCATEUR,
        verbose_name=_('Profil Cible'),
    )

    statut = models.CharField(
        max_length=20,
        choices=StatutPublication.choices,
        default=StatutPublication.BROUILLON,
        verbose_name=_('Statut de publication'),
    )

    formateur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='parcours_crees',
        verbose_name=_('Formateur référent'),
    )

    ordre = models.PositiveIntegerField(default=1, verbose_name=_('Ordre'))
    date_creation = models.DateTimeField(
        auto_now_add=True, verbose_name=_('Date de création')
    )
    date_modification = models.DateTimeField(
        auto_now=True, verbose_name=_('Dernière modification')
    )

    class Meta:
        verbose_name = _('Parcours')
        verbose_name_plural = _('Parcours')
        ordering = ['ordre', '-date_creation']

    def __str__(self):
        return f'{self.titre} ({self.get_profil_cible_display()})'


class Module(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parcours = models.ForeignKey(
        Parcours,
        on_delete=models.CASCADE,
        related_name='modules',
        verbose_name=_('Parcours'),
    )
    titre = models.CharField(max_length=255, verbose_name=_('Titre'))
    description = models.TextField(blank=True, verbose_name=_('Description'))
    ordre = models.PositiveIntegerField(default=1, verbose_name=_('Ordre'))

    class Meta:
        verbose_name = _('Module')
        verbose_name_plural = _('Modules')
        ordering = ['ordre']

    def __str__(self):
        return f'{self.parcours.titre} - Module {self.ordre} : {self.titre}'


class Lecon(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name='lecons',
        verbose_name=_('Module'),
    )
    titre = models.CharField(max_length=255, verbose_name=_('Titre'))
    duree_estimee = models.PositiveIntegerField(
        default=10,
        help_text=_('Durée estimée en minutes'),
        verbose_name=_('Durée (min)'),
    )
    ordre = models.PositiveIntegerField(default=1, verbose_name=_('Ordre'))

    class Meta:
        verbose_name = _('Leçon')
        verbose_name_plural = _('Leçons')
        ordering = ['ordre']

    def __str__(self):
        return f'{self.module.titre} - Leçon {self.ordre} : {self.titre}'

# ==========================================
# 3. CONTENUS PEDAGOGIQUES (POLYMORPHISME)
# ==========================================


class Contenu(models.Model):
    """Classe de base pour tous les types de contenus pédagogiques.

    L'utilisation d'une OneToOneField avec Lecon garantit la composition (une
    leçon possède 1 seul contenu).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lecon = models.OneToOneField(
        Lecon,
        on_delete=models.CASCADE,
        related_name='contenu',
        verbose_name=_('Leçon'),
    )
    titre_fichier = models.CharField(
        max_length=255, verbose_name=_('Titre / Nom du contenu')
    )
    date_creation = models.DateTimeField(
        auto_now_add=True, verbose_name=_('Date d\'ajout')
    )

    class Meta:
        verbose_name = _('Contenu')
        verbose_name_plural = _('Contenus')

    def __str__(self):
        return f'Contenu : {self.titre_fichier}'


class ContenuDocument(Contenu):
    """Contenu de type document statique (PDF, DOCX, etc.)"""

    fichier = models.FileField(
        upload_to='courses/documents/', verbose_name=_('Fichier document')
    )
    format = models.CharField(
        max_length=10,
        help_text=_('Ex: PDF, DOCX'),
        verbose_name=_('Format du fichier'),
    )

    class Meta:
        verbose_name = _('Contenu Document')
        verbose_name_plural = _('Contenus Documents')


class ContenuVideo(Contenu):
    """Contenu de type vidéo hébergée ou streamée"""

    class StatutEncodage(models.TextChoices):
        EN_COURS = 'EN_COURS', _('En cours d\'encodage')
        PRÊT = 'PRET', _('Prêt')
        ECHEC = 'ECHEC', _('Échec de conversion')

    url_stream = models.URLField(verbose_name=_('URL du flux vidéo'))
    duree = models.PositiveIntegerField(
        help_text=_('Durée en secondes'), verbose_name=_('Durée (s)')
    )
    statut_encodage = models.CharField(
        max_length=20,
        choices=StatutEncodage.choices,
        default=StatutEncodage.PRÊT,
        verbose_name=_('Statut d\'encodage'),
    )

    class Meta:
        verbose_name = _('Contenu Vidéo')
        verbose_name_plural = _('Contenus Vidéos')


class ContenuSCORM(Contenu):
    """Contenu interactif conforme au standard SCORM"""

    package_url = models.FileField(
        upload_to='courses/scorm/',
        verbose_name=_('Archive SCORM (ZIP)'),
    )
    standard = models.CharField(
        max_length=50, default='SCORM 1.2', verbose_name=_('Standard')
    )
    version = models.CharField(
        max_length=20, default='1.2', verbose_name=_('Version')
    )

    class Meta:
        verbose_name = _('Contenu SCORM')
        verbose_name_plural = _('Contenus SCORM')