import factory

from apps.courses.factories import LeconFactory, ParcoursFactory
from apps.progression.models import (
    ActiviteJournaliere,
    Favori,
    Inscription,
    Progression,
    StatutProgression,
)
from apps.users.factories import UserFactory


class InscriptionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Inscription

    apprenant = factory.SubFactory(UserFactory)
    parcours = factory.SubFactory(ParcoursFactory)


class FavoriFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Favori

    apprenant = factory.SubFactory(UserFactory)
    parcours = factory.SubFactory(ParcoursFactory)


class ProgressionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Progression

    apprenant = factory.SubFactory(UserFactory)
    lecon = factory.SubFactory(LeconFactory)
    statut = StatutProgression.NON_COMMENCE
    temps_passe = 0


class ActiviteJournaliereFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ActiviteJournaliere

    apprenant = factory.SubFactory(UserFactory)
    date = factory.Faker('date_object')
    secondes = 120
