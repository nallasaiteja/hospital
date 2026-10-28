# Multi-Specialty Hospital Management System (HMS)

An enterprise-grade, multi-specialty, multi-branch Hospital Management System built from scratch with a **Modular Monolith** architecture. Designed for clinical rigor, patient security, and double-entry financial fidelity.

---

## Key Features

- **Dual-Portal Architecture**:
  - **Patient Portal**: Self-registration, appointment booking, clinical consultation history, digital prescriptions, lab reports, and invoice payments.
  - **Staff Portal**: Strict invite-only/administrator-provisioned accounts for Doctors, Nurses, Receptionists, Pharmacists, Lab Techs, Accountants, Branch Managers, and Super Admins.
- **Unified Identity via Supabase Auth**:
  - Secure email/password authentication, password recovery, and email verification.
  - No credential replication in application databases.
  - Asymmetric/secret JWT verification on every backend Django REST Framework endpoint.
- **Clinical & Operations Engine**:
  - Doctor schedules & appointment queue management.
  - Electronic Medical Records (EMR), ICD-10 diagnostic codes, and structured digital prescriptions.
  - Inpatient admissions, ward/bed occupancy, and discharge summaries.
  - Laboratory order tracking, specimen management, and report attachments via private storage.
  - Pharmacy formulary, batch tracking, expiry monitoring, and stock dispensing.
- **Double-Entry Financial Accounting**:
  - Strict debit/credit invariance across chart of accounts.
  - General ledger, cash/bank transactions, income/expense categorization.
  - Real-time P&L statement, balance sheet, and revenue analytics.
  - Immutable posted transactions with explicit reversal workflows.
- **Enterprise Security & Compliance**:
  - PostgreSQL Row Level Security (RLS) policies.
  - Role-Based Access Control (RBAC) and branch data scoping.
  - Immutable audit logs tracking all critical reads and writes.
  - Private Supabase Storage buckets for sensitive medical documents.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Axios.
- **Backend**: Python 3.12, Django 5.1, Django REST Framework.
- **Database**: PostgreSQL 15+ (Hosted on Supabase).
- **Authentication**: Supabase Auth (GoTrue) + DRF JWT Authentication Backend.
- **API Documentation**: OpenAPI 3.0 / Swagger UI via `drf-spectacular`.
- **Background Tasks**: Celery + Redis.
- **Testing**: pytest, pytest-django, and Playwright.

---

## Directory Structure

```
Hospital/
├── backend/                  # Django REST Framework backend
│   ├── apps/                 # Modular domain applications
│   │   ├── core/             # Base models, audit logging, hospital/branch masters
│   │   ├── authentication/   # Supabase JWT authentication & RBAC
│   │   ├── staff/            # Staff profiles & doctor specialties
│   │   ├── patients/         # Patient profiles & portal scoping
│   │   ├── appointments/     # Scheduling & queues
│   │   ├── clinical/         # Consultations & prescriptions
│   │   ├── admissions/       # Beds & inpatient management
│   │   ├── laboratory/       # Lab orders & results
│   │   ├── pharmacy/         # Drug catalog & dispensing
│   │   ├── inventory/        # Multi-branch stock & procurement
│   │   ├── billing/          # Invoices & receipts
│   │   └── finance/          # General ledger & accounting
│   ├── config/               # Django project settings & URL routing
│   ├── requirements.txt      # Python dependencies
│   ├── manage.py             # Django CLI
│   └── Dockerfile            # Backend container configuration
├── frontend/                 # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/       # Reusable accessible UI components
│   │   ├── layouts/          # Portal layouts (Patient, Staff, Public)
│   │   ├── pages/            # Page views for portals
│   │   ├── services/         # Supabase client & Axios API handlers
│   │   ├── types/            # TypeScript domain interfaces
│   │   ├── App.tsx           # Router configuration
│   │   └── main.tsx          # Application entrypoint
│   ├── package.json          # Node dependencies
│   └── Dockerfile            # Frontend container configuration
├── docs/                     # Engineering documentation
│   ├── ARCHITECTURE.md       # Modular monolith system design
│   ├── SUPABASE_SETUP.md     # Cloud database & auth setup guide
│   └── DEVELOPMENT_GUIDE.md  # Local setup & testing instructions
├── docker-compose.yml        # Multi-container orchestration
├── .gitignore                # Git ignore rules
└── .env.example              # Environment variables template
```

---

## Getting Started

Refer to [docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md) for detailed installation and execution instructions.
