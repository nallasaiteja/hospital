from django.contrib import admin
from .models import Hospital, Branch, Department, AuditLog


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'city', 'state', 'currency', 'is_active')
    search_fields = ('name', 'code', 'city')
    list_filter = ('is_active', 'country')


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'hospital', 'city', 'is_main_branch', 'is_active')
    search_fields = ('name', 'code', 'city')
    list_filter = ('is_main_branch', 'is_active', 'hospital')


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'branch', 'is_active')
    search_fields = ('name', 'code')
    list_filter = ('branch', 'is_active')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'actor_email', 'action', 'entity_type', 'entity_id', 'branch')
    search_fields = ('actor_email', 'action', 'entity_type', 'entity_id')
    list_filter = ('action', 'entity_type', 'branch')
    readonly_fields = ('id', 'actor_user_id', 'actor_email', 'action', 'entity_type', 'entity_id', 'branch', 'ip_address', 'user_agent', 'old_values', 'new_values', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
