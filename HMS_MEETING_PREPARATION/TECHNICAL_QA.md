# Hospital Management System (HMS) – Technical Q&A Guide

This document contains 35 likely questions that project evaluators, lead architects, technical directors, and team leads may ask during the project presentation, along with concise, technically accurate answers.

---

## Category 1: Architecture & Technology Stack

### Q1: What is the overall architecture of this Hospital Management System?
**Answer**: It is a cloud-native, decoupled client-server architecture. The frontend is a single-page application built with React 18, TypeScript, and Vite. The backend is an enterprise RESTful API built on Python and Django REST Framework. Data persistence is managed by a cloud PostgreSQL database on Supabase with connection pooling, and deployment is hosted on Render via an infrastructure-as-code Blueprint (`render.yaml`).

### Q2: Why did you choose React + TypeScript for the frontend over plain JavaScript?
**Answer**: In a hospital management system with 27 distinct modules, thousands of medical data points, and strict clinical protocols, TypeScript provides compile-time type safety. It prevents runtime `undefined` errors in critical clinical and billing forms and ensures strict contract consistency between the backend API serializers and frontend component props.

### Q3: Why is Django REST Framework (DRF) suitable for a healthcare backend?
**Answer**: DRF offers enterprise-grade security features out of the box: built-in CSRF protection, SQL injection prevention via the Django ORM, granular custom permission classes for 3D RBAC, robust database migration tooling, and native support for transactional integrity (`transaction.atomic`) which is vital for clinical orders and financial ledgers.

### Q4: How is state managed in the frontend?
**Answer**: Global authentication, active user profile, and active branch context are managed via React Context providers (`AuthContext`, `BranchContext`). Local domain state is maintained via React hooks with real-time API synchronization and polling intervals. Internationalization state is managed globally by `react-i18next`.

### Q5: How do the frontend and backend communicate?
**Answer**: Via HTTPS REST APIs using an Axios HTTP client. An automated request interceptor attaches the user's Supabase JWT Bearer token to every request. A 60-second timeout is configured to handle potential cold-start latencies on containerized hosting tiers.

---

## Category 2: Database & Supabase PostgreSQL

### Q6: Why Supabase PostgreSQL instead of MySQL or MongoDB?
**Answer**: PostgreSQL provides superior ACID compliance, complex foreign key constraints (`ON DELETE RESTRICT`), transactional savepoints, and powerful table inheritance. Supabase provides managed high-availability PostgreSQL on AWS infrastructure with built-in connection pooling (`pooler.supabase.com`), native JWT authentication, and Row-Level Security (RLS).

### Q7: How are database relationships and referential integrity enforced?
**Answer**: Referential integrity is enforced at the PostgreSQL database level using foreign keys. Critical clinical entities (patients, consultations, diagnostic reports, invoices, and general ledger journal vouchers) have `ON DELETE RESTRICT` constraints to prevent accidental cascading deletion of medical or financial history.

### Q8: What happens during offline automated testing if the cloud database is unreachable?
**Answer**: The backend includes a dedicated test configuration (`config/test_settings.py`) that swaps the database engine to an isolated in-memory SQLite database (`:memory:`). This enables all 329 automated unit and integration tests to execute locally in seconds without network dependencies or risking production records.

### Q9: How is multi-branch data isolation handled in the database?
**Answer**: Core tables (`Appointment`, `InpatientAdmission`, `Invoice`, `StockItem`) include a `branch_id` foreign key. The backend queries filter strictly by the user's assigned branch (`where branch_id = user.branch_id`). Any cross-branch query attempted by a role with branch-specific scope is rejected with `HTTP 403 Forbidden`.

### Q10: How are financial figures stored to prevent floating-point rounding errors?
**Answer**: All monetary values, service tariffs, and ledger entries use PostgreSQL `NUMERIC` and Django `DecimalField(max_digits=12, decimal_places=2)`. Floating-point types (`float`, `double`) are strictly prohibited in the financial schema.

---

## Category 3: Security & Role-Based Access Control (RBAC)

### Q11: How does your Role-Based Access Control (RBAC) work?
**Answer**: The system implements a 3D RBAC model evaluating three dimensions on every request:
1. **Role Permission**: Does the user's role possess the action permission flag?
2. **Branch Scope**: Is the resource within the user's assigned branch?
3. **Maker-Checker Separation**: Does the operation involve a sensitive financial or administrative mutation? Self-approval of financial transactions or leave requests is strictly blocked.

