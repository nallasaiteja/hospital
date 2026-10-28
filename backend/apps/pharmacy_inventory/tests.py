import uuid
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.core.models import Hospital, Branch
from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile, PatientProfile
from apps.pharmacy_inventory.models import (
    Medicine, MedicineCategory, DosageForm, MedicineBatch,
    StockMovement, MovementType
)

User = get_user_model()


class TestPharmacyAndInventory(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.hospital = Hospital.objects.create(
            name='Test Hospital HQ',
            code=f"HOSP-{uuid.uuid4().hex[:4].upper()}"
        )
        self.branch = Branch.objects.create(
            hospital=self.hospital,
            name='Central Pharmacy Branch',
            code=f"BR-{uuid.uuid4().hex[:4].upper()}"
        )

        self.pharmacist_role, _ = Role.objects.get_or_create(
            name=RoleEnum.PHARMACIST,
            defaults={'display_name': 'Pharmacist'}
        )
        self.patient_role, _ = Role.objects.get_or_create(
            name=RoleEnum.PATIENT,
            defaults={'display_name': 'Patient'}
        )

        # Pharmacist profile & Django user
        self.pharm_supabase_id = uuid.uuid4()
        self.pharm_django_user = User.objects.create_user(
            username=str(self.pharm_supabase_id),
            email='pharm@hospital.local'
        )
        self.pharm_user = UserProfile.objects.create(
            supabase_user_id=self.pharm_supabase_id,
            email='pharm@hospital.local',
            first_name='Sunil',
            last_name='Kumar',
            role=self.pharmacist_role
        )
        self.pharmacist = StaffProfile.objects.create(
            user_profile=self.pharm_user,
            hospital=self.hospital,
            branch=self.branch,
            employee_id=f"PH-{uuid.uuid4().hex[:6].upper()}",
            designation='Chief Pharmacist',
            status='ACTIVE'
        )

        # Patient profile
        self.pat_supabase_id = uuid.uuid4()
        self.pat_django_user = User.objects.create_user(
            username=str(self.pat_supabase_id),
            email='patient@gmail.com'
        )
        self.pat_user = UserProfile.objects.create(
            supabase_user_id=self.pat_supabase_id,
            email='patient@gmail.com',
            first_name='Sunita',
            last_name='Rao',
            role=self.patient_role
        )
        self.patient = PatientProfile.objects.create(
            user_profile=self.pat_user,
            primary_branch=self.branch,
            medical_record_number=f"MRN-{uuid.uuid4().hex[:8].upper()}",
            gender='FEMALE'
        )

        # Medicine and Stock Batch
        self.medicine = Medicine.objects.create(
            code=f"MED-{uuid.uuid4().hex[:6].upper()}",
            generic_name='Amoxicillin Trihydrate',
            brand_name='Augmentin 625',
            category=MedicineCategory.ANTIBIOTICS,
            dosage_form=DosageForm.TABLET,
            strength='625mg',
            reorder_level=20
        )
        self.batch = MedicineBatch.objects.create(
            branch=self.branch,
            medicine=self.medicine,
            batch_number='BAT-AUG-01',
            expiry_date='2028-12-31',
            quantity_in_stock=100,
            unit_purchase_cost=Decimal('15.00'),
            unit_selling_price=Decimal('22.50')
        )

    def test_dispense_medication_stock_deduction_and_audit_trail(self):
        """Verify dispensing deducts stock quantity and creates an audited StockMovement record."""
        self.client.force_authenticate(user=self.pharm_django_user)

        dispense_payload = {
            'patient_id': str(self.patient.id),
            'items': [
                {
                    'batch_id': str(self.batch.id),
                    'quantity': 15
                }
            ]
        }

        res = self.client.post('/api/v1/pharmacy-inventory/dispense/', dispense_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(str(res.data['total_amount'])), Decimal('337.50'))  # 15 * 22.50

        # Verify batch stock is deducted from 100 to 85
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.quantity_in_stock, 85)

        # Verify an immutable StockMovement was recorded
        mv = StockMovement.objects.filter(batch_reference='BAT-AUG-01').first()
        self.assertIsNotNone(mv)
        self.assertEqual(mv.movement_type, MovementType.DISPENSE)
        self.assertEqual(mv.quantity_delta, -15)
        self.assertEqual(mv.new_stock, 85)

    def test_dispense_insufficient_stock_rejection(self):
        """Verify dispensing more than available stock is rejected with HTTP 409 Conflict."""
        self.client.force_authenticate(user=self.pharm_django_user)

        dispense_payload = {
            'patient_id': str(self.patient.id),
            'items': [
                {
                    'batch_id': str(self.batch.id),
                    'quantity': 500  # Only 100 in stock!
                }
            ]
        }

        res = self.client.post('/api/v1/pharmacy-inventory/dispense/', dispense_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('Insufficient stock', res.data['error'])
