from django.contrib import admin

from .models import Certificat, Option, Question, Quiz, TentativeQuiz


class OptionInline(admin.TabularInline):
    model = Option
    extra = 2


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1
    show_change_link = True
    inlines = [OptionInline]


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ('titre', 'module', 'lecon', 'note_de_passage', 'duree_minutes', 'max_tentatives', 'date_creation')
    list_filter = ('melange_questions', 'date_creation')
    search_fields = ('titre', 'description', 'module__titre', 'lecon__titre')
    inlines = [QuestionInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('quiz', 'ordre', 'type_question', 'points')
    list_filter = ('type_question',)
    search_fields = ('texte', 'quiz__titre')


@admin.register(Option)
class OptionAdmin(admin.ModelAdmin):
    list_display = ('question', 'texte', 'est_correcte')
    list_filter = ('est_correcte',)
    search_fields = ('texte', 'question__texte')


@admin.register(TentativeQuiz)
class TentativeQuizAdmin(admin.ModelAdmin):
    list_display = ('apprenant', 'quiz', 'score_obtenu', 'est_reussi', 'date_soumission')
    list_filter = ('est_reussi', 'date_soumission')
    search_fields = ('apprenant__email', 'quiz__titre')


@admin.register(Certificat)
class CertificatAdmin(admin.ModelAdmin):
    list_display = ('apprenant', 'parcours', 'code_verification', 'date_emission')
    search_fields = ('apprenant__email', 'parcours__titre', 'code_verification')
