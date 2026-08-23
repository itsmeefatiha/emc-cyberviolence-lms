from datetime import timedelta

from django.utils import timezone
from django.db.models import Avg, Count, F, Max, Q, Sum
from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.courses.models import Lecon, Module, Parcours, StatutPublication
from django.shortcuts import get_object_or_404

from .models import ActiviteJournaliere, Favori, Inscription, Progression, StatutProgression
from .serializers import ProgressionSerializer


def _is_manager_user(user):
    role = getattr(user, 'role', None)
    return bool(user.is_staff or role in ('ADMIN', 'FORMATEUR'))


def _published_parcours_queryset(queryset, user):
    """Les apprenants ne voient que les parcours publiés dans leurs listes."""
    if _is_manager_user(user):
        return queryset
    return queryset.filter(statut=StatutPublication.PUBLIE)


def _learner_can_access_parcours(user, parcours):
    if _is_manager_user(user):
        return True
    return parcours.statut == StatutPublication.PUBLIE


def _format_duration_display(seconds):
    seconds = max(0, int(seconds or 0))
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours > 0:
        return f'{hours}h {minutes:02d}min'
    return f'{minutes}min'


def _record_daily_activity(user, secondes):
    """Incrémente le cumul journalier d'apprentissage pour l'utilisateur."""
    if not isinstance(secondes, int) or secondes <= 0:
        return
    today = timezone.localdate()
    activite, _ = ActiviteJournaliere.objects.get_or_create(
        apprenant=user,
        date=today,
        defaults={'secondes': 0},
    )
    ActiviteJournaliere.objects.filter(pk=activite.pk).update(
        secondes=F('secondes') + secondes
    )


