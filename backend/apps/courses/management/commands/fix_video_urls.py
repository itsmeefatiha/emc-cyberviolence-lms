"""Corrige les url_stream vidéo pointant vers de faux fichiers .m3u8."""

from django.core.management.base import BaseCommand

from apps.courses.models import ContenuVideo
from apps.courses.services import process_video_content


class Command(BaseCommand):
    help = 'Recalcule url_stream des vidéos à partir du fichier source réel'

    def handle(self, *args, **options):
        qs = ContenuVideo.objects.exclude(fichier_source='')
        fixed = 0
        for video in qs.iterator():
            stream = (video.url_stream or '').lower()
            if (not video.url_stream) or stream.endswith('.m3u8') or 'streams/' in stream:
                process_video_content(video)
                fixed += 1
                self.stdout.write(f'  ✓ {video.titre_fichier or video.id}')

        self.stdout.write(self.style.SUCCESS(f'{fixed} vidéo(s) corrigée(s).'))
