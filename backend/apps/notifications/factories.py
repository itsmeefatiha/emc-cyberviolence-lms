import factory

from apps.notifications.models import Notification, TypeNotification
from apps.users.factories import UserFactory


class NotificationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Notification

    destinataire = factory.SubFactory(UserFactory)
    titre = factory.Sequence(lambda n: f'Notification {n}')
    message = factory.Faker('sentence')
    type_notification = TypeNotification.SYSTEME
    lien = '/dashboard'
    est_lue = False
