from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
class RecallUserManager(BaseUserManager):

    def create_user(self, username, password=None, email=None):
        if not username:
            raise ValueError("Username is required")
        user = self.model(username=username, email=email or "")
        user.set_password(password)   
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, email=None):
        user = self.create_user(username, password, email)
        user.is_staff    = True
        user.is_superuser = True
        user.save(using=self._db)
        return user

class RecallUser(AbstractBaseUser, PermissionsMixin):
    username   = models.CharField(max_length=50, unique=True)
    email      = models.EmailField(blank=True, null=True)
    is_active  = models.BooleanField(default=True)
    is_staff   = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = RecallUserManager()

    USERNAME_FIELD  = 'username'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.username
class RecallItem(models.Model):

    TYPE_CHOICES = [
        ('LINK',     'Link'),
        ('TODO',     'Todo'),
        ('NOTE',     'Note'),
        ('VIDEO',    'Video'),
        ('JOB',      'Job'),
        ('PURCHASE', 'Purchase'),
        ('DOCUMENT', 'Document'),
    ]
    user  = models.ForeignKey(
                       RecallUser,
                       on_delete=models.CASCADE,
                       related_name='recall_items',
                   )

    type         = models.CharField(max_length=20, choices=TYPE_CHOICES, default='LINK')
    title        = models.CharField(max_length=255)
    content      = models.TextField(blank=True, null=True)   # note / description
    url          = models.URLField(blank=True, null=True)
    extra        = models.JSONField(blank=True, null=True)   # type-specific fields (company, price, etc.)
    remind_at    = models.DateTimeField()
    snoozed_at   = models.DateTimeField(blank=True, null=True)  # last snooze time
    snooze_count = models.PositiveIntegerField(default=0)
    is_completed = models.BooleanField(default=False)
    is_deleted   = models.BooleanField(default=False)        # soft delete
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.type}] {self.title}"