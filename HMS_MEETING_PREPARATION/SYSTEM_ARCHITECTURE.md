# Hospital Management System (HMS) – System Architecture

## 1. High-Level Architecture Overview
The AURA Hospital Management System is built on a decoupled, cloud-native client-server architecture designed for reliability, strict data isolation, and high clinical responsiveness.

```mermaid
graph TB
    subgraph ClientTier["Client Tier (Presentation Layer)"]
        BrowserStaff["Staff Workstations & Tablets\n(React 18 + TS + Vite)"]
        BrowserPatient["Patient Mobile Portal\n(PWA / Responsive Web)"]
        WallDisplays["Waiting Lounge Digital Displays\n(Real-Time Token Display / Audio Chime)"]
    end

    subgraph GatewayTier["Network & Gateway Tier"]
        Cloudflare["Cloudflare CDN & SSL Termination"]
        RenderRouter["Render Edge Ingress & Reverse Proxy"]
    end

    subgraph ApplicationTier["Application Tier (Compute Layer)"]
        Gunicorn["Gunicorn WSGI Application Server"]
        DRF["Django REST Framework Backend\n(apps: clinical, billing, auth, hr, etc.)"]
        AuthMiddleware["JWT Authentication & RBAC Enforcement"]
        TariffEngine["Central Tariff Management Service"]
        AuditMiddleware["Forensic MCA Audit Logging Engine"]
    end

    subgraph DataTier["Data & Persistence Tier"]
        SupabasePostgres[("Supabase PostgreSQL Database\n(Hosted on AWS ap-south-1)")]
        RLSPolicies["Row-Level Security (RLS) & Foreign Key Constraints"]
        MediaStorage["Encrypted Object Storage (Reports, Documents)"]
    end

    BrowserStaff --> Cloudflare
    BrowserPatient --> Cloudflare
    WallDisplays --> Cloudflare
    Cloudflare --> RenderRouter
    RenderRouter --> Gunicorn
    Gunicorn --> DRF
    DRF --> AuthMiddleware
    AuthMiddleware --> TariffEngine
    DRF --> AuditMiddleware
    TariffEngine --> SupabasePostgres
    AuditMiddleware --> SupabasePostgres
    DRF --> RLSPolicies
    RLSPolicies --> SupabasePostgres
    DRF --> MediaStorage
```

---

## 2. Technology Stack Breakdown

| Layer | Technology | Version | Key Libraries & Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend** | React + TypeScript | React 18.3, TS 5.6 | Single Page Application (SPA), type safety, custom hooks. |
| | Vite | Vite 8.3 | Ultra-fast bundling, HMR, production minification (`rolldown`). |
| | Styling | Tailwind CSS v4 | Utility-first CSS, clean healthcare white-background UI design. |
| | Icons | Lucide React | Modern clinical & operational vector icon set. |
| | Internationalization | i18next + react-i18next | Dynamic 5-language UI switching (`en`, `hi`, `te`, `ta`, `kn`). |
| | Networking | Axios | Axios instance with JWT interceptor and 60s cold-start timeout. |
| **Backend** | Python | 3.11 / 3.12 | Core programming environment. |
| | Django | 5.1.15 | Enterprise web framework, ORM, migrations, security middleware. |
| | REST Framework | DRF 3.15 | Serializers, ViewSets, API routing, pagination, error handlers. |
| | Database Driver | psycopg3 | PostgreSQL 3 client with binary protocol and pooling. |
| | Payment Gateway | Razorpay SDK | Cryptographic HMAC-SHA256 signature verification & webhooks. |
| **Database** | PostgreSQL (Supabase) | 15.x | High-performance relational database with RLS & pooling. |
| | In-Memory Testing | SQLite 3 | `:memory:` SQLite backend for isolated unit testing. |
| **Deployment** | Render.com | Blueprint v1 | Web Service (Python) + Static Site (Vite) via `render.yaml`. |

---

## 3. Data Isolation & Branch Multitenancy Architecture
The system supports multiple physical branches (e.g., AURA Central Multi-Specialty, Suburban Branch, East Annex) under a unified corporate schema:

1. **Branch Association**:
   - Primary operational records (`Appointment`, `InpatientAdmission`, `Invoice`, `LaboratoryOrder`, `StockItem`) include a direct foreign key to `Branch`.
2. **Branch Manager Scoping**:
   - Users with the `BRANCH_MANAGER` role are locked to their assigned `branch_id`. Queries strictly filter `where branch_id = user.branch_id`.
   - Any query attempting to access another branch's records is rejected with `HTTP 403 Forbidden`.
3. **Multi-Branch Governance Roles**:
   - `SUPER_ADMIN`, `HOSPITAL_ADMIN`, and `INVESTMENT_MANAGER` possess global multi-branch authority and can toggle branch scopes dynamically or execute network-wide operations.

---

## 4. Centralized Tariff & Dynamic Pricing Architecture
Centralized tariff governance allows the Hospital Admin to control pricing across the entire hospital chain from a single master configuration:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Hospital Admin
    participant UI as Hospital Pricing UI
    participant CentralService as Central Tariff Service
    participant MasterTariff as Master Tariff Table
    participant Branches as Branch Service Rate Tables
    actor Patient as Receptionist / Patient

    Admin->>UI: Update Consultation Fee (e.g., ₹500 -> ₹600)
    UI->>CentralService: preview_price_change()
    CentralService-->>UI: Impact Preview (Difference: +₹100, 3 Branches Affected)
    Admin->>UI: Commit Price Across Branches
    UI->>CentralService: update_service_price(applies_to_all_branches=True)
    CentralService->>MasterTariff: Update Standard Rate & Append PriceChangeHistory
    CentralService->>Branches: Propagate Synchronized Rates to All Active Branches
    CentralService-->>UI: Success Notification (100% Dynamic Synced)
    Patient->>CentralService: Book Appointment / Register Token
    CentralService-->>Patient: Charges Applied at Synchronized Rate (₹600)
```

**Non-Destructive Historic Safeguard**:
Existing running admissions, finalized invoices, and completed receipts reference the historical rate locked at invoice generation time. Ongoing admissions continue at their admission-date tariff. Future appointments, tokens, and new inpatient admissions immediately reflect the updated rate.

---

## 5. Security & Authentication Architecture

### A. JWT Authentication & Bearer Tokens
1. User logs in with email and password via Supabase Auth or DRF login endpoint.
2. An asymmetric JWT token containing user identity and expiration claims is issued.
3. Every subsequent HTTP request delivers the token in the `Authorization: Bearer <token>` header.
4. Django DRF authentication middleware validates the cryptographic signature and extracts the active `User` and `StaffProfile`.

### B. 3D Role-Based Access Control (RBAC)
Access control evaluates three dimensions:
- **Role Permission**: Does the user's role possess the action flag (e.g., `can_issue_prescription`)?
- **Branch Scope**: Is the target resource within the user's assigned branch?
- **Maker-Checker Separation**: Does the operation involve a sensitive financial or administrative mutation? Self-approval of invoices, loans, or leave requests is strictly blocked by the system.

### C. Row-Level Security (RLS) & Foreign Key Constraints
- Supabase PostgreSQL models enforce referential integrity (`ON DELETE RESTRICT` for patient medical records and financial journals).
- Patient records cannot be viewed by other patients (`IsPatientOwner` policy).
- MCA audit trails are tamper-evident: `PriceChangeHistory` and `SecurityAuditEvent` records are append-only; update and delete operations are rejected at the database level.

