"""
Rate Limiting & Throttling Policies for Section 23: Security & Compliance.
Protects sensitive authentication, password reset, and expensive reporting routes.
"""

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle, SimpleRateThrottle


class AuthRateThrottle(SimpleRateThrottle):
    """
    Strict rate limiter for sensitive authentication endpoints:
    login, password recovery, MFA verification.
    Prevents credential stuffing, brute force, and notification spam.
    Rate: 10 requests / minute per IP.
    """
    scope = 'auth_sensitive'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class ReportExportThrottle(UserRateThrottle):
    """
    Limits expensive aggregated dashboard and export operations.
    Rate: 30 requests / minute per authenticated user.
    """
    scope = 'reports'
