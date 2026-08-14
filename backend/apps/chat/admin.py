from django.contrib import admin

from .models import ChatMessage, Conversation


class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    extra = 0
    readonly_fields = ('sender', 'body', 'est_lu', 'created_at')


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('apprenant', 'formateur', 'updated_at')
    search_fields = ('apprenant__email', 'formateur__email')
    inlines = [ChatMessageInline]


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('conversation', 'sender', 'est_lu', 'created_at')
    list_filter = ('est_lu',)
    search_fields = ('body', 'sender__email')
