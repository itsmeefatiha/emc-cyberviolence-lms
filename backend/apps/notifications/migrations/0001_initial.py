# Generated manually

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('courses', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('titre', models.CharField(max_length=255, verbose_name='Titre')),
                ('message', models.TextField(verbose_name='Message')),
                (
                    'type_notification',
                    models.CharField(
                        choices=[
                            ('PARCOURS_PUBLIE', 'Nouveau parcours publié'),
                            ('CERTIFICAT', 'Certificat disponible'),
                            ('QUIZ', 'Quiz'),
                            ('SYSTEME', 'Système'),
                        ],
                        default='SYSTEME',
                        max_length=30,
                        verbose_name='Type',
                    ),
                ),
                ('lien', models.CharField(blank=True, default='', max_length=500, verbose_name='Lien')),
                ('est_lue', models.BooleanField(default=False, verbose_name='Lue')),
                ('date_creation', models.DateTimeField(auto_now_add=True, verbose_name='Date')),
                (
                    'destinataire',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='notifications',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Destinataire',
                    ),
                ),
                (
                    'parcours',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='notifications',
                        to='courses.parcours',
                        verbose_name='Parcours',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Notification',
                'verbose_name_plural': 'Notifications',
                'ordering': ['-date_creation'],
            },
        ),
    ]
