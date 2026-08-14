from django.core.management.base import BaseCommand

from apps.notifications.services import send_upcoming_session_reminders


class Command(BaseCommand):
    help = (
        'Envoie aux formateurs un rappel 15 minutes avant le début '
        'de leurs sessions de visioconférence.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--window',
            type=int,
            default=15,
            help='Minutes avant le début (défaut: 15).',
        )
        parser.add_argument(
            '--skew',
            type=int,
            default=1,
            help='Tolérance en minutes autour de la fenêtre (défaut: 1).',
        )

    def handle(self, *args, **options):
        sent = send_upcoming_session_reminders(
            window_minutes=options['window'],
            skew_minutes=options['skew'],
        )
        self.stdout.write(self.style.SUCCESS(f'{sent} rappel(s) envoyé(s).'))
