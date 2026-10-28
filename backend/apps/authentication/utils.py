import logging
from apps.authentication.models import UserProfile, StaffProfile, PatientProfile, RoleEnum

logger = logging.getLogger(__name__)


def get_user_profile(user):
    """
    Safely resolves the UserProfile from a Django auth User instance
    using supabase_user_id == user.username, falling back to email.
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    import uuid
    from django.core.exceptions import ValidationError
    try:
        try:
            sub_uuid = uuid.UUID(str(user.username))
            prof = UserProfile.objects.select_related('staff_profile', 'patient_profile', 'role').filter(
                supabase_user_id=sub_uuid
            ).first()
            if prof:
                return prof
        except (ValueError, TypeError, ValidationError):
            pass
        if getattr(user, 'email', None):
            return UserProfile.objects.select_related('staff_profile', 'patient_profile', 'role').filter(
                email=user.email
            ).first()
    except Exception as e:
        logger.debug(f"get_user_profile lookup error: {e}")
        return None
    return None


def get_staff_profile(user):
    """
    Safely resolves the active StaffProfile associated with user.
    """
    prof = get_user_profile(user)
    if prof:
        if prof.role and prof.role.name == RoleEnum.PATIENT:
            return None
        if hasattr(prof, 'staff_profile'):
            return prof.staff_profile
    return None


def get_patient_profile(user):
    """
    Safely resolves the PatientProfile associated with user.
    """
    prof = get_user_profile(user)
    if prof and hasattr(prof, 'patient_profile'):
        return prof.patient_profile
    return None
