import uuid
from django.db import models
from django.utils import timezone
from apps.core.models import BaseUUIDModel, Branch, Department
from apps.authentication.models import PatientProfile, StaffProfile


class DoctorSchedule(BaseUUIDModel):
    """
    Weekly recurring availability slots for doctors.
    """
    DAY_CHOICES = [
        ('MON', 'Monday'),
        ('TUE', 'Tuesday'),
        ('WED', 'Wednesday'),
        ('THU', 'Thursday'),
        ('FRI', 'Friday'),
        ('SAT', 'Saturday'),
        ('SUN', 'Sunday'),
    ]
    doctor = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name='schedules')
    day_of_week = models.CharField(max_length=3, choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    slot_duration_minutes = models.PositiveIntegerField(default=15)
    max_patients = models.PositiveIntegerField(default=20)
    is_available = models.BooleanField(default=True)

    class Meta:
        db_table = 'hms_doctor_schedules'
        unique_together = ('doctor', 'day_of_week', 'start_time')
        ordering = ['day_of_week', 'start_time']

    def __str__(self):
        return f"{self.doctor.user_profile.full_name} ({self.day_of_week}: {self.start_time}-{self.end_time})"


class DoctorLeave(BaseUUIDModel):
    """
    Approved leave and unavailability windows for doctors.
    """
    doctor = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name='leaves')
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    reason = models.CharField(max_length=255, blank=True)
    is_approved = models.BooleanField(default=True)

    class Meta:
        db_table = 'hms_doctor_leaves'
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.doctor.user_profile.full_name} ({self.start_date} to {self.end_date})"


class AppointmentType(models.TextChoices):
    SCHEDULED = 'SCHEDULED', 'Scheduled'
    WALK_IN = 'WALK_IN', 'Walk-in'


class AppointmentStatus(models.TextChoices):
    SCHEDULED = 'SCHEDULED', 'Scheduled'
    CHECKED_IN = 'CHECKED_IN', 'Checked In'
    IN_CONSULTATION = 'IN_CONSULTATION', 'In Consultation'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'
    NO_SHOW = 'NO_SHOW', 'No Show'


class Appointment(BaseUUIDModel):
    """
    OPD Consultations and Specialist Appointments.
    """
    appointment_number = models.CharField(max_length=50, unique=True, db_index=True)
    appointment_type = models.CharField(max_length=20, choices=AppointmentType.choices, default=AppointmentType.SCHEDULED)
    booking_source = models.CharField(max_length=30, default='FRONT_DESK')  # FRONT_DESK, PATIENT_PORTAL, TELEPHONE, REFERRAL
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='appointments')
    doctor = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='appointments')
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name='appointments')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='appointments')
    appointment_date = models.DateField(db_index=True)
    time_slot = models.CharField(max_length=20)
    token_number = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=25, choices=AppointmentStatus.choices, default=AppointmentStatus.SCHEDULED)
    reason_for_visit = models.TextField(blank=True)
    chief_complaint = models.TextField(blank=True)
    examination_findings = models.TextField(blank=True)
    treatment_plan = models.TextField(blank=True)
    follow_up_instructions = models.TextField(blank=True)
    cancellation_reason = models.TextField(blank=True)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    consultation_started_at = models.DateTimeField(null=True, blank=True)
    consultation_ended_at = models.DateTimeField(null=True, blank=True)
    vitals = models.JSONField(default=dict, blank=True)  # {bp, heart_rate, temp, spO2, weight, height}
    consultation_notes = models.TextField(blank=True)
    diagnosis = models.TextField(blank=True)
    prescription_summary = models.TextField(blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    is_signed = models.BooleanField(default=False)
    signed_at = models.DateTimeField(null=True, blank=True)
    symptom_duration = models.CharField(max_length=100, blank=True)
    secondary_diagnosis = models.TextField(blank=True)
    icd10_code = models.CharField(max_length=50, blank=True)
    general_examination = models.TextField(blank=True)
    systemic_examination = models.TextField(blank=True)
    invoice = models.ForeignKey('billing_finance.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='appointment_records')

    class Meta:
        db_table = 'hms_appointments'
        unique_together = ('doctor', 'appointment_date', 'time_slot')
        ordering = ['appointment_date', 'time_slot']

    def __str__(self):
        return f"[{self.appointment_number}] {self.patient.user_profile.full_name} with Dr. {self.doctor.user_profile.last_name}"


class TriageAcuity(models.TextChoices):
    RED = 'RED', 'Resuscitation / Immediate (Acuity 1)'
    YELLOW = 'YELLOW', 'Urgent / Emergent (Acuity 2)'
    GREEN = 'GREEN', 'Non-Urgent / Stable (Acuity 3)'


class EmergencyStatus(models.TextChoices):
    TRIAGED = 'TRIAGED', 'Triaged'
    UNDER_TREATMENT = 'UNDER_TREATMENT', 'Under Treatment'
    TRANSFERRED_TO_IPD = 'TRANSFERRED_TO_IPD', 'Transferred to IPD'
    DISCHARGED = 'DISCHARGED', 'Discharged'
    DECEASED = 'DECEASED', 'Deceased'


class EmergencyEncounter(BaseUUIDModel):
    """
    Emergency Department Casualty & Triage Encounters.
    """
    encounter_number = models.CharField(max_length=50, unique=True, db_index=True)
    patient = models.ForeignKey(PatientProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='emergency_encounters')
    unregistered_patient_name = models.CharField(max_length=150, blank=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='emergency_cases')
    triage_acuity = models.CharField(max_length=20, choices=TriageAcuity.choices, default=TriageAcuity.YELLOW)
    arrival_mode = models.CharField(max_length=50, default='WALK_IN')  # AMBULANCE, WALK_IN, POLICE
    arrival_time = models.DateTimeField(default=timezone.now)
    chief_complaint = models.TextField()
    vitals_on_arrival = models.JSONField(default=dict, blank=True)
    attending_doctor = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='emergency_cases')
    status = models.CharField(max_length=30, choices=EmergencyStatus.choices, default=EmergencyStatus.TRIAGED)
    treatment_given = models.TextField(blank=True)
    triage_nurse = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='triaged_cases')
    linked_admission = models.ForeignKey('InpatientAdmission', on_delete=models.SET_NULL, null=True, blank=True, related_name='emergency_origin')
    discharge_summary = models.TextField(blank=True)
    discharged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hms_emergency_encounters'
        ordering = ['-arrival_time']

    def __str__(self):
        name = self.patient.user_profile.full_name if self.patient else self.unregistered_patient_name or "Unknown Patient"
        return f"[{self.triage_acuity}] {self.encounter_number} - {name}"


