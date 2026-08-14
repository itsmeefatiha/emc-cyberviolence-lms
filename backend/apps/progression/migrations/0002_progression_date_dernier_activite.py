from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('progression', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='progression',
            name='date_dernier_activite',
            field=models.DateTimeField(auto_now=True, blank=True, null=True, verbose_name='Dernière activité'),
        ),
    ]
