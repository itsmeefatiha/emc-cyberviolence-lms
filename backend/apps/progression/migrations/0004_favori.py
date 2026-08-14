import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('courses', '0001_initial'),
        ('progression', '0003_inscription'),
    ]

    operations = [
        migrations.CreateModel(
            name='Favori',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('date_ajout', models.DateTimeField(auto_now_add=True, verbose_name="Date d'ajout")),
                (
                    'apprenant',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='favoris',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Apprenant',
                    ),
                ),
                (
                    'parcours',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='favoris',
                        to='courses.parcours',
                        verbose_name='Parcours',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Favori',
                'verbose_name_plural': 'Favoris',
                'ordering': ['-date_ajout'],
                'unique_together': {('apprenant', 'parcours')},
            },
        ),
    ]