class WardType(models.TextChoices):
    GENERAL = 'GENERAL', 'General Ward'
    SEMI_PRIVATE = 'SEMI_PRIVATE', 'Semi-Private Room'
    PRIVATE = 'PRIVATE', 'Private Deluxe'
    ICU = 'ICU', 'Intensive Care Unit (ICU)'
    POST_OP = 'POST_OP', 'Post-Operative Recovery'


class Ward(BaseUUIDModel):
    """
    Inpatient Hospital Wards and Wings.
    """
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='wards')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='wards')
    name = models.CharField(max_length=100)
    ward_type = models.CharField(max_length=30, choices=WardType.choices, default=WardType.GENERAL)
    floor = models.CharField(max_length=20, default='1st Floor')
    total_beds = models.PositiveIntegerField(default=10)

    class Meta:
        db_table = 'hms_wards'
        unique_together = ('branch', 'name')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_ward_type_display()}) - {self.branch.name}"


class BedStatus(models.TextChoices):
    AVAILABLE = 'AVAILABLE', 'Available'
    OCCUPIED = 'OCCUPIED', 'Occupied'
    CLEANING = 'CLEANING', 'Under Cleaning / Sanitization'
    MAINTENANCE = 'MAINTENANCE', 'Under Maintenance / Repair'
    RESERVED = 'RESERVED', 'Reserved'


class Bed(BaseUUIDModel):
    """
    Individual Hospital Beds with status tracking and daily rate.
    """
    ward = models.ForeignKey(Ward, on_delete=models.CASCADE, related_name='beds')
    bed_number = models.CharField(max_length=30)
    status = models.CharField(max_length=20, choices=BedStatus.choices, default=BedStatus.AVAILABLE)
    daily_rate = models.DecimalField(max_digits=10, decimal_places=2, default=1500.00)

    class Meta:
        db_table = 'hms_beds'
        unique_together = ('ward', 'bed_number')
        ordering = ['bed_number']

    def __str__(self):
        return f"{self.ward.name} - Bed {self.bed_number} [{self.status}]"


class AdmissionStatus(models.TextChoices):
    REQUESTED = 'REQUESTED', 'Admission Requested'
    APPROVED = 'APPROVED', 'Approved (Awaiting Bed)'
    ADMITTED = 'ADMITTED', 'Admitted / Active Inpatient'
    AWAITING_DISCHARGE = 'AWAITING_DISCHARGE', 'Awaiting Discharge Clearance'
    DISCHARGED = 'DISCHARGED', 'Discharged'
    REJECTED = 'REJECTED', 'Rejected / Cancelled'
    TRANSFERRED = 'TRANSFERRED', 'Transferred'


