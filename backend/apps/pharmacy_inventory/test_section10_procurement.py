import uuid
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.db.models import Sum
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import UserProfile, StaffProfile, Role, RoleEnum
from apps.pharmacy_inventory.models import (
    Supplier, SupplierCategory, Medicine, MedicineBatch, BatchStatus,
    PurchaseRequisition, PurchaseRequisitionItem, ProcurementCategory, RequisitionStatus,
    SupplierQuotation, SupplierQuotationItem, QuotationStatus,
    ComparativeStatement,
    PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus,
    GoodsReceiptNote, GoodsReceiptItem,
    SupplierInvoice, InvoicePaymentStatus,
    SupplierReturn, SupplierReturnItem, SupplierReturnReason,
    SupplierCreditNote, CreditNoteStatus,
    SupplierPaymentSchedule, PaymentScheduleStatus,
    StockMovement, MovementType
)

User = get_user_model()


class Section10ProcurementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.hospital = Hospital.objects.create(name="Central City Health", code=f"HOSP-{uuid.uuid4().hex[:4].upper()}")
        self.branch = Branch.objects.create(hospital=self.hospital, name="Central City Hospital", code=f"CCH-{uuid.uuid4().hex[:4].upper()}")
        self.dept = Department.objects.create(name="Procurement & Materials", code="PROC-01", branch=self.branch)

        self.role, _ = Role.objects.get_or_create(
            name=RoleEnum.PHARMACIST,
            defaults={'display_name': 'Procurement Officer'}
        )
        self.sub_id = uuid.uuid4()
        self.user = User.objects.create_user(
            username=str(self.sub_id),
            email="procurement@hospital.org",
            password="SecurePassword123!"
        )
        self.profile = UserProfile.objects.create(
            supabase_user_id=self.sub_id,
            email="procurement@hospital.org",
            first_name="Anita",
            last_name="Desai",
            role=self.role
        )
        self.staff_profile = StaffProfile.objects.create(
            user_profile=self.profile,
            hospital=self.hospital,
            branch=self.branch,
            department=self.dept,
            employee_id=f"EMP-{uuid.uuid4().hex[:4].upper()}",
            designation="Procurement Officer",
            status="ACTIVE"
        )
        self.client.force_authenticate(user=self.user)

        # Base active supplier
        self.supplier = Supplier.objects.create(
            code="SUP-MED-01",
            name="Apex Pharmaceuticals Ltd",
            category=SupplierCategory.PHARMACEUTICALS,
            contact_person="Ramesh Gupta",
            phone="9876543210",
            email="ramesh@apexpharma.com",
            gst_or_tax_id="GST27AAACA1234A1Z5",
            payment_terms_days=30,
            is_active=True
        )

        # Base medicine item
        self.medicine = Medicine.objects.create(
            code="MED-CIPRO-500",
            generic_name="Ciprofloxacin",
            brand_name="Ciprobid 500mg",
            category="MEDICINE",
            dosage_form="TABLET",
            strength="500mg",
            unit_of_measurement="TAB",
            standard_purchase_cost=Decimal("12.00"),
            standard_selling_price=Decimal("18.00"),
            min_stock_level=50,
            reorder_level=50,
        )

    def test_supplier_registration_and_duplicate_prevention(self):
        """§10.3: Supplier Registration, category assignment, and duplicate prevention."""
        # 1. Register valid new supplier
        res = self.client.post("/api/v1/pharmacy/suppliers/", {
            "code": "SUP-SURG-01",
            "name": "Surgical Dynamics Pvt Ltd",
            "category": SupplierCategory.SURGICAL,
            "contact_person": "Vikram Seth",
            "phone": "9811223344",
            "email": "vikram@surgicaldyn.com",
            "gst_or_tax_id": "GST27BBBCB5678B1Z9",
            "payment_terms_days": 45,
            "bank_name": "State Bank of India",
            "bank_account_number": "334455667788",
            "bank_ifsc": "SBIN0001234",
            "is_active": True
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Supplier.objects.filter(code="SUP-SURG-01").exists())

        # 2. Reject duplicate code
        res_dup = self.client.post("/api/v1/pharmacy/suppliers/", {
            "code": "SUP-SURG-01",
            "name": "Another Vendor",
            "contact_person": "John Doe",
            "phone": "9999999999",
        }, format="json")
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already exists", res_dup.data["error"])

    def test_inactive_supplier_cannot_receive_purchase_orders(self):
        """§10.3: Deactivated supplier prevents new purchase orders and quotations."""
        inactive_sup = Supplier.objects.create(
            code="SUP-INACTIVE-01",
            name="Defunct Wholesalers",
            contact_person="Old Contact",
            phone="9000000000",
            is_active=False
        )

        res = self.client.post("/api/v1/pharmacy/purchase-orders/", {
            "supplier_id": str(inactive_sup.id),
            "branch_id": str(self.branch.id),
            "items": [{"item_name": "Latex Gloves", "quantity": 100, "unit_cost": "5.00"}]
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inactive", res.data["error"].lower())

    def test_procurement_requisition_across_five_categories(self):
        """§10.2: Requisitions support all 5 required categories."""
        categories = [
            ProcurementCategory.MEDICINES,
            ProcurementCategory.SURGICAL_SUPPLIES,
            ProcurementCategory.DIAGNOSTIC_REAGENTS,
            ProcurementCategory.EQUIPMENT,
            ProcurementCategory.GENERAL_MATERIALS
        ]

        for cat in categories:
            res = self.client.post("/api/v1/pharmacy/requisitions/", {
                "branch_id": str(self.branch.id),
                "department_id": str(self.dept.id),
                "procurement_category": cat,
                "urgency": "URGENT",
                "requested_delivery_date": "2026-11-15",
                "reason": f"Routine procurement for category {cat}",
                "items": [
                    {
                        "item_name": f"Item for {cat}",
                        "specifications": "Standard hospital clinical grade",
                        "quantity_requested": 50,
                        "estimated_cost": "2500.00"
                    }
                ]
            }, format="json")
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            self.assertEqual(res.data["procurement_category"], cat)

        # Test approval action
        req = PurchaseRequisition.objects.filter(procurement_category=ProcurementCategory.EQUIPMENT).first()
        res_app = self.client.post(f"/api/v1/pharmacy/requisitions/{req.id}/approve/")
        self.assertEqual(res_app.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, RequisitionStatus.APPROVED)

    def test_supplier_quotations_and_comparative_statement_evaluation(self):
        """§10.4 & §10.5: Multi-vendor quotation recording and side-by-side comparative statement."""
        # 1. Create requisition for equipment
        req = PurchaseRequisition.objects.create(
            requisition_number="REQ-EQ-001",
            branch=self.branch,
            procurement_category=ProcurementCategory.EQUIPMENT,
            requested_by=self.staff_profile,
            reason="Multipara Patient Monitors for ICU"
        )

        sup2 = Supplier.objects.create(
            code="SUP-EQ-02",
            name="BioMed Electronics",
            category=SupplierCategory.EQUIPMENT,
            contact_person="Priya Sharma",
            phone="9123456789"
        )

        # 2. Quotation 1 from Supplier 1 (₹85,000)
        res_q1 = self.client.post("/api/v1/pharmacy/quotations/", {
            "requisition_id": str(req.id),
            "supplier_id": str(self.supplier.id),
            "delivery_lead_time_days": 10,
            "payment_terms": "Net 30 Days",
            "items": [{"item_name": "Multipara Monitor 12-inch", "quantity": 2, "unit_price": "42500.00"}]
        }, format="json")
        self.assertEqual(res_q1.status_code, status.HTTP_201_CREATED)

        # 3. Quotation 2 from Supplier 2 (₹78,000 - Lowest Bidder)
        res_q2 = self.client.post("/api/v1/pharmacy/quotations/", {
            "requisition_id": str(req.id),
            "supplier_id": str(sup2.id),
            "delivery_lead_time_days": 14,
            "payment_terms": "Net 45 Days",
            "items": [{"item_name": "Multipara Monitor 12-inch", "quantity": 2, "unit_price": "39000.00"}]
        }, format="json")
        self.assertEqual(res_q2.status_code, status.HTTP_201_CREATED)

        # 4. Generate Comparative Statement
        res_cs = self.client.post("/api/v1/pharmacy/comparative-statements/", {
            "requisition_id": str(req.id),
            "notes": "Technical bid evaluation complete. Comparing prices and warranty."
        }, format="json")
        self.assertEqual(res_cs.status_code, status.HTTP_201_CREATED)
        cs_id = res_cs.data["id"]

        # 5. Non-lowest selection requires justification
        q1_id = res_q1.data["id"]
        res_fail = self.client.post(f"/api/v1/pharmacy/comparative-statements/{cs_id}/award/", {
            "quotation_id": q1_id,
            "selection_justification": ""  # Missing justification!
        }, format="json")
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("justification is required", res_fail.data["error"])

        # 6. Award with valid justification
        res_pass = self.client.post(f"/api/v1/pharmacy/comparative-statements/{cs_id}/award/", {
            "quotation_id": q1_id,
            "selection_justification": "Awarded to Apex Pharma due to 3-year on-site AMC warranty vs 1-year from competitor."
        }, format="json")
        self.assertEqual(res_pass.status_code, status.HTTP_200_OK)

        cs = ComparativeStatement.objects.get(id=cs_id)
        self.assertEqual(cs.approval_status, "APPROVED")
        self.assertEqual(cs.selected_quotation_id, uuid.UUID(q1_id))
        self.assertFalse(cs.is_lowest_bidder_selected)

    def test_purchase_order_approval_lifecycle_and_unapproved_guard(self):
        """§10.6 & §10.7: Unapproved PO cannot be issued. Full lifecycle verification."""
        po = PurchaseOrder.objects.create(
            po_number="PO-TEST-001",
            branch=self.branch,
            supplier=self.supplier,
            ordered_by=self.staff_profile,
            status=PurchaseOrderStatus.DRAFT,
            approval_status="PENDING_APPROVAL",
            total_amount=Decimal("15000.00")
        )

        # Cannot issue unapproved PO
        res_issue_fail = self.client.post(f"/api/v1/pharmacy/purchase-orders/{po.id}/issue/")
        self.assertEqual(res_issue_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("unapproved", res_issue_fail.data["error"].lower())

        # Approve PO
        res_approve = self.client.post(f"/api/v1/pharmacy/purchase-orders/{po.id}/approve/", {
            "approval_notes": "Budget available under clinical materials allocation."
        }, format="json")
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)

        # Issue PO successfully
        res_issue_ok = self.client.post(f"/api/v1/pharmacy/purchase-orders/{po.id}/issue/")
        self.assertEqual(res_issue_ok.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, PurchaseOrderStatus.ISSUED)

    def test_goods_receipt_accepted_vs_rejected_stock_posting(self):
        """§10.8: GRN updates stock ONLY for accepted quantities; rejected goods excluded."""
        po = PurchaseOrder.objects.create(
            po_number="PO-GRN-01",
            branch=self.branch,
            supplier=self.supplier,
            ordered_by=self.staff_profile,
            status=PurchaseOrderStatus.ISSUED,
            total_amount=Decimal("2400.00")
        )
        po_item = PurchaseOrderItem.objects.create(
            purchase_order=po,
            medicine=self.medicine,
            item_name=self.medicine.brand_name,
            quantity=200,
            unit_cost=Decimal("12.00"),
            subtotal=Decimal("2400.00")
        )

        # Receive 200: 170 accepted, 30 rejected due to broken vials
        res = self.client.post("/api/v1/pharmacy/grns/", {
            "purchase_order_id": str(po.id),
            "delivery_challan_number": "DC-2026-881",
            "items": [
                {
                    "po_item_id": str(po_item.id),
                    "medicine_id": str(self.medicine.id),
                    "quantity_received": 200,
                    "quantity_accepted": 170,
                    "quantity_rejected": 30,
                    "rejection_reason": "30 vials fractured in transit box #2",
                    "batch_number": "BATCH-CIPRO-REC1",
                    "expiry_date": "2027-10-31",
                    "purchase_cost": "12.00",
                    "selling_price": "18.00"
                }
            ]
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Verify stock incremented ONLY by 170, not 200
        batch = MedicineBatch.objects.get(batch_number="BATCH-CIPRO-REC1")
        self.assertEqual(batch.quantity_in_stock, 170)

        # Verify movement ledger
        mov = StockMovement.objects.get(reference_document=res.data["grn_number"])
        self.assertEqual(mov.quantity_delta, 170)

    def test_supplier_return_deducts_inventory_and_issues_credit_note(self):
        """§10.10 & §10.11: Supplier return atomically deducts stock and generates Credit Note."""
        # Setup initial stock batch
        batch = MedicineBatch.objects.create(
            medicine=self.medicine,
            branch=self.branch,
            supplier=self.supplier,
            batch_number="BATCH-RET-TEST",
            expiry_date=timezone.localdate() + timezone.timedelta(days=180),
            quantity_in_stock=100,
            unit_purchase_cost=Decimal("12.00")
        )

        # Return 25 units back to supplier due to packaging defect
        res = self.client.post("/api/v1/pharmacy/supplier-returns/", {
            "supplier_id": str(self.supplier.id),
            "branch_id": str(self.branch.id),
            "reason_type": SupplierReturnReason.DEFECTIVE,
            "reason_details": "Packaging seal breached on blister strip",
            "items": [
                {
                    "batch_id": str(batch.id),
                    "quantity_returned": 25
                }
            ]
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Stock deducted to 75
        batch.refresh_from_db()
        self.assertEqual(batch.quantity_in_stock, 75)

        # Verify negative stock movement logged
        return_num = res.data["return_number"]
        mov = StockMovement.objects.get(reference_document=return_num)
        self.assertEqual(mov.quantity_delta, -25)
        self.assertEqual(mov.new_stock, 75)

        # Verify Credit Note was automatically generated
        cn = SupplierCreditNote.objects.get(supplier_return__return_number=return_num)
        self.assertEqual(cn.total_credit_amount, Decimal("300.00")) # 25 * 12.00
        self.assertEqual(cn.remaining_balance, Decimal("300.00"))

    def test_supplier_return_cannot_exceed_available_stock(self):
        """§10.10: Validates return quantity does not exceed current stock."""
        batch = MedicineBatch.objects.create(
            medicine=self.medicine,
            branch=self.branch,
            supplier=self.supplier,
            batch_number="BATCH-LOW-STOCK",
            expiry_date=timezone.localdate() + timezone.timedelta(days=180),
            quantity_in_stock=10,
            unit_purchase_cost=Decimal("12.00")
        )

        res = self.client.post("/api/v1/pharmacy/supplier-returns/", {
            "supplier_id": str(self.supplier.id),
            "items": [{"batch_id": str(batch.id), "quantity_returned": 50}]  # 50 > 10
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("only 10 available", res.data["error"].lower())

    def test_credit_note_applied_to_supplier_invoice(self):
        """§10.11: Applying Credit Note reduces invoice payable liability."""
        invoice = SupplierInvoice.objects.create(
            invoice_number="INV-SUP-101",
            supplier=self.supplier,
            branch=self.branch,
            invoice_date="2026-10-01",
            due_date="2026-10-31",
            total_amount=Decimal("1000.00"),
            paid_amount=Decimal("0.00"),
            payment_status=InvoicePaymentStatus.UNPAID
        )

        cn = SupplierCreditNote.objects.create(
            credit_note_number="SCN-TEST-01",
            supplier=self.supplier,
            branch=self.branch,
            credit_date="2026-10-15",
            total_credit_amount=Decimal("400.00"),
            utilized_amount=Decimal("0.00"),
            remaining_balance=Decimal("400.00"),
            status=CreditNoteStatus.APPROVED
        )

        # Apply credit note to invoice
        res = self.client.post(f"/api/v1/pharmacy/credit-notes/{cn.id}/apply-to-invoice/", {
            "invoice_id": str(invoice.id)
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        invoice.refresh_from_db()
        cn.refresh_from_db()
        self.assertEqual(invoice.paid_amount, Decimal("400.00"))
        self.assertEqual(invoice.payment_status, InvoicePaymentStatus.PARTIALLY_PAID)
        self.assertEqual(cn.remaining_balance, Decimal("0.00"))
        self.assertEqual(cn.status, CreditNoteStatus.UTILIZED)

    def test_supplier_payment_schedules_and_settlement(self):
        """§10.12: Payment schedule installments and recorded settlement."""
        invoice = SupplierInvoice.objects.create(
            invoice_number="INV-SUP-SCH-01",
            supplier=self.supplier,
            branch=self.branch,
            invoice_date="2026-10-01",
            due_date="2026-11-01",
            total_amount=Decimal("6000.00"),
            paid_amount=Decimal("0.00")
        )

        # Create 2 installment schedules (₹3000 each)
        res_sch = self.client.post("/api/v1/pharmacy/payment-schedules/", {
            "invoice_id": str(invoice.id),
            "installment_number": 1,
            "scheduled_date": "2026-10-15",
            "scheduled_amount": "3000.00"
        }, format="json")
        self.assertEqual(res_sch.status_code, status.HTTP_201_CREATED)
        sched_id = res_sch.data["id"]

        # Record payment settlement
        res_settle = self.client.post(f"/api/v1/pharmacy/payment-schedules/{sched_id}/record-settlement/", {
            "payment_reference": "NEFT-HDFC-998877"
        }, format="json")
        self.assertEqual(res_settle.status_code, status.HTTP_200_OK)

        invoice.refresh_from_db()
        self.assertEqual(invoice.paid_amount, Decimal("3000.00"))
        self.assertEqual(invoice.payment_status, InvoicePaymentStatus.PARTIALLY_PAID)

    def test_supplier_outstanding_balances_report(self):
        """§10.13: Accounts payable source of truth with aging buckets."""
        SupplierInvoice.objects.create(
            invoice_number="INV-BAL-01",
            supplier=self.supplier,
            branch=self.branch,
            invoice_date="2026-09-01",
            due_date="2026-09-30",
            total_amount=Decimal("5000.00"),
            paid_amount=Decimal("2000.00"),
            payment_status=InvoicePaymentStatus.PARTIALLY_PAID
        )

        res = self.client.get("/api/v1/pharmacy/outstanding-balances/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("summary", res.data)
        self.assertIn("suppliers", res.data)
        sup_data = next((s for s in res.data["suppliers"] if s["supplier_id"] == str(self.supplier.id)), None)
        self.assertIsNotNone(sup_data)
        self.assertEqual(sup_data["net_outstanding"], "3000.00")

    def test_vendor_performance_report_metrics(self):
        """§10.14: Vendor analytics on fulfillment, on-time delivery, and defect rate."""
        po = PurchaseOrder.objects.create(
            po_number="PO-PERF-01",
            branch=self.branch,
            supplier=self.supplier,
            ordered_by=self.staff_profile,
            order_date=timezone.localdate(),
            expected_delivery_date=timezone.localdate() + timezone.timedelta(days=5),
            status=PurchaseOrderStatus.RECEIVED,
            total_amount=Decimal("12000.00")
        )
        grn = GoodsReceiptNote.objects.create(
            grn_number="GRN-PERF-01",
            branch=self.branch,
            supplier=self.supplier,
            purchase_order=po,
            received_by=self.staff_profile,
            receipt_date=timezone.now(),
            total_received_value=Decimal("12000.00")
        )
        GoodsReceiptItem.objects.create(
            grn=grn,
            medicine=self.medicine,
            quantity_received=100,
            quantity_accepted=95,
            quantity_rejected=5,
            batch_number="BATCH-PERF-01",
            expiry_date=timezone.localdate() + timezone.timedelta(days=365),
            unit_purchase_cost=Decimal("120.00"),
            unit_selling_price=Decimal("150.00")
        )

        res = self.client.get("/api/v1/pharmacy/vendor-performance/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("performance_reports", res.data)
        sup_rep = next((r for r in res.data["performance_reports"] if r["supplier_id"] == str(self.supplier.id)), None)
        self.assertIsNotNone(sup_rep)
        self.assertEqual(sup_rep["total_purchase_orders"], 1)
        self.assertEqual(sup_rep["total_accepted_quantity"], 95)
        self.assertEqual(sup_rep["total_rejected_quantity"], 5)
        self.assertEqual(sup_rep["rejection_defect_rate_pct"], 5.0)
        self.assertEqual(sup_rep["on_time_delivery_rate_pct"], 100.0)

    def test_scheduled_payments_do_not_falsely_increase_paid_amounts_until_settled(self):
        """§10.12: Creating a payment schedule does NOT falsely mark an invoice as paid."""
        invoice = SupplierInvoice.objects.create(
            invoice_number="INV-SCH-TEST-02",
            supplier=self.supplier,
            branch=self.branch,
            invoice_date="2026-10-01",
            due_date="2026-11-15",
            total_amount=Decimal("8000.00"),
            paid_amount=Decimal("0.00"),
            payment_status=InvoicePaymentStatus.UNPAID
        )

        res = self.client.post("/api/v1/pharmacy/payment-schedules/", {
            "invoice_id": str(invoice.id),
            "installment_number": 1,
            "scheduled_date": "2026-11-01",
            "scheduled_amount": "4000.00"
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        invoice.refresh_from_db()
        self.assertEqual(invoice.paid_amount, Decimal("0.00"))
        self.assertEqual(invoice.payment_status, InvoicePaymentStatus.UNPAID)

    def test_purchase_order_creation_does_not_alter_stock(self):
        """§10.7: PO creation does not increment stock. Only GRN increments."""
        initial_stock = MedicineBatch.objects.filter(medicine=self.medicine).aggregate(s=Sum('quantity_in_stock'))['s'] or 0

        res = self.client.post("/api/v1/pharmacy/purchase-orders/", {
            "supplier_id": str(self.supplier.id),
            "branch_id": str(self.branch.id),
            "items": [
                {
                    "medicine_id": str(self.medicine.id),
                    "quantity": 500,
                    "unit_cost": "12.00"
                }
            ]
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        new_stock = MedicineBatch.objects.filter(medicine=self.medicine).aggregate(s=Sum('quantity_in_stock'))['s'] or 0
        self.assertEqual(new_stock, initial_stock)

    def test_rejection_of_requisition_records_reason(self):
        """§10.2: Requisition rejection requires/records reason."""
        req = PurchaseRequisition.objects.create(
            requisition_number="REQ-REJ-01",
            branch=self.branch,
            procurement_category=ProcurementCategory.GENERAL_MATERIALS,
            requested_by=self.staff_profile,
            reason="Office Chairs"
        )

        res = self.client.post(f"/api/v1/pharmacy/requisitions/{req.id}/reject/", {
            "reason": "Sufficient ergonomic chairs available in storage room B"
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, RequisitionStatus.REJECTED)
        self.assertIn("Sufficient ergonomic chairs", req.rejection_reason)

    def test_purchase_order_amendment_tracking(self):
        """§10.7: Amendment to PO updates delivery dates and audit notes."""
        po = PurchaseOrder.objects.create(
            po_number="PO-AMEND-01",
            branch=self.branch,
            supplier=self.supplier,
            ordered_by=self.staff_profile,
            status=PurchaseOrderStatus.DRAFT,
            expected_delivery_date="2026-11-01"
        )

        res = self.client.post(f"/api/v1/pharmacy/purchase-orders/{po.id}/amend/", {
            "expected_delivery_date": "2026-11-20",
            "amendment_notes": "Supplier requested 3-week extension due to raw material delay."
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(str(po.expected_delivery_date), "2026-11-20")
        self.assertIn("raw material delay", po.notes)

    def test_credit_note_partial_utilization(self):
        """§10.11: Partial credit note utilization against smaller invoice."""
        invoice = SupplierInvoice.objects.create(
            invoice_number="INV-SMALL-01",
            supplier=self.supplier,
            branch=self.branch,
            invoice_date="2026-10-01",
            due_date="2026-10-31",
            total_amount=Decimal("300.00"),
            paid_amount=Decimal("0.00")
        )

        cn = SupplierCreditNote.objects.create(
            credit_note_number="SCN-LARGE-01",
            supplier=self.supplier,
            branch=self.branch,
            credit_date="2026-10-15",
            total_credit_amount=Decimal("1000.00"),
            utilized_amount=Decimal("0.00"),
            remaining_balance=Decimal("1000.00"),
            status=CreditNoteStatus.APPROVED
        )

        res = self.client.post(f"/api/v1/pharmacy/credit-notes/{cn.id}/apply-to-invoice/", {
            "invoice_id": str(invoice.id)
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        invoice.refresh_from_db()
        cn.refresh_from_db()
        self.assertEqual(invoice.payment_status, InvoicePaymentStatus.PAID)
        self.assertEqual(cn.utilized_amount, Decimal("300.00"))
        self.assertEqual(cn.remaining_balance, Decimal("700.00"))
        self.assertEqual(cn.status, CreditNoteStatus.PARTIALLY_UTILIZED)

