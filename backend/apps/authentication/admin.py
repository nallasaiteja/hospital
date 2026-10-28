from django.contrib import admin
from .models import Permission, Role, UserProfile, StaffProfile, PatientProfile


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'module', 'is_active')
    search_fields = ('code', 'name', 'module')
    list_filter = ('module', 'is_active')


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'display_name', 'is_active')
    search_fields = ('name', 'display_name')
    filter_horizontal = ('permissions',)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('email', 'full_name', 'role', 'is_verified', 'is_active', 'created_at')
    search_fields = ('email', 'first_name', 'last_name', 'supabase_user_id')
    list_filter = ('role', 'is_verified', 'is_active')
    readonly_fields = ('supabase_user_id', 'created_at', 'updated_at', 'last_login_at')


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'user_profile', 'designation', 'branch', 'department', 'status', 'is_on_duty')
    search_fields = ('employee_id', 'user_profile__email', 'user_profile__first_name', 'user_profile__last_name', 'medical_license_number')
    list_filter = ('branch', 'department', 'status', 'is_on_duty')


@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    list_display = ('medical_record_number', 'user_profile', 'primary_branch', 'gender', 'blood_group', 'created_at')
    search_fields = ('medical_record_number', 'user_profile__email', 'user_profile__first_name', 'user_profile__last_name', 'emergency_contact_phone')
    list_filter = ('primary_branch', 'gender', 'blood_group')