class InpatientAdmission(BaseUUIDModel):
    """
    Inpatient (IPD) Admission Records, Bed Occupancy, Discharge Clearances, and Billing.
    """
    admission_number = models.CharField(max_length=50, unique=True, db_index=True)
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='admissions')
    bed = models.ForeignKey(Bed, on_delete=models.PROTECT, null=True, blank=True, related_name='admissions')
    admitting_doctor = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='admitted_patients')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='admissions')
    admission_source = models.CharField(max_length=30, default='DIRECT')  # EMERGENCY, OPD, DIRECT, TRANSFER
    priority = models.CharField(max_length=20, default='ROUTINE')  # ROUTINE, URGENT, STAT_EMERGENCY
    requested_ward_type = models.CharField(max_length=30, blank=True)
    requesting_doctor = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='requested_admissions')
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_admissions')
    approved_at = models.DateTimeField(null=True, blank=True)
    admission_date = models.DateTimeField(default=timezone.now)
    expected_discharge_date = models.DateField(null=True, blank=True)
    discharge_date = models.DateTimeField(null=True, blank=True)
    initial_diagnosis = models.TextField()
    status = models.CharField(max_length=25, choices=AdmissionStatus.choices, default=AdmissionStatus.ADMITTED)
    admission_deposit = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    # 4-point Discharge Clearance Checklist
    clinical_clearance = models.BooleanField(default=False)
    nursing_clearance = models.BooleanField(default=False)
    pharmacy_clearance = models.BooleanField(default=False)
    billing_clearance = models.BooleanField(default=False)
    cleared_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='cleared_discharges')

    discharge_condition = models.CharField(max_length=100, blank=True)
    discharge_summary = models.TextField(blank=True)
    discharge_medications = models.JSONField(default=list, blank=True)
    follow_up_instructions = models.TextField(blank=True)
    invoice = models.ForeignKey('billing_finance.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='inpatient_records')

    class Meta:
        db_table = 'hms_inpatient_admissions'
        ordering = ['-admission_date']

    def __str__(self):
        bed_str = f"in {self.bed.ward.name} - Bed {self.bed.bed_number}" if self.bed else "Awaiting Bed Allocation"
        return f"[{self.admission_number}] {self.patient.user_profile.full_name} {bed_str}"


class PatientTransfer(BaseUUIDModel):
    """
    Inpatient Bed, Room, Ward, and ICU Transfers with Handover Notes.
    """
    admission = models.ForeignKey(InpatientAdmission, on_delete=models.CASCADE, related_name='transfers')
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='bed_transfers')
    from_bed = models.ForeignKey(Bed, on_delete=models.PROTECT, related_name='transfers_from')
    to_bed = models.ForeignKey(Bed, on_delete=models.PROTECT, related_name='transfers_to')
    requested_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='initiated_transfers')
    transfer_reason = models.TextField()
    clinical_handover_notes = models.TextField(blank=True)
    transfer_time = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hms_patient_transfers'
        ordering = ['-transfer_time']

    def __str__(self):
        return f"Transfer {self.patient.user_profile.full_name}: Bed {self.from_bed.bed_number} -> Bed {self.to_bed.bed_number}"



class DailyProgressNote(BaseUUIDModel):
    """
    Daily Clinical Rounds and Nursing Observations for Inpatients.
    """
    admission = models.ForeignKey(InpatientAdmission, on_delete=models.CASCADE, related_name='progress_notes')
    recorded_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='clinical_notes')
    recorded_at = models.DateTimeField(default=timezone.now)
    clinical_notes = models.TextField()
    vitals = models.JSONField(default=dict, blank=True)
    treatment_plan = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_daily_progress_notes'
        ordering = ['-recorded_at']


class OperatingTheatre(BaseUUIDModel):
    """
    Surgical Operating Suites and Theatres.
    """
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='operation_theatres')
    name = models.CharField(max_length=100)
    room_number = models.CharField(max_length=30)
    status = models.CharField(max_length=25, default='AVAILABLE')

    class Meta:
        db_table = 'hms_operating_theatres'
        unique_together = ('branch', 'room_number')

    def __str__(self):
        return f"{self.name} (Room {self.room_number}) - {self.branch.name}"


class SurgicalCase(BaseUUIDModel):
    """
    Surgical Case Bookings, Pre-op Checklists, and Surgery Records.
    """
    case_number = models.CharField(max_length=50, unique=True, db_index=True)
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='surgeries')
    theatre = models.ForeignKey(OperatingTheatre, on_delete=models.PROTECT, related_name='surgical_cases')
    lead_surgeon = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='surgeries_led')
    anesthetist = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='surgeries_anesthesia')
    procedure_name = models.CharField(max_length=200)
    scheduled_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(max_length=25, default='SCHEDULED')  # SCHEDULED, IN_PROGRESS, RECOVERY, COMPLETED
    pre_op_checklist_done = models.BooleanField(default=False)
    surgical_findings = models.TextField(blank=True)
    post_op_orders = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_surgical_cases'
        ordering = ['-scheduled_date', 'start_time']

    def __str__(self):
        return f"[{self.case_number}] {self.procedure_name} - {self.patient.user_profile.full_name}"


class LabCategory(models.TextChoices):
    BIOCHEMISTRY = 'BIOCHEMISTRY', 'Clinical Biochemistry'
    HEMATOLOGY = 'HEMATOLOGY', 'Hematology & Coagulation'
    MICROBIOLOGY = 'MICROBIOLOGY', 'Microbiology & Serology'
    PATHOLOGY = 'PATHOLOGY', 'Histopathology & Cytology'
    IMMUNOLOGY = 'IMMUNOLOGY', 'Immunology & Hormones'
    MOLECULAR = 'MOLECULAR', 'Molecular Diagnostics & PCR'
    GENETICS = 'GENETICS', 'Cytogenetics & Genomics'
    TOXICOLOGY = 'TOXICOLOGY', 'Toxicology & Drug Monitoring'


