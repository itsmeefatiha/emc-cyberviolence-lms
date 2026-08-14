import factory
from django.contrib.auth import get_user_model

User = get_user_model()


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    username = factory.Sequence(lambda n: f'user{n}')
    email = factory.LazyAttribute(lambda o: f'{o.username}@example.com')
    first_name = factory.Faker('first_name')
    last_name = factory.Faker('last_name')
    telephone = factory.Sequence(lambda n: f'06{n:08d}')
    role = User.RoleChoices.APPRENANT
    profil_professionnel = User.ProfilProfessionnel.EDUCATEUR
    specialite = None
    is_active = True

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        password = extracted or 'Testpass123!'
        self.set_password(password)
        if create:
            self.save()

    class Params:
        formateur = factory.Trait(
            role=User.RoleChoices.FORMATEUR,
            specialite='Cyberviolence',
            profil_professionnel=None,
        )
        admin = factory.Trait(
            role=User.RoleChoices.ADMIN,
            is_staff=True,
            is_superuser=True,
            specialite=None,
            profil_professionnel=None,
        )
        inactive = factory.Trait(is_active=False)
