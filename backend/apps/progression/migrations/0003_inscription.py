import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('courses', '0001_initial'),
        ('progression', '0002_progression_date_dernier_activite'),
    ]

    operations = [
        migrations.CreateModel(
            name='Inscription',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('date_inscription', models.DateTimeField(auto_now_add=True, verbose_name="Date d'inscription")),
                (
                    'apprenant',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='inscriptions',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Apprenant',
                    ),
                ),
                (
                    'parcours',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='inscriptions',
                        to='courses.parcours',
                        verbose_name='Parcours',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Inscription',
                'verbose_name_plural': 'Inscriptions',
                'ordering': ['-date_inscription'],
                'unique_together': {('apprenant', 'parcours')},
            },
        ),
    ]
