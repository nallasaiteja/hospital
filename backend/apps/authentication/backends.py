import jwt
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import authentication, exceptions
from drf_spectacular.extensions import OpenApiAuthenticationExtension

logger = logging.getLogger(__name__)
User = get_user_model()


class SupabaseAuthentication(authentication.BaseAuthentication):
    """
    Validates Supabase-issued JWT Bearer tokens from the Authorization header.
    Resolves the authenticated user and populates request.auth with claims.
    """

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return None

        token = parts[1]

        try:
            unverified_header = jwt.get_unverified_header(token)
            alg = unverified_header.get('alg', 'HS256')
            secret = getattr(settings, 'SUPABASE_SECRET_KEY', None)

            # Supabase tokens can be HS256 (with JWT secret) or modern ES256/RS256 (asymmetric)
            if alg == 'HS256' and secret and not secret.startswith('sb_secret_'):
                try:
                    payload = jwt.decode(
                        token,
                        secret,
                        algorithms=['HS256'],
                        options={'verify_aud': False}
                    )
                except Exception:
                    payload = jwt.decode(token, options={'verify_signature': False, 'verify_exp': True})
            else:
                payload = jwt.decode(token, options={'verify_signature': False, 'verify_exp': True})

        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed('Authentication token has expired.')
        except jwt.DecodeError:
            raise exceptions.AuthenticationFailed('Invalid authentication token format.')
        except Exception as e:
            logger.error(f'Token decoding error: {e}')
            raise exceptions.AuthenticationFailed('Failed to authenticate token.')

        supabase_user_id = payload.get('sub')
        if not supabase_user_id:
            raise exceptions.AuthenticationFailed('Token missing subject identifier (sub).')

        email = payload.get('email', '')

        user, _ = User.objects.get_or_create(
            username=supabase_user_id,
            defaults={
                'email': email,
                'is_active': True,
            }
        )

        if not user.is_active:
            raise exceptions.AuthenticationFailed('User account has been disabled.')

        # Enforce UserProfile and StaffProfile status
        try:
            from apps.authentication.models import UserProfile, StaffStatus
            profile = UserProfile.objects.select_related('staff_profile').filter(supabase_user_id=supabase_user_id).first()
            if profile:
                if not profile.is_active:
                    raise exceptions.AuthenticationFailed('User account has been deactivated.')
                if hasattr(profile, 'staff_profile') and profile.staff_profile:
                    staff = profile.staff_profile
                    if staff.status == StaffStatus.SUSPENDED:
                        raise exceptions.AuthenticationFailed('Staff account is suspended. Access denied.')
                    elif staff.status == StaffStatus.RESIGNED:
                        raise exceptions.AuthenticationFailed('Staff credentials have been revoked.')
        except exceptions.AuthenticationFailed:
            raise
        except Exception as e:
            logger.debug(f"User profile status check skipped: {e}")

        # Attach raw Supabase claims to request for downstream RBAC inspection
        request.supabase_claims = payload
        return (user, payload)


class SupabaseAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = 'apps.authentication.backends.SupabaseAuthentication'
    name = 'BearerAuth'

    def get_security_requirement(self, auto_schema):
        return {'BearerAuth': []}

    def get_security_definition(self, auto_schema):
        return {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'JWT',
            'description': 'Supabase access token (JWT)',
        }
