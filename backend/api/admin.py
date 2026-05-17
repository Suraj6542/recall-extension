from django.contrib import admin
from .models import RecallItem


@admin.register(RecallItem)
class RecallItemAdmin(admin.ModelAdmin):
    list_display  = ['id', 'type', 'title', 'remind_at', 'is_completed', 'is_deleted', 'snooze_count']
    list_filter   = ['type', 'is_completed', 'is_deleted']
    search_fields = ['title', 'content']
    ordering      = ['-created_at']