class ExternalDiagnosticProvider(BaseUUIDModel):
    """
    Accredited external reference laboratories and diagnostic referral centres.
    """
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    contact_person = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    accreditation = models.CharField(max_length=100, default='NABL / CAP Accredited')
    standard_tat_hours = models.PositiveIntegerField(default=24)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'hms_external_diagnostic_providers'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} [{self.code}]"


class LabTestCatalogue(BaseUUIDModel):
    """
    Master Diagnostic Test Catalogue with Reference Ranges, Pricing, Specimen Specs and Outsourcing.
    """
    code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=30, choices=LabCategory.choices)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='lab_tests')
    description = models.TextField(blank=True)
    clinical_instructions = models.TextField(blank=True)
    preparation_instructions = models.TextField(blank=True)  # e.g. 10-12 hour fasting, stop biotin
    sample_type = models.CharField(max_length=100, default='Blood (EDTA)')
    specimen_container = models.CharField(max_length=100, default='Lavender Top (EDTA)')
    standard_rate = models.DecimalField(max_digits=10, decimal_places=2, default=500.00)
    turnaround_hours = models.PositiveIntegerField(default=4)
    reference_range = models.CharField(max_length=150, blank=True)
    unit_of_measurement = models.CharField(max_length=30, blank=True)
    normal_min = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    normal_max = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    critical_low = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    critical_high = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    is_outsourced = models.BooleanField(default=False)
    external_provider = models.ForeignKey(ExternalDiagnosticProvider, on_delete=models.SET_NULL, null=True, blank=True, related_name='catalogue_tests')
    outsourced_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'hms_lab_test_catalogue'
        ordering = ['category', 'name']

    def __str__(self):
        return f"[{self.code}] {self.name} ({self.category})"


class LabOrderStatus(models.TextChoices):
    ORDERED = 'ORDERED', 'Ordered / Pending Collection'
    SAMPLE_COLLECTED = 'SAMPLE_COLLECTED', 'Sample Collected'
    IN_PROCESS = 'IN_PROCESS', 'In Analysis'
    AWAITING_VALIDATION = 'AWAITING_VALIDATION', 'Awaiting Validation'
    AWAITING_APPROVAL = 'AWAITING_APPROVAL', 'Awaiting Approval'
    APPROVED = 'APPROVED', 'Approved by Pathologist'
    RELEASED = 'RELEASED', 'Report Released'
    CANCELLED = 'CANCELLED', 'Cancelled'


class DiagnosticEncounterType(models.TextChoices):
    OPD = 'OPD', 'Outpatient Department (OPD)'
    IPD = 'IPD', 'Inpatient Admission (IPD)'
    EMERGENCY = 'EMERGENCY', 'Emergency & Casualty'
    DIRECT = 'DIRECT', 'Direct / Walk-In Diagnostic'


class LabOrder(BaseUUIDModel):
    """
    Diagnostic Laboratory Orders with Specimen Accessioning, Encounter Linking, and Billing.
    """
    order_number = models.CharField(max_length=50, unique=True, db_index=True)
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='lab_orders')
    doctor = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='prescribed_lab_orders')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='lab_orders')
    encounter_type = models.CharField(max_length=20, choices=DiagnosticEncounterType.choices, default=DiagnosticEncounterType.OPD)
    appointment = models.ForeignKey('Appointment', on_delete=models.SET_NULL, null=True, blank=True, related_name='lab_orders')
    admission = models.ForeignKey('InpatientAdmission', on_delete=models.SET_NULL, null=True, blank=True, related_name='lab_orders')
    emergency_encounter = models.ForeignKey('EmergencyEncounter', on_delete=models.SET_NULL, null=True, blank=True, related_name='lab_orders')
    priority = models.CharField(max_length=20, default='ROUTINE')  # ROUTINE, URGENT, STAT
    status = models.CharField(max_length=25, choices=LabOrderStatus.choices, default=LabOrderStatus.ORDERED)
    specimen_accession_number = models.CharField(max_length=50, blank=True)
    clinical_notes = models.TextField(blank=True)
    cancelled_reason = models.TextField(blank=True)
    cancelled_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='cancelled_lab_orders')
    cancelled_at = models.DateTimeField(null=True, blank=True)
    invoice = models.ForeignKey('billing_finance.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='lab_orders')
    is_critical = models.BooleanField(default=False)
    # Outsourcing fields
    is_outsourced = models.BooleanField(default=False)
    external_provider = models.ForeignKey(ExternalDiagnosticProvider, on_delete=models.SET_NULL, null=True, blank=True, related_name='lab_orders')
    external_reference_number = models.CharField(max_length=100, blank=True)
    external_dispatch_date = models.DateTimeField(null=True, blank=True)
    external_received_date = models.DateTimeField(null=True, blank=True)
    external_report_url = models.URLField(max_length=500, blank=True)
    external_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    class Meta:
        db_table = 'hms_lab_orders'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.order_number}] {self.patient.user_profile.full_name} ({self.status})"


