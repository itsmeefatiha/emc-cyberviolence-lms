from datetime import timedelta

import factory
from django.utils import timezone

from apps.live_sessions.models import SessionLive, StatutSession
from apps.users.factories import UserFactory
from apps.users.models import Utilisateur


class SessionLiveFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = SessionLive

    titre = factory.Sequence(lambda n: f'Session live {n}')
    description = 'Session de test'
    profil_cible = Utilisateur.ProfilProfessionnel.EDUCATEUR
    formateur = factory.SubFactory(UserFactory, formateur=True)
    statut = StatutSession.PLANIFIEE
    date_debut = factory.LazyFunction(lambda: timezone.now() + timedelta(hours=1))
    date_fin = factory.LazyFunction(lambda: timezone.now() + timedelta(hours=2))

    class Params:
        live_now = factory.Trait(
            statut=StatutSession.EN_COURS,
            date_debut=factory.LazyFunction(lambda: timezone.now() - timedelta(minutes=10)),
            date_fin=factory.LazyFunction(lambda: timezone.now() + timedelta(hours=1)),
        )
        ended = factory.Trait(
            statut=StatutSession.TERMINEE,
            date_debut=factory.LazyFunction(lambda: timezone.now() - timedelta(hours=3)),
            date_fin=factory.LazyFunction(lambda: timezone.now() - timedelta(hours=1)),
        )
        brouillon = factory.Trait(statut=StatutSession.BROUILLON)
