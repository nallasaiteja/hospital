"""
URL configuration for Hospital Management System (HMS) backend.
"""

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)


def health_check(request):
    """System health check endpoint for monitoring, Docker, and uptime probes."""
    return JsonResponse({
        'status': 'healthy',
        'system': 'Hospital Management System (HMS)',
        'version': '1.0.0',
    })


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health-check'),

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

