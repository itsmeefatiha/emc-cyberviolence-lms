from django.contrib import admin

from .models import ActiviteJournaliere, Favori, Inscription, Progression


@admin.register(Inscription)
class InscriptionAdmin(admin.ModelAdmin):
    list_display = ('apprenant', 'parcours', 'date_inscription')
    list_filter = ('date_inscription',)
    search_fields = ('apprenant__email', 'parcours__titre')


@admin.register(Favori)
class FavoriAdmin(admin.ModelAdmin):
    list_display = ('apprenant', 'parcours', 'date_ajout')
    list_filter = ('date_ajout',)
    search_fields = ('apprenant__email', 'parcours__titre')


@admin.register(ActiviteJournaliere)
class ActiviteJournaliereAdmin(admin.ModelAdmin):
    list_display = ('apprenant', 'date', 'secondes')
    list_filter = ('date',)
    search_fields = ('apprenant__email',)


@admin.register(Progression)
class ProgressionAdmin(admin.ModelAdmin):
    list_display = ('apprenant', 'lecon', 'statut', 'temps_passe', 'date_dernier_activite')
    list_filter = ('statut',)
    search_fields = ('apprenant__email', 'lecon__titre')
