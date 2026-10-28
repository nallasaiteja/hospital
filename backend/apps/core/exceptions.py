import logging
from django.db import IntegrityError, DatabaseError
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    ValidationError,
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied as DRFPermissionDenied,
    NotFound,
    MethodNotAllowed,
    Throttled,
    UnsupportedMediaType,
)

logger = logging.getLogger('hospital_core')

def custom_exception_handler(exc, context):
    """
    Standardized, secure exception handler for AURA Hospital Management System.
    - Sanitizes all exceptions to prevent leaking raw SQL, table names, stack traces,
      or sensitive internal infrastructure details to clients.
    - Preserves detailed technical context in server logs for developer debugging.
    - Standardizes response structure:
      {
        "error": "Human readable user-friendly message",
        "code": "ERROR_CODE",
        "field_errors": { "field_name": ["message", ...] }  // optional
      }
    """
    # 1. Call DRF's default exception handler first to get the standard response
    response = exception_handler(exc, context)

    # Context information for secure server-side logging
    view_name = context.get('view', None).__class__.__name__ if context.get('view') else 'UnknownView'
    request = context.get('request', None)
    method = request.method if request else 'UNKNOWN'
    path = request.path if request else 'UNKNOWN'

    # 2. Handle database IntegrityError (PostgreSQL unique constraints, foreign keys, not null)
    if isinstance(exc, IntegrityError):
        raw_msg = str(exc)
        logger.warning(
            f"Database IntegrityError in {view_name} [{method} {path}]: {raw_msg}",
            exc_info=True
        )

        # Distinguish constraint types safely without exposing raw SQL
        if 'unique constraint' in raw_msg.lower() or 'duplicate key' in raw_msg.lower():
            user_msg = "A record with these unique details already exists in the system."
            error_code = "DUPLICATE_RECORD"
            http_status = status.HTTP_409_CONFLICT
        elif 'foreign key constraint' in raw_msg.lower() or 'violates foreign key' in raw_msg.lower():
            user_msg = "This record cannot be modified or deleted because it is referenced by other hospital records."
            error_code = "FOREIGN_KEY_VIOLATION"
            http_status = status.HTTP_400_BAD_REQUEST
        elif 'not-null constraint' in raw_msg.lower() or 'null value in column' in raw_msg.lower():
            user_msg = "A required field was missing from your submission."
            error_code = "MISSING_REQUIRED_FIELD"
            http_status = status.HTTP_400_BAD_REQUEST
        elif 'check constraint' in raw_msg.lower():
            user_msg = "The submitted data violated validation rules (e.g., date range or non-negative amount constraint)."
            error_code = "CONSTRAINT_VIOLATION"
            http_status = status.HTTP_400_BAD_REQUEST
        else:
            user_msg = "Database constraint violation. Please verify all submitted details."
            error_code = "INTEGRITY_ERROR"
            http_status = status.HTTP_400_BAD_REQUEST

        return Response({
            "error": user_msg,
            "code": error_code,
            "success": False
        }, status=http_status)

    # 3. Handle general DatabaseError (e.g. connection pool exhaustion, timeout)
    if isinstance(exc, DatabaseError):
        logger.error(
            f"DatabaseError in {view_name} [{method} {path}]: {str(exc)}",
            exc_info=True
        )
        return Response({
            "error": "The database service is temporarily unavailable. Please retry in a few moments.",
            "code": "DATABASE_UNAVAILABLE",
            "success": False
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    # 4. Handle Django built-in PermissionDenied and Http404 if DRF missed them
    if isinstance(exc, DjangoPermissionDenied) and response is None:
        return Response({
            "error": "You do not have permission to perform this action with your current role.",
            "code": "PERMISSION_DENIED",
            "success": False
        }, status=status.HTTP_403_FORBIDDEN)

    if isinstance(exc, Http404) and response is None:
        return Response({
            "error": "The requested hospital record was not found or has been moved.",
            "code": "NOT_FOUND",
            "success": False
        }, status=status.HTTP_404_NOT_FOUND)

    # 5. Format DRF standard response into unified contract
    if response is not None:
        data = response.data
        field_errors = {}
        error_message = "An error occurred while processing your request."
        error_code = "API_ERROR"

        if isinstance(exc, ValidationError):
            error_code = "VALIDATION_ERROR"
            if isinstance(data, dict):
                # Extract field errors
                formatted_field_errors = {}
                first_field_msg = None
                for field, errs in data.items():
                    if isinstance(errs, list):
                        formatted_field_errors[field] = [str(e) for e in errs]
                        if not first_field_msg and len(errs) > 0:
                            first_field_msg = f"{field.replace('_', ' ').capitalize()}: {errs[0]}"
                    else:
                        formatted_field_errors[field] = [str(errs)]
                        if not first_field_msg:
                            first_field_msg = f"{field.replace('_', ' ').capitalize()}: {errs}"

                field_errors = formatted_field_errors
                if 'non_field_errors' in data and data['non_field_errors']:
                    error_message = str(data['non_field_errors'][0])
                elif 'detail' in data:
                    error_message = str(data['detail'])
                elif first_field_msg:
                    error_message = first_field_msg
                else:
                    error_message = "Please correct the highlighted form errors and submit again."
            elif isinstance(data, list) and len(data) > 0:
                error_message = str(data[0])
            else:
                error_message = "Validation failed for the submitted information."

        elif isinstance(exc, (AuthenticationFailed, NotAuthenticated)):
            error_code = "AUTHENTICATION_REQUIRED"
            error_message = "Your session is invalid or has expired. Please sign in again."

        elif isinstance(exc, DRFPermissionDenied):
            error_code = "PERMISSION_DENIED"
            error_message = str(data.get('detail', 'You do not have permission to perform this action with your current role.'))

        elif isinstance(exc, NotFound):
            error_code = "NOT_FOUND"
            error_message = "The requested hospital record could not be found."

        elif isinstance(exc, MethodNotAllowed):
            error_code = "METHOD_NOT_ALLOWED"
            error_message = f"The {method} action is not supported for this endpoint."

        elif isinstance(exc, Throttled):
            error_code = "RATE_LIMITED"
            wait_seconds = exc.wait or 60
            error_message = f"Too many requests. Please wait {int(wait_seconds)} seconds before trying again."

        elif isinstance(exc, UnsupportedMediaType):
            error_code = "UNSUPPORTED_MEDIA_TYPE"
            error_message = "The submitted document or media format is not supported."

        elif isinstance(data, dict) and 'detail' in data:
            error_message = str(data['detail'])

        payload = {
            "error": error_message,
            "code": error_code,
            "success": False
        }
        if field_errors:
            payload["field_errors"] = field_errors
            for k, v in field_errors.items():
                if k not in payload:
                    payload[k] = v

        response.data = payload
        return response

    # 6. Fallback for completely unhandled server exceptions (500)
    logger.error(
        f"Unhandled Internal Server Exception in {view_name} [{method} {path}]: {str(exc)}",
        exc_info=True
    )

    return Response({
        "error": "A server error occurred while processing your hospital request. Our engineering team has been notified.",
        "code": "INTERNAL_SERVER_ERROR",
        "success": False
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
