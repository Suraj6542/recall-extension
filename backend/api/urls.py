from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

urlpatterns = [
    path('health/',                 views.health,             name='health'),
    path('auth/register/',          views.register,           name='register'),   # new
    path('auth/login/',             TokenObtainPairView.as_view(), name='login'), # new
    path('auth/refresh/',           TokenRefreshView.as_view(),    name='refresh'),
    path('items/',                  views.recall_items,       name='recall-items'),
    path('items/due/',              views.due_items,          name='due-items'),
    path('items/<int:pk>/',         views.recall_item_detail, name='recall-item-detail'),
    path('items/<int:pk>/snooze/',  views.snooze_item,        name='snooze-item'),
]