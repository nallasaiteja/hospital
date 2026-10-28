from django.db import migrations

RLS_SQL = """
-- 0. Ensure auth schema and auth.uid() function exist (standard in Supabase, stub for test runner)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
    SELECT NULL::uuid;
$$ LANGUAGE sql STABLE;

-- 1. Enable RLS on core tables
ALTER TABLE hms_hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hms_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE hms_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hms_audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Policies for Facilities (Hospitals, Branches, Departments)
-- Allow authenticated users to view active hospitals, branches, and departments
DROP POLICY IF EXISTS "Allow authenticated read on hospitals" ON hms_hospitals;
CREATE POLICY "Allow authenticated read on hospitals" ON hms_hospitals
    FOR SELECT TO authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS "Allow authenticated read on branches" ON hms_branches;
CREATE POLICY "Allow authenticated read on branches" ON hms_branches
    FOR SELECT TO authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS "Allow authenticated read on departments" ON hms_departments;
CREATE POLICY "Allow authenticated read on departments" ON hms_departments
    FOR SELECT TO authenticated
    USING (is_active = true);

-- 3. Audit Logs RLS
-- Audit logs can only be read by authorized personnel, never updated or deleted
DROP POLICY IF EXISTS "Staff branch audit logs view" ON hms_audit_logs;
CREATE POLICY "Staff branch audit logs view" ON hms_audit_logs
    FOR SELECT TO authenticated
    USING (
        actor_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM hms_user_profiles u
            JOIN hms_roles r ON u.role_id = r.id
            WHERE u.supabase_user_id = auth.uid()
            AND r.name IN ('SUPER_ADMIN', 'BRANCH_MANAGER')
        )
    );
"""

REVERSE_RLS_SQL = """
ALTER TABLE hms_hospitals DISABLE ROW LEVEL SECURITY;
ALTER TABLE hms_branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE hms_departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE hms_audit_logs DISABLE ROW LEVEL SECURITY;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        ('authentication', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql=RLS_SQL,
            reverse_sql=REVERSE_RLS_SQL
        ),
    ]
