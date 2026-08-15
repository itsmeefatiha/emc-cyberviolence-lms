"""Idempotent fixtures for Playwright critical-journey tests."""

from django.core.exceptions import ObjectDoesNotExist
from django.core.management.base import BaseCommand

from apps.courses.models import ContenuTexte, Lecon, Module, Parcours, StatutPublication
from apps.users.models import Utilisateur

E2E_PASSWORD = 'E2ePass123!'
COURSE_TITLE = 'E2E — Cyberviolence : parcours de démonstration'
COURSE_DESCRIPTION = (
    'Parcours de démonstration utilisé par les tests E2E Playwright. '
    'Ne pas supprimer tant que la suite e2e tourne.'
)
LESSON_TITLE = 'Leçon E2E : introduction'
LESSON_BODY = 'Contenu pédagogique E2E pour les tests Playwright.'
MODULE_TITLE = 'Module E2E'


class Command(BaseCommand):
    help = 'Crée (ou met à jour) les utilisateurs et le parcours utilisés par Playwright.'

    def handle(self, *args, **options):
        learner = self._upsert_user(
            email='e2e.apprenant@example.com',
            username='e2e_apprenant',
            first_name='Amina',
            last_name='E2E',
            role=Utilisateur.RoleChoices.APPRENANT,
            profil_professionnel=Utilisateur.ProfilProfessionnel.EDUCATEUR,
        )
        instructor = self._upsert_user(
            email='e2e.formateur@example.com',
            username='e2e_formateur',
            first_name='Karim',
            last_name='E2E',
            role=Utilisateur.RoleChoices.FORMATEUR,
            specialite='Cyberviolence',
            profil_professionnel=None,
        )
        self._upsert_user(
            email='e2e.admin@example.com',
            username='e2e_admin',
            first_name='Nadia',
            last_name='E2E',
            role=Utilisateur.RoleChoices.ADMIN,
            is_staff=True,
            is_superuser=True,
            profil_professionnel=None,
        )

        parcours = self._ensure_course(instructor)
        self.stdout.write(
            self.style.SUCCESS(
                'E2E seed OK — '
                f'{learner.email} / {instructor.email} / parcours « {parcours.titre} »'
            )
        )

    def _upsert_user(self, *, email, username, first_name, last_name, **fields):
        user, _created = Utilisateur.objects.get_or_create(
            email=email,
            defaults={
                'username': username,
                'first_name': first_name,
                'last_name': last_name,
                'is_active': True,
                **fields,
            },
        )
        user.username = username
        user.first_name = first_name
        user.last_name = last_name
        user.is_active = True
        for key, value in fields.items():
            setattr(user, key, value)
        user.set_password(E2E_PASSWORD)
        user.save()
        return user

    def _ensure_course(self, instructor):
        parcours, _created = Parcours.objects.get_or_create(
            titre=COURSE_TITLE,
            defaults={
                'description': COURSE_DESCRIPTION,
                'profil_cible': Utilisateur.ProfilProfessionnel.EDUCATEUR,
                'statut': StatutPublication.PUBLIE,
                'formateur': instructor,
                'ordre': 1,
            },
        )
        parcours.description = COURSE_DESCRIPTION
        parcours.profil_cible = Utilisateur.ProfilProfessionnel.EDUCATEUR
        parcours.statut = StatutPublication.PUBLIE
        parcours.formateur = instructor
        parcours.save()

        module = parcours.modules.order_by('ordre').first()
        if module is None:
            module = Module.objects.create(
                parcours=parcours,
                titre=MODULE_TITLE,
                description='Module de démonstration E2E.',
                ordre=1,
            )
        else:
            module.titre = MODULE_TITLE
            module.save(update_fields=['titre'])

        lecon = module.lecons.order_by('ordre', 'id').first()
        if lecon is None:
            lecon = Lecon.objects.create(
                module=module,
                titre=LESSON_TITLE,
                duree_estimee=10,
                ordre=1,
            )
        else:
            lecon.titre = LESSON_TITLE
            lecon.save(update_fields=['titre'])

        try:
            lecon.contenu
        except ObjectDoesNotExist:
            ContenuTexte.objects.create(
                lecon=lecon,
                titre_fichier='Texte E2E',
                corps=LESSON_BODY,
            )
        else:
            ContenuTexte.objects.filter(lecon=lecon).update(corps=LESSON_BODY)

        return parcours
