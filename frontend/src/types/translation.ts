/**
 * Type definitions for Voice Language Translation feature.
 */

export type LanguageCode = 'en' | 'te' | 'hi' | 'ta' | 'kn';

export interface SupportedLanguage {
  code: LanguageCode;
  name: string;
  native_name: string;
  stt_locale: string;
  tts_locale: string;
  direction: 'ltr' | 'rtl';
  gemini_supported: boolean;
  stt_browser_notice?: string;
  tts_browser_notice?: string;
}

export interface TranslationRequest {
  text: string;
  source_language: LanguageCode;
  target_language: LanguageCode;
}

export interface TranslationResponse {
  status: 'success';
  source_language: LanguageCode;
  target_language: LanguageCode;
  translated_text: string;
}

export interface TranslationErrorResponse {
  status: 'error';
  error: string;
  code?: string;
  field_errors?: Record<string, string[]>;
}

export type SpeechRecognitionState =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'processing'
  | 'error';

export type PlaybackState =
  | 'idle'
  | 'playing'
  | 'paused'
  | 'unavailable'
  | 'error';