class ProgressionViewSet(viewsets.ModelViewSet):
    serializer_class = ProgressionSerializer
    permission_classes = [IsAuthenticated]

    def _progression_queryset(self):
        user = self.request.user
        user_role = getattr(user, 'role', None)

        base_queryset = Progression.objects.select_related(
            'apprenant',
            'lecon',
            'lecon__module',
            'lecon__module__parcours',
            'lecon__module__parcours__formateur',
        )

        if user_role in ['ADMIN', 'FORMATEUR'] or user.is_staff:
            return base_queryset

        return base_queryset.filter(apprenant=user)

    def get_queryset(self):
        return self._progression_queryset()

    def _build_lecon_snapshot(self, progression):
        lecon = progression.lecon
        module = lecon.module
        parcours = module.parcours

        return {
            'progression_id': str(progression.id),
            'lecon_id': str(lecon.id),
            'lecon_titre': lecon.titre,
            'module_id': str(module.id),
            'module_titre': module.titre,
            'parcours_id': str(parcours.id),
            'parcours_titre': parcours.titre,
            'statut': progression.statut,
            'temps_passe_secondes': progression.temps_passe,
            'date_dernier_activite': progression.date_dernier_activite,
            'date_debut': progression.date_debut,
            'date_fin': progression.date_fin,
        }

    def _build_module_summary(self, user, module):
        lecons = list(module.lecons.all())
        progressions = {
            progression.lecon_id: progression
            for progression in Progression.objects.filter(
                apprenant=user,
                lecon__module=module,
            ).select_related('lecon', 'lecon__module', 'lecon__module__parcours')
        }

        total_lecons = len(lecons)
        terminees = 0
        en_cours = 0
        temps_total = 0
        derniere_activite = None
        last_lecon = None
        lecons_detail = []

        for lecon in lecons:
            progression = progressions.get(lecon.id)
            statut = StatutProgression.NON_COMMENCE
            temps_passe = 0

            if progression:
                statut = progression.statut
                temps_passe = progression.temps_passe
                temps_total += progression.temps_passe
                if progression.date_dernier_activite and (
                    derniere_activite is None or progression.date_dernier_activite > derniere_activite
                ):
                    derniere_activite = progression.date_dernier_activite
                    last_lecon = progression

                if progression.statut == StatutProgression.TERMINE:
                    terminees += 1
                elif progression.statut == StatutProgression.EN_COURS:
                    en_cours += 1

            lecons_detail.append(
                {
                    'lecon_id': str(lecon.id),
                    'lecon_titre': lecon.titre,
                    'ordre': lecon.ordre,
                    'statut': statut,
                    'temps_passe_secondes': temps_passe,
                }
            )

        from apps.quizzes.models import Quiz, TentativeQuiz

        quizzes = list(Quiz.objects.filter(module=module).order_by('id'))
        quizzes_detail = []
        quizzes_reussis = 0
        for quiz in quizzes:
            est_reussi = TentativeQuiz.objects.filter(
                apprenant=user, quiz=quiz, est_reussi=True
            ).exists()
            if est_reussi:
                quizzes_reussis += 1
            quizzes_detail.append(
                {
                    'quiz_id': str(quiz.id),
                    'quiz_titre': quiz.titre,
                    'est_reussi': est_reussi,
                    'note_de_passage': float(quiz.note_de_passage),
                }
            )

        total_units = total_lecons + len(quizzes)
        completed_units = terminees + quizzes_reussis
        pourcentage = round((completed_units / total_units) * 100, 2) if total_units else 0.0

        return {
            'module_id': str(module.id),
            'module_titre': module.titre,
            'ordre': module.ordre,
            'total_lecons': total_lecons,
            'lecons_terminees': terminees,
            'lecons_en_cours': en_cours,
            'total_quizzes': len(quizzes),
            'quizzes_reussis': quizzes_reussis,
            'pourcentage': pourcentage,
            'temps_total_secondes': temps_total,
            'est_termine': total_units > 0 and completed_units == total_units,
            'derniere_activite': derniere_activite,
            'derniere_lecon': self._build_lecon_snapshot(last_lecon) if last_lecon else None,
            'lecons': lecons_detail,
            'quizzes': quizzes_detail,
        }

    def _build_parcours_summary(self, user, parcours):
        modules = list(parcours.modules.prefetch_related('lecons').all())
        module_summaries = [self._build_module_summary(user, module) for module in modules]
        total_lecons = sum(module_summary['total_lecons'] for module_summary in module_summaries)
        terminees = sum(module_summary['lecons_terminees'] for module_summary in module_summaries)
        en_cours = sum(module_summary['lecons_en_cours'] for module_summary in module_summaries)
        total_quizzes = sum(module_summary['total_quizzes'] for module_summary in module_summaries)
        quizzes_reussis = sum(module_summary['quizzes_reussis'] for module_summary in module_summaries)
        temps_total = sum(module_summary['temps_total_secondes'] for module_summary in module_summaries)
        derniere_activite = max(
            [summary['derniere_activite'] for summary in module_summaries if summary['derniere_activite']],
            default=None,
        )
        is_enrolled = Inscription.objects.filter(apprenant=user, parcours=parcours).exists()
        if not is_enrolled:
            is_enrolled = Progression.objects.filter(
                apprenant=user,
                lecon__module__parcours=parcours,
            ).exists()

        image_url = None
        if getattr(parcours, 'image', None):
            try:
                image_url = parcours.image.url
            except ValueError:
                image_url = None

        from apps.courses.serializers import _formateur_display_name, _publie_par_label

        total_units = total_lecons + total_quizzes
        completed_units = terminees + quizzes_reussis
        lecons_done = total_lecons > 0 and terminees == total_lecons
        quizzes_done = total_quizzes == 0 or quizzes_reussis == total_quizzes
        # Parcours terminé seulement si toutes les leçons ET tous les quiz sont validés
        est_termine = total_units > 0 and lecons_done and quizzes_done

        return {
            'parcours_id': str(parcours.id),
            'parcours_titre': parcours.titre,
            'profil_cible': parcours.profil_cible,
            'statut': parcours.statut,
            'image': image_url,
            'formateur_nom': _formateur_display_name(parcours.formateur) if parcours.formateur else None,
            'publie_par': _publie_par_label(parcours.formateur) if parcours.formateur else None,
            'is_enrolled': is_enrolled,
            'is_favorite': Favori.objects.filter(apprenant=user, parcours=parcours).exists(),
            'total_modules': len(modules),
            'total_lecons': total_lecons,
            'lecons_terminees': terminees,
            'lecons_en_cours': en_cours,
            'total_quizzes': total_quizzes,
            'quizzes_reussis': quizzes_reussis,
            'pourcentage': round((completed_units / total_units) * 100, 2) if total_units else 0.0,
            'temps_total_secondes': temps_total,
            'est_termine': est_termine,
            'derniere_activite': derniere_activite,
            'modules': module_summaries,
        }

    def _build_global_summary(self, user):
        progressions = self._progression_queryset().filter(apprenant=user).select_related(
            'lecon__module__parcours'
        )
        parcours_ids = {
            progression.lecon.module.parcours_id
            for progression in progressions
        }
        parcours_ids |= set(
            Inscription.objects.filter(apprenant=user).values_list('parcours_id', flat=True)
        )
        parcours_qs = _published_parcours_queryset(
            Parcours.objects.select_related('formateur')
            .prefetch_related('modules__lecons')
            .filter(id__in=parcours_ids),
            user,
        )

        parcours_summaries = [
            self._build_parcours_summary(user, parcours)
            for parcours in parcours_qs
        ]

        total_lecons = progressions.count()
        terminees = progressions.filter(statut=StatutProgression.TERMINE).count()
        en_cours = progressions.filter(statut=StatutProgression.EN_COURS).count()
        temps_total = progressions.aggregate(total=Sum('temps_passe'))['total'] or 0
        derniere_progression = progressions.order_by('-date_dernier_activite', '-date_debut').first()

        return {
            'apprenant_id': str(user.id),
            'apprenant_nom': user.get_full_name() or user.email,
            'total_progressions': total_lecons,
            'lecons_terminees': terminees,
            'lecons_en_cours': en_cours,
            'pourcentage_global': round((terminees / total_lecons) * 100, 2) if total_lecons else 0.0,
            'temps_total_secondes': temps_total,
            'parcours': parcours_summaries,
            'derniere_activite': self._build_lecon_snapshot(derniere_progression) if derniere_progression else None,
        }

    def _build_facilitator_dashboard(self, request):
        user = request.user
        user_role = getattr(user, 'role', None)

        queryset = self._progression_queryset()
        if user_role == 'FORMATEUR' and not user.is_staff:
            queryset = queryset.filter(lecon__module__parcours__formateur=user)

        profil_filter = request.query_params.get('profil_professionnel')
        if profil_filter:
            queryset = queryset.filter(apprenant__profil_professionnel=profil_filter)

        queryset = queryset.select_related('apprenant', 'lecon', 'lecon__module', 'lecon__module__parcours')

        total_apprenants = queryset.values('apprenant_id').distinct().count()
        total_progressions = queryset.count()
        lecons_terminees = queryset.filter(statut=StatutProgression.TERMINE).count()
        lecons_en_cours = queryset.filter(statut=StatutProgression.EN_COURS).count()
        temps_total = queryset.aggregate(total=Sum('temps_passe'))['total'] or 0

        profils = (
            queryset.values('apprenant__profil_professionnel')
            .annotate(
                total=Count('id'),
                terminees=Count('id', filter=Q(statut=StatutProgression.TERMINE)),
                temps=Sum('temps_passe'),
            )
            .order_by('apprenant__profil_professionnel')
        )

        parcours_stats = []
        parcours_ids = queryset.values_list('lecon__module__parcours_id', flat=True).distinct()
        for parcours in Parcours.objects.filter(id__in=parcours_ids).select_related('formateur').prefetch_related('modules__lecons'):
            parcours_progressions = queryset.filter(lecon__module__parcours=parcours)
            parcours_total_lecons = Lecon.objects.filter(module__parcours=parcours).count()
            parcours_terminees = parcours_progressions.filter(statut=StatutProgression.TERMINE).count()
            parcours_stats.append(
                {
                    'parcours_id': str(parcours.id),
                    'parcours_titre': parcours.titre,
                    'profil_cible': parcours.profil_cible,
                    'apprenants_actifs': parcours_progressions.values('apprenant_id').distinct().count(),
                    'lecons_terminees': parcours_terminees,
                    'total_lecons': parcours_total_lecons,
                    'pourcentage_moyen': round((parcours_terminees / max(parcours_total_lecons, 1)) * 100, 2)
                    if parcours_total_lecons
                    else 0.0,
                    'inscriptions': Inscription.objects.filter(parcours=parcours).count(),
                }
            )

        # Détail apprenants (Student Progress)
        apprenants_stats = []
        apprenant_ids = list(queryset.values_list('apprenant_id', flat=True).distinct())
        # Inclure aussi les inscrits sans progression encore
        if user_role == 'FORMATEUR' and not user.is_staff:
            inscrit_ids = Inscription.objects.filter(
                parcours__formateur=user
            ).values_list('apprenant_id', flat=True)
        else:
            inscrit_ids = Inscription.objects.values_list('apprenant_id', flat=True)
        all_apprenant_ids = set(apprenant_ids) | set(inscrit_ids)

        User = get_user_model()
        for apprenant in User.objects.filter(id__in=all_apprenant_ids).order_by('last_name', 'first_name'):
            user_qs = queryset.filter(apprenant=apprenant)
            user_terminees = user_qs.filter(statut=StatutProgression.TERMINE).count()
            user_total = user_qs.count()
            user_temps = user_qs.aggregate(total=Sum('temps_passe'))['total'] or 0
            derniere = user_qs.order_by('-date_dernier_activite', '-date_debut').first()
            parcours_inscrits = Inscription.objects.filter(apprenant=apprenant)
            if user_role == 'FORMATEUR' and not user.is_staff:
                parcours_inscrits = parcours_inscrits.filter(parcours__formateur=user)
            apprenants_stats.append(
                {
                    'apprenant_id': str(apprenant.id),
                    'apprenant_nom': apprenant.get_full_name() or apprenant.email,
                    'apprenant_email': apprenant.email,
                    'profil_professionnel': getattr(apprenant, 'profil_professionnel', None),
                    'parcours_inscrits': parcours_inscrits.count(),
                    'lecons_terminees': user_terminees,
                    'lecons_en_cours': user_qs.filter(statut=StatutProgression.EN_COURS).count(),
                    'total_progressions': user_total,
                    'pourcentage': round((user_terminees / user_total) * 100, 2) if user_total else 0.0,
                    'temps_total_secondes': user_temps,
                    'derniere_activite': derniere.date_dernier_activite if derniere else None,
                }
            )

        if user_role == 'FORMATEUR' and not user.is_staff:
            published_count = Parcours.objects.filter(formateur=user).count()
            inscriptions_count = Inscription.objects.filter(parcours__formateur=user).count()
        else:
            published_count = Parcours.objects.count()
            inscriptions_count = Inscription.objects.count()

        return Response(
            {
                'total_apprenants': max(total_apprenants, len(apprenants_stats)),
                'total_progressions': total_progressions,
                'lecons_terminees': lecons_terminees,
                'lecons_en_cours': lecons_en_cours,
                'temps_total_secondes': temps_total,
                'taux_reussite_modules': round((lecons_terminees / total_progressions) * 100, 2)
                if total_progressions
                else 0.0,
                'parcours_count': published_count,
                'inscriptions_count': inscriptions_count,
                'par_profils': list(profils),
                'parcours': parcours_stats,
                'apprenants': apprenants_stats,
                'filtre_profil': profil_filter,
            }
        )

    def _allow_manager_access(self):
        user = self.request.user
        user_role = getattr(user, 'role', None)
        return bool(user.is_staff or user_role in ['ADMIN', 'FORMATEUR'])

    @action(detail=False, methods=['get'], url_path='me/learning')
    def me_learning(self, request):
        """My Learning : parcours inscrits + favoris."""
        user = request.user

        enrolled_ids = set(
            Inscription.objects.filter(apprenant=user).values_list('parcours_id', flat=True)
        )
        # Compatibilité activité sans inscription formelle
        activity_ids = set(
            Progression.objects.filter(apprenant=user).values_list(
                'lecon__module__parcours_id', flat=True
            )
        )
        enrolled_ids |= activity_ids

        favorite_ids = set(
            Favori.objects.filter(apprenant=user).values_list('parcours_id', flat=True)
        )

        all_ids = enrolled_ids | favorite_ids
        parcours_map = {
            p.id: p
            for p in _published_parcours_queryset(
                Parcours.objects.filter(id__in=all_ids)
                .select_related('formateur')
                .prefetch_related('modules__lecons'),
                user,
            )
        }

        enrolled = [
            self._build_parcours_summary(user, parcours_map[pid])
            for pid in enrolled_ids
            if pid in parcours_map
        ]
        enrolled.sort(key=lambda item: item.get('derniere_activite') or '', reverse=True)

        completed = [item for item in enrolled if item.get('est_termine')]
        in_progress = [item for item in enrolled if not item.get('est_termine')]

        favorites = []
        for favori in Favori.objects.filter(apprenant=user).select_related('parcours'):
            parcours = parcours_map.get(favori.parcours_id)
            if not parcours:
                continue
            summary = self._build_parcours_summary(user, parcours)
            summary['date_ajout_favori'] = favori.date_ajout
            favorites.append(summary)

        return Response(
            {
                'enrolled': in_progress,
                'completed': completed,
                'favorites': favorites,
                'enrolled_count': len(in_progress),
                'completed_count': len(completed),
                'favorites_count': len(favorites),
            }
        )

    @action(detail=False, methods=['post'], url_path='favorites/toggle')
    def toggle_favorite(self, request):
        """Ajoute ou retire un parcours des favoris.

        Payload : { "parcours_id": "UUID" }
        """
        parcours_id = request.data.get('parcours_id')
        if not parcours_id:
            return Response(
                {'error': "Le champ 'parcours_id' est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parcours = get_object_or_404(Parcours, id=parcours_id)
        favori = Favori.objects.filter(apprenant=request.user, parcours=parcours).first()
        if favori:
            favori.delete()
            return Response(
                {
                    'detail': 'Parcours retiré des favoris.',
                    'is_favorite': False,
                    'parcours_id': str(parcours.id),
                }
            )

        Favori.objects.create(apprenant=request.user, parcours=parcours)
        return Response(
            {
                'detail': 'Parcours ajouté aux favoris.',
                'is_favorite': True,
                'parcours_id': str(parcours.id),
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['get'], url_path='favorites')
    def list_favorites(self, request):
        favoris = Favori.objects.filter(apprenant=request.user).select_related(
            'parcours', 'parcours__formateur'
        )
        results = []
        for favori in favoris:
            if not _learner_can_access_parcours(request.user, favori.parcours):
                continue
            summary = self._build_parcours_summary(request.user, favori.parcours)
            summary['date_ajout_favori'] = favori.date_ajout
            results.append(summary)
        return Response({'count': len(results), 'results': results})

    @action(detail=False, methods=['post'], url_path='enroll')
    def enroll(self, request):
        """Inscription formelle d'un apprenant à un parcours.

        Payload attendu :
        {
            "parcours_id": "UUID_DU_PARCOURS"
        }
        """
        parcours_id = request.data.get('parcours_id')
        if not parcours_id:
            return Response(
                {'error': "Le champ 'parcours_id' est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parcours = get_object_or_404(
            Parcours.objects.prefetch_related('modules__lecons'),
            id=parcours_id,
        )

        if parcours.statut != 'PUBLIE' and not (
            request.user.is_staff or getattr(request.user, 'role', None) in ['ADMIN', 'FORMATEUR']
        ):
            return Response(
                {'detail': "Ce parcours n'est pas encore publié."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        inscription, created = Inscription.objects.get_or_create(
            apprenant=request.user,
            parcours=parcours,
        )

        if created:
            try:
                from apps.notifications.services import notify_formateur_inscription

                notify_formateur_inscription(inscription)
            except Exception:
                pass

        # Crée les fiches de progression NON_COMMENCE pour chaque leçon
        lecons = Lecon.objects.filter(module__parcours=parcours)
        progressions_created = 0
        for lecon in lecons:
            _, prog_created = Progression.objects.get_or_create(
                apprenant=request.user,
                lecon=lecon,
                defaults={'statut': StatutProgression.NON_COMMENCE},
            )
            if prog_created:
                progressions_created += 1

        first_lecon = (
            Lecon.objects.filter(module__parcours=parcours)
            .order_by('module__ordre', 'ordre', 'id')
            .first()
        )

        return Response(
            {
                'detail': 'Inscription réussie.' if created else 'Vous êtes déjà inscrit à ce parcours.',
                'created': created,
                'is_enrolled': True,
                'inscription_id': str(inscription.id),
                'parcours_id': str(parcours.id),
                'parcours_titre': parcours.titre,
                'progressions_creees': progressions_created,
                'premiere_lecon_id': str(first_lecon.id) if first_lecon else None,
                'date_inscription': inscription.date_inscription,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='track')
    def track_lecon(self, request):
        """Endpoint de suivi en temps réel pour le frontend React.

        Payload attendu :
        {
            "lecon_id": "UUID_DE_LA_LECON",
            "temps_passe_ajoute": 15,  # secondes écoulées depuis le dernier ping
            "statut": "EN_COURS"       # facultatif: "EN_COURS" ou "TERMINE"
        }
        """
        lecon_id = request.data.get('lecon_id')
        temps_ajoute = request.data.get('temps_passe_ajoute', 0)
        nouveau_statut = request.data.get('statut')

        if not lecon_id:
            return Response(
                {"error": "Le champ 'lecon_id' est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Récupération ou création de la fiche de progression
        lecon = get_object_or_404(
            Lecon.objects.select_related('module', 'module__parcours'),
            id=lecon_id,
        )

        progression, created = Progression.objects.get_or_create(
            apprenant=request.user,
            lecon=lecon,
            defaults={'statut': StatutProgression.EN_COURS},
        )

        # Normalise temps_ajoute (int / float JSON)
        try:
            temps_ajoute = int(float(temps_ajoute or 0))
        except (TypeError, ValueError):
            temps_ajoute = 0

        # Cumul du temps passé
        if temps_ajoute > 0:
            progression.temps_passe += temps_ajoute
            _record_daily_activity(request.user, temps_ajoute)

        # Mise à jour facultative du statut — ne jamais rétrograder TERMINE → EN_COURS
        if nouveau_statut in StatutProgression.values:
            already_done = progression.statut == StatutProgression.TERMINE
            downgrade = already_done and nouveau_statut == StatutProgression.EN_COURS
            if not downgrade:
                progression.statut = nouveau_statut
                if (
                    nouveau_statut == StatutProgression.TERMINE
                    and not progression.date_fin
                ):
                    progression.date_fin = timezone.now()

        progression.save()

        # Tente d'émettre le certificat si le parcours est entièrement terminé
        try:
            from apps.quizzes.services import issue_certificate_if_completed

            parcours = progression.lecon.module.parcours
            if nouveau_statut == StatutProgression.TERMINE or progression.statut == StatutProgression.TERMINE:
                issue_certificate_if_completed(request.user, parcours)
        except Exception:
            pass

        serializer = self.get_serializer(progression)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
            if created
            else status.HTTP_200_OK,
        )

    @action(detail=False, methods=['get'], url_path='me/summary')
    def me_summary(self, request):
        return Response(self._build_global_summary(request.user))

    @action(detail=False, methods=['get'], url_path='me/activity')
    def me_activity(self, request):
        """Temps d'apprentissage agrégé par jour (semaine ou mois courant).

        Query params:
          - period: "weekly" (défaut) | "monthly"
        """
        period = (request.query_params.get('period') or 'weekly').lower()
        if period not in ('weekly', 'monthly'):
            period = 'weekly'

        today = timezone.localdate()
        if period == 'monthly':
            start = today.replace(day=1)
            # Fin du mois courant
            if today.month == 12:
                end = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
            # Pour un graphique lisible, on limite aux jours jusqu'à aujourd'hui
            end = min(end, today)
        else:
            # Semaine calendaire Lundi → Dimanche
            start = today - timedelta(days=today.weekday())
            end = start + timedelta(days=6)

        rows = {
            row.date: row.secondes
            for row in ActiviteJournaliere.objects.filter(
                apprenant=request.user,
                date__gte=start,
                date__lte=end,
            )
        }

        day_labels_fr = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        days = []
        cursor = start
        while cursor <= end:
            secondes = int(rows.get(cursor, 0) or 0)
            hours = round(secondes / 3600, 2)
            days.append(
                {
                    'date': cursor.isoformat(),
                    'label': day_labels_fr[cursor.weekday()]
                    if period == 'weekly'
                    else str(cursor.day),
                    'secondes': secondes,
                    'value_heures': hours,
                    'display': _format_duration_display(secondes),
                }
            )
            cursor += timedelta(days=1)

        total = sum(d['secondes'] for d in days)
        return Response(
            {
                'period': period,
                'start': start.isoformat(),
                'end': end.isoformat(),
                'total_secondes': total,
                'total_display': _format_duration_display(total),
                'days': days,
            }
        )

    @action(detail=False, methods=['get'], url_path='me/resume')
    def me_resume(self, request):
        progression_qs = self._progression_queryset().filter(apprenant=request.user)
        if not _is_manager_user(request.user):
            progression_qs = progression_qs.filter(
                lecon__module__parcours__statut=StatutPublication.PUBLIE
            )
        progression = progression_qs.order_by('-date_dernier_activite', '-date_debut').first()

        if not progression:
            return Response({'resume_disponible': False})

        return Response(
            {
                'resume_disponible': True,
                'dernier_element': self._build_lecon_snapshot(progression),
            }
        )

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        if not self._allow_manager_access():
            return Response({'detail': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)

        return self._build_facilitator_dashboard(request)

    @action(detail=False, methods=['get'], url_path=r'parcours/(?P<parcours_id>[^/.]+)/summary')
    def parcours_summary(self, request, parcours_id=None):
        parcours = get_object_or_404(
            Parcours.objects.select_related('formateur').prefetch_related('modules__lecons'),
            id=parcours_id,
        )
        if not _learner_can_access_parcours(request.user, parcours):
            return Response(
                {'detail': "Ce parcours n'est pas disponible."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(self._build_parcours_summary(request.user, parcours))

    @action(detail=False, methods=['get'], url_path=r'module/(?P<module_id>[^/.]+)/summary')
    def module_summary(self, request, module_id=None):
        module = get_object_or_404(
            Module.objects.select_related('parcours').prefetch_related('lecons'),
            id=module_id,
        )
        return Response(self._build_module_summary(request.user, module))

    def _resolve_target_apprenant(self, request):
        if self._allow_manager_access():
            target_apprenant_id = request.data.get('apprenant_id') or request.query_params.get('apprenant_id')
            if target_apprenant_id:
                return get_object_or_404(
                    get_user_model().objects.all(),
                    id=target_apprenant_id,
                )
        return request.user

    @action(detail=False, methods=['post'], url_path=r'module/(?P<module_id>[^/.]+)/validate')
    def validate_module(self, request, module_id=None):
        if not self._allow_manager_access():
            return Response({'detail': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)

        module = get_object_or_404(
            Module.objects.select_related('parcours').prefetch_related('lecons'),
            id=module_id,
        )
        apprenant = self._resolve_target_apprenant(request)

        progressions = Progression.objects.filter(
            apprenant=apprenant,
            lecon__module=module,
        ).select_related('lecon', 'lecon__module', 'lecon__module__parcours')

        now = timezone.now()
        updated_count = 0
        for progression in progressions:
            progression.statut = StatutProgression.TERMINE
            progression.date_fin = progression.date_fin or now
            progression.save(update_fields=['statut', 'date_fin', 'date_dernier_activite'])
            updated_count += 1

        return Response(
            {
                'detail': 'Module validé avec succès.',
                'apprenant_id': str(apprenant.id),
                'module': self._build_module_summary(apprenant, module),
                'progressions_mises_a_jour': updated_count,
            }
        )

    @action(detail=False, methods=['post'], url_path=r'parcours/(?P<parcours_id>[^/.]+)/validate')
    def validate_parcours(self, request, parcours_id=None):
        if not self._allow_manager_access():
            return Response({'detail': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)

        parcours = get_object_or_404(
            Parcours.objects.select_related('formateur').prefetch_related('modules__lecons'),
            id=parcours_id,
        )
        apprenant = self._resolve_target_apprenant(request)

        progressions = Progression.objects.filter(
            apprenant=apprenant,
            lecon__module__parcours=parcours,
        ).select_related('lecon', 'lecon__module', 'lecon__module__parcours')

        now = timezone.now()
        updated_count = 0
        for progression in progressions:
            progression.statut = StatutProgression.TERMINE
            progression.date_fin = progression.date_fin or now
            progression.save(update_fields=['statut', 'date_fin', 'date_dernier_activite'])
            updated_count += 1

        return Response(
            {
                'detail': 'Parcours validé avec succès.',
                'apprenant_id': str(apprenant.id),
                'parcours': self._build_parcours_summary(apprenant, parcours),
                'progressions_mises_a_jour': updated_count,
            }
        )

    @action(
        detail=False,
        methods=['get'],
        url_path=r'parcours/(?P<parcours_id>[^/.]+)/stats',
    )
    def parcours_stats(self, request, parcours_id=None):
        """Calcule le taux de complétion (%) et le temps total accumulé

        pour un parcours spécifique donné.
        """
        user = request.user

        # Vérifier si le parcours existe
        parcours = get_object_or_404(Parcours, id=parcours_id)

        # Compter le nombre total de leçons dans le parcours
        total_lecons = Lecon.objects.filter(
            module__parcours=parcours
        ).count()

        if total_lecons == 0:
            return Response({
                "parcours_id": str(parcours.id),
                "total_lecons": 0,
                "lecons_terminees": 0,
                "lecons_en_cours": 0,
                "pourcentage": 0.0,
                "temps_total_secondes": 0,
            })

        # Récupérer les progressions de l'utilisateur sur ce parcours
        progressions = Progression.objects.filter(
            apprenant=user, lecon__module__parcours=parcours
        )

        lecons_terminees = progressions.filter(
            statut=StatutProgression.TERMINE
        ).count()
        lecons_en_cours = progressions.filter(
            statut=StatutProgression.EN_COURS
        ).count()

        # Somme du temps passé (en secondes)
        temps_total_secondes = (
            sum(p.temps_passe for p in progressions) if progressions else 0
        )

        # Calcul du pourcentage arrondi
        pourcentage = round((lecons_terminees / total_lecons) * 100, 2)

        return Response({
            "parcours_id": str(parcours.id),
            "total_lecons": total_lecons,
            "lecons_terminees": lecons_terminees,
            "lecons_en_cours": lecons_en_cours,
            "pourcentage": pourcentage,
            "temps_total_secondes": temps_total_secondes,
        })