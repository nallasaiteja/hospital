from django.test import SimpleTestCase
from django.db import IntegrityError, DatabaseError
from rest_framework.exceptions import (
    ValidationError,
    PermissionDenied,
    NotFound,
    NotAuthenticated,
)
from rest_framework.test import APIRequestFactory
from apps.core.exceptions import custom_exception_handler


class ErrorHandlingTestSuite(SimpleTestCase):
    """
    Exhaustive verification of the enterprise exception handler,
    database constraint translation, and sensitive data protection.
    """

    def setUp(self):
        self.factory = APIRequestFactory()
        self.request = self.factory.get('/api/v1/test/')
        self.context = {'request': self.request, 'view': 'TestView'}

    def test_unique_constraint_violation(self):
        exc = IntegrityError('duplicate key value violates unique constraint "unique_patient_mrn"')
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.data['code'], 'DUPLICATE_RECORD')
        self.assertIn('already exists', resp.data['error'])

    def test_foreign_key_violation(self):
        exc = IntegrityError('violates foreign key constraint "fk_doctor_id"')
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data['code'], 'FOREIGN_KEY_VIOLATION')
        self.assertIn('referenced by other hospital records', resp.data['error'])

    def test_not_null_violation(self):
        exc = IntegrityError('null value in column "blood_group" violates not-null constraint')
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data['code'], 'MISSING_REQUIRED_FIELD')

    def test_database_connection_failure(self):
        exc = DatabaseError('could not connect to server: Connection refused')
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, 503)
        self.assertEqual(resp.data['code'], 'DATABASE_UNAVAILABLE')
        self.assertIn('temporarily unavailable', resp.data['error'])

    def test_permission_denied(self):
        exc = PermissionDenied('You do not have permission to view payroll records.')
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.data['code'], 'PERMISSION_DENIED')

    def test_not_found(self):
        exc = NotFound('The requested patient admission was not found.')
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.data['code'], 'NOT_FOUND')

    def test_not_authenticated(self):
        exc = NotAuthenticated('Authentication credentials were not provided.')
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.data['code'], 'AUTHENTICATION_REQUIRED')

    def test_validation_error_field_mapping(self):
        exc = ValidationError({
            'email': ['Enter a valid email address.'],
            'phone_number': ['This field is required.']
        })
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data['code'], 'VALIDATION_ERROR')
        self.assertIn('email', resp.data['field_errors'])
        self.assertIn('phone_number', resp.data['field_errors'])

    def test_unhandled_crash_scrubs_secrets_and_tracebacks(self):
        exc = RuntimeError('Internal crash with authorization token Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.supersecret')
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, 500)
        self.assertEqual(resp.data['code'], 'INTERNAL_SERVER_ERROR')
        self.assertNotIn('supersecret', str(resp.data))
        self.assertNotIn('Traceback', str(resp.data))
        self.assertEqual(
            resp.data['error'],
            'A server error occurred while processing your hospital request. Our engineering team has been notified.'
        )
