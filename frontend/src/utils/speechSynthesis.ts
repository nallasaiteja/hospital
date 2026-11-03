/**
 * Web SpeechSynthesis Helper.
 * Handles text-to-speech audio playback for translated messages.
 */

export interface SpeechPlaybackHandlers {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: { code: string; message: string }) => void;
}

export class SpeechSynthesisController {
  private static synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;

  private static currentAudio: HTMLAudioElement | null = null;
  private static activeBlobUrl: string | null = null;

  public static isSupported(): boolean {
    return true; // Supported either via native Audio stream or SpeechSynthesis
  }

  /**
   * Retrieves all voices currently loaded in the browser.
   */
  public static async getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
    if (!SpeechSynthesisController.synth) return [];
    let voices = SpeechSynthesisController.synth.getVoices();
    if (voices.length > 0) return voices;

    // In Chrome and some browsers, voices load asynchronously
    return new Promise((resolve) => {
      const onVoicesChanged = () => {
        voices = SpeechSynthesisController.synth?.getVoices() || [];
        SpeechSynthesisController.synth?.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(voices);
      };
      SpeechSynthesisController.synth?.addEventListener('voiceschanged', onVoicesChanged);
      // Timeout fallback in case voiceschanged never fires
      setTimeout(() => {
        resolve(SpeechSynthesisController.synth?.getVoices() || []);
      }, 500);
    });
  }

  /**
   * Finds the best voice matching a target language code or locale.
   */
  public static findVoiceForLanguage(
    voices: SpeechSynthesisVoice[],
    locale: string,
    langCode: string
  ): SpeechSynthesisVoice | null {
    const normalizedLocale = locale.toLowerCase().replace('_', '-');
    const normalizedCode = langCode.toLowerCase();

    // 1. Exact locale match (e.g. te-IN)
    const exact = voices.find(
      (v) => v.lang.toLowerCase().replace('_', '-') === normalizedLocale
    );
    if (exact) return exact;

    // 2. Prefix match on lang tag (e.g. te, kn, hi, ta)
    const prefix = voices.find((v) =>
      v.lang.toLowerCase().startsWith(normalizedCode)
    );
    if (prefix) return prefix;

    // 3. Name match for browser online / natural cloud voices
    const langNames: Record<string, string[]> = {
      te: ['telugu', 'తెలుగు'],
      kn: ['kannada', 'ಕನ್ನಡ'],
      ta: ['tamil', 'தமிழ்'],
      hi: ['hindi', 'हिन्दी', 'हिंदी'],
      bn: ['bengali', 'বাংলা'],
      mr: ['marathi', 'मराठी'],
      gu: ['gujarati', 'ગુજરાતી'],
      ml: ['malayalam', 'മലയാളം'],
      pa: ['punjabi', 'ਪੰਜਾਬੀ'],
      ur: ['urdu', 'اردو'],
    };

    const targetNames = langNames[normalizedCode] || [];
    for (const name of targetNames) {
      const match = voices.find((v) => v.name.toLowerCase().includes(name));
      if (match) return match;
    }

    return null;
  }

  /**
   * Speaks the provided text. First attempts crystal-clear native speech synthesis
   * from the backend audio engine (works seamlessly for Telugu, Kannada, Hindi, etc.,
   * without needing Windows voice packs). If offline or unavailable, falls back to
   * browser SpeechSynthesis.
   */
  public static async speak(
    text: string,
    locale: string,
    langCode: string,
    handlers: SpeechPlaybackHandlers = {}
  ): Promise<boolean> {
    if (!text || !text.trim()) {
      handlers.onError?.({
        code: 'EMPTY_TEXT',
        message: 'No text provided for audio playback.',
      });
      return false;
    }

    // Always stop any existing playback first
    SpeechSynthesisController.stop();

    // 1. Primary engine: High-quality backend native speech audio
    try {
      const { VoiceTranslationService } = await import('../services/voiceTranslation');
      const audioBlob = await VoiceTranslationService.getSpeechAudio(text, langCode || locale);
      if (audioBlob && audioBlob.size > 0) {
        const blobUrl = URL.createObjectURL(audioBlob);
        SpeechSynthesisController.activeBlobUrl = blobUrl;
        const audio = new Audio(blobUrl);
        SpeechSynthesisController.currentAudio = audio;

        audio.onplay = () => {
          handlers.onStart?.();
        };

        audio.onended = () => {
          SpeechSynthesisController.cleanupAudio();
          handlers.onEnd?.();
        };

        audio.onerror = () => {
          SpeechSynthesisController.cleanupAudio();
          SpeechSynthesisController.speakWithBrowserSynth(text, locale, langCode, handlers);
        };

        await audio.play();
        return true;
      }
    } catch (ttsErr) {
      console.warn('Backend audio synthesis unavailable, falling back to browser SpeechSynthesis:', ttsErr);
    }

    // 2. Secondary fallback: Browser SpeechSynthesis
    return SpeechSynthesisController.speakWithBrowserSynth(text, locale, langCode, handlers);
  }

  /**
   * Fallback browser SpeechSynthesis implementation.
   */
  public static async speakWithBrowserSynth(
    text: string,
    locale: string,
    langCode: string,
    handlers: SpeechPlaybackHandlers = {}
  ): Promise<boolean> {
    if (!SpeechSynthesisController.synth) {
      handlers.onError?.({
        code: 'NOT_SUPPORTED',
        message: 'Speech synthesis audio playback is not supported by your browser.',
      });
      return false;
    }

    SpeechSynthesisController.synth.cancel();

    const voices = await SpeechSynthesisController.getAvailableVoices();
    const matchedVoice = SpeechSynthesisController.findVoiceForLanguage(
      voices,
      locale,
      langCode
    );

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale;
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        handlers.onStart?.();
      };

      utterance.onend = () => {
        handlers.onEnd?.();
      };

      utterance.onerror = (event: any) => {
        if (event.error === 'canceled' || event.error === 'interrupted') {
          handlers.onEnd?.();
          return;
        }

        if (event.error === 'language-unavailable' || event.error === 'voice-unavailable') {
          handlers.onError?.({
            code: 'VOICE_NOT_FOUND',
            message: `Voice audio for this language (${locale}) is not installed on this device or supported by the browser synthesizer. The translated text is displayed above for visual review.`,
          });
          return;
        }

        handlers.onError?.({
          code: 'PLAYBACK_FAILED',
          message: `Audio playback error: ${event.error || 'Failed to play audio'}`,
        });
      };

      SpeechSynthesisController.synth.speak(utterance);
      return true;
    } catch (err: any) {
      handlers.onError?.({
        code: 'SYNTH_FAILED',
        message: err.message || 'Speech synthesis error.',
      });
      return false;
    }
  }

  /**
   * Immediately stops any active audio playback.
   */
  public static stop(): void {
    if (SpeechSynthesisController.currentAudio) {
      SpeechSynthesisController.currentAudio.pause();
      SpeechSynthesisController.currentAudio.currentTime = 0;
    }
    SpeechSynthesisController.cleanupAudio();

    if (SpeechSynthesisController.synth) {
      SpeechSynthesisController.synth.cancel();
    }
  }

  private static cleanupAudio(): void {
    if (SpeechSynthesisController.activeBlobUrl) {
      URL.revokeObjectURL(SpeechSynthesisController.activeBlobUrl);
      SpeechSynthesisController.activeBlobUrl = null;
    }
    SpeechSynthesisController.currentAudio = null;
  }

  public static isSpeaking(): boolean {
    const audioSpeaking = !!(
      SpeechSynthesisController.currentAudio &&
      !SpeechSynthesisController.currentAudio.paused &&
      !SpeechSynthesisController.currentAudio.ended
    );
    const synthSpeaking = !!SpeechSynthesisController.synth?.speaking;
    return audioSpeaking || synthSpeaking;
  }
}
