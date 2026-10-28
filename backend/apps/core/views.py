from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiResponse
from apps.core.models import Hospital, Branch
from apps.core.serializers import HospitalSerializer, BranchSerializer


class SystemInfoView(APIView):
    """Returns basic system environment and regional settings."""
    permission_classes = [AllowAny]

    def get(self, request):
        hospital = Hospital.objects.filter(is_active=True).first()
        return Response({
            'name': hospital.name if hospital else 'AURA Multi-Specialty Hospital',
            'version': '1.0.0',
            'status': 'online',
            'timezone': hospital.timezone if hospital else 'Asia/Kolkata',
            'default_currency': hospital.currency if hospital else 'INR',
        })


class BranchListView(APIView):
    """
    Returns active hospital branches with their assigned clinical departments.
    Available to all authenticated users for branch selection.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="List Active Hospital Branches",
        responses={200: BranchSerializer(many=True)},
    )
    def get(self, request):
        branches = Branch.objects.filter(is_active=True).prefetch_related('departments').select_related('hospital')
        serializer = BranchSerializer(branches, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PatientListView(APIView):
    """
    Returns registered patients with search filtering for clinical lookups.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.authentication.models import PatientProfile
        from apps.authentication.serializers import PatientProfileSerializer
        from django.db.models import Q

        qs = PatientProfile.objects.select_related('user_profile', 'primary_branch').all()
        search = request.query_params.get('search')
        branch_id = request.query_params.get('branch_id')

        if branch_id:
            qs = qs.filter(primary_branch_id=branch_id)
        if search:
            qs = qs.filter(
                Q(medical_record_number__icontains=search) |
                Q(user_profile__first_name__icontains=search) |
                Q(user_profile__last_name__icontains=search) |
                Q(user_profile__phone_number__icontains=search)
            )

        serializer = PatientProfileSerializer(qs[:50], many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

