import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class Utilisateur(AbstractUser):
    class RoleChoices(models.TextChoices):
        ADMIN = 'ADMIN', 'Administrateur'
        FORMATEUR = 'FORMATEUR', 'Formateur'
        APPRENANT = 'APPRENANT', 'Apprenant'

    class ProfilProfessionnel(models.TextChoices):
        EDUCATEUR = 'EDUCATEUR', 'Éducateur'
        FORCES_ORDRE = 'FORCES_ORDRE', "Forces de l'ordre"
        MAGISTRAT = 'MAGISTRAT', 'Magistrat'
        ASSISTANT_SOCIAL = 'ASSISTANT_SOCIAL', 'Assistant social'
        AUTRE = 'AUTRE', 'Autre'

    # Primary Key as UUID
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Contact Info
    telephone = models.CharField(max_length=20, blank=True, null=True)

    # Core system role
    role = models.CharField(
        max_length=15, 
        choices=RoleChoices.choices, 
        default=RoleChoices.APPRENANT
    )
    
    # Role-specific optional fields
    specialite = models.CharField(max_length=150, blank=True, null=True)  # For Formateurs
    profil_professionnel = models.CharField(
        max_length=30, 
        choices=ProfilProfessionnel.choices, 
        blank=True, 
        null=True
    )  # For Apprenants

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Login configuration using email
    email = models.EmailField(unique=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.role})"