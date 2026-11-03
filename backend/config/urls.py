"""
URL configuration for Hospital Management System (HMS) backend.
"""

from django.contrib import admin
from django.urls import path, include
from django.db import connection
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.renderers import JSONRenderer
from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)


class IgnoreClientContentNegotiation(BaseContentNegotiation):
    """Force JSON rendering regardless of client Accept headers to ensure lightweight response."""
    def select_parser(self, request, parsers):
        return parsers[0]

    def select_renderer(self, request, renderers, format_suffix=None):
        return (renderers[0], 'application/json')


class HealthCheckView(APIView):
    """
    Lightweight liveness health check endpoint.
    Returns HTTP 200 with minimal JSON ({"status": "ok"})
    for uptime monitors (e.g. cron-job.org), Docker, and Render.
    Guarantees no DB queries, no sensitive data, and ultra-small payload.
    """
    permission_classes = [AllowAny]
    renderer_classes = [JSONRenderer]
    content_negotiation_class = IgnoreClientContentNegotiation

    def get(self, request):
        return Response({'status': 'ok'}, status=status.HTTP_200_OK, content_type='application/json')

    def head(self, request):
        return Response({'status': 'ok'}, status=status.HTTP_200_OK, content_type='application/json')


class ReadinessCheckView(APIView):
    """
    Readiness check endpoint that verifies database connectivity.
    Kept separate from the ultra-lightweight liveness probe.
    """
    permission_classes = [AllowAny]
    renderer_classes = [JSONRenderer]
    content_negotiation_class = IgnoreClientContentNegotiation

    def get(self, request):
        try:
            connection.ensure_connection()
            return Response(
                {'status': 'ok', 'database': 'connected'},
                status=status.HTTP_200_OK,
                content_type='application/json'
            )
        except Exception:
            return Response(
                {'status': 'unavailable', 'database': 'disconnected'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
                content_type='application/json'
            )

    def head(self, request):
        return self.get(request)


health_check = HealthCheckView.as_view()
readiness_check = ReadinessCheckView.as_view()

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health-check'),
    path('api/health', health_check),
    path('api/health/readiness/', readiness_check, name='readiness-check'),
    path('api/health/readiness', readiness_check),

    # OpenAPI 3 Schema & Interactive Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # API v1 Namespaces
    path('api/v1/core/', include('apps.core.urls')),
    path('api/v1/auth/', include('apps.authentication.urls')),
    path('api/v1/clinical/', include('apps.clinical.urls')),
    path('api/v1/pharmacy/', include(('apps.pharmacy_inventory.urls', 'pharmacy_inventory'), namespace='pharmacy')),
    path('api/v1/pharmacy-inventory/', include(('apps.pharmacy_inventory.urls', 'pharmacy_inventory'), namespace='pharmacy_inventory')),
    path('api/v1/billing-finance/', include('apps.billing_finance.urls')),
    path('api/v1/operations-hr/', include('apps.operations_hr.urls')),
    path('api/v1/dashboards-reports/', include('apps.core.dashboard_reporting_urls')),
    path('api/v1/reports/', include('apps.core.dashboard_reporting_urls')),
]
