import uuid
from django.db import models


class BaseUUIDModel(models.Model):
    """
    Abstract base model providing UUID primary keys and standard audit timestamps.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        abstract = True


class Hospital(BaseUUIDModel):
    """
    Represents the parent healthcare enterprise/network.
    """
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    legal_name = models.CharField(max_length=255, blank=True)
    tax_identifier = models.CharField(max_length=100, blank=True, help_text="GSTIN / PAN / Corporate Tax ID")
    registration_number = models.CharField(max_length=100, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)
    website = models.URLField(blank=True)
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100, default='India')
    currency = models.CharField(max_length=10, default='INR')
    timezone = models.CharField(max_length=50, default='Asia/Kolkata')

    class Meta:
        db_table = 'hms_hospitals'
        verbose_name = 'Hospital'
        verbose_name_plural = 'Hospitals'

    def __str__(self):
        return f"{self.name} ({self.code})"


class Branch(BaseUUIDModel):
    """
    Individual operational hospital facility, hospital branch, or clinic.
    """
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name='branches')
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    is_main_branch = models.BooleanField(default=False)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100, default='India')
    operating_hours = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'hms_branches'
        verbose_name = 'Branch'
        verbose_name_plural = 'Branches'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} - {self.hospital.code}"


class Department(BaseUUIDModel):
    """
    Specialty medical or administrative departments within a specific hospital branch.
    """
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='departments')
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    head_of_department_id = models.UUIDField(null=True, blank=True, help_text="StaffProfile UUID")

    class Meta:
        db_table = 'hms_departments'
        verbose_name = 'Department'
        verbose_name_plural = 'Departments'
        unique_together = ('branch', 'code')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.branch.name})"


class AuditLog(models.Model):
    """
    Immutable audit trail recording critical actions, clinical modifications, and security events.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor_user_id = models.UUIDField(null=True, blank=True, db_index=True, help_text="Supabase auth UUID")
    actor_email = models.CharField(max_length=255, blank=True)
    action = models.CharField(max_length=100, db_index=True)
    entity_type = models.CharField(max_length=100, db_index=True)
    entity_id = models.CharField(max_length=100, blank=True)
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'hms_audit_logs'
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at}] {self.actor_email or 'System'} -> {self.action} on {self.entity_type} {self.entity_id}"
