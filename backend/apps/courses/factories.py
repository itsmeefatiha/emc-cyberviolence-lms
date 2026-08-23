import factory

from apps.courses.models import Lecon, Module, Parcours, StatutPublication
from apps.users.factories import UserFactory
from apps.users.models import Utilisateur


class ParcoursFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Parcours

    titre = factory.Sequence(lambda n: f'Parcours {n}')
    description = factory.Faker('sentence')
    profil_cible = Utilisateur.ProfilProfessionnel.EDUCATEUR
    statut = StatutPublication.PUBLIE
    formateur = factory.SubFactory(UserFactory, formateur=True)
    ordre = factory.Sequence(lambda n: n + 1)

    class Params:
        brouillon = factory.Trait(statut=StatutPublication.BROUILLON)
        archive = factory.Trait(statut=StatutPublication.ARCHIVE)


class ModuleFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Module

    parcours = factory.SubFactory(ParcoursFactory)
    titre = factory.Sequence(lambda n: f'Module {n}')
    description = factory.Faker('sentence')
    ordre = factory.Sequence(lambda n: n + 1)


class LeconFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Lecon

    module = factory.SubFactory(ModuleFactory)
    titre = factory.Sequence(lambda n: f'Leçon {n}')
    duree_estimee = 15
    ordre = factory.Sequence(lambda n: n + 1)
