from django.apps import AppConfig


class LiveSessionsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.live_sessions'
    label = 'live_sessions'
    verbose_name = 'Sessions live'

    def ready(self):
        from . import signals  # noqa: F401
