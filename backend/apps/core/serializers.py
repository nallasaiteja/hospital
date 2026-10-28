from rest_framework import serializers
from apps.core.models import Hospital, Branch, Department


class HospitalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hospital
        fields = ['id', 'name', 'code', 'tax_identifier', 'city', 'state', 'currency', 'timezone', 'is_active']


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'branch_id', 'name', 'code', 'description', 'is_active']


class BranchSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    departments = DepartmentSerializer(many=True, read_only=True)

    class Meta:
        model = Branch
        fields = [
            'id',
            'hospital',
            'hospital_name',
            'name',
            'code',
            'is_main_branch',
            'phone',
            'email',
            'city',
            'state',
            'postal_code',
            'operating_hours',
            'departments',
            'is_active',
        ]
