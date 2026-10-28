# Hospital Management System (HMS) — Architecture & System Design

## 1. Overview
The Hospital Management System (HMS) is a multi-specialty, multi-branch, enterprise-grade healthcare operations and clinical management platform. It is architected as a **Modular Monolith** with clean domain separation between clinical care, administration, operational workflows, inventory, and double-entry financial accounting.

```
                           +------------------------------------------+
                           |       React + TypeScript + Vite          |
                           |       Tailwind CSS / Lucide UI           |
                           +--------------------+---------------------+
                                                |
                               +----------------+----------------+
                               |                                 |
                     Supabase Auth SDK                Axios / Fetch REST API
                     (Tokens, Sessions)               (Bearer JWT Header)
                               |                                 |
                               v                                 v
                 +---------------------------+     +-------------------------------+
                 |  Supabase Cloud Platform  |     |  Django REST Framework API    |
                 |  - Auth Service (GoTrue)  |<----+  - Supabase JWT Verification  |
                 |  - S3 Storage Buckets     |     |  - RBAC & Branch Scoping      |
                 |  - PostgreSQL Database    |<----+  - Modular Business Logic     |
                 |    (RLS Enabled)          |     |  - Audit Logging Middleware   |
                 +---------------------------+     +-------------------------------+
```

---

## 2. Core Architectural Principles

### 2.1 Modular Monolith
The backend is organized into distinct Django applications under `apps/`, each encapsulating its models, serializers, views, permissions, services, and tests:
- `apps.core`: Core models (Hospital, Branch, Department, AuditLog, BaseUUIDModel).
- `apps.authentication`: Supabase JWT authentication backend, UserProfile, Role-Based Access Control (RBAC), and user provisioning.
- `apps.staff`: Staff profiles, doctor specialties, schedules, and branch assignments.
- `apps.patients`: Patient profiles, emergency contacts, medical IDs, and patient portal isolation.
- `apps.appointments`: Scheduling, queues, slots, and doctor availability.
- `apps.clinical`: Electronic Medical Records (EMR), consultations, diagnoses (ICD-10), and prescriptions.
- `apps.admissions`: Bed allocation, wards, inpatient care, and discharge summaries.
- `apps.laboratory`: Lab test catalog, specimen collection, test orders, and results.
- `apps.pharmacy`: Drug formulary, dispensing, stock batches, and expiry management.
- `apps.inventory`: Multi-branch warehouses, stock adjustments, purchase requisitions, and vendors.
- `apps.billing`: Invoices, tariff masters, receipts, refunds, and payment reconciliation.
- `apps.finance`: General ledger, chart of accounts, journal entries (double-entry), cash/bank, P&L, balance sheets.

### 2.2 Identity & Dual-Portal Authentication
- **Unified Identity Provider**: Supabase Auth manages user credentials, password hashing, MFA, email confirmations, and token issuance.
- **No Password Duplication**: The Django database stores no passwords or hashes. The foreign key `supabase_user_id` links application records to `auth.users(id)`.
- **Dual Portal Separation**:
  1. **Patient Portal**: Public registration, password reset, self-service appointment booking, prescription & lab result access.
  2. **Staff Portal**: **No public signup**. Accounts are strictly provisioned by authorized administrators. Roles and privileges are validated server-side and never trusted from frontend input.
- **JWT Verification**: Every DRF request verifies the Supabase-issued Bearer JWT using either JWKS / asymmetric verification or the project secret key, resolving the authenticated `UserProfile` and enforcing RBAC.

### 2.3 Security & Multi-Tenant Data Isolation
- **Row Level Security (RLS)**: PostgreSQL tables feature RLS policies ensuring that direct Supabase queries strictly adhere to patient ownership and staff branch assignments.
- **Django-Level Permission Classes**: Custom DRF permissions (`IsStaffMember`, `HasRole`, `IsBranchAuthorized`, `IsPatientOwner`) enforce authorization before any database operation executes.
- **Audit Trails**: Every write, status update, clinical record access, and financial entry generates an immutable `AuditLog` entry tracking user ID, IP address, timestamp, action, and payload changes.
- **Financial Invariance**: Double-entry accounting requires balanced debits and credits on every journal entry. Posted transactions are immutable; reversals require explicit contra-entries.

---

## 3. Technology Stack Summary

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, TypeScript, Vite | High-performance SPA with type safety |
| **Styling** | Tailwind CSS v4, Lucide React | Modern, responsive healthcare UI |
| **Backend** | Python 3.12, Django 5.1, DRF | Robust enterprise business logic & APIs |
| **Database** | PostgreSQL 15+ (Supabase) | ACID compliance, JSONB, Row Level Security |
| **Auth** | Supabase Auth (GoTrue) | OAuth/Email/Password/MFA token engine |
| **API Docs** | drf-spectacular (OpenAPI 3 / Swagger) | Interactive API exploration & schema contracts |
| **Storage** | Supabase Storage (S3-compatible) | Private encrypted medical records & documents |
| **Containers** | Docker, Docker Compose | Reproducible multi-service deployment |
