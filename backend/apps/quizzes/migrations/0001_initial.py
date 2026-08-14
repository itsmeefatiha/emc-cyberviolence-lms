# Generated manually for the quizzes app.

import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('courses', '0002_courses_content_processing'),
    ]

    operations = [
        migrations.CreateModel(
            name='Quiz',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('titre', models.CharField(max_length=255, verbose_name='Titre')),
                ('description', models.TextField(blank=True, verbose_name='Description')),
                ('note_de_passage', models.DecimalField(decimal_places=2, default=80, max_digits=5, verbose_name='Note de passage (%)')),
                ('duree_minutes', models.PositiveIntegerField(default=30, verbose_name='Durée limite (minutes)')),
                ('max_tentatives', models.PositiveIntegerField(default=3, verbose_name='Nombre max de tentatives')),
                ('melange_questions', models.BooleanField(default=True, verbose_name='Mélanger les questions')),
                ('date_creation', models.DateTimeField(auto_now_add=True, verbose_name='Date de création')),
                ('lecon', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='quizzes_for_lecon', to='courses.lecon', verbose_name='Leçon')),
                ('module', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='quizzes', to='courses.module', verbose_name='Module')),
            ],
            options={
                'verbose_name': 'Quiz',
                'verbose_name_plural': 'Quizzes',
                'ordering': ['-date_creation'],
            },
        ),
        migrations.CreateModel(
            name='Question',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('texte', models.TextField(verbose_name='Texte')),
                ('type_question', models.CharField(choices=[('QCU', 'Choix unique'), ('QCM', 'Choix multiple')], max_length=3, verbose_name='Type')),
                ('explication', models.TextField(blank=True, verbose_name='Explication')),
                ('points', models.PositiveIntegerField(default=1, verbose_name='Points')),
                ('ordre', models.PositiveIntegerField(default=1, verbose_name='Ordre')),
                ('quiz', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='questions', to='quizzes.quiz', verbose_name='Quiz')),
            ],
            options={
                'verbose_name': 'Question',
                'verbose_name_plural': 'Questions',
                'ordering': ['ordre', 'id'],
            },
        ),
        migrations.CreateModel(
            name='Option',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('texte', models.CharField(max_length=500, verbose_name='Texte')),
                ('est_correcte', models.BooleanField(default=False, verbose_name='Est correcte')),
                ('question', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='options', to='quizzes.question', verbose_name='Question')),
            ],
            options={
                'verbose_name': 'Option',
                'verbose_name_plural': 'Options',
                'ordering': ['id'],
            },
        ),
        migrations.CreateModel(
            name='TentativeQuiz',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('score_obtenu', models.DecimalField(decimal_places=2, default=0, max_digits=5, verbose_name='Score obtenu (%)')),
                ('points_obtenus', models.DecimalField(decimal_places=2, default=0, max_digits=8, verbose_name='Points obtenus')),
                ('est_reussi', models.BooleanField(default=False, verbose_name='Réussi')),
                ('reponses_json', models.JSONField(blank=True, default=list, verbose_name='Réponses fournies')),
                ('temps_reponse_secondes', models.PositiveIntegerField(default=0, verbose_name='Temps de réponse (s)')),
                ('date_soumission', models.DateTimeField(auto_now_add=True, verbose_name='Date de soumission')),
                ('apprenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tentatives_quiz', to=settings.AUTH_USER_MODEL, verbose_name='Apprenant')),
                ('quiz', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tentatives', to='quizzes.quiz', verbose_name='Quiz')),
            ],
            options={
                'verbose_name': 'Tentative de quiz',
                'verbose_name_plural': 'Tentatives de quiz',
                'ordering': ['-date_soumission'],
            },
        ),
        migrations.CreateModel(
            name='Certificat',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code_verification', models.CharField(db_index=True, max_length=64, unique=True, verbose_name='Code de vérification')),
                ('fichier_pdf', models.FileField(blank=True, null=True, upload_to='certificats/', verbose_name='Fichier PDF')),
                ('date_emission', models.DateTimeField(auto_now_add=True, verbose_name='Date d\u2019émission')),
                ('apprenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='certificats', to=settings.AUTH_USER_MODEL, verbose_name='Apprenant')),
                ('parcours', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='certificats', to='courses.parcours', verbose_name='Parcours')),
            ],
            options={
                'verbose_name': 'Certificat',
                'verbose_name_plural': 'Certificats',
                'ordering': ['-date_emission'],
            },
        ),
        migrations.AddConstraint(
            model_name='tentativequiz',
            constraint=models.UniqueConstraint(fields=('apprenant', 'quiz', 'date_soumission'), name='unique_attempt_per_timestamp'),
        ),
        migrations.AddConstraint(
            model_name='certificat',
            constraint=models.UniqueConstraint(fields=('apprenant', 'parcours'), name='unique_certificate_per_parcours'),
        ),
    ]
