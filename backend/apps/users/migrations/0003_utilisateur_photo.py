# Generated manually for photo de profil

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_alter_utilisateur_is_active'),
    ]

    operations = [
        migrations.AddField(
            model_name='utilisateur',
            name='photo',
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to='avatars/',
                verbose_name='Photo de profil',
            ),
        ),
    ]
