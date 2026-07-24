from django.contrib import admin
from .models import Lecon, Module, Parcours
from .models import (
    ContenuDocument,
    ContenuSCORM,
    ContenuVideo,
    Lecon,
    Module,
    Parcours,
)


class LeconInline(admin.TabularInline):
    model = Lecon
    extra = 1


class ModuleInline(admin.TabularInline):
    model = Module
    extra = 1


@admin.register(Parcours)
class ParcoursAdmin(admin.ModelAdmin):
    list_display = (
        'titre',
        'profil_cible',
        'statut',
        'formateur',
        'date_creation',
    )
    list_filter = ('profil_cible', 'statut')
    search_fields = ('titre', 'description')
    inlines = [ModuleInline]


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ('titre', 'parcours', 'ordre')
    list_filter = ('parcours',)
    inlines = [LeconInline]


@admin.register(Lecon)
class LeconAdmin(admin.ModelAdmin):
    list_display = ('titre', 'module', 'duree_estimee', 'ordre')
    list_filter = ('module__parcours', 'module')


@admin.register(ContenuDocument)
class ContenuDocumentAdmin(admin.ModelAdmin):
    list_display = ('titre_fichier', 'lecon', 'format', 'date_creation')
    search_fields = ('titre_fichier', 'lecon__titre')


@admin.register(ContenuVideo)
class ContenuVideoAdmin(admin.ModelAdmin):
    list_display = (
        'titre_fichier',
        'lecon',
        'duree',
        'statut_encodage',
        'date_creation',
    )
    list_filter = ('statut_encodage',)
    search_fields = ('titre_fichier', 'lecon__titre')


@admin.register(ContenuSCORM)
class ContenuSCORMAdmin(admin.ModelAdmin):
    list_display = (
        'titre_fichier',
        'lecon',
        'standard',
        'version',
        'date_creation',
    )
    search_fields = ('titre_fichier', 'lecon__titre')