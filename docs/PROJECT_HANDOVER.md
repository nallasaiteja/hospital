# Enterprise Hospital Management System (HMS)
## Project Handover & Final Verification Deliverables

---

### 1. Executive Summary & Deliverables Verification

This document constitutes the official handover package for the **Multi-Specialty Hospital Management System (HMS)**. The system is an enterprise-grade modular monolith supporting dual-portal operations (Staff Portal and Patient Portal), Supabase-managed authentication, strict PostgreSQL Row Level Security (RLS), and double-entry general ledger fidelity across all 27 clinical, operational, and financial modules.

| Deliverable | Verification Status | Artifact Reference |
| :--- | :--- | :--- |
| **Frontend Source Code** | Complete & Verified (React 19, TypeScript, Vite) | `frontend/src/` |
| **Backend Source Code** | Complete & Verified (Django 5.1, DRF, Modular Monolith) | `backend/apps/` |
| **Database Schema & Migrations** | 100% Migrations Applied (0 Pending) | `backend/apps/*/migrations/` |
| **Database Configuration** | PostgreSQL 15+ Pooled (Port 6543) & Direct (Port 5432) | `docs/SUPABASE_SETUP.md` |
| **Authentication & RBAC** | Supabase GoTrue + Django JWT Verification Backend | `backend/apps/authentication/` |
| **Storage Buckets & Policies** | Private Buckets with Signed URLs (`lab-results`, `invoices`, etc.) | `docs/SUPABASE_SETUP.md` |
| **Environment Variables Template** | Placeholders Only (Zero secrets/credentials committed) | `.env.example`, `backend/.env.example` |
| **Installation & Run Guide** | Validated on Windows PowerShell & Docker | `docs/DEVELOPMENT_GUIDE.md` |
| **Build & Deployment Guide** | Production build tested (`npm run build` in 1.54s) | Section 8 of this document |
| **Testing & Verification** | 104/104 Endpoints Passed (0 Failures) | Section 9 of this document |
| **Module Inventory & Status** | All 27 Modules Implemented & Operational | Section 10 of this document |

---

### 2. Implemented Modules Status (All 27 Modules)

| # | Module Name | Scope / URL Path | Operational Status |
| :---: | :--- | :--- | :---: |
| **1** | Hospital Dashboard | `/staff/dashboard` | **Operational** |
| **2** | Patient Management & EMR | `/staff/patients`, `/staff/patients/:id` | **Operational** |
| **3** | OPD & Appointment Queue | `/staff/appointments` | **Operational** |
| **4** | Emergency & Casualty | `/staff/emergency` | **Operational** |
| **5** | IPD & Bed Allocation | `/staff/admissions` | **Operational** |
| **6** | Doctors & Nursing Clinical Care | `/staff/doctors-nursing` | **Operational** |
| **7** | Laboratory & Diagnostics | `/staff/laboratory` | **Operational** |
| **8** | Radiology & Imaging | `/staff/radiology` | **Operational** |
| **9** | Pharmacy Formulary & Dispensing | `/staff/pharmacy` | **Operational** |
| **10** | Inventory & Procurement | `/staff/inventory` | **Operational** |
| **11** | OT & ICU Surgical Suite | `/staff/surgery-icu` | **Operational** |
| **12** | Billing & Cashier Services | `/staff/billing` | **Operational** |
| **13** | Insurance & Corporate TPA Claims | `/staff/insurance` | **Operational** |
| **14** | Financial Accounts Directory | `/staff/financial-accounts` | **Operational** |
| **15** | Financial Transactions & Vouchers | `/staff/transactions` | **Operational** |
| **16** | Investment Portfolio Registers | `/staff/investments` | **Operational** |
| **17** | Banking & Bank Reconciliation | `/staff/banking` | **Operational** |
| **18** | Loans & Hospital Liabilities | `/staff/loans` | **Operational** |
| **19** | Accounting & General Ledger | `/staff/general-ledger` | **Operational** |
| **20** | Budgeting & Cash Flow Forecasting | `/staff/budgeting` | **Operational** |
| **21** | Profit & Loss Financial Statements | `/staff/profit-loss` | **Operational** |
| **22** | HR, Shifts & Staff Payroll | `/staff/hr-payroll` | **Operational** |
| **23** | Fixed Assets & Equipment Register | `/staff/assets` | **Operational** |
| **24** | Patient Portal Gateway & Telehealth Hub | `/staff/patient-portal` & `/patient/dashboard` | **Operational** |
| **25** | Clinical & Management Reports | `/staff/reports` | **Operational** |
| **26** | User Directory, Roles & RBAC | `/staff/users-roles` | **Operational** |
| **27** | System Settings & Audit Logs | `/staff/settings-audit` | **Operational** |

