"""
Indian Privacy, Healthcare, Tax, and Accounting Regulatory Assessment Service.
Section 23: Security & Compliance.

Evaluates applicability, existing controls, missing controls, changes required,
and required professional reviews across:
1. Digital Personal Data Protection Act, 2023 (DPDP Act 2023)
2. Healthcare Regulations (Clinical Establishments Act, NMC EHR Guidelines, Drugs & Cosmetics Act)
3. Indian Tax & Accounting (GST Act 2017 SAC 9993, Income Tax Act Sec 194J, MCA Audit Trail Rules)
4. Ayushman Bharat Digital Mission (ABDM) Integration Readiness (M1, M2, M3)
"""

from typing import Dict, Any, List
from django.utils import timezone


class IndianComplianceAssessmentService:
    """
    Structured compliance assessment engine for Indian healthcare deployments.
    Provides verifiable gap analysis without false claims of official certification.
    """

    @classmethod
    def get_comprehensive_assessment(cls) -> Dict[str, Any]:
        """
        Returns a detailed multi-framework assessment covering DPDP Act, Healthcare regulations,
        Tax & Accounting requirements, and ABDM milestones.
        """
        assessments: List[Dict[str, Any]] = [
            # -------------------------------------------------------------
            # 1. DPDP ACT 2023
            # -------------------------------------------------------------
            {
                'id': 'DPDP-2023-NOTICE-CONSENT',
                'framework': 'Digital Personal Data Protection Act, 2023 (DPDP Act)',
                'requirement': 'Section 5 & 6: Notice and Explicit, Informed Consent Architecture for Data Principals (Patients & Staff).',
                'applies': True,
                'applicability_rationale': 'Applies to processing of digital personal data within India by Data Fiduciary (Hospital).',
                'status': 'PARTIALLY_IMPLEMENTED',
                'existing_controls': [
                    'PatientConsent model records granular consent types (General Treatment, Surgery, Telemedicine, Data Sharing).',
                    'Tracks consent status (GRANTED, REVOKED, EXPIRED), timestamp, and recorded staff member.',
                    'Consent revocation reasons and revocation timestamps are captured.'
                ],
                'missing_controls': [
                    'Multilingual consent notice presentation in 22 Eighth Schedule languages (presently English-first).',
                    'Direct self-service consent revocation button on the patient web portal.'
                ],
                'changes_required': [
                    'Deploy multilingual notice templates as DPDP rules are officially notified by Data Protection Board.',
                    'Add patient portal consent toggle with instant withdrawal synchronization.'
                ],
                'professional_review_required': 'Requires review by a qualified Indian cyber-law and privacy attorney upon notification of DPDP Rules.'
            },
            {
                'id': 'DPDP-2023-PRINCIPAL-RIGHTS',
                'framework': 'Digital Personal Data Protection Act, 2023 (DPDP Act)',
                'requirement': 'Section 11-13: Rights of Data Principal (Right to Access Summary, Right to Correction/Erasure, Right of Grievance Redressal).',
                'applies': True,
                'applicability_rationale': 'Hospital must provide mechanisms for patients to request their medical summary and correct inaccurate demographic data.',
                'status': 'IMPLEMENTED',
                'existing_controls': [
                    'Patient portal allows patients to access their appointments, diagnostic reports, and medical history.',
                    'Patient merge/correction service resolves duplicate demographic profiles.',
                    'Designated Grievance Redressal Officer contact fields provided in system settings.'
                ],
                'missing_controls': [
                    'Automated 72-hour regulatory turnaround tracking for formal erasure and correction requests.'
                ],
                'changes_required': [
                    'Formalize standard operating procedure (SOP) for medical record retention vs right to erasure (clinical records cannot be deleted prior to legal retention period).'
                ],
                'professional_review_required': 'Legal counsel must review data retention policies against clinical retention obligations.'
            },
            {
                'id': 'DPDP-2023-DATA-PROTECTION',
                'framework': 'Digital Personal Data Protection Act, 2023 (DPDP Act)',
                'requirement': 'Section 8: Reasonable Security Safeguards to Prevent Personal Data Breaches.',
                'applies': True,
                'applicability_rationale': 'Mandatory for all Data Fiduciaries handling sensitive personal data.',
                'status': 'IMPLEMENTED',
                'existing_controls': [
                    'PostgreSQL Row Level Security (RLS) policies on sensitive medical and profile tables.',
                    'AES-256 database encryption at rest, TLS 1.3 in-transit via Supabase.',
                    'Role-based access control (RBAC) separating clinical, pharmacy, and HR modules.',
                    'Automated sanitization of secrets and passwords from audit logs.',
                    'Rate limiting and brute force protection on authentication routes.'
                ],
                'missing_controls': [
                    'Mandatory automated breach notification dispatcher to Data Protection Board of India within 6 hours.'
                ],
                'changes_required': [
                    'Configure CERT-In & DPB incident reporting escalation workflow.'
                ],
                'professional_review_required': 'Periodic third-party CERT-In empaneled security audit and penetration testing.'
            },

            # -------------------------------------------------------------
            # 2. HEALTHCARE REGULATIONS & CLINICAL ESTABLISHMENTS
            # -------------------------------------------------------------
            {
                'id': 'HEALTH-EHR-STANDARDS',
                'framework': 'Clinical Establishments Act & NMC Medical Practice Regulations',
                'requirement': 'Electronic Health Record (EHR) Standards & Minimum Record Retention Period (3 Years for OPD/IPD, Permanent for Medico-Legal).',
                'applies': True,
                'applicability_rationale': 'Applies to all registered clinical establishments in adopting states/UTs and practicing Registered Medical Practitioners (RMPs).',
                'status': 'IMPLEMENTED',
                'existing_controls': [
                    'Immutable clinical consultation records, daily progress notes, and inpatient admissions.',
                    'Medical license number tracking for all treating doctors.',
                    'Database deletion protections (on_delete=models.PROTECT) preventing purge of patient records.',
                    'Structured diagnosis, vital signs, prescription, and allergy tracking.'
                ],
                'missing_controls': [
                    'Digital signature (PKI / Aadhaar eSign) on finalized discharge summaries.'
                ],
                'changes_required': [
                    'Integrate Class 3 DSC / eSign provider for doctor clinical notes.'
                ],
                'professional_review_required': 'Hospital Medical Superintendent must approve EHR retention and medico-legal archival rules.'
            },
            {
                'id': 'HEALTH-PHARMACY-SCHEDULE-H',
                'framework': 'Drugs and Cosmetics Act, 1940 & Pharmacy Rules',
                'requirement': 'Schedule H & H1 Drug Dispensing Traceability, Prescription Validation, and Batch Expiry Management.',
                'applies': True,
                'applicability_rationale': 'Mandatory for in-house hospital pharmacies dispensing scheduled pharmaceuticals.',
                'status': 'IMPLEMENTED',
                'existing_controls': [
                    'Batch number, manufacturing date, and expiry date required for all medicine stock receipts.',
                    'Dispensing records linked to doctor prescriptions and invoice numbers.',
                    'StockMovement immutable audit trail for receipts, dispensations, and returns.',
                    'Expired batch alert and write-off workflow.'
                ],
                'missing_controls': [
                    'Separate Schedule H1 register export format.'
                ],
                'changes_required': [
                    'Add dedicated one-click Schedule H1 Register report export.'
                ],
                'professional_review_required': 'Chief Pharmacist and State Drug Inspectorate compliance inspection.'
            },

            # -------------------------------------------------------------
            # 3. TAX & ACCOUNTING REGULATIONS
            # -------------------------------------------------------------
            {
                'id': 'TAX-GST-HEALTHCARE',
                'framework': 'Central Goods and Services Tax (CGST) Act, 2017',
                'requirement': 'SAC 9993 Exemption for Healthcare Services & Taxability of Non-Healthcare Services (Cosmetic, Commercial Pharmacy, Room Rent > ₹5000/day).',
                'applies': True,
                'applicability_rationale': 'Applies to hospital billing, outpatient services, pharmacy sales, and inpatient room charges.',
                'status': 'IMPLEMENTED',
                'existing_controls': [
                    'Itemized invoice lines with configurable tax rates (0%, 5%, 12%, 18%).',
                    'Historical pricing and tax snapshot frozen on invoice creation.',
                    'GSTIN and tax identification fields on Hospital and Branch models.',
                    'Double-entry General Ledger balancing and tax liability ledger accounts.'
                ],
                'missing_controls': [
                    'Automated room rent GST threshold detection (Notification No. 12/2017-Central Tax as amended).'
                ],
                'changes_required': [
                    'Add automated rule triggering 5% GST on non-ICU bed charges exceeding ₹5,000 per day.'
                ],
                'professional_review_required': 'Hospital Chartered Accountant / Tax Advisor must verify quarterly GST returns (GSTR-1, GSTR-3B).'
            },
            {
                'id': 'TAX-MCA-AUDIT-TRAIL',
                'framework': 'Companies (Accounts) Rules, 2014 - Rule 3(1) Amendment',
                'requirement': 'Mandatory Audit Trail (Edit Log) for all Financial Accounting Software with No Tampering or Disabling.',
                'applies': True,
                'applicability_rationale': 'Mandatory for corporate hospitals incorporated under the Companies Act, 2013.',
                'status': 'IMPLEMENTED',
                'existing_controls': [
                    'Immutable hms_security_audit_events and hms_audit_logs capturing actor, timestamp, action, and JSON diffs.',
                    'General Ledger journal entries cannot be deleted once posted; adjustments require authorized reversal vouchers.',
                    'Strict separation of duties on financial approvals.'
                ],
                'missing_controls': [
                    'Dedicated annual auditor report certifying that the audit trail feature operated throughout the fiscal year.'
                ],
                'changes_required': [
                    'Provide one-click MCA Audit Trail certification dashboard for statutory auditors.'
                ],
                'professional_review_required': 'Statutory Auditor review under CARO / Section 143(3) of Companies Act.'
            },

            # -------------------------------------------------------------
            # 4. AYUSHMAN BHARAT DIGITAL MISSION (ABDM) READINESS
            # -------------------------------------------------------------
            {
                'id': 'ABDM-MILESTONE-M1',
                'framework': 'Ayushman Bharat Digital Mission (ABDM)',
                'requirement': 'Milestone M1: Ayushman Bharat Health Account (ABHA) Creation and Demographic Verification.',
                'applies': True,
                'applicability_rationale': 'Required for hospitals seeking ABDM accreditation and Ayushman Bharat PM-JAY empanelment.',
                'status': 'PARTIALLY_IMPLEMENTED',
                'existing_controls': [
                    'PatientProfile schema stores government identifiers, demographic details, and mobile number.',
                    'Universal unique Medical Record Number (MRN) assigned to all patients.'
                ],
                'missing_controls': [
                    'Direct Sandbox API integration with NHA ABDM Gateway for OTP-based 14-digit ABHA creation and ABHA Address linking.'
                ],
                'changes_required': [
                    'Add ABDM Bridge Connector service utilizing NHA Gateway client credentials.',
                    'Add ABHA verification badge on patient registration interface.'
                ],
                'professional_review_required': 'National Health Authority (NHA) Sandbox testing and formal M1 compliance review.'
            },
            {
                'id': 'ABDM-MILESTONE-M2-M3',
                'framework': 'Ayushman Bharat Digital Mission (ABDM)',
                'requirement': 'Milestones M2 & M3: Health Facility Registry (HFR) Linking, Health Professional Registry (HPR) Linking, and FHIR Diagnostic Report Exchange.',
                'applies': True,
                'applicability_rationale': 'Required for participating in national health records exchange and PM-JAY claim processing.',
                'status': 'PARTIALLY_IMPLEMENTED',
                'existing_controls': [
                    'Hospital, Branch, and Department models map to National HFR identifiers.',
                    'StaffProfile stores medical license and specialization for HPR mapping.',
                    'Diagnostic reports and prescriptions are digitally structured.'
                ],
                'missing_controls': [
                    'HL7 FHIR Release 4 (R4) bundle serialization pipeline for ABDM Consent Manager discovery.'
                ],
                'changes_required': [
                    'Implement FHIR R4 DiagnosticReport and MedicationRequest document converters.',
                    'Obtain production NHA client credentials upon hospital empanelment.'
                ],
                'professional_review_required': 'NHA certification and Security Audit clearance prior to live production gateway cutover.'
            }
        ]

        summary = {
            'total_requirements_assessed': len(assessments),
            'implemented_count': sum(1 for a in assessments if a['status'] == 'IMPLEMENTED'),
            'partially_implemented_count': sum(1 for a in assessments if a['status'] == 'PARTIALLY_IMPLEMENTED'),
            'not_implemented_count': sum(1 for a in assessments if a['status'] == 'NOT_IMPLEMENTED'),
            'disclaimer': (
                'This regulatory assessment evaluates system technical readiness and data architecture. '
                'It is not a substitute for formal legal, accounting, tax, or ABDM certification. '
                'All operational deployments require independent verification by qualified professionals.'
            )
        }

        return {
            'assessment_date': timezone.now().isoformat(),
            'summary': summary,
            'assessments': assessments
        }
