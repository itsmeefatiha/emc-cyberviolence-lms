from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.courses.models import Lecon, Parcours
from django.shortcuts import get_object_or_404

from .models import Progression, StatutProgression
from .serializers import ProgressionSerializer


class ProgressionViewSet(viewsets.ModelViewSet):
    serializer_class = ProgressionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        user_role = getattr(user, 'role', None)

        # Les Administrateurs et Formateurs voient toutes les progressions
        if user_role in ['ADMIN', 'FORMATEUR'] or user.is_staff:
            return Progression.objects.all()

        # Un apprenant ne consulte que sa propre progression
        return Progression.objects.filter(apprenant=user)

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
        progression, created = Progression.objects.get_or_create(
            apprenant=request.user,
            lecon_id=lecon_id,
            defaults={'statut': StatutProgression.EN_COURS},
        )

        # Cumul du temps passé
        if isinstance(temps_ajoute, int) and temps_ajoute > 0:
            progression.temps_passe += temps_ajoute

        # Mise à jour facultative du statut
        if nouveau_statut in StatutProgression.values:
            progression.statut = nouveau_statut
            if (
                nouveau_statut == StatutProgression.TERMINE
                and not progression.date_fin
            ):
                progression.date_fin = timezone.now()

        progression.save()

        serializer = self.get_serializer(progression)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
            if created
            else status.HTTP_200_OK,
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