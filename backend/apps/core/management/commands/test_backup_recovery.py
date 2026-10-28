"""
Management command to execute and verify database backup restoration.
Section 23: Security & Compliance.
Usage: python manage.py test_backup_recovery
"""

from django.core.management.base import BaseCommand
from apps.core.backup_recovery_service import BackupRecoveryService


class Command(BaseCommand):
    help = 'Generates a database backup snapshot and runs automated safe restoration verification.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("1. Generating database snapshot and cryptographic checksum..."))
        archive = BackupRecoveryService.generate_backup_archive(
            requested_by='cli_admin@aurahms.org',
            notes='CLI automated recovery verification'
        )

        metadata = archive['metadata']
        self.stdout.write(self.style.SUCCESS(f"   Backup Created: {metadata['backup_id']}"))
        self.stdout.write(f"   Total Records Archived: {metadata['total_records_archived']}")
        self.stdout.write(f"   SHA-256 Checksum: {metadata['sha256_checksum']}")

        self.stdout.write(self.style.NOTICE("2. Executing safe, non-destructive restoration verification..."))
        result = BackupRecoveryService.verify_backup_restoration_safe(archive)

        if result['status'] == 'VERIFIED':
            self.stdout.write(self.style.SUCCESS(f"   Restoration Status: {result['status']}"))
            self.stdout.write(f"   Checksum Valid: {result['checksum_valid']}")
            self.stdout.write(f"   Referential Integrity: {result['referential_integrity']}")
            self.stdout.write(f"   RTO Target: {result['recovery_time_objective_target']}")
            self.stdout.write(f"   RPO Target: {result['recovery_point_objective_target']}")
            self.stdout.write(self.style.SUCCESS("All backup restoration checks PASSED."))
        else:
            self.stdout.write(self.style.ERROR(f"   Restoration Status: {result['status']}"))
            self.stdout.write(self.style.ERROR("Restoration verification encountered issues."))
