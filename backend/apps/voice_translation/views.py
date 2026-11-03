"""
API Views for HMS Voice Language Translation.
Handles authenticated speech translation requests and supported language queries.
"""

import logging
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.throttling import UserRateThrottle
from drf_spectacular.utils import extend_schema, OpenApiResponse

from .languages import get_supported_languages_list
from .serializers import (
    TranslationRequestSerializer,
    TranslationResponseSerializer,
    LanguageMetadataSerializer,
)
from .services import (
    GeminiTranslationService,
    TextToSpeechService,
    TranslationError,
    GeminiNotConfiguredError,
    GeminiQuotaExceededError,
    GeminiTimeoutError,
)
from .throttling import TranslationRateThrottle

logger = logging.getLogger('hospital_translation')


class VoiceTranslationView(APIView):
    """
    Translates spoken or typed clinical communication between supported hospital languages
    using Google Gemini API. Enforces authentication, input validation, and rate limiting.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [TranslationRateThrottle, UserRateThrottle]

    @extend_schema(
        summary="Translate Spoken Communication",
        description="Receives source text transcript and translates it to target language using Google Gemini API.",
        request=TranslationRequestSerializer,
        responses={
            200: OpenApiResponse(response=TranslationResponseSerializer, description="Translation successful"),
            400: OpenApiResponse(description="Validation error (e.g., identical languages or empty text)"),
            401: OpenApiResponse(description="Authentication credentials were not provided or expired"),
            429: OpenApiResponse(description="Translation rate limit or Gemini API quota exceeded"),
            503: OpenApiResponse(description="Gemini API is not configured on the backend"),
            504: OpenApiResponse(description="Gemini API request timed out"),
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = TranslationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "error": "Invalid translation request parameters.",
                    "code": "VALIDATION_ERROR",
                    "field_errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        validated_data = serializer.validated_data
        text = validated_data['text']
        source_language = validated_data['source_language']
        target_language = validated_data['target_language']

        try:
            result = GeminiTranslationService.translate(
                text=text,
                source_language=source_language,
                target_language=target_language,
            )
            return Response(result, status=status.HTTP_200_OK)

        except GeminiNotConfiguredError as exc:
            return Response(
                {
                    "status": "error",
                    "error": exc.message,
                    "code": exc.code,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        except GeminiQuotaExceededError as exc:
            return Response(
                {
                    "status": "error",
                    "error": exc.message,
                    "code": exc.code,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        except GeminiTimeoutError as exc:
            return Response(
                {
                    "status": "error",
                    "error": exc.message,
                    "code": exc.code,
                },
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )

        except TranslationError as exc:
            return Response(
                {
                    "status": "error",
                    "error": exc.message,
                    "code": exc.code,
                },
                status=exc.http_status,
            )

        except Exception as exc:
            logger.error(f"[Voice Translation] Unexpected internal error: {type(exc).__name__}", exc_info=True)
            return Response(
                {
                    "status": "error",
                    "error": "An unexpected error occurred during translation processing.",
                    "code": "INTERNAL_SERVER_ERROR",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class SupportedLanguagesView(APIView):
    """
    Returns list of supported languages and verified capabilities (Gemini translation, STT locale, TTS locale).
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="List Supported Voice Translation Languages",
        description="Returns list of languages supported for translation, speech recognition locales, and speech synthesis locales.",
        responses={
            200: OpenApiResponse(response=LanguageMetadataSerializer(many=True), description="Supported languages list"),
            401: OpenApiResponse(description="Authentication credentials required"),
        },
    )
    def get(self, request, *args, **kwargs):
        languages = get_supported_languages_list()
        serializer = LanguageMetadataSerializer(languages, many=True)
        return Response(
            {
                "status": "success",
                "count": len(languages),
                "gemini_configured": GeminiTranslationService.is_configured(),
                "configured_model": GeminiTranslationService.get_model_name(),
                "languages": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class TextToSpeechView(APIView):
    """
    Synthesizes translated clinical text into clear audio (MP3).
    Ensures seamless pronunciation for Telugu, Kannada, Hindi, Tamil, English, etc.,
    independent of the client operating system or missing local voice packs.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [TranslationRateThrottle, UserRateThrottle]

    def get(self, request, *args, **kwargs):
        text = request.query_params.get('text', '').strip()
        language = request.query_params.get('language', 'en').strip()
        if not text:
            return Response(
                {"status": "error", "error": "Query parameter 'text' is required.", "code": "EMPTY_TEXT"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            audio_bytes = TextToSpeechService.synthesize(text, language)
            response = HttpResponse(audio_bytes, content_type='audio/mpeg')
            response['Content-Disposition'] = 'inline; filename="clinical_speech.mp3"'
            return response
        except Exception as exc:
            logger.error(f"[TTS] GET synthesis error: {type(exc).__name__} - {exc}")
            return Response(
                {"status": "error", "error": "Speech audio synthesis temporarily unavailable.", "code": "TTS_FAILED"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

    def post(self, request, *args, **kwargs):
        text = request.data.get('text', '').strip()
        language = request.data.get('language', 'en').strip()
        if not text:
            return Response(
                {"status": "error", "error": "Field 'text' is required.", "code": "EMPTY_TEXT"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            audio_bytes = TextToSpeechService.synthesize(text, language)
            response = HttpResponse(audio_bytes, content_type='audio/mpeg')
            response['Content-Disposition'] = 'inline; filename="clinical_speech.mp3"'
            return response
        except Exception as exc:
            logger.error(f"[TTS] POST synthesis error: {type(exc).__name__} - {exc}")
            return Response(
                {"status": "error", "error": "Speech audio synthesis temporarily unavailable.", "code": "TTS_FAILED"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