class SampleStatus(models.TextChoices):
    COLLECTED = 'COLLECTED', 'Sample Collected'
    RECEIVED_IN_LAB = 'RECEIVED_IN_LAB', 'Received in Laboratory'
    PROCESSING = 'PROCESSING', 'Under Processing / Aliquoted'
    REJECTED = 'REJECTED', 'Rejected (Unsuitable / Hemolyzed)'
    RECOLLECTION_REQUESTED = 'RECOLLECTION_REQUESTED', 'Recollection Requested'
    COMPLETED = 'COMPLETED', 'Processing Completed'


class LabSample(BaseUUIDModel):
    """
    Specimen Collection, Unique Barcode Tracking, and Sample Integrity Status.
    """
    sample_barcode = models.CharField(max_length=60, unique=True, db_index=True)
    lab_order = models.ForeignKey(LabOrder, on_delete=models.CASCADE, related_name='samples')
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='lab_samples')
    specimen_type = models.CharField(max_length=100)
    container_type = models.CharField(max_length=100, blank=True)
    collection_site = models.CharField(max_length=100, blank=True)
    collected_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='collected_samples')
    collected_at = models.DateTimeField(default=timezone.now)
    status = models.CharField(max_length=30, choices=SampleStatus.choices, default=SampleStatus.COLLECTED)
    rejection_reason = models.TextField(blank=True)
    rejected_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='rejected_samples')
    rejected_at = models.DateTimeField(null=True, blank=True)
    is_recollection = models.BooleanField(default=False)
    recollected_from_sample = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='recollections')
    storage_location = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'hms_lab_samples'
        ordering = ['-collected_at']

    def __str__(self):
        return f"[{self.sample_barcode}] {self.specimen_type} - {self.patient.user_profile.full_name} ({self.status})"


class LabItemStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Result'
    DRAFT = 'DRAFT', 'Draft Saved'
    ENTERED = 'ENTERED', 'Result Entered'
    VALIDATED = 'VALIDATED', 'Validated by Senior Tech'
    APPROVED = 'APPROVED', 'Approved by Pathologist'
    RELEASED = 'RELEASED', 'Released'
    AMENDED = 'AMENDED', 'Amended / Corrected'


class LabOrderItem(BaseUUIDModel):
    """
    Individual Test Results with Abnormal/Critical Result Flags, Pricing Invariance, and History.
    """
    lab_order = models.ForeignKey(LabOrder, on_delete=models.CASCADE, related_name='items')
    test = models.ForeignKey(LabTestCatalogue, on_delete=models.PROTECT, related_name='order_items')
    sample = models.ForeignKey(LabSample, on_delete=models.SET_NULL, null=True, blank=True, related_name='order_items')
    captured_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    result_value = models.CharField(max_length=150, blank=True)
    unit_of_measurement = models.CharField(max_length=30, blank=True)
    reference_range = models.CharField(max_length=150, blank=True)
    is_abnormal = models.BooleanField(default=False)
    is_critical = models.BooleanField(default=False)
    abnormal_flag = models.CharField(max_length=30, default='NORMAL')  # NORMAL, HIGH, LOW, CRITICAL_HIGH, CRITICAL_LOW, POSITIVE
    status = models.CharField(max_length=25, choices=LabItemStatus.choices, default=LabItemStatus.PENDING)
    result_notes = models.TextField(blank=True)
    entered_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='entered_lab_items')
    entered_at = models.DateTimeField(null=True, blank=True)
    validated_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='validated_lab_items')
    validated_at = models.DateTimeField(null=True, blank=True)
    previous_result_value = models.CharField(max_length=150, blank=True)
    correction_reason = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_lab_order_items'

    def __str__(self):
        return f"{self.test.name}: {self.result_value or 'Pending'} [{self.status}]"


class ModalityEnum(models.TextChoices):
    X_RAY = 'X_RAY', 'Digital X-Ray'
    CT_SCAN = 'CT_SCAN', 'Computed Tomography (CT)'
    MRI = 'MRI', 'Magnetic Resonance Imaging (MRI)'
    ULTRASOUND = 'ULTRASOUND', 'Ultrasound Sonography (USG)'
    MAMMOGRAPHY = 'MAMMOGRAPHY', 'Digital Mammography'
    PET_CT = 'PET_CT', 'PET-CT Molecular Imaging'
    DEXA = 'DEXA', 'Bone Mineral Densitometry (DEXA)'


class RadiologyStatus(models.TextChoices):
    REQUESTED = 'REQUESTED', 'Requested'
    SCHEDULED = 'SCHEDULED', 'Scheduled'
    IN_PROGRESS = 'IN_PROGRESS', 'Procedure in Progress'
    COMPLETED = 'COMPLETED', 'Procedure Completed (Images Acquired)'
    REPORT_DRAFTED = 'REPORT_DRAFTED', 'Draft Report'
    APPROVED = 'APPROVED', 'Report Approved by Radiologist'
    RELEASED = 'RELEASED', 'Report Released'
    CANCELLED = 'CANCELLED', 'Cancelled'


