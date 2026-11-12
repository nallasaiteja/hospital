# -*- coding: utf-8 -*-
"""Part 6: Technical Architecture in Simple English"""

def get_part6():
    return """# PART 6: Technical Architecture in Simple English

You do not need a computer science degree to understand how AURA HMS operates behind the scenes. Below is the complete internal architecture explained using simple, real-world analogies.

---

### The Three-Tier Architecture

```
   ┌─────────────────────────────────────────────────────────┐
   │            FRONTEND (Client Browser / React)             │
   │  - Patient Registration Forms  - Live Queue Boards      │
   │  - Doctor EMR Workspace        - Billing Cashier Desk   │
   └────────────────────────────┬────────────────────────────┘
                                │  HTTPS REST API Requests
                                │  JSON Web Tokens (JWT)
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │             BACKEND (Django REST Framework)              │
   │  - Role-Based Access Control   - FEFO Inventory Engine  │
   │  - Double-Entry General Ledger - Multi-Branch Security  │
   └────────────────────────────┬────────────────────────────┘
                                │  Encrypted SQL Queries
                                │  ACID Transactions
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │             DATABASE (Supabase PostgreSQL 15)           │
   │  - Patients Table              - Appointments Table     │
   │  - Bed Census Table            - General Ledger Table   │
   └─────────────────────────────────────────────────────────┘
```

---

### 1. React Frontend (The Hospital Interior & Furniture)
- **What it is:** React is an open-source user interface library developed by Meta (Facebook). In AURA HMS, it powers everything you see on the screen: buttons, modals, dropdowns, tables, and color-coded cards.
- **Why we use it:** Instead of reloading the entire web page every time you click a button, React updates only the small part of the screen that changed. When a new patient books an appointment, only that single row in the queue table updates instantly in 0.05 seconds.
- **Real-World Analogy:** A smart whiteboard in the hospital lobby where only the new token number is erased and rewritten, rather than tearing down the entire wall.

---

### 2. TypeScript (The Strict Medical Checklist)
- **What it is:** TypeScript is a programming language that adds strict types and rules on top of JavaScript.
- **Why we use it:** In a hospital, a computer error can be fatal. If a software bug accidentally puts a patient's age (`28`) into their blood pressure field (`120/80`), a doctor could make a wrong clinical decision. TypeScript catches these mistakes while the software is being built, preventing crashes and data corruption before the code ever reaches the hospital.
- **Real-World Analogy:** A strict surgical nurse who double-checks that the surgeon has the exact right scalpel in hand before the operation begins.

---

### 3. Backend Architecture: Django REST Framework (The Hospital Superintendent's Office)
- **What it is:** Django is a high-security Python web framework used by organizations like Instagram, Spotify, and NASA. Django REST Framework (DRF) turns it into a high-speed API engine.
- **Why we use it:** It processes all hospital business logic: checking doctor availability, verifying user passwords, calculating taxes on bills, running FEFO inventory allocations, and enforcing legal compliance.
- **Real-World Analogy:** The administrative headquarters behind closed doors that verifies staff credentials and approves official paperwork before it gets filed.

---

### 4. Database: Supabase PostgreSQL (The Fireproof Central Medical Vault)
- **What it is:** PostgreSQL is one of the most reliable and advanced open-source relational databases in the world. Supabase provides managed PostgreSQL with real-time replication and encryption.
- **Why we use it:** Medical and financial data must never be lost. PostgreSQL guarantees **ACID Compliance** (Atomicity, Consistency, Isolation, Durability). If power cuts out in the middle of saving a ₹50,000 billing payment, the database rolls back safely so money is never recorded half-way.
- **Real-World Analogy:** A fireproof, bank-grade physical records vault where every medical file and financial voucher is locked in indexed steel drawers.

---

### 5. Database Tables & Relational Structure
Information is not stored in one giant spreadsheet. It is split into organized, specialized tables that link to one another using **Foreign Keys**:

| Table Name | Real-World Content | Links To (Foreign Keys) |
| :--- | :--- | :--- |
| `core_patientprofile` | Patient name, DOB, phone, blood group, MRN | `core_branch` |
| `clinical_appointment` | Token #, appointment date, timeslot, status | `core_patientprofile`, `staff_staffprofile`, `core_branch` |
| `clinical_inpatientadmission` | Admitted patient, ward, bed, deposit, discharge | `core_patientprofile`, `clinical_bed`, `staff_staffprofile` |
| `clinical_prescription` | Doctor notes, signed e-Rx, diagnosis | `clinical_appointment`, `core_patientprofile` |
| `pharmacy_stockbatch` | Medicine batch code, quantity on hand, expiry date | `pharmacy_medication`, `inventory_warehouse` |
| `billing_invoice` | Gross bill, advance deposits, balance due, GST | `core_patientprofile`, `clinical_inpatientadmission` |
| `billing_journalentry` | Double-entry debits, credits, voucher narration | `billing_chartofaccount`, `core_branch` |
| `core_auditlog` | Immutable record of who modified what and when | `authentication_customuser`, `core_branch` |

---

### 6. Authentication & JSON Web Tokens (The Digital Security Badge)
- **What it is:** When a staff member types their email and password, the backend verifies their credentials and issues a secure, encrypted digital passport called a **JSON Web Token (JWT)**.
- **How it works:**
  1. Login generates an `access_token` (lasts 60 minutes) and a `refresh_token` (lasts 7 days).
  2. Every time your browser opens a screen or clicks a button, it sends this token in the background: `Authorization: Bearer <token>`.
  3. The server inspects the token: if you are a Doctor, it lets you view the prescription pad; if you are a Receptionist, it lets you book appointments.
- **Real-World Analogy:** An electronic RFID keycard hanging on your lab coat that beeps to unlock only the doors you are authorized to enter.

---

### 7. Role-Based Access Control (RBAC) & The Permission Guard
- **What it is:** The security logic that inspects your assigned role and matches it against the **RBAC Permission Matrix**.
- **How it works:**
  - In React: `<ProtectedRoute allowedRoles={['DOCTOR', 'NURSE']}>` prevents unauthorized screens from ever rendering.
  - In Django: `permission_classes = [IsAuthorizedClinician]` blocks unauthorized API requests with `403 Forbidden` even if someone tries to hack the network.
- **Real-World Analogy:** A security guard standing outside the operating theatre who checks your ID badge before letting you inside.

---

### 8. Row Level Security (RLS) & Multi-Branch Isolation
- **What it is:** A database rule that filters data row-by-row based on your current hospital branch.
- **How it works:** When the West Wing clinic requests patient records, the database automatically appends `WHERE branch_id = 'west-wing-uuid'`, completely hiding records belonging to Downtown or City Center campuses.
- **Real-World Analogy:** Soundproof walls between clinic rooms so secrets discussed in Room A can never be overheard in Room B.

---

### 9. REST APIs & HTTP Verbs (The Digital Messengers)
- **What it is:** Standard web protocols used by the frontend to talk to the backend:
  - `GET`: "Please fetch the list of patients."
  - `POST`: "Please create a new appointment and save it."
  - `PUT / PATCH`: "Please update Rahul's phone number."
  - `DELETE`: "Please cancel this reservation."
- **Real-World Analogy:** A pneumatic tube capsule carrying an order chit from the nurse's station down to the central pharmacy.

---

### 10. Real-Time Data Updates & LiveSync (The Digital Hospital Radio)
- **What it is:** Background synchronization using polling intervals and WebSockets.
- **Why we use it:** When a doctor in Cabin 102 clicks "Call Patient", the Waiting Lounge TV mounted 50 meters away in the lobby rings its chime and updates its display in under 300 milliseconds without anyone pressing refresh.
- **Real-World Analogy:** A two-way hospital walkie-talkie where urgent news is broadcast to everyone simultaneously.

---

### 11. Security, Encryption & Cryptographic Audit Trails
- **Passwords:** Passwords are never stored as plain text. They are hashed using **PBKDF2 with SHA-256**, turning `DoctorSecret123` into an irreversible mathematical string: `pbkdf2_sha256$260000$x9...`.
- **In-Transit Encryption:** All communications use **HTTPS / TLS 1.3** with 256-bit encryption, making it impossible for network eavesdroppers to steal patient data.
- **Immutable Audit Logging:** PostgreSQL database triggers block any user or administrator from executing `DELETE` statements on the `core_auditlog` table, guaranteeing tamper-proof legal protection.
"""

