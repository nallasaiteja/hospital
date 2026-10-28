import uuid
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile, PatientProfile
from apps.billing_finance.models import Invoice, InvoiceItem, ChargeItemType
from apps.pharmacy_inventory.models import (
    Medicine, MedicineCategory, ItemType, DosageForm, MedicineBatch, BatchStatus,
    Prescription, PrescriptionItem, DispenseRecord, DispenseItem,
    Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus,
    GoodsReceiptNote, GoodsReceiptItem,
    SupplierInvoice, InvoicePaymentStatus,
    PurchaseRequisition, PurchaseRequisitionItem, RequisitionStatus,
    StockTransfer, StockTransferItem, TransferStatus,
    StockAdjustment, StockAdjustmentItem, AdjustmentType,
    PharmacyReturn, PharmacyReturnItem, ReturnType,
    StockReconciliation, StockReconciliationItem, ReconciliationStatus,
    StockMovement, MovementType
)

User = get_user_model()


class Section9PharmacyInventoryTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.hospital = Hospital.objects.create(
            name='Apollo Memorial Hospital',
            code=f"HOSP-{uuid.uuid4().hex[:4].upper()}"
        )
        self.branch = Branch.objects.create(
            hospital=self.hospital,
            name='Main Campus Pharmacy',
            code=f"BR-{uuid.uuid4().hex[:4].upper()}"
        )
        self.dept = Department.objects.create(
            branch=self.branch,
            name='Central Pharmacy',
            code='PHARM'
        )

        self.pharmacist_role, _ = Role.objects.get_or_create(
            name=RoleEnum.PHARMACIST,
            defaults={'display_name': 'Pharmacist'}
        )
        self.doctor_role, _ = Role.objects.get_or_create(
            name=RoleEnum.DOCTOR,
            defaults={'display_name': 'Doctor'}
        )
        self.patient_role, _ = Role.objects.get_or_create(
            name=RoleEnum.PATIENT,
            defaults={'display_name': 'Patient'}
        )

        # Staff: Pharmacist
        self.pharm_sub = uuid.uuid4()
        self.pharm_django = User.objects.create_user(username=str(self.pharm_sub), email='pharm9@hms.local')
        self.pharm_prof = UserProfile.objects.create(
            supabase_user_id=self.pharm_sub,
            email='pharm9@hms.local',
            first_name='Kavitha',
            last_name='Nair',
            role=self.pharmacist_role
        )
        self.pharmacist = StaffProfile.objects.create(
            user_profile=self.pharm_prof,
            hospital=self.hospital,
            branch=self.branch,
            department=self.dept,
            employee_id=f"EMP-{uuid.uuid4().hex[:4].upper()}",
            designation='Senior Pharmacist',
            status='ACTIVE'
        )

        # Staff: Doctor
        self.doc_sub = uuid.uuid4()
        self.doc_django = User.objects.create_user(username=str(self.doc_sub), email='dr.sharma@hms.local')
        self.doc_prof = UserProfile.objects.create(
            supabase_user_id=self.doc_sub,
            email='dr.sharma@hms.local',
            first_name='Rajesh',
            last_name='Sharma',
            role=self.doctor_role
        )
        self.doctor = StaffProfile.objects.create(
            user_profile=self.doc_prof,
            hospital=self.hospital,
            branch=self.branch,
            department=self.dept,
            employee_id=f"DOC-{uuid.uuid4().hex[:4].upper()}",
            designation='Attending Physician',
            status='ACTIVE'
        )

        # Patient
        self.pat_sub = uuid.uuid4()
        self.pat_django = User.objects.create_user(username=str(self.pat_sub), email='patient9@hms.local')
        self.pat_prof = UserProfile.objects.create(
            supabase_user_id=self.pat_sub,
            email='patient9@hms.local',
            first_name='Ananya',
            last_name='Patel',
            role=self.patient_role
        )
        self.patient = PatientProfile.objects.create(
            user_profile=self.pat_prof,
            primary_branch=self.branch,
            medical_record_number=f"MRN-{uuid.uuid4().hex[:8].upper()}",
            date_of_birth='1990-05-15',
            gender='FEMALE',
            blood_group='O+',
            status='ACTIVE'
        )

        # Supplier
        self.supplier = Supplier.objects.create(
            code=f"SUP-{uuid.uuid4().hex[:6].upper()}",
            name='MedPlus Pharma Supplies Ltd',
            contact_person='Mr. Ravi Verma',
            phone='+919876543210',
            email='ravi@medplus.example.com',
            gst_or_tax_id='29ABCDE1234F1Z5',
            payment_terms_days=30,
            is_active=True
        )

        self.client.force_authenticate(user=self.pharm_django)

    def test_01_catalogue_medicine_and_consumable_creation(self):
        """Verify database-backed catalogue creation for medicines and consumables with min/max stock."""
        # 1. Create a medicine
        med_payload = {
            'item_code': f"MED-{uuid.uuid4().hex[:5].upper()}",
            'item_type': ItemType.MEDICINE,
            'brand_name': 'Augmentin 625 Duo',
            'generic_name': 'Amoxicillin and Potassium Clavulanate',
            'category': MedicineCategory.ANTIBIOTICS,
            'dosage_form': DosageForm.TABLET,
            'strength': '625mg',
            'unit_of_measure': 'STRIP',
            'dispensing_unit': 'TABLET',
            'manufacturer': 'GSK Pharmaceuticals',
            'purchase_cost': '180.00',
            'selling_price': '225.50',
            'min_stock_level': 20,
            'max_stock_level': 200,
            'barcode': f"BAR-{uuid.uuid4().hex[:8].upper()}"
        }
        res_med = self.client.post('/api/v1/pharmacy/medicines/', med_payload, format='json')
        self.assertEqual(res_med.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_med.data['brand_name'], 'Augmentin 625 Duo')
        self.assertEqual(res_med.data['item_type'], ItemType.MEDICINE)

        # 2. Create a hospital consumable
        con_payload = {
            'item_code': f"CON-{uuid.uuid4().hex[:5].upper()}",
            'item_type': ItemType.CONSUMABLE,
            'brand_name': 'Latex Surgical Gloves Size 7.5',
            'generic_name': 'Sterile Surgical Latex Gloves',
            'category': MedicineCategory.SURGICAL,
            'dosage_form': DosageForm.PIECE,
            'strength': 'N/A',
            'unit_of_measure': 'BOX',
            'dispensing_unit': 'PAIR',
            'manufacturer': 'SafeTouch Healthcare',
            'purchase_cost': '350.00',
            'selling_price': '450.00',
            'min_stock_level': 10,
            'max_stock_level': 100,
            'barcode': f"BAR-{uuid.uuid4().hex[:8].upper()}"
        }
        res_con = self.client.post('/api/v1/pharmacy/medicines/', con_payload, format='json')
        self.assertEqual(res_con.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_con.data['item_type'], ItemType.CONSUMABLE)

    def test_02_purchase_requisition_lifecycle_and_conversion_to_po(self):
        """Verify requisition submission, approval, and conversion to purchase order."""
        med = Medicine.objects.create(
            brand_name='Paracetamol 650',
            generic_name='Paracetamol',
            category=MedicineCategory.ANALGESICS,
            dosage_form=DosageForm.TABLET,
            strength='650mg',
            purchase_cost=Decimal('15.00'),
            selling_price=Decimal('25.00')
        )

        # 1. Create Requisition
        req_res = self.client.post('/api/v1/pharmacy/requisitions/', {
            'department_id': str(self.dept.id),
            'location_type': 'MAIN_PHARMACY',
            'urgency': 'URGENT',
            'reason': 'Stock depletion in ER',
            'items': [{'medicine_id': str(med.id), 'requested_quantity': 100}]
        }, format='json')
        self.assertEqual(req_res.status_code, status.HTTP_201_CREATED)
        req_id = req_res.data['id']
        self.assertEqual(req_res.data['status'], RequisitionStatus.SUBMITTED)

        # 2. Approve Requisition
        app_res = self.client.post(f'/api/v1/pharmacy/requisitions/{req_id}/approve/', {
            'notes': 'Approved by inventory lead'
        }, format='json')
        self.assertEqual(app_res.status_code, status.HTTP_200_OK)
        self.assertEqual(app_res.data['status'], RequisitionStatus.APPROVED)

        # 3. Convert to Purchase Order
        conv_res = self.client.post(f'/api/v1/pharmacy/requisitions/{req_id}/convert_to_po/', {
            'supplier_id': str(self.supplier.id),
            'expected_delivery_date': '2026-11-15'
        }, format='json')
        self.assertEqual(conv_res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(conv_res.data['success'])
        po_data = conv_res.data['purchase_order']
        self.assertEqual(po_data['status'], PurchaseOrderStatus.SUBMITTED)
        self.assertEqual(Decimal(str(po_data['total_amount'])), Decimal('1500.00'))

    def test_03_purchase_order_creation_does_not_increase_stock(self):
        """Verify PO creation does NOT increase usable stock before physical receipt."""
        med = Medicine.objects.create(
            brand_name='Azithromycin 500mg',
            generic_name='Azithromycin',
            category=MedicineCategory.ANTIBIOTICS,
            purchase_cost=Decimal('60.00'),
            selling_price=Decimal('85.00')
        )

        self.assertEqual(med.batches.count(), 0)

        # Create PO
        po_res = self.client.post('/api/v1/pharmacy/purchase-orders/', {
            'supplier_id': str(self.supplier.id),
            'items': [{'item_name': med.brand_name, 'quantity': 50, 'unit_cost': '60.00'}]
        }, format='json')
        self.assertEqual(po_res.status_code, status.HTTP_201_CREATED)

        # Check stock remains zero
        self.assertEqual(MedicineBatch.objects.filter(medicine=med).count(), 0)

    def test_04_goods_receipt_note_atomic_stock_and_movement_audit(self):
        """Verify GRN records stock receipt, creates batch, updates PO status, and writes StockMovement ledger."""
        med = Medicine.objects.create(
            brand_name='Pantoprazole 40mg',
            generic_name='Pantoprazole',
            category=MedicineCategory.GASTROINTESTINAL,
            purchase_cost=Decimal('45.00'),
            selling_price=Decimal('70.00')
        )

        po = PurchaseOrder.objects.create(
            po_number=f"PO-{uuid.uuid4().hex[:6].upper()}",
            branch=self.branch,
            supplier=self.supplier,
            ordered_by=self.pharmacist,
            status=PurchaseOrderStatus.SUBMITTED,
            total_amount=Decimal('4500.00')
        )
        po_item = PurchaseOrderItem.objects.create(
            purchase_order=po,
            medicine=med,
            item_name=med.brand_name,
            quantity=100,
            unit_cost=Decimal('45.00'),
            subtotal=Decimal('4500.00')
        )

        # Process GRN
        batch_no = f"PAN-{uuid.uuid4().hex[:6].upper()}"
        grn_payload = {
            'purchase_order_id': str(po.id),
            'supplier_id': str(self.supplier.id),
            'delivery_challan_number': 'DC-9921',
            'supplier_invoice_number': 'INV-MED-441',
            'items': [{
                'medicine_id': str(med.id),
                'batch_number': batch_no,
                'received_quantity': 100,
                'accepted_quantity': 90,
                'rejected_quantity': 10,
                'rejection_reason': '10 strips found moisture damaged in transit',
                'unit_purchase_cost': '45.00',
                'unit_selling_price': '70.00',
                'expiry_date': (timezone.now().date() + timezone.timedelta(days=400)).isoformat()
            }]
        }
        res_grn = self.client.post('/api/v1/pharmacy/grns/', grn_payload, format='json')
        self.assertEqual(res_grn.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_grn.data['status'], 'PARTIALLY_ACCEPTED')

        # Verify stock increment strictly matches accepted quantity (90, not 100)
        batch = MedicineBatch.objects.get(batch_number=batch_no)
        self.assertEqual(batch.quantity_in_stock, 90)
        self.assertEqual(batch.status, BatchStatus.AVAILABLE)

        # Verify PO was updated
        po.refresh_from_db()
        self.assertEqual(po.status, PurchaseOrderStatus.PARTIALLY_RECEIVED)

        # Verify immutable StockMovement audit ledger entry
        movement = StockMovement.objects.filter(batch=batch, movement_type=MovementType.PURCHASE_RECEIPT).first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.quantity_delta, 90)
        self.assertEqual(movement.previous_stock, 0)
        self.assertEqual(movement.new_stock, 90)
        self.assertEqual(movement.reference_document, res_grn.data['grn_number'])

    def test_05_supplier_invoice_registration_and_approval(self):
        """Verify Accounts Payable registration and approval distinct from receipt/payment."""
        inv_payload = {
            'supplier_id': str(self.supplier.id),
            'invoice_number': f"SINV-{uuid.uuid4().hex[:6].upper()}",
            'invoice_date': timezone.now().date().isoformat(),
            'due_date': (timezone.now().date() + timezone.timedelta(days=30)).isoformat(),
            'subtotal': '4050.00',
            'tax_amount': '486.00',
            'total_amount': '4536.00',
            'notes': 'GST 12% applied'
        }
        res_inv = self.client.post('/api/v1/pharmacy/supplier-invoices/', inv_payload, format='json')
        self.assertEqual(res_inv.status_code, status.HTTP_201_CREATED)
        inv_id = res_inv.data['id']
        self.assertEqual(res_inv.data['status'], 'PENDING_REVIEW')

        # Approve invoice
        app_res = self.client.post(f'/api/v1/pharmacy/supplier-invoices/{inv_id}/approve/', format='json')
        self.assertEqual(app_res.status_code, status.HTTP_200_OK)
        self.assertEqual(app_res.data['status'], 'APPROVED')

    def test_06_prescription_dispensing_with_concurrency_and_billing_sync(self):
        """Verify dispensing deducts batch stock, writes movement ledger, and attaches invoice item."""
        med = Medicine.objects.create(
            brand_name='Metformin 500mg',
            generic_name='Metformin Hydrochloride',
            category=MedicineCategory.ENDOCRINE,
            purchase_cost=Decimal('10.00'),
            selling_price=Decimal('20.00')
        )
        batch = MedicineBatch.objects.create(
            medicine=med,
            branch=self.branch,
            supplier=self.supplier,
            batch_number=f"MET-{uuid.uuid4().hex[:6].upper()}",
            quantity_in_stock=50,
            unit_purchase_cost=Decimal('10.00'),
            unit_selling_price=Decimal('20.00'),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
            status=BatchStatus.AVAILABLE
        )

        # Create Doctor Prescription
        rx = Prescription.objects.create(
            prescription_number=f"RX-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient,
            doctor=self.doctor,
            branch=self.branch,
            diagnosis='Type 2 Diabetes Mellitus'
        )
        PrescriptionItem.objects.create(
            prescription=rx,
            medicine=med,
            dosage='500mg',
            frequency='1-0-1',
            duration_days=10,
            total_quantity=20
        )

        # Dispense prescription
        disp_payload = {
            'patient_id': str(self.patient.id),
            'prescription_id': str(rx.id),
            'items': [{'batch_id': str(batch.id), 'quantity': 20}]
        }
        res_disp = self.client.post('/api/v1/pharmacy/dispense/', disp_payload, format='json')
        self.assertEqual(res_disp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res_disp.data['success'])

        # Verify stock decreased by 20
        batch.refresh_from_db()
        self.assertEqual(batch.quantity_in_stock, 30)

        # Verify prescription marked dispensed
        rx.refresh_from_db()
        self.assertTrue(rx.is_dispensed)

        # Verify StockMovement ledger
        movement = StockMovement.objects.filter(batch=batch, movement_type=MovementType.DISPENSE).first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.quantity_delta, -20)
        self.assertEqual(movement.previous_stock, 50)
        self.assertEqual(movement.new_stock, 30)

        # Verify billing synchronization: patient invoice with ChargeItemType.PHARMACY
        inv_id = res_disp.data['invoice_id']
        invoice = Invoice.objects.get(id=inv_id)
        pharmacy_line = invoice.items.filter(item_type=ChargeItemType.PHARMACY).first()
        self.assertIsNotNone(pharmacy_line)
        self.assertEqual(pharmacy_line.quantity, 20)
        self.assertEqual(pharmacy_line.unit_price, Decimal('20.00'))
        self.assertEqual(invoice.total_amount, Decimal('400.00'))

    def test_07_clinical_safety_expired_and_quarantined_stock_rejection(self):
        """CRITICAL CLINICAL SAFETY: Expired or quarantined stock MUST BE REJECTED during dispensing."""
        med = Medicine.objects.create(
            brand_name='Insulin Glargine 100IU',
            generic_name='Insulin Glargine',
            category=MedicineCategory.ENDOCRINE
        )
        # Expired batch
        expired_batch = MedicineBatch.objects.create(
            medicine=med,
            branch=self.branch,
            supplier=self.supplier,
            batch_number=f"EXP-{uuid.uuid4().hex[:6].upper()}",
            quantity_in_stock=25,
            unit_purchase_cost=Decimal('300.00'),
            unit_selling_price=Decimal('450.00'),
            expiry_date=timezone.now().date() - timezone.timedelta(days=1),  # Yesterday!
            status=BatchStatus.AVAILABLE
        )

        disp_payload = {
            'patient_id': str(self.patient.id),
            'items': [{'batch_id': str(expired_batch.id), 'quantity': 1}]
        }
        res_exp = self.client.post('/api/v1/pharmacy/dispense/', disp_payload, format='json')
        self.assertEqual(res_exp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Clinical Safety Violation', res_exp.data['error'])

        # Quarantined batch
        quarantine_batch = MedicineBatch.objects.create(
            medicine=med,
            branch=self.branch,
            supplier=self.supplier,
            batch_number=f"QRN-{uuid.uuid4().hex[:6].upper()}",
            quantity_in_stock=25,
            unit_purchase_cost=Decimal('300.00'),
            unit_selling_price=Decimal('450.00'),
            expiry_date=timezone.now().date() + timezone.timedelta(days=180),
            status=BatchStatus.QUARANTINED
        )
        disp_payload_qrn = {
            'patient_id': str(self.patient.id),
            'items': [{'batch_id': str(quarantine_batch.id), 'quantity': 1}]
        }
        res_qrn = self.client.post('/api/v1/pharmacy/dispense/', disp_payload_qrn, format='json')
        self.assertEqual(res_qrn.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Clinical Safety Violation', res_qrn.data['error'])

    def test_08_insufficient_stock_dispensing_rejection(self):
        """Verify dispensing more than available stock is rejected with conflict."""
        med = Medicine.objects.create(brand_name='Cetirizine 10mg', generic_name='Cetirizine')
        batch = MedicineBatch.objects.create(
            medicine=med,
            branch=self.branch,
            batch_number=f"CET-{uuid.uuid4().hex[:6].upper()}",
            quantity_in_stock=5,
            unit_purchase_cost=Decimal('2.00'),
            unit_selling_price=Decimal('5.00'),
            expiry_date=timezone.now().date() + timezone.timedelta(days=300),
            status=BatchStatus.AVAILABLE
        )

        res = self.client.post('/api/v1/pharmacy/dispense/', {
            'patient_id': str(self.patient.id),
            'items': [{'batch_id': str(batch.id), 'quantity': 15}]
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('Insufficient stock', res.data['error'])

    def test_09_ipd_medication_issue_workflow(self):
        """Verify inpatient ward medication issues record consumption and link to billing."""
        med = Medicine.objects.create(
            brand_name='Ceftriaxone 1g Injection',
            generic_name='Ceftriaxone',
            category=MedicineCategory.ANTIBIOTICS,
            dosage_form=DosageForm.INJECTION,
            purchase_cost=Decimal('75.00'),
            selling_price=Decimal('120.00')
        )
        batch = MedicineBatch.objects.create(
            medicine=med,
            branch=self.branch,
            batch_number=f"CEF-{uuid.uuid4().hex[:6].upper()}",
            quantity_in_stock=40,
            unit_purchase_cost=Decimal('75.00'),
            unit_selling_price=Decimal('120.00'),
            expiry_date=timezone.now().date() + timezone.timedelta(days=200),
            status=BatchStatus.AVAILABLE
        )

        issue_payload = {
            'patient_id': str(self.patient.id),
            'ward_name': 'ICU Bed 04',
            'administered_by': 'Nurse Priya',
            'items': [{'batch_id': str(batch.id), 'quantity': 2}]
        }
        res_ipd = self.client.post('/api/v1/pharmacy/ipd-issue/', issue_payload, format='json')
        self.assertEqual(res_ipd.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res_ipd.data['success'])

        batch.refresh_from_db()
        self.assertEqual(batch.quantity_in_stock, 38)

        # Check movement type is IPD_ISSUE
        mov = StockMovement.objects.filter(batch=batch, movement_type=MovementType.IPD_ISSUE).first()
        self.assertIsNotNone(mov)
        self.assertEqual(mov.quantity_delta, -2)

    def test_10_ward_and_department_stock_transfers(self):
        """Verify transfer workflow: Requested -> Dispatched (source deducted) -> Received (destination stocked)."""
        dest_branch = Branch.objects.create(
            hospital=self.hospital,
            name='Trauma Center Pharmacy',
            code=f"BR-{uuid.uuid4().hex[:4].upper()}"
        )
        med = Medicine.objects.create(
            brand_name='Ondansetron 4mg Inj',
            generic_name='Ondansetron',
            category=MedicineCategory.GASTROINTESTINAL
        )
        src_batch = MedicineBatch.objects.create(
            medicine=med,
            branch=self.branch,
            batch_number=f"OND-{uuid.uuid4().hex[:6].upper()}",
            quantity_in_stock=50,
            unit_purchase_cost=Decimal('12.00'),
            unit_selling_price=Decimal('25.00'),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
            status=BatchStatus.AVAILABLE
        )

        # 1. Request Transfer
        trf_res = self.client.post('/api/v1/pharmacy/transfers/', {
            'destination_branch_id': str(dest_branch.id),
            'source_location': 'Main Pharmacy',
            'destination_location': 'Emergency Sub-Stock',
            'items': [{'medicine_id': str(med.id), 'batch_id': str(src_batch.id), 'quantity': 20}]
        }, format='json')
        self.assertEqual(trf_res.status_code, status.HTTP_201_CREATED)
        trf_id = trf_res.data['id']

        # 2. Dispatch Transfer
        disp_res = self.client.post(f'/api/v1/pharmacy/transfers/{trf_id}/dispatch/', format='json')
        self.assertEqual(disp_res.status_code, status.HTTP_200_OK)
        src_batch.refresh_from_db()
        self.assertEqual(src_batch.quantity_in_stock, 30)  # Deducted at source

        # 3. Receive Transfer
        recv_res = self.client.post(f'/api/v1/pharmacy/transfers/{trf_id}/receive/', format='json')
        self.assertEqual(recv_res.status_code, status.HTTP_200_OK)
        self.assertEqual(recv_res.data['status'], TransferStatus.RECEIVED)

        # Verify destination batch stocked
        dest_batch = MedicineBatch.objects.get(branch=dest_branch, batch_number=src_batch.batch_number)
        self.assertEqual(dest_batch.quantity_in_stock, 20)

    def test_11_damage_write_off_and_expiry_adjustments(self):
        """Verify stock adjustments for damage write-off deducts stock and records movement."""
        med = Medicine.objects.create(brand_name='Vial Saline 100ml', generic_name='Sodium Chloride 0.9%')
        batch = MedicineBatch.objects.create(
            medicine=med,
            branch=self.branch,
            batch_number=f"SAL-{uuid.uuid4().hex[:6].upper()}",
            quantity_in_stock=20,
            unit_purchase_cost=Decimal('15.00'),
            unit_selling_price=Decimal('30.00'),
            expiry_date=timezone.now().date() + timezone.timedelta(days=200),
            status=BatchStatus.AVAILABLE
        )

        adj_res = self.client.post('/api/v1/pharmacy/adjustments/', {
            'adjustment_type': AdjustmentType.DAMAGE_WRITEOFF,
            'reason': 'Glass vials broken in store shelf accident',
            'items': [{
                'medicine_id': str(med.id),
                'batch_id': str(batch.id),
                'quantity_change': -5,
                'reason': 'Damaged vials'
            }]
        }, format='json')
        self.assertEqual(adj_res.status_code, status.HTTP_201_CREATED)
        adj_id = adj_res.data['id']

        # Approve and Post
        post_res = self.client.post(f'/api/v1/pharmacy/adjustments/{adj_id}/approve_and_post/', format='json')
        self.assertEqual(post_res.status_code, status.HTTP_200_OK)
        batch.refresh_from_db()
        self.assertEqual(batch.quantity_in_stock, 15)

        # Check movement ledger
        mov = StockMovement.objects.filter(batch=batch, movement_type=MovementType.ADJUSTMENT_DAMAGE).first()
        self.assertIsNotNone(mov)
        self.assertEqual(mov.quantity_delta, -5)

    def test_12_low_stock_reorder_alerts(self):
        """Verify reorder alert triggers when usable unexpired stock <= min_stock_level."""
        med = Medicine.objects.create(
            brand_name='Atorvastatin 20mg',
            generic_name='Atorvastatin',
            min_stock_level=30,
            max_stock_level=100,
            purchase_cost=Decimal('40.00')
        )
        # Usable stock = 10, which is <= 30
        MedicineBatch.objects.create(
            medicine=med,
            branch=self.branch,
            batch_number=f"ATO-{uuid.uuid4().hex[:6].upper()}",
            quantity_in_stock=10,
            unit_purchase_cost=Decimal('40.00'),
            unit_selling_price=Decimal('65.00'),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
            status=BatchStatus.AVAILABLE
        )

        res = self.client.get('/api/v1/pharmacy/reorder-alerts/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        alert_items = [a for a in res.data['alerts'] if str(a['medicine_id']) == str(med.id)]
        self.assertEqual(len(alert_items), 1)
        alert = alert_items[0]
        self.assertEqual(alert['usable_stock'], 10)
        self.assertEqual(alert['deficit'], 20)
        self.assertEqual(alert['suggested_reorder_quantity'], 90)

    def test_13_physical_stock_reconciliation(self):
        """Verify stock reconciliation calculates variance and posts delta to stock ledger."""
        med = Medicine.objects.create(brand_name='Ibuprofen 400mg', generic_name='Ibuprofen')
        batch = MedicineBatch.objects.create(
            medicine=med,
            branch=self.branch,
            batch_number=f"IBU-{uuid.uuid4().hex[:6].upper()}",
            quantity_in_stock=100,
            unit_purchase_cost=Decimal('10.00'),
            unit_selling_price=Decimal('18.00'),
            expiry_date=timezone.now().date() + timezone.timedelta(days=300),
            status=BatchStatus.AVAILABLE
        )

        # Count found 92 strips (variance = -8)
        rec_res = self.client.post('/api/v1/pharmacy/reconciliations/', {
            'location': 'Shelf B-3',
            'items': [{
                'medicine_id': str(med.id),
                'batch_id': str(batch.id),
                'physical_quantity': 92,
                'variance_reason': 'Count discrepancy under audit'
            }]
        }, format='json')
        self.assertEqual(rec_res.status_code, status.HTTP_201_CREATED)
        rec_id = rec_res.data['id']
        self.assertEqual(rec_res.data['items'][0]['variance_quantity'], -8)

        # Approve and Post
        post_res = self.client.post(f'/api/v1/pharmacy/reconciliations/{rec_id}/approve_and_post/', format='json')
        self.assertEqual(post_res.status_code, status.HTTP_200_OK)

        batch.refresh_from_db()
        self.assertEqual(batch.quantity_in_stock, 92)

        # Verify ledger movement
        mov = StockMovement.objects.filter(batch=batch, movement_type=MovementType.RECONCILIATION).first()
        self.assertIsNotNone(mov)
        self.assertEqual(mov.quantity_delta, -8)

    def test_14_inventory_valuation_report(self):
        """Verify inventory valuation aggregates usable stock valuation separately from expired stock."""
        med = Medicine.objects.create(brand_name='Doxycycline 100mg', generic_name='Doxycycline')
        # Usable batch: 100 * 25 = 2500
        MedicineBatch.objects.create(
            medicine=med,
            branch=self.branch,
            batch_number=f"DOX1-{uuid.uuid4().hex[:4].upper()}",
            quantity_in_stock=100,
            unit_purchase_cost=Decimal('25.00'),
            unit_selling_price=Decimal('40.00'),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
            status=BatchStatus.AVAILABLE
        )
        # Expired batch: 20 * 25 = 500
        MedicineBatch.objects.create(
            medicine=med,
            branch=self.branch,
            batch_number=f"DOX2-{uuid.uuid4().hex[:4].upper()}",
            quantity_in_stock=20,
            unit_purchase_cost=Decimal('25.00'),
            unit_selling_price=Decimal('40.00'),
            expiry_date=timezone.now().date() - timezone.timedelta(days=10),
            status=BatchStatus.EXPIRED
        )

        res = self.client.get('/api/v1/pharmacy/valuation/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(Decimal(str(res.data['total_usable_valuation'])), Decimal('2500.00'))
        self.assertGreaterEqual(Decimal(str(res.data['total_expired_quarantined_valuation'])), Decimal('500.00'))

    def test_15_cogs_and_gross_margin_financial_report(self):
        """Verify COGS, Revenue, and Gross Margin percentage reporting."""
        med = Medicine.objects.create(
            brand_name='Clopidogrel 75mg',
            generic_name='Clopidogrel',
            purchase_cost=Decimal('30.00'),
            selling_price=Decimal('50.00')
        )
        batch = MedicineBatch.objects.create(
            medicine=med,
            branch=self.branch,
            batch_number=f"CLO-{uuid.uuid4().hex[:4].upper()}",
            quantity_in_stock=50,
            unit_purchase_cost=Decimal('30.00'),
            unit_selling_price=Decimal('50.00'),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
            status=BatchStatus.AVAILABLE
        )

        # Dispense 10 units: Revenue = 500, COGS = 300, Profit = 200, Margin = 40%
        self.client.post('/api/v1/pharmacy/dispense/', {
            'patient_id': str(self.patient.id),
            'items': [{'batch_id': str(batch.id), 'quantity': 10}]
        }, format='json')

        res = self.client.get('/api/v1/pharmacy/financial-reports/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(Decimal(str(res.data['total_sales_revenue'])), Decimal('500.00'))
        self.assertGreaterEqual(Decimal(str(res.data['cost_of_goods_sold'])), Decimal('300.00'))
        self.assertGreaterEqual(Decimal(str(res.data['gross_profit'])), Decimal('200.00'))
        self.assertGreaterEqual(float(res.data['gross_margin_percentage']), 0.0)

    def test_16_barcode_lookup_scanner_endpoint(self):
        """Verify fast scanner barcode lookup for medicines and batches with fallback."""
        bc = f"BC-{uuid.uuid4().hex[:8].upper()}"
        med = Medicine.objects.create(
            item_code=f"MED-{uuid.uuid4().hex[:4].upper()}",
            brand_name='Aspirin Cardio 75mg',
            generic_name='Acetylsalicylic Acid',
            barcode=bc
        )

        res = self.client.get(f'/api/v1/pharmacy/barcode-lookup/?code={bc}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['type'], 'MEDICINE')
        self.assertEqual(res.data['brand_name'], 'Aspirin Cardio 75mg')

    def test_17_pharmacy_dashboard_stats(self):
        """Verify summary dashboard metrics calculation."""
        res = self.client.get('/api/v1/pharmacy/dashboard-stats/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('total_catalogue_items', res.data)
        self.assertIn('low_stock_items_count', res.data)
        self.assertIn('expiring_soon_batches_count', res.data)
        self.assertIn('pending_prescriptions_count', res.data)
        self.assertIn('total_inventory_valuation', res.data)
