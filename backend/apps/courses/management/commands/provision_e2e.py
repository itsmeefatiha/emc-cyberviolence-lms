"""Create one isolated, already-active user for a single Playwright test.

Prints a JSON object on stdout (last line) so Node can parse it.
"""

import json
import uuid

from django.core.exceptions import ObjectDoesNotExist
from django.core.management.base import BaseCommand, CommandError

from apps.courses.management.commands.seed_e2e import (
    COURSE_TITLE,
    E2E_PASSWORD,
    LESSON_BODY,
    LESSON_TITLE,
    MODULE_TITLE,
)
from apps.courses.models import ContenuTexte, Lecon, Module, Parcours, StatutPublication
from apps.progression.models import Inscription
from apps.users.models import Utilisateur

DEFAULT_NAMES = {
    'APPRENANT': ('Amina', 'E2E'),
    'FORMATEUR': ('Karim', 'E2E'),
    'ADMIN': ('Nadia', 'E2E'),
}


class Command(BaseCommand):
    help = 'Provisionne un utilisateur E2E unique (email isolé) et optionnellement un parcours.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--role',
            required=True,
            choices=['APPRENANT', 'FORMATEUR', 'ADMIN'],
        )
        parser.add_argument(
            '--enroll-shared-course',
            action='store_true',
            help='Inscrit un apprenant au parcours de catalogue seedé.',
        )
        parser.add_argument(
            '--with-course',
            action='store_true',
            help='Crée un parcours publié unique (formateur).',
        )
        parser.add_argument(
            '--with-learner',
            action='store_true',
            help='Crée aussi un apprenant unique (admin : recherche isolée).',
        )

    def handle(self, *args, **options):
        role = options['role']
        user = self._create_user(role)
        payload = self._user_payload(user)

        if options['with_course']:
            if role != 'FORMATEUR':
                raise CommandError('--with-course n’est valable que pour FORMATEUR.')
            parcours = self._create_course(user)
            payload['course_title'] = parcours.titre
            payload['lesson_title'] = LESSON_TITLE
            payload['lesson_body'] = LESSON_BODY

        if options['enroll_shared_course']:
            if role != 'APPRENANT':
                raise CommandError('--enroll-shared-course n’est valable que pour APPRENANT.')
            parcours = Parcours.objects.filter(titre=COURSE_TITLE).first()
            if parcours is None:
                raise CommandError(
                    f'Parcours partagé introuvable ({COURSE_TITLE}). Lancez seed_e2e d’abord.'
                )
            Inscription.objects.get_or_create(apprenant=user, parcours=parcours)

        if options['with_learner']:
            learner = self._create_user('APPRENANT')
            payload['learner'] = self._user_payload(learner)

        self.stdout.write(json.dumps(payload, ensure_ascii=False))

    def _create_user(self, role):
        suffix = uuid.uuid4().hex[:10]
        first_name, last_name = DEFAULT_NAMES[role]
        fields = {
            'role': role,
            'is_active': True,
        }
        if role == 'APPRENANT':
            fields['profil_professionnel'] = Utilisateur.ProfilProfessionnel.EDUCATEUR
        elif role == 'FORMATEUR':
            fields['specialite'] = 'Cyberviolence'
            fields['profil_professionnel'] = None
        else:
            fields['is_staff'] = True
            fields['is_superuser'] = True
            fields['profil_professionnel'] = None

        user = Utilisateur.objects.create_user(
            username=f'e2e_{role.lower()}_{suffix}'[:150],
            email=f'e2e.{role.lower()}.{suffix}@example.com',
            password=E2E_PASSWORD,
            first_name=first_name,
            last_name=last_name,
            **fields,
        )
        user.is_active = True
        user.save(update_fields=['is_active'])
        return user

    def _user_payload(self, user):
        return {
            'email': user.email,
            'password': E2E_PASSWORD,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'full_name': user.get_full_name(),
            'role': user.role,
        }

    def _create_course(self, instructor):
        suffix = uuid.uuid4().hex[:8]
        parcours = Parcours.objects.create(
            titre=f'E2E course {suffix}',
            description='Parcours isolé pour un test Playwright.',
            profil_cible=Utilisateur.ProfilProfessionnel.EDUCATEUR,
            statut=StatutPublication.PUBLIE,
            formateur=instructor,
            ordre=1,
        )
        module = Module.objects.create(
            parcours=parcours,
            titre=MODULE_TITLE,
            description='Module E2E isolé.',
            ordre=1,
        )
        lecon = Lecon.objects.create(
            module=module,
            titre=LESSON_TITLE,
            duree_estimee=10,
            ordre=1,
        )
        try:
            lecon.contenu
        except ObjectDoesNotExist:
            ContenuTexte.objects.create(
                lecon=lecon,
                titre_fichier='Texte E2E',
                corps=LESSON_BODY,
            )
        return parcours
