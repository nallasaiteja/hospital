"""
Central Language Configuration for HMS Voice Language Translation.
Maintains supported language codes, names, native representations,
and speech recognition/synthesis locale codes.
"""

from typing import Dict, List, Optional, Tuple

SUPPORTED_LANGUAGES: Dict[str, dict] = {
    'en': {
        'code': 'en',
        'name': 'English',
        'native_name': 'English',
        'stt_locale': 'en-IN',
        'fallback_stt_locales': ['en-US', 'en-GB'],
        'tts_locale': 'en-IN',
        'fallback_tts_locales': ['en-US', 'en-GB'],
        'script': 'Latin',
        'direction': 'ltr',
        'gemini_supported': True,
        'speech_recognition_browser_supported': True,
        'speech_synthesis_browser_supported': True,
    },
    'te': {
        'code': 'te',
        'name': 'Telugu',
        'native_name': 'తెలుగు',
        'stt_locale': 'te-IN',
        'fallback_stt_locales': ['te'],
        'tts_locale': 'te-IN',
        'fallback_tts_locales': ['te'],
        'script': 'Telugu',
        'direction': 'ltr',
        'gemini_supported': True,
        'speech_recognition_browser_supported': True,
        'speech_synthesis_browser_supported': True,
    },
    'hi': {
        'code': 'hi',
        'name': 'Hindi',
        'native_name': 'हिन्दी',
        'stt_locale': 'hi-IN',
        'fallback_stt_locales': ['hi'],
        'tts_locale': 'hi-IN',
        'fallback_tts_locales': ['hi'],
        'script': 'Devanagari',
        'direction': 'ltr',
        'gemini_supported': True,
        'speech_recognition_browser_supported': True,
        'speech_synthesis_browser_supported': True,
    },
    'ta': {
        'code': 'ta',
        'name': 'Tamil',
        'native_name': 'தமிழ்',
        'stt_locale': 'ta-IN',
        'fallback_stt_locales': ['ta-LK', 'ta'],
        'tts_locale': 'ta-IN',
        'fallback_tts_locales': ['ta-LK', 'ta'],
        'script': 'Tamil',
        'direction': 'ltr',
        'gemini_supported': True,
        'speech_recognition_browser_supported': True,
        'speech_synthesis_browser_supported': True,
    },
    'kn': {
        'code': 'kn',
        'name': 'Kannada',
        'native_name': 'ಕನ್ನಡ',
        'stt_locale': 'kn-IN',
        'fallback_stt_locales': ['kn'],
        'tts_locale': 'kn-IN',
        'fallback_tts_locales': ['kn'],
        'script': 'Kannada',
        'direction': 'ltr',
        'gemini_supported': True,
        'speech_recognition_browser_supported': True,
        'speech_synthesis_browser_supported': True,
    },
}


def get_supported_language_codes() -> List[str]:
    """Returns a list of all supported language ISO codes."""
    return list(SUPPORTED_LANGUAGES.keys())


def get_language_choices() -> List[Tuple[str, str]]:
    """Returns DRF/Django choices format (e.g. [('en', 'English'), ...])."""
    return [(lang['code'], f"{lang['name']} ({lang['native_name']})") for lang in SUPPORTED_LANGUAGES.values()]


def is_supported_language(code: str) -> bool:
    """Verifies whether a language code is currently supported."""
    return str(code).lower().strip() in SUPPORTED_LANGUAGES


def get_language_name(code: str) -> str:
    """Resolves language code to human-readable English name."""
    lang = SUPPORTED_LANGUAGES.get(str(code).lower().strip())
    return lang['name'] if lang else code


def get_supported_languages_list() -> List[dict]:
    """Returns list of language configurations for frontend display and client validation."""
    return [
        {
            'code': lang['code'],
            'name': lang['name'],
            'native_name': lang['native_name'],
            'stt_locale': lang['stt_locale'],
            'tts_locale': lang['tts_locale'],
            'direction': lang['direction'],
            'gemini_supported': lang['gemini_supported'],
            'stt_browser_notice': 'Browser Web Speech API support varies by device and operating system.',
            'tts_browser_notice': 'Audio playback relies on OS/browser installed speech synthesis voices.',
        }
        for lang in SUPPORTED_LANGUAGES.values()
    ]
