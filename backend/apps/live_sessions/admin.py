from django.contrib import admin

from .models import PresenceSession, RoomPeer, SessionLive, SignalMessage


@admin.register(SessionLive)
class SessionLiveAdmin(admin.ModelAdmin):
    list_display = (
        'titre',
        'profil_cible',
        'formateur',
        'statut',
        'room_name',
        'date_debut',
        'date_fin',
    )
    list_filter = ('statut', 'profil_cible')
    search_fields = ('titre', 'formateur__email', 'room_name')
    readonly_fields = ('room_name',)


@admin.register(PresenceSession)
class PresenceSessionAdmin(admin.ModelAdmin):
    list_display = ('session', 'apprenant', 'date_join')
    list_filter = ('date_join',)
    search_fields = ('session__titre', 'apprenant__email')


@admin.register(RoomPeer)
class RoomPeerAdmin(admin.ModelAdmin):
    list_display = ('session', 'display_name', 'peer_id', 'is_moderator', 'last_seen')
    list_filter = ('is_moderator',)
    search_fields = ('display_name', 'peer_id', 'session__titre')


@admin.register(SignalMessage)
class SignalMessageAdmin(admin.ModelAdmin):
    list_display = ('session', 'from_peer_id', 'to_peer_id', 'consumed', 'created_at')
    list_filter = ('consumed',)