### Q12: Can doctors book appointments or issue tokens?
**Answer**: No. Business rules strictly mandate that only Receptionists (and Patients via self-service) can book appointments and generate tokens upon verified payment. Doctors are strictly prohibited from booking appointments (`test_10_doctor_cannot_book_appointments_or_issue_tokens`), ensuring physicians focus exclusively on clinical care and eliminating unbilled walk-in consultations.

### Q13: What permissions does the Branch Manager have?
**Answer**: The Branch Manager has **Strict Read-Only** access. They have full visibility to monitor live operational telemetry across all 14 hospital departments in their assigned branch, but they are blocked (`HTTP 403`) from creating, updating, or deleting any clinical, financial, or staff records.

### Q14: How are passwords and secrets secured?
**Answer**: Passwords are never stored in plaintext; they are hashed using Argon2 / PBKDF2 with SHA-256 salts. Environment variables, database credentials, and secret keys are stored outside the codebase and injected via Render environment secrets. Custom production exception handlers scrub all internal stack traces and secrets before returning API responses.

### Q15: How does the system prevent privilege escalation during user registration?
**Answer**: Public patient self-registration endpoints strictly ignore any client-supplied role parameters and hardcode the assigned role to `PATIENT`. Staff account provisioning is restricted exclusively to authenticated Super Administrators (`test_privilege_escalation_prevention_on_registration`).

---

## Category 4: Clinical Workflows & EMR

### Q16: How does the EMR protect against retroactive alterations of medical notes?
**Answer**: Once a doctor clicks "Sign & Finalize Consultation", the consultation record is cryptographically locked with a digital signature and timestamp. No direct edits are allowed. Any subsequent corrections or clinical updates must be authored as formal, timestamped clinical addendums that reference the original consultation.

### Q17: How does electronic prescription (Rx) integrate with the Pharmacy?
**Answer**: When a doctor signs a prescription in the Doctor Clinical Workspace, the prescription is automatically published to the Pharmacy Formulary Queue. Pharmacists can immediately inspect the prescribed items, verify batch availability, and dispense using First-Expiring, First-Out (FEFO) batch selection.

### Q18: What safety checks occur during medication dispensing?
**Answer**: The dispensing engine verifies that:
1. Requested quantity does not exceed available batch stock (`HTTP 409 Conflict` on insufficient stock).
2. Expired batches cannot be dispensed.
3. Every dispense transaction atomically deducts stock quantity and writes an immutable `StockMovement` audit record.

### Q19: How do panic/critical lab results notify doctors?
**Answer**: When a laboratory technician enters a test value outside physiological panic thresholds (e.g., serum potassium < 2.5 or > 6.5 mmol/L), the system automatically flags the result with an abnormal panic badge and escalates an urgent visual alert directly to the ordering physician's workspace.

### Q20: How does the 4-Point Inpatient Discharge Clearance work?
**Answer**: To release a patient and their bed, four independent clearances must be completed:
1. Clinical Discharge Summary signed by attending Doctor.
2. Nursing Care Clearance (cannula removed, medications completed).
3. Pharmacy Clearance (unopened medications returned and credited).
4. Billing Settlement (advance deposits applied, net balance cleared).
Only when all four are checked does the bed status flip to `CLEANING` for sanitization.

---

## Category 5: Central Pricing & Tariff Governance

### Q21: What is the Hospital Pricing & Tariff Management module?
**Answer**: It is a centralized pricing control system that empowers the authorized Hospital Admin to configure and update charges for hospital services (consultations, bed charges, ICU rates, lab tests, radiology, procedures) across all branches from a single master interface.

### Q22: What happens if the Hospital Admin changes a price (e.g., General Ward bed from ₹1,500 to ₹1,800)?
**Answer**: When committed with `applies_to_all_branches=True`, the Central Tariff Service updates the master rate and automatically propagates the new rate to Branch 1, Branch 2, Branch 3, and all newly created branches simultaneously.

### Q23: Does updating a tariff disrupt existing inpatient bills or past invoices?
**Answer**: No. The system guarantees **Non-Destructive Historic Integrity**. Existing running admissions continue at the daily rate contracted at admission time. Finalized invoices and past receipts remain completely immutable. Only future appointments, tokens, and new inpatient admissions adopt the revised rate.