class RadiologyOrder(BaseUUIDModel):
    """
    Radiology & Imaging Requests, Modality Scheduling, DICOM Accessioning, and Diagnostic Reports.
    """
    order_number = models.CharField(max_length=50, unique=True, db_index=True)
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='radiology_orders')
    doctor = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='prescribed_radiology')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='radiology_orders')
    encounter_type = models.CharField(max_length=20, choices=DiagnosticEncounterType.choices, default=DiagnosticEncounterType.OPD)
    appointment = models.ForeignKey('Appointment', on_delete=models.SET_NULL, null=True, blank=True, related_name='radiology_orders')
    admission = models.ForeignKey('InpatientAdmission', on_delete=models.SET_NULL, null=True, blank=True, related_name='radiology_orders')
    emergency_encounter = models.ForeignKey('EmergencyEncounter', on_delete=models.SET_NULL, null=True, blank=True, related_name='radiology_orders')
    modality = models.CharField(max_length=30, choices=ModalityEnum.choices)
    study_name = models.CharField(max_length=150)
    clinical_indication = models.TextField(blank=True)
    priority = models.CharField(max_length=20, default='ROUTINE')
    status = models.CharField(max_length=25, choices=RadiologyStatus.choices, default=RadiologyStatus.REQUESTED)
    scheduled_date = models.DateField(null=True, blank=True)
    scheduled_time = models.TimeField(null=True, blank=True)
    suite_room = models.CharField(max_length=50, blank=True)
    performing_technician = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='performed_radiology')
    completed_at = models.DateTimeField(null=True, blank=True)
    captured_rate = models.DecimalField(max_digits=10, decimal_places=2, default=1200.00)
    invoice = models.ForeignKey('billing_finance.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='radiology_orders')
    radiologist = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='reported_radiology')
    technique = models.TextField(blank=True)
    findings = models.TextField(blank=True)
    impression = models.TextField(blank=True)
    key_recommendations = models.TextField(blank=True)
    dicom_viewer_url = models.URLField(max_length=500, blank=True)
    accession_number = models.CharField(max_length=100, blank=True)
    pacs_study_uid = models.CharField(max_length=100, blank=True)
    reported_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_radiology')
    approved_at = models.DateTimeField(null=True, blank=True)
    is_critical = models.BooleanField(default=False)
    is_released = models.BooleanField(default=False)

    class Meta:
        db_table = 'hms_radiology_orders'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.order_number}] {self.study_name} ({self.modality}) - {self.patient.user_profile.full_name}"


class DiagnosticReportStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    AWAITING_APPROVAL = 'AWAITING_APPROVAL', 'Awaiting Approval'
    APPROVED = 'APPROVED', 'Approved'
    RELEASED = 'RELEASED', 'Released to Patient'
    AMENDED = 'AMENDED', 'Amended / Corrected'


class DiagnosticReport(BaseUUIDModel):
    """
    Formal Laboratory and Radiology Diagnostic Reports with Versioning and Digital Release Signatures.
    """
    report_number = models.CharField(max_length=60, unique=True, db_index=True)
    report_type = models.CharField(max_length=20, choices=[('LABORATORY', 'Laboratory Report'), ('RADIOLOGY', 'Radiology Report')])
    lab_order = models.ForeignKey(LabOrder, on_delete=models.CASCADE, null=True, blank=True, related_name='reports')
    radiology_order = models.ForeignKey(RadiologyOrder, on_delete=models.CASCADE, null=True, blank=True, related_name='reports')
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='diagnostic_reports')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='diagnostic_reports')
    version = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=25, choices=DiagnosticReportStatus.choices, default=DiagnosticReportStatus.DRAFT)
    prepared_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='prepared_diagnostic_reports')
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_diagnostic_reports')
    approved_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)
    is_released = models.BooleanField(default=False)
    summary_findings = models.TextField(blank=True)
    clinical_comments = models.TextField(blank=True)
    amendment_notes = models.TextField(blank=True)
    original_report = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='amended_versions')
    file_url = models.URLField(max_length=500, blank=True)
    digital_signature_hash = models.CharField(max_length=128, blank=True)

    class Meta:
        db_table = 'hms_diagnostic_reports'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.report_number}] v{self.version} ({self.report_type}) - {self.patient.user_profile.full_name} [{self.status}]"


class CriticalAlertNotification(BaseUUIDModel):
    """
    High-Priority / Panic Clinical Value Alerts with Doctor Escalation and Acknowledgement Tracking.
    """
    lab_order = models.ForeignKey(LabOrder, on_delete=models.CASCADE, null=True, blank=True, related_name='critical_alerts')
    radiology_order = models.ForeignKey(RadiologyOrder, on_delete=models.CASCADE, null=True, blank=True, related_name='critical_alerts')
    order_item = models.ForeignKey(LabOrderItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='critical_alerts')
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='critical_alerts')
    test_name = models.CharField(max_length=150)
    critical_value = models.CharField(max_length=150)
    recipient_doctor = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='received_critical_alerts')
    notified_at = models.DateTimeField(default=timezone.now)
    channel = models.CharField(max_length=50, default='IN_APP')  # IN_APP, TELEPHONIC, SMS_GATEWAY_PENDING
    delivery_status = models.CharField(max_length=50, default='DELIVERED_IN_APP')
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='acknowledged_critical_alerts')
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledgement_notes = models.TextField(blank=True)
    escalated_to = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='escalated_critical_alerts')
    escalated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hms_critical_alert_notifications'
        ordering = ['-notified_at']

    def __str__(self):
        return f"CRITICAL: {self.test_name} ({self.critical_value}) for {self.patient.user_profile.full_name}"


