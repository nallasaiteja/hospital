import os
import django
import urllib.request
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile, PatientProfile, StaffStatus
from apps.core.models import Branch, Department
from django.contrib.auth import get_user_model

from django.conf import settings

User = get_user_model()
SUPABASE_URL = os.environ.get('SUPABASE_URL', getattr(settings, 'SUPABASE_URL', ''))
SECRET_KEY = os.environ.get('SUPABASE_SECRET_KEY', getattr(settings, 'SUPABASE_SECRET_KEY', ''))
DEMO_PASSWORD = os.environ.get('DEMO_PASSWORD', 'HospitalDemo@123')

headers = {
    'apikey': SECRET_KEY,
    'Authorization': f'Bearer {SECRET_KEY}',
    'Content-Type': 'application/json'
}

# Fetch existing Supabase users
req = urllib.request.Request(f'{SUPABASE_URL}/auth/v1/admin/users', headers=headers)
with urllib.request.urlopen(req) as resp:
    existing_users = {u['email']: u['id'] for u in json.loads(resp.read().decode()).get('users', [])}

main_branch = Branch.objects.filter(code='AURA-MAIN').first() or Branch.objects.first()
dept_med = Department.objects.filter(code='MED').first() or Department.objects.first()
dept_emer = Department.objects.filter(code='EMER').first() or Department.objects.first()
dept_path = Department.objects.filter(code='PATH').first() or Department.objects.first()
dept_pharm = Department.objects.filter(code='PHARM').first() or Department.objects.first()
dept_fin = Department.objects.filter(code='FIN').first() or Department.objects.first()
dept_fhk = Department.objects.filter(code='FHK').first() or Department.objects.first()

accounts = [
    {
        'email': 'admin.demo@aurahospital.com',
        'first_name': 'Admin',
        'last_name': 'Super',
        'role_enum': RoleEnum.SUPER_ADMIN,
        'department': dept_med,
        'emp_id': 'EMP-ADM-001',
        'designation': 'Hospital Chief Administrator',
        'is_staff': True,
    },
    {
        'email': 'doctor.demo@aurahospital.com',
        'first_name': 'Ananya',
        'last_name': 'Deshmukh',
        'role_enum': RoleEnum.DOCTOR,
        'department': dept_med,
        'emp_id': 'EMP-DOC-001',
        'designation': 'Senior Consultant - Internal Medicine',
        'is_staff': True,
    },
    {
        'email': 'nurse.demo@aurahospital.com',
        'first_name': 'Mary',
        'last_name': 'Joseph',
        'role_enum': RoleEnum.NURSE,
        'department': dept_emer,
        'emp_id': 'EMP-NUR-001',
        'designation': 'Head Nursing Officer',
        'is_staff': True,
    },
    {
        'email': 'receptionist.demo@aurahospital.com',
        'first_name': 'Ramu',
        'last_name': 'Govind',
        'role_enum': RoleEnum.RECEPTIONIST,
        'department': dept_fhk,
        'emp_id': 'EMP-REC-001',
        'designation': 'Chief Front Desk Executive',
        'is_staff': True,
    },
    {
        'email': 'lab.demo@aurahospital.com',
        'first_name': 'Rajesh',
        'last_name': 'Kumar',
        'role_enum': RoleEnum.LAB_TECHNICIAN,
        'department': dept_path,
        'emp_id': 'EMP-LAB-001',
        'designation': 'Senior Pathologist & Lab Tech',
        'is_staff': True,
    },
    {
        'email': 'pharmacist.demo@aurahospital.com',
        'first_name': 'Kavita',
        'last_name': 'Reddy',
        'role_enum': RoleEnum.PHARMACIST,
        'department': dept_pharm,
        'emp_id': 'EMP-PHR-001',
        'designation': 'Lead Pharmacist & Formulary Head',
        'is_staff': True,
    },
    {
        'email': 'finance.manager@aurahospital.com',
        'first_name': 'Meenakshi',
        'last_name': 'Sundaram',
        'role_enum': RoleEnum.FINANCE_MANAGER,
        'department': dept_fin,
        'emp_id': 'EMP-FIN-001',
        'designation': 'Head of Finance & Accounts',
        'is_staff': True,
    },
    {
        'email': 'patient.demo@aurahospital.com',
        'first_name': 'Rahul',
        'last_name': 'Sharma',
        'role_enum': RoleEnum.PATIENT,
        'is_staff': False,
    },
]

for acc in accounts:
    email = acc['email']
    first_name = acc['first_name']
    last_name = acc['last_name']
    role_enum = acc['role_enum']
    
    # 1. Ensure in Supabase
    if email in existing_users:
        uid = existing_users[email]
        update_url = f'{SUPABASE_URL}/auth/v1/admin/users/{uid}'
        body = json.dumps({'password': DEMO_PASSWORD, 'email_confirm': True}).encode()
        r = urllib.request.Request(update_url, headers=headers, data=body, method='PUT')
        with urllib.request.urlopen(r) as resp:
            pass
        print(f'Supabase updated password for: {email}')
    else:
        create_url = f'{SUPABASE_URL}/auth/v1/admin/users'
        body = json.dumps({
            'email': email,
            'password': DEMO_PASSWORD,
            'email_confirm': True,
            'user_metadata': {'first_name': first_name, 'last_name': last_name, 'role': role_enum.value}
        }).encode()
        r = urllib.request.Request(create_url, headers=headers, data=body, method='POST')
        with urllib.request.urlopen(r) as resp:
            u_data = json.loads(resp.read().decode())
            uid = u_data['id']
            existing_users[email] = uid
        print(f'Supabase created user: {email} ({uid})')

    # 2. Ensure in Django User
    user, _ = User.objects.get_or_create(
        username=str(uid),
        defaults={'email': email, 'is_active': True, 'first_name': first_name, 'last_name': last_name}
    )
    user.set_password(DEMO_PASSWORD)
    user.save()

    # 3. Ensure Role & UserProfile
    role_obj = Role.objects.filter(name=role_enum).first()
    if not role_obj:
        role_obj, _ = Role.objects.get_or_create(name=role_enum, defaults={'display_name': role_enum.value})

    profile, _ = UserProfile.objects.update_or_create(
        supabase_user_id=str(uid),
        defaults={
            'email': email,
            'first_name': first_name,
            'last_name': last_name,
            'role': role_obj,
            'is_active': True,
            'is_verified': True
        }
    )

    # 4. Attach Staff or Patient Profile
    if acc['is_staff']:
        emp_id = acc['emp_id']
        designation = acc['designation']
        StaffProfile.objects.update_or_create(
            user_profile=profile,
            defaults={
                'hospital': main_branch.hospital,
                'branch': main_branch,
                'department': acc['department'],
                'employee_id': emp_id,
                'designation': designation,
                'status': StaffStatus.ACTIVE
            }
        )
        print(f'   Linked Staff Profile: {emp_id} ({designation})')
    else:
        PatientProfile.objects.update_or_create(
            user_profile=profile,
            defaults={
                'primary_branch': main_branch,
                'medical_record_number': 'MRN-2026-DEMO01',
                'gender': 'MALE',
                'status': 'ACTIVE'
            }
        )
        print(f'   Linked Patient Profile: MRN-2026-DEMO01')

print('\nALL DEMO ACCOUNTS READY!')