### Q24: What is the Price Change Impact Preview feature?
**Answer**: Before committing any price revision, the system displays a live comparison card showing: old rate, new rate, absolute difference in ₹, percentage change, and the count and names of all active hospital branches that will receive the update. A mandatory administrative justification reason is required for MCA compliance.

---

## Category 6: Financial & Billing Integrity

### Q25: How do you ensure there is zero fake, seeded, or hardcoded revenue in the system?
**Answer**: All financial metrics, revenue cards, expenses, and net profit figures are calculated via SQL aggregation queries directly over posted, balanced double-entry General Ledger journal vouchers. If no transactions exist for a selected date range, the system displays exact ₹0.00 metrics rather than fabricated numbers.

### Q26: Are patient advance deposits counted as revenue?
**Answer**: No. Following international accounting standards and Indian MCA guidelines, advance deposits collected during admission or appointment booking are credited to a Customer Advance Liability account. They are only recognized as revenue when an actual service invoice is finalized and the deposit is applied against billed charges.

### Q27: How does double-entry bookkeeping work in the General Ledger?
**Answer**: Every financial transaction generates a balanced journal voucher where total debits equal total credits (`sum(debit) == sum(credit)`). If a voucher is unbalanced, the backend rejects it with a validation error. Deletion of posted journal entries is forbidden; corrections must be made via audited reversing journal entries.

### Q28: How does Cashier Shift Reconciliation operate?
**Answer**: When a billing cashier starts their duty, they open a cashier shift. All cash, card, and UPI collections during the shift are tracked. At shift end, the cashier declares physical cash counted, and the system reconciles declared cash against system-recorded collections, flagging any surplus or deficit for finance manager review.

---

## Category 7: Multi-Language & Frontend Accessibility

### Q29: Which languages does the HMS support?
**Answer**: The system supports 5 languages: **English (`en`)**, **Hindi (`hi`)**, **Telugu (`te`)**, **Tamil (`ta`)**, and **Kannada (`kn`)**.

### Q30: Does language switching require a page reload?
**Answer**: No. Selecting a language from the global header immediately calls `i18n.changeLanguage()`, which triggers an instant, reactive re-render of all mounted components across the entire website without refreshing the page.

### Q31: How do you verify dictionary completeness across all languages?
**Answer**: We executed an automated key parity audit (`test_translations_e2e.js`) which verified that all 5 language files (`en.json`, `hi.json`, `te.json`, `ta.json`, `kn.json`) contain exactly **36 top-level domains** and **1,013 leaf keys**, achieving 100% parity with zero missing keys.

### Q32: Are patient names, clinical notes, or medicine brands translated?
**Answer**: No. The system strictly isolates dynamic healthcare data. Patient names, clinical diagnosis notes, doctor designations, drug brand names (e.g., Paracetamol), dosage instructions, currency symbols (₹), and invoice IDs remain in their authentic operational format to prevent clinical misinterpretation.

---

## Category 8: Deployment, Performance & Scalability

### Q33: How is the application deployed on Render?
**Answer**: It is deployed using a declarative Blueprint specification (`render.yaml`):
1. **Backend Web Service**: Python 3.11/3.12 environment running Gunicorn WSGI bound to `$PORT`, executing automated database migrations on deployment (`build.sh`).
2. **Frontend Static Site**: Built with Vite (`npm run build`) and hosted on Render's global CDN with single-page application URL rewriting (`/* -> /index.html`).

### Q34: How does the frontend handle Render free-tier cold starts?
**Answer**: Render's free tier spins down inactive web containers after 15 minutes of inactivity. When a request arrives, the container takes 30-50 seconds to initialize. To prevent premature timeout failures in the client, Axios is configured with a 60-second request timeout (`timeout: 60000`).

### Q35: How would this architecture scale to 50+ hospital branches?
**Answer**:
1. **Database Tier**: Supabase PostgreSQL can be scaled vertically with dedicated compute and pgBouncer connection pooling to handle tens of thousands of concurrent connections.
2. **Application Tier**: The stateless Django Gunicorn backend can be horizontally auto-scaled across multiple worker nodes behind a load balancer.
3. **Frontend CDN**: Static assets are globally cached on Cloudflare/Render edge CDNs, providing sub-50ms latency worldwide regardless of branch count.

