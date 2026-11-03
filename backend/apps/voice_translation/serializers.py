"""
Serializers for HMS Voice Language Translation endpoints.
"""

from rest_framework import serializers
from django.conf import settings
from .languages import SUPPORTED_LANGUAGES, get_supported_language_codes


class TranslationRequestSerializer(serializers.Serializer):
    """
    Validates inbound speech-to-text translation requests.
    """
    text = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
        help_text="The transcript text to translate (max length 5,000 characters).",
    )
    source_language = serializers.ChoiceField(
        choices=list(SUPPORTED_LANGUAGES.keys()),
        required=True,
        help_text="Source language code (e.g., 'en', 'te', 'hi', 'ta', 'kn').",
    )
    target_language = serializers.ChoiceField(
        choices=list(SUPPORTED_LANGUAGES.keys()),
        required=True,
        help_text="Target language code to translate into.",
    )

    def validate_text(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Text to translate cannot be empty or whitespace only.")
        
        max_chars = getattr(settings, 'VOICE_TRANSLATION_MAX_CHARS', 5000)
        if len(cleaned) > max_chars:
            raise serializers.ValidationError(
                f"Text length ({len(cleaned)} chars) exceeds maximum allowed {max_chars} characters."
            )
        return cleaned

    def validate(self, attrs):
        source = attrs.get('source_language')
        target = attrs.get('target_language')
        if source and target and source == target:
            raise serializers.ValidationError({
                "target_language": "Target language must be different from source language."
            })
        return attrs


class TranslationResponseSerializer(serializers.Serializer):
    """
    Serializes successful translation response to client.
    """
    status = serializers.CharField(default='success')
    source_language = serializers.CharField()
    target_language = serializers.CharField()
    translated_text = serializers.CharField()


class LanguageMetadataSerializer(serializers.Serializer):
    """
    Serializes verified capability and metadata for supported languages.
    """
    code = serializers.CharField()
    name = serializers.CharField()
    native_name = serializers.CharField()
    stt_locale = serializers.CharField()
    tts_locale = serializers.CharField()
    direction = serializers.CharField()
    gemini_supported = serializers.BooleanField()
    stt_browser_notice = serializers.CharField()
    tts_browser_notice = serializers.CharField()
