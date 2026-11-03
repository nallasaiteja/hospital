/**
 * Voice Language Translation API service.
 * Handles communication with Django voice translation backend endpoints.
 */

import api from './api';
import {
  LanguageCode,
  SupportedLanguage,
  TranslationRequest,
  TranslationResponse,
} from '../types/translation';

export const DEFAULT_SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  {
    code: 'en',
    name: 'English',
    native_name: 'English',
    stt_locale: 'en-IN',
    tts_locale: 'en-IN',
    direction: 'ltr',
    gemini_supported: true,
  },
  {
    code: 'te',
    name: 'Telugu',
    native_name: 'తెలుగు',
    stt_locale: 'te-IN',
    tts_locale: 'te-IN',
    direction: 'ltr',
    gemini_supported: true,
  },
  {
    code: 'hi',
    name: 'Hindi',
    native_name: 'हिन्दी',
    stt_locale: 'hi-IN',
    tts_locale: 'hi-IN',
    direction: 'ltr',
    gemini_supported: true,
  },
  {
    code: 'ta',
    name: 'Tamil',
    native_name: 'தமிழ்',
    stt_locale: 'ta-IN',
    tts_locale: 'ta-IN',
    direction: 'ltr',
    gemini_supported: true,
  },
  {
    code: 'kn',
    name: 'Kannada',
    native_name: 'ಕನ್ನಡ',
    stt_locale: 'kn-IN',
    tts_locale: 'kn-IN',
    direction: 'ltr',
    gemini_supported: true,
  },
];

export const VoiceTranslationService = {
  /**
   * Retrieves supported languages from backend, falling back to local registry if offline.
   */
  async getLanguages(): Promise<{
    languages: SupportedLanguage[];
    gemini_configured?: boolean;
    configured_model?: string;
  }> {
    try {
      const response = await api.get('/voice-translation/languages/');
      if (response.data && response.data.languages) {
        return {
          languages: response.data.languages,
          gemini_configured: response.data.gemini_configured,
          configured_model: response.data.configured_model,
        };
      }
    } catch (err) {
      console.warn('Failed to fetch languages list from backend, using default fallback list:', err);
    }
    return { languages: DEFAULT_SUPPORTED_LANGUAGES };
  },

  /**
   * Sends text to backend for Gemini translation.
   */
  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const response = await api.post<TranslationResponse>('/voice-translation/translate/', request);
    return response.data;
  },

  /**
   * Fetches high-quality native synthesized speech audio (MP3 blob) from the backend.
   * Ensures crystal-clear pronunciation for Telugu, Kannada, Tamil, Hindi, etc.,
   * without depending on Windows OS local voice installations.
   */
  async getSpeechAudio(text: string, language: string): Promise<Blob> {
    const response = await api.post(
      '/voice-translation/tts/',
      { text, language },
      { responseType: 'blob' }
    );
    return response.data;
  },

  /**
   * Finds language configuration by code.
   */
  getLanguage(code: LanguageCode): SupportedLanguage {
    return (
      DEFAULT_SUPPORTED_LANGUAGES.find((lang) => lang.code === code) ||
      DEFAULT_SUPPORTED_LANGUAGES[0]
    );
  },
};
