"""
Automated unit tests for Voice Language Translation API and Gemini Translation Service.
Tests validate authentication, RBAC, input validation, provider mock behavior,
error handling, and security safeguards.
"""

import uuid
import pytest
from unittest.mock import MagicMock, patch
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework import status

from apps.authentication.models import Role, RoleEnum, UserProfile
from apps.voice_translation.services import (
    GeminiTranslationService,
    GeminiNotConfiguredError,
    GeminiQuotaExceededError,
    GeminiTimeoutError,
    TranslationServiceError,
)
from apps.voice_translation.languages import SUPPORTED_LANGUAGES


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_user(db):
    user_uuid = uuid.uuid4()
    user = User.objects.create_user(
        username=str(user_uuid),
        email='staff@aurahms.test',
        password='TestPassword123!',
        is_active=True,
    )
    role, _ = Role.objects.get_or_create(
        name=RoleEnum.DOCTOR,
        defaults={'display_name': 'Doctor'}
    )
    UserProfile.objects.create(
        supabase_user_id=user_uuid,
        role=role,
        email='staff@aurahms.test',
        first_name='Aditi',
        last_name='Rao',
    )
    return user


@pytest.fixture
def patient_user(db):
    patient_uuid = uuid.uuid4()
    user = User.objects.create_user(
        username=str(patient_uuid),
        email='patient@aurahms.test',
        password='TestPassword123!',
        is_active=True,
    )
    role, _ = Role.objects.get_or_create(
        name=RoleEnum.PATIENT,
        defaults={'display_name': 'Patient'}
    )
    UserProfile.objects.create(
        supabase_user_id=patient_uuid,
        role=role,
        email='patient@aurahms.test',
        first_name='Kavya',
        last_name='Reddy',
    )
    return user