class DiagnosticEquipment(BaseUUIDModel):
    """
    Clinical Analyzers, Hematology Counters, and Imaging Modality Interface Nodes.
    """
    name = models.CharField(max_length=150)
    model_number = models.CharField(max_length=100)
    serial_number = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=50, default='BIOCHEMISTRY')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='diagnostic_equipment')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='equipment')
    protocol_type = models.CharField(max_length=30, default='HL7_V2')  # ASTM_E1394, HL7_V2, REST_JSON
    ip_address = models.CharField(max_length=50, blank=True)
    port = models.PositiveIntegerField(default=5000)
    is_online = models.BooleanField(default=True)
    last_ping_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hms_diagnostic_equipment'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.model_number}) - {self.branch.name}"


class EquipmentTransmissionLog(BaseUUIDModel):
    """
    Raw and Parsed Ingestion Logs from Diagnostic Equipment and Analyzers.
    """
    equipment = models.ForeignKey(DiagnosticEquipment, on_delete=models.CASCADE, related_name='transmissions')
    sample_barcode = models.CharField(max_length=60, blank=True, db_index=True)
    raw_payload = models.TextField()
    parsed_payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=30, default='SUCCESS')  # SUCCESS, PARSE_ERROR, UNMATCHED_SAMPLE
    error_details = models.TextField(blank=True)
    processed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hms_equipment_transmission_logs'
        ordering = ['-processed_at']


class HL7TransmissionLog(BaseUUIDModel):
    """
    HL7 v2.x and FHIR Interoperability Outbound and Inbound Exchange Logs.
    """
    message_control_id = models.CharField(max_length=100, unique=True)
    message_type = models.CharField(max_length=50)  # ORM_O01, ORU_R01, FHIR_SERVICE_REQUEST, FHIR_DIAGNOSTIC_REPORT
    direction = models.CharField(max_length=10, choices=[('INBOUND', 'Inbound'), ('OUTBOUND', 'Outbound')])
    payload = models.TextField()
    status = models.CharField(max_length=30, default='SENT')  # SENT, RECEIVED, ACK_RECEIVED, FAILED
    response_ack = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_hl7_transmission_logs'
        ordering = ['-created_at']



class DutyRoster(BaseUUIDModel):
    """
    Staff and Nursing Duty Rosters, Shifts, and Station Assignments.
    """
    SHIFT_CHOICES = [
        ('MORNING', 'Morning (08:00 - 16:00)'),
        ('EVENING', 'Evening (16:00 - 00:00)'),
        ('NIGHT', 'Night (00:00 - 08:00)'),
        ('ON_CALL', 'On Call 24h'),
    ]
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name='duty_rosters')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='duty_rosters')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='duty_rosters')
    shift = models.CharField(max_length=20, choices=SHIFT_CHOICES)
    roster_date = models.DateField(db_index=True)
    assigned_station = models.CharField(max_length=100, blank=True)
    is_completed = models.BooleanField(default=False)

    class Meta:
        db_table = 'hms_duty_rosters'
        unique_together = ('staff', 'roster_date', 'shift')
        ordering = ['-roster_date', 'shift']

    def __str__(self):
        return f"{self.staff.user_profile.full_name} ({self.roster_date} - {self.shift})"


# =============================================================================
# DOCTOR MODULE EXTENSIONS: ADDENDUMS, REFERRALS, DOCUMENTS & NOTIFICATIONS
# =============================================================================

class ConsultationAddendum(BaseUUIDModel):
    """
    Audited amendment / addendum to a completed and signed consultation record.
    Prevents unauthorized overwriting of historical clinical findings.
    """
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name='addendums')
    doctor = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='consultation_addendums')
    reason_for_amendment = models.TextField(help_text="Clinical justification for adding this addendum")
    addendum_notes = models.TextField(help_text="Additional observations, corrected notes or lab follow-ups")

    class Meta:
        db_table = 'hms_consultation_addendums'
        ordering = ['-created_at']

    def __str__(self):
        return f"Addendum for {self.appointment.appointment_number} by Dr. {self.doctor.user_profile.last_name}"


class ReferralPriority(models.TextChoices):
    ROUTINE = 'ROUTINE', 'Routine'
    URGENT = 'URGENT', 'Urgent'
    EMERGENCY = 'EMERGENCY', 'Emergency'


class ReferralStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    ACCEPTED = 'ACCEPTED', 'Accepted'
    COMPLETED = 'COMPLETED', 'Completed'
    DECLINED = 'DECLINED', 'Declined'
    CANCELLED = 'CANCELLED', 'Cancelled'


