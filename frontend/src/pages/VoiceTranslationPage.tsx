import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Languages,
  ArrowRightLeft,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Info,
  Radio,
  FileText,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  LanguageCode,
  SupportedLanguage,
  SpeechRecognitionState,
  PlaybackState,
} from '../types/translation';
import {
  VoiceTranslationService,
  DEFAULT_SUPPORTED_LANGUAGES,
} from '../services/voiceTranslation';
import { SpeechRecognitionController } from '../utils/speechRecognition';
import { SpeechSynthesisController } from '../utils/speechSynthesis';
import clsx from 'clsx';

export const VoiceTranslationPage: React.FC = () => {
  // Languages state
  const [languages, setLanguages] = useState<SupportedLanguage[]>(DEFAULT_SUPPORTED_LANGUAGES);
  const [sourceLang, setSourceLang] = useState<LanguageCode>('en');
  const [targetLang, setTargetLang] = useState<LanguageCode>('te');
  const [isGeminiConfigured, setIsGeminiConfigured] = useState<boolean | null>(null);
  const [geminiModel, setGeminiModel] = useState<string>('gemini-2.5-flash');

  // Text state
  const [transcript, setTranscript] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');

  // Status and operation states
  const [recState, setRecState] = useState<SpeechRecognitionState>('idle');
  const [recDuration, setRecDuration] = useState<number>(0);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  // Notification / Alert states
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const [copiedOriginal, setCopiedOriginal] = useState<boolean>(false);
  const [copiedTranslated, setCopiedTranslated] = useState<boolean>(false);

  // Browser capability detection
  const isSpeechRecSupported = useMemo(() => SpeechRecognitionController.isSupported(), []);
  const isSpeechSynthSupported = useMemo(() => SpeechSynthesisController.isSupported(), []);

  // Controller references
  const recognitionRef = useRef<SpeechRecognitionController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load languages and backend Gemini status on mount
  useEffect(() => {
    let mounted = true;
    VoiceTranslationService.getLanguages().then((res) => {
      if (mounted) {
        if (res.languages && res.languages.length > 0) {
          setLanguages(res.languages);
        }
        if (typeof res.gemini_configured === 'boolean') {
          setIsGeminiConfigured(res.gemini_configured);
        }
        if (res.configured_model) {
          setGeminiModel(res.configured_model);
        }
      }
    });

    return () => {
      mounted = false;
      // Clean up recognition and playback when component unmounts
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      SpeechSynthesisController.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Timer logic for recording duration
  useEffect(() => {
    if (recState === 'listening') {
      setRecDuration(0);
      timerRef.current = setInterval(() => {
        setRecDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recState]);

  // Format recording seconds into mm:ss
  const formattedDuration = useMemo(() => {
    const mins = Math.floor(recDuration / 60);
    const secs = recDuration % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [recDuration]);

  // Resolve source and target language objects
  const sourceLangObj = useMemo(
    () => languages.find((l) => l.code === sourceLang) || languages[0],
    [languages, sourceLang]
  );
  const targetLangObj = useMemo(
    () => languages.find((l) => l.code === targetLang) || languages[1],
    [languages, targetLang]
  );

  // Start speech recognition
  const handleStartRecording = async () => {
    setMicPermissionError(null);
    setTranslationError(null);
    setPlaybackNotice(null);
    setInterimText('');

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognitionController();
    }

    setRecState('requesting_permission');

    const success = await recognitionRef.current.start(sourceLangObj.stt_locale, {
      onStart: () => {
        setRecState('listening');
      },
      onInterimResult: (interim) => {
        setInterimText(interim);
      },
      onFinalResult: (finalChunk) => {
        setTranscript((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} ${finalChunk.trim()}` : finalChunk.trim();
        });
        setInterimText('');
      },
      onError: (err) => {
        setRecState('error');
        if (err.code === 'PERMISSION_DENIED') {
          setMicPermissionError(
            'Microphone access was denied. Please allow microphone permissions in your browser address bar to use speech recognition.'
          );
        } else if (err.code === 'NO_SPEECH') {
          // No speech detected is common, keep existing transcript
        } else {
          setMicPermissionError(err.message);
        }
      },
      onEnd: () => {
        setRecState('idle');
        setInterimText('');
      },
    });

    if (!success) {
      setRecState('idle');
    }
  };

  // Stop speech recognition
  const handleStopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setRecState('idle');
    setInterimText('');
  };

  // Handle language swapping
  const handleSwapLanguages = () => {
    const prevSource = sourceLang;
    const prevTarget = targetLang;
    const prevOriginal = transcript;
    const prevTranslated = translatedText;

    // Swap dropdowns
    setSourceLang(prevTarget);
    setTargetLang(prevSource);

    // If a translation is already present, swap texts so user can translate the reply
    if (prevTranslated.trim()) {
      setTranscript(prevTranslated.trim());
      setTranslatedText(prevOriginal.trim());
    }

    // Stop playback if in progress
    if (playbackState === 'playing') {
      SpeechSynthesisController.stop();
      setPlaybackState('idle');
    }
    setPlaybackNotice(null);
    setTranslationError(null);
  };

  // Perform Gemini translation
  const handleTranslate = async () => {
    const fullText = transcript.trim();
    if (!fullText) {
      setTranslationError('Please enter or record a message before requesting translation.');
      return;
    }

    if (sourceLang === targetLang) {
      setTranslationError('Source and target languages must be different.');
      return;
    }

    // Stop active recording or audio before translating
    if (recState === 'listening') {
      handleStopRecording();
    }
    if (playbackState === 'playing') {
      SpeechSynthesisController.stop();
      setPlaybackState('idle');
    }

    setIsTranslating(true);
    setTranslationError(null);
    setPlaybackNotice(null);

    try {
      const response = await VoiceTranslationService.translate({
        text: fullText,
        source_language: sourceLang,
        target_language: targetLang,
      });

      if (response && response.translated_text) {
        setTranslatedText(response.translated_text);
      } else {
        setTranslationError('Received an empty response from the translation service.');
      }
    } catch (err: any) {
      const backendError = err?.response?.data;
      if (backendError && backendError.error) {
        if (backendError.code === 'GEMINI_NOT_CONFIGURED') {
          setIsGeminiConfigured(false);
          setTranslationError(
            'Google Gemini API is not configured on the hospital backend server. Please configure GEMINI_API_KEY in the backend environment.'
          );
        } else if (backendError.code === 'GEMINI_QUOTA_EXCEEDED') {
          setTranslationError(
            'Gemini API rate limit or quota exceeded. Please wait a few moments before trying again.'
          );
        } else if (backendError.code === 'GEMINI_TIMEOUT') {
          setTranslationError(
            'Translation request timed out while communicating with Google Gemini. Please check your network connection and retry.'
          );
        } else {
          setTranslationError(backendError.error);
        }
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setTranslationError('Network timeout: backend translation server did not respond in time.');
      } else {
        setTranslationError('Failed to communicate with translation service. Please check your connection.');
      }
    } finally {
      setIsTranslating(false);
    }
  };

  // Play translated message aloud
  const handlePlayTranslation = async () => {
    const textToPlay = translatedText.trim();
    if (!textToPlay) return;

    setPlaybackNotice(null);

    if (playbackState === 'playing') {
      SpeechSynthesisController.stop();
      setPlaybackState('idle');
      return;
    }

    setPlaybackState('playing');

    const success = await SpeechSynthesisController.speak(
      textToPlay,
      targetLangObj.tts_locale,
      targetLangObj.code,
      {
        onStart: () => setPlaybackState('playing'),
        onEnd: () => setPlaybackState('idle'),
        onError: (err) => {
          setPlaybackState('idle');
          if (err.code === 'VOICE_NOT_FOUND') {
            setPlaybackNotice(
              `Voice audio for ${targetLangObj.name} (${targetLangObj.tts_locale}) is not installed on this device. The translated text is displayed above for visual review.`
            );
          } else {
            setPlaybackNotice(err.message);
          }
        },
      }
    );

    if (!success) {
      setPlaybackState('idle');
    }
  };

  // Stop active audio playback
  const handleStopAudio = () => {
    SpeechSynthesisController.stop();
    setPlaybackState('idle');
  };

  // Reset entire translation session
  const handleClearSession = () => {
    if (recState === 'listening') {
      handleStopRecording();
    }
    if (playbackState === 'playing') {
      SpeechSynthesisController.stop();
      setPlaybackState('idle');
    }
    setTranscript('');
    setInterimText('');
    setTranslatedText('');
    setTranslationError(null);
    setMicPermissionError(null);
    setPlaybackNotice(null);
    setCopiedOriginal(false);
    setCopiedTranslated(false);
  };

  // Copy text utilities
  const handleCopy = (text: string, isOriginal: boolean) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (isOriginal) {
      setCopiedOriginal(true);
      setTimeout(() => setCopiedOriginal(false), 2000);
    } else {
      setCopiedTranslated(true);
      setTimeout(() => setCopiedTranslated(false), 2000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/20">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Voice Language Translation
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Gemini-powered real-time speech translation utility for multi-lingual healthcare communication
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Status Pill */}
        <div className="flex items-center gap-3">
          {isGeminiConfigured === false && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Gemini API Key Required
            </span>
          )}
          {isGeminiConfigured === true && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Gemini Active ({geminiModel})
            </span>
          )}
          <button
            onClick={handleClearSession}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition text-xs font-semibold border border-slate-200 shadow-sm"
            title="Clear current translation session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Session</span>
          </button>
        </div>
      </div>

      {/* Hospital Privacy & Clinical Safety Notice */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 shadow-xl relative overflow-hidden">
        {/* Soft decorative background glows */}
        <div className="absolute top-0 right-0 w-72 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start gap-3.5 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Clinical Safety & Translation Advisory
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Clinical Protocol
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              Machine translation may be inaccurate. Verify important medical instructions with a qualified
              healthcare professional or interpreter. Do not rely on this tool alone for emergency instructions,
              diagnoses, prescriptions or medication dosages.
            </p>

            <div className="pt-2.5 mt-2.5 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2.5 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-bold text-[10px] uppercase tracking-wider border border-cyan-500/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Privacy Safeguard
              </span>
              <span className="text-slate-300">
                Transcripts and audio are processed temporarily in memory for real-time consultation and are never stored into permanent EMR records or hospital databases.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Language Selection Card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Source Language */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-cyan-400" />
              <span>Speaker Language (Source)</span>
            </label>
            <select
              value={sourceLang}
              onChange={(e) => {
                const next = e.target.value as LanguageCode;
                if (next === targetLang) {
                  // Auto swap to prevent identical
                  setTargetLang(sourceLang);
                }
                setSourceLang(next);
              }}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} — {lang.native_name} ({lang.code.toUpperCase()})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-500 block">
              Speech locale: <code className="text-slate-400">{sourceLangObj.stt_locale}</code>
            </span>
          </div>

          {/* Swap Languages Button */}
          <div className="flex items-center justify-center pt-2 md:pt-4">
            <button
              onClick={handleSwapLanguages}
              className="p-3 rounded-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 border border-slate-700 transition transform active:scale-95 shadow-md group"
              title="Reverse / Swap languages to translate reply"
              aria-label="Reverse / Swap languages"
            >
              <ArrowRightLeft className="w-5 h-5 transition group-hover:rotate-180 duration-300" />
            </button>
          </div>

          {/* Target Language */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-blue-400" />
              <span>Translate Into (Target)</span>
            </label>
            <select
              value={targetLang}
              onChange={(e) => {
                const next = e.target.value as LanguageCode;
                if (next === sourceLang) {
                  // Auto swap to prevent identical
                  setSourceLang(targetLang);
                }
                setTargetLang(next);
              }}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} — {lang.native_name} ({lang.code.toUpperCase()})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-500 block">
              Audio locale: <code className="text-slate-400">{targetLangObj.tts_locale}</code>
            </span>
          </div>
        </div>
      </div>

      {/* Main Dual-Panel Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: Speech Recording & Source Transcript */}
        <div className="flex flex-col rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-xl">
          {/* Header & Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Original Speech Transcript</h2>
                <p className="text-xs text-slate-400">Speak or paste text in {sourceLangObj.name}</p>
              </div>
            </div>

            {/* Recording Status Chip */}
            {recState === 'listening' ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                Recording ({formattedDuration})
              </span>
            ) : recState === 'requesting_permission' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Radio className="w-3.5 h-3.5 animate-spin" />
                Requesting Mic...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                <Mic className="w-3.5 h-3.5" />
                Mic Ready
              </span>
            )}
          </div>

          {/* Browser Unsupported Warning */}
          {!isSpeechRecSupported && (
            <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-3 text-xs text-slate-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                Your browser engine does not support automatic voice recognition. You can type or paste
                text directly into the transcript box below to translate.
              </span>
            </div>
          )}

          {/* Microphone Permission Error Notice */}
          {micPermissionError && (
            <div className="rounded-xl bg-red-950/30 border border-red-500/30 p-3 text-xs text-red-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{micPermissionError}</span>
            </div>
          )}

          {/* Voice Recording Action Box */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {recState === 'listening' ? (
                <button
                  onClick={handleStopRecording}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition shadow-lg shadow-red-600/30 animate-pulse active:scale-95"
                >
                  <MicOff className="w-4 h-4" />
                  <span>Stop Recording</span>
                </button>
              ) : (
                <button
                  onClick={handleStartRecording}
                  disabled={!isSpeechRecSupported}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm transition shadow-lg shadow-cyan-600/20 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Recording</span>
                </button>
              )}

              {recState === 'listening' && (
                <div className="flex items-center gap-1 text-red-400 text-xs font-mono font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formattedDuration}</span>
                </div>
              )}
            </div>

            <div className="text-right text-xs text-slate-400">
              <span>Target: </span>
              <strong className="text-white">{sourceLangObj.name}</strong>
              <span className="text-slate-500"> ({sourceLangObj.native_name})</span>
            </div>
          </div>

          {/* Editable Transcript Textarea */}
          <div className="space-y-1.5 flex-1 flex flex-col">
            <div className="relative flex-1">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={`Speak using the microphone above, or type in ${sourceLangObj.name}...`}
                rows={6}
                maxLength={5000}
                className="w-full h-full min-h-[160px] bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/80 transition resize-y font-sans leading-relaxed"
              />
              {/* Interim voice stream preview */}
              {interimText && (
                <div className="absolute bottom-3 left-3.5 right-3.5 bg-slate-900/90 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-2 text-xs text-cyan-300 italic flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                  <span className="truncate">{interimText}</span>
                </div>
              )}
            </div>

            {/* Bottom Bar: Character Count and Copy */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>
                {transcript.length} / 5,000 characters
              </span>
              <button
                onClick={() => handleCopy(transcript, true)}
                disabled={!transcript.trim()}
                className="flex items-center gap-1 text-slate-400 hover:text-white disabled:opacity-40 transition cursor-pointer disabled:cursor-not-allowed"
              >
                {copiedOriginal ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Gemini Translation & Speech Playback */}
        <div className="flex flex-col rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-xl">
          {/* Header & Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Translated Text</h2>
                <p className="text-xs text-slate-400">Translated into {targetLangObj.name} by Gemini</p>
              </div>
            </div>

            {/* Audio Playback Status Chip */}
            {playbackState === 'playing' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                <Volume2 className="w-3.5 h-3.5" />
                Playing Audio...
              </span>
            ) : isTranslating ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Translating...
              </span>
            ) : translatedText ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Translation Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-500 border border-slate-700">
                Awaiting Input
              </span>
            )}
          </div>

          {/* Translation Provider Error Banner */}
          {translationError && (
            <div className="rounded-xl bg-red-950/30 border border-red-500/30 p-3 text-xs text-red-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{translationError}</span>
            </div>
          )}

          {/* Audio Voice Unavailable Notice */}
          {playbackNotice && (
            <div className="rounded-xl bg-amber-50 border border-amber-200/90 p-3 text-xs text-amber-900 flex items-start gap-2.5 shadow-xs font-medium">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{playbackNotice}</span>
            </div>
          )}

          {/* Translation & Playback Action Box */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {/* Translate button */}
              <button
                onClick={handleTranslate}
                disabled={isTranslating || !transcript.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-sm transition shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Translating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-300" />
                    <span>Translate</span>
                  </>
                )}
              </button>

              {/* Playback controls */}
              {playbackState === 'playing' ? (
                <button
                  onClick={handleStopAudio}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition border border-slate-700"
                  title="Stop audio playback"
                >
                  <VolumeX className="w-4 h-4 text-red-400" />
                  <span>Stop Audio</span>
                </button>
              ) : (
                <button
                  onClick={handlePlayTranslation}
                  disabled={!translatedText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-medium text-sm transition border border-slate-700 cursor-pointer disabled:cursor-not-allowed"
                  title="Listen to translation"
                >
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>Play Translation</span>
                </button>
              )}
            </div>

            <div className="text-right text-xs text-slate-400">
              <span>Target: </span>
              <strong className="text-white">{targetLangObj.name}</strong>
              <span className="text-slate-500"> ({targetLangObj.native_name})</span>
            </div>
          </div>

          {/* Translated Text Display Area */}
          <div className="space-y-1.5 flex-1 flex flex-col">
            <div className="relative flex-1">
              <textarea
                value={translatedText}
                onChange={(e) => setTranslatedText(e.target.value)}
                placeholder="The translated text produced by Gemini will appear here..."
                rows={6}
                className="w-full h-full min-h-[160px] bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/80 transition resize-y font-sans leading-relaxed"
              />
            </div>

            {/* Bottom Bar: Character Count and Copy */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>{translatedText.length} characters</span>
              <button
                onClick={() => handleCopy(translatedText, false)}
                disabled={!translatedText.trim()}
                className="flex items-center gap-1 text-slate-400 hover:text-white disabled:opacity-40 transition cursor-pointer disabled:cursor-not-allowed"
              >
                {copiedTranslated ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Translation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceTranslationPage;
