from rest_framework import serializers
from .models import RecallItem

class RecallItemSerializer(serializers.ModelSerializer):

    class Meta:
        model  = RecallItem
        fields = [
            'id', 'type', 'title', 'content', 'url', 'extra',
            'remind_at', 'snoozed_at', 'snooze_count',
            'is_completed', 'is_deleted', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'snoozed_at', 'snooze_count']