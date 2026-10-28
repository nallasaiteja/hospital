# Supabase Setup & Configuration Guide

This document provides step-by-step instructions for creating and connecting your Supabase project with the Hospital Management System (HMS).

---

## 1. Create a Supabase Project

1. Navigate to [Supabase](https://supabase.com) and log in or create an account.
2. Click **"New Project"**.
3. Fill in the project details:
   - **Name**: `HMS-Hospital-Core` (or your preferred name)
   - **Database Password**: Choose a strong password and save it securely.
   - **Region**: Choose the region closest to your deployment (e.g., `South Asia (Mumbai)` for India / `Asia/Kolkata` timezone).
   - **Pricing Plan**: Free or Pro tier.
4. Click **"Create new project"** and wait 1–2 minutes for the database to provision.

---

## 2. Obtain Connection Strings & API Keys

### 2.1 Database Connection Strings
1. In your project dashboard, navigate to **Project Settings** (gear icon on bottom left) -> **Database**.
2. Scroll to the **Connection string** section:
   - **Direct Connection** (Session mode on Port `5432`):
     ```
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
     ```
     Copy this as `DIRECT_URL` (used for Django schema migrations).
   - **Transaction Pooler Connection** (Transaction mode on Port `6543`):
     ```
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
     ```
     Copy this as `DATABASE_URL` (used for standard application runtime queries).

### 2.2 API Keys & URL
1. Navigate to **Project Settings** -> **API**.
2. Copy the following values:
   - **Project URL**: `https://[PROJECT-REF].supabase.co` -> `SUPABASE_URL` and `VITE_SUPABASE_URL`
   - **Project API Keys**:
     - `anon` / `public`: Copy as `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
     - `service_role` (Secret): Copy as `SUPABASE_SECRET_KEY` (**Never share this or expose it in frontend code**).

---

## 3. Configure Supabase Authentication

1. In the Supabase sidebar, click **Authentication** -> **Providers**.
2. Click **Email**:
   - Ensure **Enable Email provider** is turned **ON**.
   - **Confirm email**: Enable in production; can be turned off during local development if testing without SMTP.
   - **Secure email change**: Enabled.
3. Under **Authentication** -> **URL Configuration**:
   - Set **Site URL** to `http://localhost:5173` (or your production frontend domain).
   - Add **Redirect URLs**:
     - `http://localhost:5173/**`
     - `http://localhost:5173/auth/reset-password`
     - `http://localhost:5173/patient/verify-email`

---

## 4. Setup Private Storage Buckets

Medical documents, lab reports, and radiological images must be stored in private buckets accessible only via signed URLs or authenticated proxy endpoints.

1. In the Supabase sidebar, click **Storage**.
2. Click **"New Bucket"** and create the following buckets:
   - `patient-records` (Private)
   - `lab-results` (Private)
   - `prescriptions` (Private)
   - `invoices` (Private)
3. Ensure the **"Public bucket"** toggle is set to **OFF** for all healthcare storage buckets.

---

## 5. Row Level Security (RLS) Policies

All healthcare tables have PostgreSQL RLS enabled. Policies are applied automatically via Django migrations or SQL scripts:
- **Patients**: Can select and insert records where `auth.uid() = patient.supabase_user_id`.
- **Staff**: Can view and manage patient records matching their assigned hospital branch, verified via their active `staff_profile.branch_id`.
- **Service Role**: Backend API service-role key has full administrative access for background processing and reconciliation.

---

## 6. Database Backup & Restore

### Automated Backups
- Supabase performs daily automated backups (retained for 7 days on Pro, 1 day on Free).

### Manual CLI Backup (pg_dump)
To export the complete schema and data:
```bash
pg_dump "postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres" \
  --clean --if-exists --no-owner --no-privileges -F p -f hms_backup_$(date +%Y%m%d).sql
```

### Restore from Backup (psql)
```bash
psql "postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres" \
  < hms_backup_YYYYMMDD.sql
```
