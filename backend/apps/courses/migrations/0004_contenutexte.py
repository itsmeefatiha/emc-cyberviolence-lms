import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0003_parcours_image'),
    ]

    operations = [
        migrations.CreateModel(
            name='ContenuTexte',
            fields=[
                (
                    'contenu_ptr',
                    models.OneToOneField(
                        auto_created=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        parent_link=True,
                        primary_key=True,
                        serialize=False,
                        to='courses.contenu',
                    ),
                ),
                ('corps', models.TextField(verbose_name='Corps du texte')),
            ],
            options={
                'verbose_name': 'Contenu Texte',
                'verbose_name_plural': 'Contenus Texte',
            },
            bases=('courses.contenu',),
        ),
    ]
