"""
Security Audit and Data Protection Services for Section 23: Security & Compliance.
Enforces audit log immutability, sensitive field redaction, and security incident tracking.
"""

import re
import uuid
import logging
from typing import Dict, Any, Optional
from django.utils import timezone
from apps.authentication.models import SecurityAuditEvent, SecurityEventType

logger = logging.getLogger(__name__)

# Keys that MUST be redacted from audit logs and responses
SENSITIVE_FIELD_PATTERNS = [
    re.compile(r'password', re.IGNORECASE),
    re.compile(r'token', re.IGNORECASE),
    re.compile(r'secret', re.IGNORECASE),
    re.compile(r'api[_-]?key', re.IGNORECASE),
    re.compile(r'auth', re.IGNORECASE),
    re.compile(r'cvv', re.IGNORECASE),
    re.compile(r'card[_-]?number', re.IGNORECASE),
    re.compile(r'private[_-]?key', re.IGNORECASE),
]


class SecurityAuditService:
    """
    Centralized service for generating immutable security audit trails
    with automatic secret and PII sanitization.
    """

    @classmethod
    def sanitize_payload(cls, data: Any) -> Any:
        """
        Recursively redacts passwords, tokens, API keys, and sensitive financial credentials.
        """
        if isinstance(data, dict):
            sanitized = {}
            for key, val in data.items():
                if any(pat.search(str(key)) for pat in SENSITIVE_FIELD_PATTERNS):
                    sanitized[key] = '[REDACTED_CONFIDENTIAL]'
                elif isinstance(val, (dict, list)):
                    sanitized[key] = cls.sanitize_payload(val)
                else:
                    sanitized[key] = val
            return sanitized
        elif isinstance(data, list):
            return [cls.sanitize_payload(item) for item in data]
        return data

    @classmethod
    def log_security_event(
        cls,
        event_type: str,
        actor_email: str,
        actor_user_id: Optional[uuid.UUID] = None,
        target_user_id: Optional[uuid.UUID] = None,
        target_user_email: str = '',
        ip_address: str = '',
        user_agent: str = '',
        details: Optional[Dict[str, Any]] = None
    ) -> SecurityAuditEvent:
        """
        Records an immutable audit event in hms_security_audit_events.
        Sanitizes all payload details before persisting to prevent accidental secret leakage.
        """
        sanitized_details = cls.sanitize_payload(details or {})

        event = SecurityAuditEvent.objects.create(
            event_type=event_type,
            actor_email=actor_email or 'system@aurahms.org',
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
            target_user_email=target_user_email,
            ip_address=ip_address,
            user_agent=user_agent[:255] if user_agent else '',
            details=sanitized_details,
        )
        return event