---

### 3. Architecture & Modular Structure

```
Hospital/
├── backend/                  # Django 5.1 Modular Monolith Backend
│   ├── apps/
│   │   ├── core/             # Base models, branch masters, patient EMR, audit logging
│   │   ├── authentication/   # Supabase JWT backend, RBAC, financial policies
│   │   ├── clinical/         # Appointments, OPD, IPD, wards, beds, lab, radiology, surgeries
│   │   ├── pharmacy_inventory/# Formulary, batches, FEFO dispensing, procurement, POs, GRNs
│   │   ├── billing_finance/  # Billing, insurance claims, double-entry GL, P&L, investments
│   │   └── operations_hr/    # Shifts, rosters, payroll, fixed assets, OT/ICU suites
│   ├── config/               # Django root settings, WSGI/ASGI, URLs
│   ├── requirements.txt      # Python dependencies
│   └── manage.py
├── frontend/                 # React 19 + TypeScript + Vite Single Page App
│   ├── src/
│   │   ├── components/       # Reusable UI primitives (DataTable, StatCard, Badge, Modal, Input)
│   │   ├── layouts/          # StaffLayout (27 modules) & PatientLayout (patient portal)
│   │   ├── pages/            # 27 Dedicated module views for staff & patient pages
│   │   ├── context/          # AuthContext (Supabase) & BranchContext (Multi-branch selector)
│   │   ├── services/         # Axios API clients & Supabase browser client
│   │   └── App.tsx           # Client router with strict role-guarded routes
│   └── package.json
└── docs/                     # Architectural, setup, and handover documentation
```

---

### 4. Database Configuration & Schema Migrations

* **Database Engine**: PostgreSQL 15+ (Hosted on Supabase or local PostgreSQL).
* **Connection Pooling**:
  * `DATABASE_URL`: Port `6543` (PgBouncer transaction mode for runtime API queries).
  * `DIRECT_URL`: Port `5432` (Direct session mode for executing schema migrations and DDL).
* **Migration Status**:
  * All 31 app migration files are executed and synchronized.
  * Verified via `python manage.py showmigrations`.
* **Database Setup Command**:
  ```bash
  cd backend
  python manage.py migrate
  ```

---

### 5. Authentication, Roles & Row Level Security (RLS)

#### 5.1 Identity Architecture
1. **Supabase Auth (GoTrue)**:
   * Handles user credentials, password encryption (bcrypt), password recovery, and email verification.
   * Eliminates password and credential replication in the Django database.
2. **Backend JWT Verification (`SupabaseAuthentication`)**:
   * Inspects `Authorization: Bearer <token>` on every API request.
   * Validates asymmetric/secret JWT signature and extracts `supabase_uid`.
   * Maps to `UserProfile`, `StaffProfile`, or `PatientProfile` with cached role assignments.

#### 5.2 Role-Based Access Control (RBAC)
* Supported Roles:
  * `SUPER_ADMIN`: Unrestricted administrative and system-wide visibility.
  * `HOSPITAL_ADMIN`: Hospital administrative authority across all operational sections.
  * `BRANCH_MANAGER`: Operational authority scoped to their assigned branch.
  * `DOCTOR`: Clinical encounters, OPD queue, IPD admissions, surgical cases, prescriptions, and EMR.
  * `NURSE`: Vitals recording, nursing notes, MAR administration, bed turnover.
  * `PHARMACIST`: Drug formulary, stock batches, FEFO dispensing, stock adjustments.
  * `LAB_TECHNICIAN` / `PATHOLOGIST`: Investigation orders, barcode lookup, result entry, report release.
  * `RADIOLOGY_TECHNICIAN` / `RADIOLOGIST`: Imaging workflow, scheduling, DICOM/report signoff.
  * `FINANCE_MANAGER` / `ACCOUNTANT`: Invoices, cashier shifts, general ledger, bank reconciliation, P&L.
  * `PATIENT`: Isolated self-service access to own appointments, prescriptions, and invoices.