class ClinicalReferral(BaseUUIDModel):
    """
    Specialist and inter-departmental patient referrals initiated by doctors.
    """
    referral_number = models.CharField(max_length=50, unique=True, db_index=True)
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='clinical_referrals')
    referring_doctor = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='outgoing_referrals')
    receiving_doctor = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='incoming_referrals')
    receiving_department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name='department_referrals')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='clinical_referrals')
    appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name='referrals')
    admission = models.ForeignKey(InpatientAdmission, on_delete=models.SET_NULL, null=True, blank=True, related_name='referrals')
    priority = models.CharField(max_length=20, choices=ReferralPriority.choices, default=ReferralPriority.ROUTINE)
    status = models.CharField(max_length=20, choices=ReferralStatus.choices, default=ReferralStatus.PENDING)
    referral_reason = models.TextField()
    clinical_notes = models.TextField(blank=True)
    receiving_doctor_notes = models.TextField(blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hms_clinical_referrals'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.referral_number}] Ref to {self.receiving_department.name} ({self.status})"


class MedicalDocumentType(models.TextChoices):
    MEDICAL_CERTIFICATE = 'MEDICAL_CERTIFICATE', 'Medical Certificate'
    SICK_LEAVE_CERTIFICATE = 'SICK_LEAVE_CERTIFICATE', 'Sick Leave Certificate'
    FITNESS_CERTIFICATE = 'FITNESS_CERTIFICATE', 'Fitness Certificate'
    DISCHARGE_SUMMARY = 'DISCHARGE_SUMMARY', 'Discharge Summary'
    TREATMENT_SUMMARY = 'TREATMENT_SUMMARY', 'Treatment Summary'
    REFERRAL_SUMMARY = 'REFERRAL_SUMMARY', 'Referral Summary'


class MedicalDocument(BaseUUIDModel):
    """
    Legally valid medical certificates, discharge summaries, and clinical reports
    issued and digitally signed by authorized medical practitioners.
    """
    document_number = models.CharField(max_length=50, unique=True, db_index=True)
    document_type = models.CharField(max_length=35, choices=MedicalDocumentType.choices)
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='medical_documents')
    doctor = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='issued_medical_documents')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='medical_documents')
    appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name='medical_documents')
    admission = models.ForeignKey(InpatientAdmission, on_delete=models.SET_NULL, null=True, blank=True, related_name='medical_documents')
    referral = models.ForeignKey(ClinicalReferral, on_delete=models.SET_NULL, null=True, blank=True, related_name='medical_documents')
    title = models.CharField(max_length=200)
    diagnosis = models.TextField()
    clinical_summary = models.TextField()
    recommendations = models.TextField(blank=True)
    leave_from_date = models.DateField(null=True, blank=True)
    leave_to_date = models.DateField(null=True, blank=True)
    fitness_date = models.DateField(null=True, blank=True)
    issue_date = models.DateField(default=timezone.localdate)
    is_signed = models.BooleanField(default=True)
    signed_at = models.DateTimeField(default=timezone.now)
    digital_signature = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'hms_medical_documents'
        ordering = ['-issue_date', '-created_at']

    def __str__(self):
        return f"[{self.document_number}] {self.document_type} - {self.patient.user_profile.full_name}"


class DoctorNotificationType(models.TextChoices):
    APPOINTMENT_ASSIGNED = 'APPOINTMENT_ASSIGNED', 'New Appointment Assigned'
    PATIENT_CHECKED_IN = 'PATIENT_CHECKED_IN', 'Patient Checked In'
    PATIENT_WAITING = 'PATIENT_WAITING', 'Patient Waiting'
    LAB_REPORT_AVAILABLE = 'LAB_REPORT_AVAILABLE', 'Lab Report Available'
    CRITICAL_ALERT = 'CRITICAL_ALERT', 'Critical Investigation Alert'
    REFERRAL_RECEIVED = 'REFERRAL_RECEIVED', 'New Referral Received'
    INPATIENT_ALERT = 'INPATIENT_ALERT', 'Inpatient Clinical Alert'
    FOLLOW_UP_REMINDER = 'FOLLOW_UP_REMINDER', 'Follow-up Reminder'
    LEAVE_STATUS = 'LEAVE_STATUS', 'Leave Application Status'
    ANNOUNCEMENT = 'ANNOUNCEMENT', 'Hospital Announcement'
    APPOINTMENT_CONFLICT = 'APPOINTMENT_CONFLICT', 'Leave Overlap Appointment Conflict'


class DoctorNotification(BaseUUIDModel):
    """
    Real-time notification and clinical task stream for doctors and hospital coordinators.
    """
    recipient_doctor = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='doctor_notifications')
    recipient_role = models.CharField(max_length=50, blank=True)  # e.g., 'RECEPTIONIST', 'HR_MANAGER'
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='doctor_notifications')
    notification_type = models.CharField(max_length=35, choices=DoctorNotificationType.choices)
    title = models.CharField(max_length=200)
    message = models.TextField()
    priority = models.CharField(max_length=20, default='ROUTINE')  # ROUTINE, URGENT, CRITICAL
    patient = models.ForeignKey(PatientProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='clinical_notifications')
    target_url = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hms_doctor_notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.notification_type}] {self.title} -> {self.recipient_doctor or self.recipient_role}"

