from django.utils import timezone
from datetime import timedelta

from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from django.contrib.auth.models import User
from .models import RecallUser, RecallItem
from .models import RecallItem
from .serializers import RecallItemSerializer



@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"})


#REGISTER 

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()
    email    = request.data.get('email', '').strip()

    if not username or not password:
        return Response({"error": "Username and password required."}, status=400)

    if RecallUser.objects.filter(username=username).exists():
        return Response({"error": "Username already taken."}, status=400)

    RecallUser.objects.create_user(username=username, password=password, email=email)
    return Response({"message": "Account created. Please log in."}, status=201)

# LIST / CREATE 

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def recall_items(request):

    if request.method == 'GET':
        items = RecallItem.objects.filter(user=request.user, is_deleted=False)  

        item_type = request.query_params.get('type')
        if item_type:
            items = items.filter(type=item_type)

        completed = request.query_params.get('completed')
        if completed == 'false':
            items = items.filter(is_completed=False)
        elif completed == 'true':
            items = items.filter(is_completed=True)

        return Response(RecallItemSerializer(items, many=True).data)

    if request.method == 'POST':
        serializer = RecallItemSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)   # ← attach user on save
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


# RETRIEVE / UPDATE / DELETE

@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def recall_item_detail(request, pk):

    try:
        # Scope by user — users cannot access each other's items
        item = RecallItem.objects.get(pk=pk, user=request.user, is_deleted=False)
    except RecallItem.DoesNotExist:
        return Response({"error": "Not found"}, status=404)

    if request.method == 'GET':
        return Response(RecallItemSerializer(item).data)

    if request.method == 'PATCH':
        serializer = RecallItemSerializer(item, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    if request.method == 'DELETE':
        item.is_deleted = True
        item.save()
        return Response({"deleted": True})


#SNOOZE 

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def snooze_item(request, pk):
    try:
        item = RecallItem.objects.get(pk=pk, user=request.user, is_deleted=False)
    except RecallItem.DoesNotExist:
        return Response({"error": "Not found"}, status=404)

    minutes        = int(request.data.get('minutes', 30))
    item.remind_at    = timezone.now() + timedelta(minutes=minutes)
    item.snoozed_at   = timezone.now()
    item.snooze_count += 1
    item.save()

    return Response(RecallItemSerializer(item).data)


#  DUE NOW 

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def due_items(request):
    items = RecallItem.objects.filter(
        user=request.user,      
        is_deleted=False,
        is_completed=False,
        remind_at__lte=timezone.now()
    )
    return Response(RecallItemSerializer(items, many=True).data)