/**
 * Web Speech API Speech Recognition Helper.
 * Handles microphone permissions, speech-to-text conversion,
 * interim/final transcripts, and error normalization.
 */

// Interface for Web Speech API recognition instances
interface IWindowSpeechRecognition extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export interface SpeechRecognitionHandlers {
  onStart?: () => void;
  onInterimResult?: (transcript: string) => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (error: { code: string; message: string }) => void;
  onEnd?: () => void;
}

export class SpeechRecognitionController {
  private recognition: any = null;
  private isListening: boolean = false;
  private handlers: SpeechRecognitionHandlers = {};
  private activeStream: MediaStream | null = null;

  public static isSupported(): boolean {
    const win = window as unknown as IWindowSpeechRecognition;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  /**
   * Initializes and starts speech recognition with the requested locale.
   */
  public async start(
    locale: string,
    handlers: SpeechRecognitionHandlers
  ): Promise<boolean> {
    this.handlers = handlers;

    if (!SpeechRecognitionController.isSupported()) {
      this.handlers.onError?.({
        code: 'NOT_SUPPORTED',
        message: 'Your browser does not support voice speech recognition. You can type or paste text manually.',
      });
      return false;
    }

    // Explicitly request user microphone permission via getUserMedia
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (err: any) {
      const code = err.name === 'NotAllowedError' ? 'PERMISSION_DENIED' : 'MIC_UNAVAILABLE';
      const message =
        err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access in your browser settings to record speech.'
          : 'Microphone hardware is unavailable or in use by another program.';
      this.handlers.onError?.({ code, message });
      return false;
    }

    try {
      const win = window as unknown as IWindowSpeechRecognition;
      const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionClass();

      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = locale;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.handlers.onStart?.();
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += chunk;
          } else {
            interimTranscript += chunk;
          }
        }

        if (interimTranscript) {
          this.handlers.onInterimResult?.(interimTranscript);
        }
        if (finalTranscript) {
          this.handlers.onFinalResult?.(finalTranscript);
        }
      };

      this.recognition.onerror = (event: any) => {
        let code = 'RECOGNITION_ERROR';
        let message = 'Speech recognition failed.';

        switch (event.error) {
          case 'not-allowed':
            code = 'PERMISSION_DENIED';
            message = 'Microphone permission denied. Please allow microphone access in your browser.';
            break;
          case 'no-speech':
            code = 'NO_SPEECH';
            message = 'No speech was detected. Please check your microphone and speak clearly.';
            break;
          case 'audio-capture':
            code = 'AUDIO_CAPTURE_ERROR';
            message = 'No microphone device was detected.';
            break;
          case 'network':
            code = 'NETWORK_ERROR';
            message = 'Network error occurred while connecting to the speech recognition service.';
            break;
          case 'aborted':
            // Normal user abort, do not surface as loud error
            return;
          case 'language-not-supported':
            code = 'LANGUAGE_UNSUPPORTED';
            message = `Speech recognition for locale ${locale} is not supported by your browser engine.`;
            break;
          default:
            message = event.message || `Speech recognition error: ${event.error}`;
        }

        this.handlers.onError?.({ code, message });
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.releaseMicStream();
        this.handlers.onEnd?.();
      };

      this.recognition.start();
      return true;
    } catch (err: any) {
      this.isListening = false;
      this.releaseMicStream();
      this.handlers.onError?.({
        code: 'START_FAILED',
        message: err.message || 'Failed to start speech recognition.',
      });
      return false;
    }
  }

  /**
   * Stops recognition and releases microphone hardware.
   */
  public stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        // Ignore if already stopped
      }
    }
    this.isListening = false;
    this.releaseMicStream();
  }

  /**
   * Immediately aborts recognition session without processing remaining audio.
   */
  public abort(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (err) {
        // Ignore
      }
    }
    this.isListening = false;
    this.releaseMicStream();
  }

  private releaseMicStream(): void {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((track) => track.stop());
      this.activeStream = null;
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}