#### 5.3 Storage Buckets & Policies
* Storage Buckets (All configured as **Private**):
  * `patient-records`: Scoped to `auth.uid() = patient_id` or authorized clinician.
  * `lab-results`: Accessible via signed URLs issued after pathologist release.
  * `prescriptions`: Digital PDFs accessible to patient or dispensing pharmacist.
  * `invoices`: Financial records accessible to billing staff and invoice owner.

---

### 6. Environment Variables Template

All `.env.example` templates contain placeholder values only. Real keys, passwords, and tokens are strictly excluded from source control.

```env
# ------------------------------------------------------------------------------
# Backend (.env)
# ------------------------------------------------------------------------------
DJANGO_SECRET_KEY=replace-with-a-secure-random-key-in-production
DJANGO_DEBUG=False
ALLOWED_HOSTS=yourdomain.com,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:5173

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres.yourprojectref:yourpassword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.yourprojectref:yourpassword@aws-0-ap-south-1.pooler.supabase.com:5432/postgres

# Supabase Identity & API
SUPABASE_URL=https://yourprojectref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
SUPABASE_SECRET_KEY=your-supabase-service-role-key

# Healthcare Defaults
DEFAULT_CURRENCY=INR
TIME_ZONE=Asia/Kolkata

# ------------------------------------------------------------------------------
# Frontend (.env)
# ------------------------------------------------------------------------------
VITE_SUPABASE_URL=https://yourprojectref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

### 7. Installation & Local Development Instructions

#### Prerequisites
* Node.js v20+ LTS
* Python 3.11 or 3.12
* PostgreSQL 15+ (or Supabase project)

#### 1. Setup Backend
```bash
cd backend
python -m venv venv
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On macOS / Linux:
# source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

#### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev -- --host
```
* Frontend: `http://localhost:5173/`
* Backend API: `http://localhost:8000/api/v1/`
* Interactive API Documentation: `http://localhost:8000/api/schema/swagger-ui/`

---

### 8. Production Build & Deployment Instructions

#### 1. Frontend Production Build
```bash
cd frontend
npm run build
```
* **Output**: Production assets in `frontend/dist/`.
* **Performance**: Optimized gzip assets (`dist/assets/index-*.js`, `dist/assets/index-*.css`).
* **Serving**: Serve via Nginx, Caddy, Vercel, or AWS CloudFront/S3.

#### 2. Backend Production Deployment
* **WSGI / ASGI Server**: Run via Gunicorn or Uvicorn:
  ```bash
  gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4 --threads 2
  ```
* **Static Assets**:
  ```bash
  python manage.py collectstatic --noinput
  ```
* **Database Migrations**:
  ```bash
  python manage.py migrate --noinput
  ```

---

### 9. Test Execution & Verification Results

1. **System Health Check**:
   * Command: `python manage.py check`
   * Result: `System check identified no issues (0 silenced)`.
2. **Full Endpoints Test Across All 27 Modules**:
   * Total Endpoints Tested: **104**
   * Total Passed: **104 (100%)**
   * Total Failed: **0 (0%)**
3. **Backend Test Suite (pytest)**:
   * Total Test Cases Collected: **260**
   * Total Passed: **260 (100%)**
   * Total Failed: **0 (0%)**
4. **Frontend TypeScript & Build Verification**:
   * Command: `npm run build`
   * Result: `2095 modules transformed. built in 1.54s (0 TypeScript errors)`.

---

### 10. Known Considerations & Future Enhancements

1. **Payment Gateway Integration**:
   * Razorpay order creation and webhook verification logic implemented in `apps/billing_finance/gateway_views.py`. For live payment capture, ensure merchant credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) are configured in the environment.
2. **DICOM Viewer Integration**:
   * Module 8 (Radiology & Imaging) supports PACS equipment ingestion and metadata tracking. For clinical 3D volumetric rendering, integration with a client-side Cornerstone.js or OHIF viewer is recommended.
3. **SMS / WhatsApp Gateway**:
   * Outbound SMS notifications for portal credentials use pluggable notification handlers. In production, configure Twilio or AWS SNS credentials.
