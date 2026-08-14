from __future__ import annotations

import shutil
import zipfile
from pathlib import Path
from urllib.parse import urljoin
from xml.etree import ElementTree as ET

from django.conf import settings
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import ContenuSCORM, ContenuVideo


VIDEO_STREAM_PREFIX = 'courses/videos/streams'
SCORM_EXTRACTED_PREFIX = 'scorm_extracted'


def _media_relative_url(*parts: str) -> str:
    media_url = settings.MEDIA_URL or '/media/'
    if not media_url.endswith('/'):
        media_url += '/'
    return urljoin(media_url, '/'.join(part.strip('/') for part in parts))


def process_video_content(video_instance: ContenuVideo) -> ContenuVideo:
    """Prépare une vidéo pour la lecture (pointe vers le fichier source réel)."""

    video_instance.statut_encodage = ContenuVideo.StatutEncodage.EN_COURS
    video_instance.save(update_fields=['statut_encodage'])

    source_size = 0
    if video_instance.fichier_source:
        try:
            source_size = video_instance.fichier_source.size or 0
        except OSError:
            source_size = 0

    video_instance.duree = max(30, source_size // 1024) if source_size else 180

    # Utiliser l'URL réelle du fichier uploadé (pas un faux flux HLS)
    if video_instance.fichier_source:
        video_instance.url_stream = video_instance.fichier_source.url
    else:
        video_instance.url_stream = ''

    video_instance.statut_encodage = ContenuVideo.StatutEncodage.PRÊT
    video_instance.save(
        update_fields=['duree', 'url_stream', 'statut_encodage']
    )
    return video_instance


def _candidate_scorm_launch_path(extracted_dir: Path) -> Path | None:
    manifest_path = None
    for candidate in extracted_dir.rglob('imsmanifest.xml'):
        manifest_path = candidate
        break

    if manifest_path and manifest_path.exists():
        try:
            tree = ET.parse(manifest_path)
            root = tree.getroot()
            namespace = ''
            if root.tag.startswith('{'):
                namespace = root.tag.split('}')[0] + '}'

            resource = root.find(f'.//{namespace}resource')
            if resource is not None:
                href = resource.attrib.get('href')
                if href:
                    launch_candidate = (manifest_path.parent / href).resolve()
                    if launch_candidate.exists():
                        return launch_candidate

        except ET.ParseError:
            pass

    preferred_names = ('index.html', 'launch.html', 'default.html', 'default.htm')
    for name in preferred_names:
        for candidate in extracted_dir.rglob(name):
            if candidate.is_file():
                return candidate

    for candidate in extracted_dir.rglob('*.html'):
        if candidate.is_file():
            return candidate

    return None


def process_scorm_package(scorm_instance: ContenuSCORM) -> ContenuSCORM:
    """Décompresse un package SCORM et identifie la page de lancement."""

    if not scorm_instance.package_url:
        return scorm_instance

    extracted_root = Path(settings.MEDIA_ROOT) / SCORM_EXTRACTED_PREFIX / str(
        scorm_instance.id
    )
    if extracted_root.exists():
        shutil.rmtree(extracted_root)
    extracted_root.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(scorm_instance.package_url.path) as archive:
        archive.extractall(extracted_root)

    launch_path = _candidate_scorm_launch_path(extracted_root)
    if launch_path:
        launch_relative = launch_path.relative_to(settings.MEDIA_ROOT)
        scorm_instance.launch_path_url = _media_relative_url(
            *launch_relative.parts
        )
    else:
        scorm_instance.launch_path_url = ''

    scorm_instance.save(update_fields=['launch_path_url'])
    return scorm_instance


@receiver(post_save, sender=ContenuVideo)
def handle_video_processing(sender, instance, created, **kwargs):
    if not created:
        return

    def _process():
        process_video_content(instance)

    transaction.on_commit(_process)


@receiver(post_save, sender=ContenuSCORM)
def handle_scorm_processing(sender, instance, created, **kwargs):
    if not created:
        return

    def _process():
        process_scorm_package(instance)

    transaction.on_commit(_process)