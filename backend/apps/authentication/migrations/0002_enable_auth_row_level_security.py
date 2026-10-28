from django.db import migrations

RLS_SQL = """
-- 0. Ensure auth schema and auth.uid() exist
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
    SELECT NULL::uuid;
$$ LANGUAGE sql STABLE;

-- 1. Enable Row Level Security on Authentication & Profile Tables
ALTER TABLE hms_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hms_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hms_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hms_staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hms_patient_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Roles & Permissions read access for all authenticated users
DROP POLICY IF EXISTS "Authenticated users can read roles" ON hms_roles;
CREATE POLICY "Authenticated users can read roles" ON hms_roles
    FOR SELECT TO authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users can read permissions" ON hms_permissions;
CREATE POLICY "Authenticated users can read permissions" ON hms_permissions
    FOR SELECT TO authenticated
    USING (is_active = true);

-- 3. User Profiles Security Policies
-- Users can view their own profile, or staff members can view patient/staff profiles
DROP POLICY IF EXISTS "Users can read own profile" ON hms_user_profiles;
CREATE POLICY "Users can read own profile" ON hms_user_profiles
    FOR SELECT TO authenticated
    USING (
        supabase_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM hms_user_profiles u
            JOIN hms_roles r ON u.role_id = r.id
            WHERE u.supabase_user_id = auth.uid()
            AND r.name IN ('SUPER_ADMIN', 'BRANCH_MANAGER', 'DOCTOR', 'NURSE', 'RECEPTIONIST')
        )
    );

DROP POLICY IF EXISTS "Users can update own profile" ON hms_user_profiles;
CREATE POLICY "Users can update own profile" ON hms_user_profiles
    FOR UPDATE TO authenticated
    USING (supabase_user_id = auth.uid())
    WITH CHECK (supabase_user_id = auth.uid());

-- 4. Staff Profiles Security Policies
-- Anyone authenticated can view active staff (e.g. Doctor directory for booking)
DROP POLICY IF EXISTS "Allow authenticated read on active staff" ON hms_staff_profiles;
CREATE POLICY "Allow authenticated read on active staff" ON hms_staff_profiles
    FOR SELECT TO authenticated
    USING (status = 'ACTIVE');

-- 5. Patient Profiles Security Policies
-- Strict Isolation: Patient can ONLY read their own profile
DROP POLICY IF EXISTS "Patient profile self isolation" ON hms_patient_profiles;
CREATE POLICY "Patient profile self isolation" ON hms_patient_profiles
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM hms_user_profiles u
            WHERE u.id = user_profile_id
            AND u.supabase_user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM hms_user_profiles u
            JOIN hms_roles r ON u.role_id = r.id
            JOIN hms_staff_profiles s ON s.user_profile_id = u.id
            WHERE u.supabase_user_id = auth.uid()
            AND (r.name = 'SUPER_ADMIN' OR s.branch_id = hms_patient_profiles.primary_branch_id)
        )
    );
"""

REVERSE_RLS_SQL = """
ALTER TABLE hms_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE hms_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE hms_user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE hms_staff_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE hms_patient_profiles DISABLE ROW LEVEL SECURITY;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0001_initial'),
        ('core', '0002_enable_row_level_security'),
    ]

    operations = [
        migrations.RunSQL(
            sql=RLS_SQL,
            reverse_sql=REVERSE_RLS_SQL
        ),
    ]
