import factory

from apps.chat.models import ChatMessage, Conversation
from apps.users.factories import UserFactory


class ConversationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Conversation

    apprenant = factory.SubFactory(UserFactory)
    formateur = factory.SubFactory(UserFactory, formateur=True)


class ChatMessageFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ChatMessage

    conversation = factory.SubFactory(ConversationFactory)
    sender = factory.SelfAttribute('conversation.apprenant')
    body = factory.Faker('sentence')
    est_lu = False
