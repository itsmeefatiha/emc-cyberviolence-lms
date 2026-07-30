import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class Utilisateur(AbstractUser):
    class RoleChoices(models.TextChoices):
        ADMIN = 'ADMIN', _('Administrateur')
        FORMATEUR = 'FORMATEUR', _('Formateur')
        APPRENANT = 'APPRENANT', _('Apprenant')

    class ProfilProfessionnel(models.TextChoices):
        EDUCATEUR = 'EDUCATEUR', _('Éducateur')
        FORCES_ORDRE = 'FORCES_ORDRE', _("Forces de l'ordre")
        MAGISTRAT = 'MAGISTRAT', _('Magistrat')
        ASSISTANT_SOCIAL = 'ASSISTANT_SOCIAL', _('Assistant social')
        AUTRE = 'AUTRE', _('Autre')

    # Primary Key as UUID
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Email Activation Flag (Surchargé à False par défaut)
    is_active = models.BooleanField(
        default=False,
        help_text=_(
            "Indique si l'utilisateur a activé son compte via le lien envoyé par email."
        ),
    )

    # Contact Info
    telephone = models.CharField(max_length=20, blank=True, null=True)

    # Core system role
    role = models.CharField(
        max_length=15,
        choices=RoleChoices.choices,
        default=RoleChoices.APPRENANT,
    )

    # Role-specific optional fields
    specialite = models.CharField(
        max_length=150, blank=True, null=True
    )  # For Formateurs
    profil_professionnel = models.CharField(
        max_length=30,
        choices=ProfilProfessionnel.choices,
        blank=True,
        null=True,
    )  # For Apprenants

    photo = models.ImageField(
        upload_to='avatars/',
        blank=True,
        null=True,
        verbose_name=_('Photo de profil'),
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Login configuration using email
    email = models.EmailField(unique=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    def __str__(self):
        return f'{self.first_name} {self.last_name} ({self.role})'