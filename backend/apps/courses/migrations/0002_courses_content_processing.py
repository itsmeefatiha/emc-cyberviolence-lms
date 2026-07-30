from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='contenuvideo',
            name='fichier_source',
            field=models.FileField(
                blank=True,
                null=True,
                upload_to='courses/videos/source/',
                verbose_name='Fichier source vidéo',
            ),
        ),
        migrations.AlterField(
            model_name='contenuvideo',
            name='url_stream',
            field=models.URLField(
                blank=True, default='', verbose_name='URL du flux vidéo'
            ),
        ),
        migrations.AlterField(
            model_name='contenuvideo',
            name='duree',
            field=models.PositiveIntegerField(
                default=0, help_text='Durée en secondes', verbose_name='Durée (s)'
            ),
        ),
        migrations.AddField(
            model_name='contenuscorm',
            name='launch_path_url',
            field=models.CharField(
                blank=True,
                default='',
                max_length=500,
                verbose_name='URL de lancement',
            ),
        ),
    ]