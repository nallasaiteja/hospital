from rest_framework import serializers
from .models import (
    DoctorSchedule, DoctorLeave, Appointment, EmergencyEncounter,
    Ward, Bed, InpatientAdmission, PatientTransfer, DailyProgressNote,
    OperatingTheatre, SurgicalCase, LabTestCatalogue,
    LabOrder, LabOrderItem, RadiologyOrder, DutyRoster,
    ExternalDiagnosticProvider, LabSample, DiagnosticReport,
    CriticalAlertNotification, DiagnosticEquipment,
    EquipmentTransmissionLog, HL7TransmissionLog
)
from apps.authentication.models import PatientProfile, StaffProfile
from apps.core.models import Branch, Department


class DoctorScheduleSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source='doctor.user_profile.full_name', read_only=True)

    class Meta:
        model = DoctorSchedule
        fields = '__all__'


class DoctorLeaveSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source='doctor.user_profile.full_name', read_only=True)

    class Meta:
        model = DoctorLeave
        fields = '__all__'


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.medical_record_number', read_only=True)
    patient_phone = serializers.CharField(source='patient.user_profile.phone_number', read_only=True)
    patient_gender = serializers.CharField(source='patient.gender', read_only=True)
    patient_blood_group = serializers.CharField(source='patient.blood_group', read_only=True)
    patient_allergies = serializers.ListField(source='patient.allergies', read_only=True)
    doctor_name = serializers.CharField(source='doctor.user_profile.full_name', read_only=True)
    doctor_specialization = serializers.CharField(source='doctor.specialization', read_only=True)
    doctor_fee = serializers.DecimalField(source='doctor.consultation_fee', max_digits=10, decimal_places=2, read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    invoice_status = serializers.CharField(source='invoice.status', read_only=True)

    class Meta:
        model = Appointment
        fields = '__all__'


class EmergencyEncounterSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    patient_mrn = serializers.CharField(source='patient.medical_record_number', read_only=True)
    patient_phone = serializers.CharField(source='patient.user_profile.phone_number', read_only=True)
    attending_doctor_name = serializers.CharField(source='attending_doctor.user_profile.full_name', read_only=True)
    triage_nurse_name = serializers.CharField(source='triage_nurse.user_profile.full_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    linked_admission_number = serializers.CharField(source='linked_admission.admission_number', read_only=True)

    class Meta:
        model = EmergencyEncounter
        fields = '__all__'

    def get_patient_name(self, obj):
        if obj.patient:
            return obj.patient.user_profile.full_name
        return obj.unregistered_patient_name or 'Unidentified Emergency Patient'


class BedSerializer(serializers.ModelSerializer):
    ward_name = serializers.CharField(source='ward.name', read_only=True)
    ward_type = serializers.CharField(source='ward.ward_type', read_only=True)
    current_patient_name = serializers.SerializerMethodField()

    class Meta:
        model = Bed
        fields = '__all__'

    def get_current_patient_name(self, obj):
        active_adm = obj.admissions.filter(status='ADMITTED').first()
        if active_adm:
            return active_adm.patient.user_profile.full_name
        return None


class WardSerializer(serializers.ModelSerializer):
    beds = BedSerializer(many=True, read_only=True)
    available_beds_count = serializers.SerializerMethodField()
    occupied_beds_count = serializers.SerializerMethodField()
    cleaning_beds_count = serializers.SerializerMethodField()
    maintenance_beds_count = serializers.SerializerMethodField()

    class Meta:
        model = Ward
        fields = '__all__'

    def get_available_beds_count(self, obj):
        return obj.beds.filter(status='AVAILABLE').count()

    def get_occupied_beds_count(self, obj):
        return obj.beds.filter(status='OCCUPIED').count()

    def get_cleaning_beds_count(self, obj):
        return obj.beds.filter(status='CLEANING').count()

    def get_maintenance_beds_count(self, obj):
        return obj.beds.filter(status='MAINTENANCE').count()


class InpatientAdmissionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.medical_record_number', read_only=True)
    patient_gender = serializers.CharField(source='patient.gender', read_only=True)
    patient_blood_group = serializers.CharField(source='patient.blood_group', read_only=True)
    patient_allergies = serializers.ListField(source='patient.allergies', read_only=True)
    patient_phone = serializers.CharField(source='patient.user_profile.phone_number', read_only=True)
    bed_number = serializers.CharField(source='bed.bed_number', read_only=True)
    ward_name = serializers.CharField(source='bed.ward.name', read_only=True)
    ward_type = serializers.CharField(source='bed.ward.ward_type', read_only=True)
    daily_rate = serializers.DecimalField(source='bed.daily_rate', max_digits=10, decimal_places=2, read_only=True)
    admitting_doctor_name = serializers.CharField(source='admitting_doctor.user_profile.full_name', read_only=True)
    requesting_doctor_name = serializers.CharField(source='requesting_doctor.user_profile.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)
    cleared_by_name = serializers.CharField(source='cleared_by.user_profile.full_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    invoice_status = serializers.CharField(source='invoice.status', read_only=True)
    invoice_total = serializers.DecimalField(source='invoice.total_amount', max_digits=12, decimal_places=2, read_only=True)
    invoice_paid = serializers.DecimalField(source='invoice.paid_amount', max_digits=12, decimal_places=2, read_only=True)
    invoice_balance = serializers.DecimalField(source='invoice.balance_amount', max_digits=12, decimal_places=2, read_only=True)
    running_days = serializers.SerializerMethodField()
    running_bed_charges = serializers.SerializerMethodField()

    class Meta:
        model = InpatientAdmission
        fields = '__all__'

    def get_running_days(self, obj):
        from django.utils import timezone
        start = obj.admission_date
        end = obj.discharge_date or timezone.now()
        diff = (end - start).days
        return max(1, diff if diff > 0 else 1)

    def get_running_bed_charges(self, obj):
        days = self.get_running_days(obj)
        rate = obj.bed.daily_rate if obj.bed else 0
        return str(round(days * rate, 2))


class PatientTransferSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.medical_record_number', read_only=True)
    from_bed_number = serializers.CharField(source='from_bed.bed_number', read_only=True)
    from_ward_name = serializers.CharField(source='from_bed.ward.name', read_only=True)
    to_bed_number = serializers.CharField(source='to_bed.bed_number', read_only=True)
    to_ward_name = serializers.CharField(source='to_bed.ward.name', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.user_profile.full_name', read_only=True)

    class Meta:
        model = PatientTransfer
        fields = '__all__'


class DailyProgressNoteSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.user_profile.full_name', read_only=True)

    class Meta:
        model = DailyProgressNote
        fields = '__all__'


class OperatingTheatreSerializer(serializers.ModelSerializer):
    class Meta:
        model = OperatingTheatre
        fields = '__all__'


class SurgicalCaseSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    surgeon_name = serializers.CharField(source='lead_surgeon.user_profile.full_name', read_only=True)
    theatre_name = serializers.CharField(source='theatre.name', read_only=True)

    class Meta:
        model = SurgicalCase
        fields = '__all__'


class ExternalDiagnosticProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalDiagnosticProvider
        fields = '__all__'


class LabTestCatalogueSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    provider_name = serializers.CharField(source='external_provider.name', read_only=True)

    class Meta:
        model = LabTestCatalogue
        fields = '__all__'


class LabSampleSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.medical_record_number', read_only=True)
    collected_by_name = serializers.CharField(source='collected_by.user_profile.full_name', read_only=True)
    rejected_by_name = serializers.CharField(source='rejected_by.user_profile.full_name', read_only=True)

    class Meta:
        model = LabSample
        fields = '__all__'


class LabOrderItemSerializer(serializers.ModelSerializer):
    test_name = serializers.CharField(source='test.name', read_only=True)
    test_code = serializers.CharField(source='test.code', read_only=True)
    test_category = serializers.CharField(source='test.category', read_only=True)
    sample_barcode = serializers.CharField(source='sample.sample_barcode', read_only=True)
    entered_by_name = serializers.CharField(source='entered_by.user_profile.full_name', read_only=True)
    validated_by_name = serializers.CharField(source='validated_by.user_profile.full_name', read_only=True)

    class Meta:
        model = LabOrderItem
        fields = '__all__'


class LabOrderSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.medical_record_number', read_only=True)
    patient_gender = serializers.CharField(source='patient.gender', read_only=True)
    patient_age = serializers.IntegerField(source='patient.age', read_only=True)
    doctor_name = serializers.CharField(source='doctor.user_profile.full_name', read_only=True)
    doctor_specialty = serializers.CharField(source='doctor.specialization', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    provider_name = serializers.CharField(source='external_provider.name', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    items = LabOrderItemSerializer(many=True, read_only=True)
    samples = LabSampleSerializer(many=True, read_only=True)

    class Meta:
        model = LabOrder
        fields = '__all__'


class RadiologyOrderSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.medical_record_number', read_only=True)
    patient_gender = serializers.CharField(source='patient.gender', read_only=True)
    patient_age = serializers.IntegerField(source='patient.age', read_only=True)
    doctor_name = serializers.CharField(source='doctor.user_profile.full_name', read_only=True)
    radiologist_name = serializers.CharField(source='radiologist.user_profile.full_name', read_only=True)
    technician_name = serializers.CharField(source='performing_technician.user_profile.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model = RadiologyOrder
        fields = '__all__'


class DiagnosticReportSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.medical_record_number', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    prepared_by_name = serializers.CharField(source='prepared_by.user_profile.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)
    order_number = serializers.SerializerMethodField()

    class Meta:
        model = DiagnosticReport
        fields = '__all__'

    def get_order_number(self, obj):
        if obj.lab_order:
            return obj.lab_order.order_number
        if obj.radiology_order:
            return obj.radiology_order.order_number
        return ''


class CriticalAlertNotificationSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.medical_record_number', read_only=True)
    doctor_name = serializers.CharField(source='recipient_doctor.user_profile.full_name', read_only=True)
    acknowledged_by_name = serializers.CharField(source='acknowledged_by.user_profile.full_name', read_only=True)
    order_number = serializers.SerializerMethodField()

    class Meta:
        model = CriticalAlertNotification
        fields = '__all__'

    def get_order_number(self, obj):
        if obj.lab_order:
            return obj.lab_order.order_number
        if obj.radiology_order:
            return obj.radiology_order.order_number
        return ''


class DiagnosticEquipmentSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = DiagnosticEquipment
        fields = '__all__'


class EquipmentTransmissionLogSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source='equipment.name', read_only=True)

    class Meta:
        model = EquipmentTransmissionLog
        fields = '__all__'


class HL7TransmissionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = HL7TransmissionLog
        fields = '__all__'


class DutyRosterSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.user_profile.full_name', read_only=True)
    designation = serializers.CharField(source='staff.designation', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = DutyRoster
        fields = '__all__'
