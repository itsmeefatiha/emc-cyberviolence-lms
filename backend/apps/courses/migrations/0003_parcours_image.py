from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0002_courses_content_processing'),
    ]

    operations = [
        migrations.AddField(
            model_name='parcours',
            name='image',
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to='parcours/covers/',
                verbose_name='Image de couverture',
            ),
        ),
    ]