@pytest.mark.django_db
class TestVoiceTranslationAPI:
    """Test suite covering the Voice Translation endpoints."""

    def test_unauthenticated_request_rejected(self, api_client):
        """Unauthenticated requests must be rejected with 401 Unauthorized or 403 Forbidden."""
        response = api_client.post(
            '/api/v1/voice-translation/translate/',
            {'text': 'Hello doctor', 'source_language': 'en', 'target_language': 'te'},
            format='json',
        )
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

    def test_unauthenticated_languages_rejected(self, api_client):
        """Unauthenticated requests to languages endpoint must return 401 or 403."""
        response = api_client.get('/api/v1/voice-translation/languages/')
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

    def test_supported_languages_list(self, api_client, auth_user):
        """Authenticated users can retrieve supported languages and capabilities."""
        api_client.force_authenticate(user=auth_user)
        response = api_client.get('/api/v1/voice-translation/languages/')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['status'] == 'success'
        assert data['count'] == 5

        codes = [l['code'] for l in data['languages']]
        assert set(codes) == {'en', 'te', 'hi', 'ta', 'kn'}

        # Verify BCP-47 locale tags are present for STT and TTS
        for lang in data['languages']:
            assert 'stt_locale' in lang
            assert 'tts_locale' in lang
            assert 'gemini_supported' in lang

    def test_validation_empty_and_whitespace_text(self, api_client, auth_user):
        """Empty or whitespace-only text must return 400 bad request."""
        api_client.force_authenticate(user=auth_user)
        
        # Blank text
        res1 = api_client.post(
            '/api/v1/voice-translation/translate/',
            {'text': '', 'source_language': 'en', 'target_language': 'te'},
            format='json',
        )
        assert res1.status_code == status.HTTP_400_BAD_REQUEST

        # Whitespace-only text
        res2 = api_client.post(
            '/api/v1/voice-translation/translate/',
            {'text': '   \n\t  ', 'source_language': 'en', 'target_language': 'te'},
            format='json',
        )
        assert res2.status_code == status.HTTP_400_BAD_REQUEST

    def test_validation_excessively_long_text(self, api_client, auth_user):
        """Text exceeding character limit (5000) must return 400."""
        api_client.force_authenticate(user=auth_user)
        oversized = "A" * 5001
        response = api_client.post(
            '/api/v1/voice-translation/translate/',
            {'text': oversized, 'source_language': 'en', 'target_language': 'te'},
            format='json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_validation_identical_languages(self, api_client, auth_user):
        """Selecting identical source and target language must be rejected."""
        api_client.force_authenticate(user=auth_user)
        response = api_client.post(
            '/api/v1/voice-translation/translate/',
            {'text': 'Take medicine with water.', 'source_language': 'en', 'target_language': 'en'},
            format='json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_validation_unsupported_language_codes(self, api_client, auth_user):
        """Unsupported language codes must be rejected."""
        api_client.force_authenticate(user=auth_user)
        response = api_client.post(
            '/api/v1/voice-translation/translate/',
            {'text': 'Hello', 'source_language': 'xx', 'target_language': 'te'},
            format='json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @override_settings(GEMINI_API_KEY='')
    def test_missing_gemini_credentials_returns_503(self, api_client, auth_user):
        """When GEMINI_API_KEY is not configured, API must return 503 Service Unavailable."""
        api_client.force_authenticate(user=auth_user)
        response = api_client.post(
            '/api/v1/voice-translation/translate/',
            {'text': 'Please come tomorrow morning.', 'source_language': 'en', 'target_language': 'te'},
            format='json',
        )
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        data = response.json()
        assert data['code'] == 'GEMINI_NOT_CONFIGURED'

    @override_settings(GEMINI_API_KEY='fake-test-key-for-mocking')
    def test_mocked_gemini_success_response(self, api_client, auth_user):
        """With valid credentials and mocked Gemini SDK, returns 200 with translation."""
        api_client.force_authenticate(user=auth_user)

        mock_response = MagicMock()
        mock_response.text = 'దయచేసి రేపు ఉదయం రండి.'

        with patch('google.genai.Client') as mock_client_cls:
            mock_client = MagicMock()
            mock_client.models.generate_content.return_value = mock_response
            mock_client_cls.return_value = mock_client

            response = api_client.post(
                '/api/v1/voice-translation/translate/',
                {
                    'text': 'Please come tomorrow morning.',
                    'source_language': 'en',
                    'target_language': 'te',
                },
                format='json',
            )
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['status'] == 'success'
            assert data['source_language'] == 'en'
            assert data['target_language'] == 'te'
            assert data['translated_text'] == 'దయచేసి రేపు ఉదయం రండి.'

    @override_settings(GEMINI_API_KEY='fake-test-key-for-mocking')
    def test_patient_user_role_can_translate(self, api_client, patient_user):
        """Patient portal users can access voice translation communication utility."""
        api_client.force_authenticate(user=patient_user)

        mock_response = MagicMock()
        mock_response.text = 'कृपया कल सुबह आएं।'

        with patch('google.genai.Client') as mock_client_cls:
            mock_client = MagicMock()
            mock_client.models.generate_content.return_value = mock_response
            mock_client_cls.return_value = mock_client

            response = api_client.post(
                '/api/v1/voice-translation/translate/',
                {
                    'text': 'Please come tomorrow morning.',
                    'source_language': 'en',
                    'target_language': 'hi',
                },
                format='json',
            )
            assert response.status_code == status.HTTP_200_OK
            assert response.json()['translated_text'] == 'कृपया कल सुबह आएं।'

    @override_settings(GEMINI_API_KEY='fake-test-key-for-mocking')
    def test_gemini_quota_exceeded_handling(self, api_client, auth_user):
        """When Gemini returns 429 quota error, API must return 429 with clear message."""
        api_client.force_authenticate(user=auth_user)

        with patch('google.genai.Client') as mock_client_cls:
            mock_client = MagicMock()
            mock_client.models.generate_content.side_effect = Exception("429 ResourceExhausted: Quota exceeded")
            mock_client_cls.return_value = mock_client

            response = api_client.post(
                '/api/v1/voice-translation/translate/',
                {
                    'text': 'Please take your prescription.',
                    'source_language': 'en',
                    'target_language': 'ta',
                },
                format='json',
            )
            assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
            assert response.json()['code'] == 'GEMINI_QUOTA_EXCEEDED'

    @override_settings(GEMINI_API_KEY='fake-test-key-for-mocking')
    def test_gemini_timeout_handling(self, api_client, auth_user):
        """When Gemini provider times out, API must return 504 Gateway Timeout."""
        api_client.force_authenticate(user=auth_user)

        with patch('google.genai.Client') as mock_client_cls:
            mock_client = MagicMock()
            mock_client.models.generate_content.side_effect = Exception("DeadlineExceeded: request timed out")
            mock_client_cls.return_value = mock_client

            response = api_client.post(
                '/api/v1/voice-translation/translate/',
                {
                    'text': 'The doctor is reviewing your lab tests.',
                    'source_language': 'en',
                    'target_language': 'kn',
                },
                format='json',
            )
            assert response.status_code == status.HTTP_504_GATEWAY_TIMEOUT
            assert response.json()['code'] == 'GEMINI_TIMEOUT'

    @override_settings(GEMINI_API_KEY='fake-test-key-for-mocking')
    def test_gemini_empty_response_handling(self, api_client, auth_user):
        """When Gemini returns empty text, API returns 502 Bad Gateway."""
        api_client.force_authenticate(user=auth_user)

        mock_response = MagicMock()
        mock_response.text = ''

        with patch('google.genai.Client') as mock_client_cls:
            mock_client = MagicMock()
            mock_client.models.generate_content.return_value = mock_response
            mock_client_cls.return_value = mock_client

            response = api_client.post(
                '/api/v1/voice-translation/translate/',
                {
                    'text': 'Your vitals are stable.',
                    'source_language': 'en',
                    'target_language': 'te',
                },
                format='json',
            )
            assert response.status_code == status.HTTP_502_BAD_GATEWAY
            assert response.json()['code'] == 'TRANSLATION_FAILED'

    @override_settings(GEMINI_API_KEY='fake-test-key-for-mocking')
    def test_markdown_fence_cleaning(self, api_client, auth_user):
        """If provider returns markdown code block, fences are cleaned automatically."""
        api_client.force_authenticate(user=auth_user)

        mock_response = MagicMock()
        mock_response.text = '```\nడాక్టర్ త్వరలో వస్తారు.\n```'

        with patch('google.genai.Client') as mock_client_cls:
            mock_client = MagicMock()
            mock_client.models.generate_content.return_value = mock_response
            mock_client_cls.return_value = mock_client

            response = api_client.post(
                '/api/v1/voice-translation/translate/',
                {
                    'text': 'The doctor will arrive soon.',
                    'source_language': 'en',
                    'target_language': 'te',
                },
                format='json',
            )
            assert response.status_code == status.HTTP_200_OK
            assert response.json()['translated_text'] == 'డాక్టర్ త్వరలో వస్తారు.'

    @override_settings(GEMINI_API_KEY='fake-test-key-for-mocking')
    def test_legacy_url_route(self, api_client, auth_user):
        """Verifies /api/voice-translation/translate/ route works identically."""
        api_client.force_authenticate(user=auth_user)

        mock_response = MagicMock()
        mock_response.text = 'డాక్టర్ అందుబాటులో ఉన్నారు.'

        with patch('google.genai.Client') as mock_client_cls:
            mock_client = MagicMock()
            mock_client.models.generate_content.return_value = mock_response
            mock_client_cls.return_value = mock_client

            response = api_client.post(
                '/api/voice-translation/translate/',
                {
                    'text': 'The doctor is available.',
                    'source_language': 'en',
                    'target_language': 'te',
                },
                format='json',
            )
            assert response.status_code == status.HTTP_200_OK
            assert response.json()['translated_text'] == 'డాక్టర్ అందుబాటులో ఉన్నారు.'
