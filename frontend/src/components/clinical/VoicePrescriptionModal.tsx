import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Sparkles, AlertCircle, CheckCircle, AlertTriangle,
  RotateCcw, Check, Plus, Trash2, Clock, Calendar, Info, Pill, ChevronDown, ChevronUp
} from 'lucide-react';
import { SpeechRecognitionController } from '../../utils/speechRecognition';
import { opdService } from '../../services/api';

export interface StructuredPrescriptionItem {
  medicine_id: string | null;
  medicine_name: string;
  generic_name?: string;
  strength?: string;
  dosage_form?: string;
  dose_amount?: string;
  dose_unit?: string;
  frequency: string;
  duration_days: number;
  total_quantity: number;
  route?: string;
  food_instruction?: string;
  is_prn?: boolean;
  prn_indication?: string;
  schedule?: {
    morning: boolean;
    morning_dose: string;
    afternoon: boolean;
    afternoon_dose: string;
    evening: boolean;
    evening_dose: string;
    night: boolean;
    night_dose: string;
  };
  instructions: string;
  review_flags?: string[];
  expanded?: boolean;
}

interface VoicePrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string;
  patientName?: string;
  patientAllergies?: string[];
  formularyMedicines: any[];
  onApplyPrescriptions: (items: StructuredPrescriptionItem[]) => void;
}

export const VoicePrescriptionModal: React.FC<VoicePrescriptionModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  patientAllergies = [],
  formularyMedicines = [],
  onApplyPrescriptions,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);

  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractedItems, setExtractedItems] = useState<StructuredPrescriptionItem[]>([]);
  const [hasExtracted, setHasExtracted] = useState<boolean>(false);

  const recognitionRef = useRef<SpeechRecognitionController | null>(null);
  const timerRef = useRef<any>(null);

  // Stop voice dictation
  const handleStopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  useEffect(() => {
    if (!isOpen) {
      handleStopRecording();
      setTranscript('');
      setInterimText('');
      setExtractedItems([]);
      setHasExtracted(false);
      setMicError(null);
      setExtractionError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  if (!isOpen) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start voice dictation
  const handleStartRecording = async () => {
    setMicError(null);
    setExtractionError(null);

    const controller = new SpeechRecognitionController();
    recognitionRef.current = controller;

    const started = await controller.start('en-IN', {
      onStart: () => {
        setIsRecording(true);
      },
      onInterimResult: (text) => {
        setInterimText(text);
      },
      onFinalResult: (text) => {
        setTranscript((prev) => (prev ? `${prev} ${text}` : text));
        setInterimText('');
      },
      onError: (err) => {
        setIsRecording(false);
        setMicError(err.message || 'Microphone error during speech recognition.');
      },
      onEnd: () => {
        setIsRecording(false);
      },
    });

    if (!started) {
      setIsRecording(false);
    }
  };

  // Extract structured prescription data from transcript using backend
  const handleExtractPrescriptions = async () => {
    const fullText = `${transcript} ${interimText}`.trim();
    if (!fullText) {
      setExtractionError('Please dictate or type medication details before extracting.');
      return;
    }

    if (isRecording) {
      handleStopRecording();
    }

    setIsExtracting(true);
    setExtractionError(null);

    try {
      const res = await opdService.extractVoicePrescription(fullText, patientId);
      if (res && res.items) {
        const enriched: StructuredPrescriptionItem[] = res.items.map((item) => {
          // If no matched ID from backend, attempt fuzzy matching with formulary
          let medId = item.medicine_id;
          if (!medId && formularyMedicines.length > 0) {
            const match = formularyMedicines.find(
              (m) =>
                m.brand_name.toLowerCase().includes((item.medicine_name || '').toLowerCase()) ||
                m.generic_name.toLowerCase().includes((item.generic_name || item.medicine_name || '').toLowerCase())
            );
            if (match) medId = match.id;
          }

          // Compute quantity if missing or 0
          const dur = item.duration_days || 5;
          let calculatedQty = item.calculated_quantity;
          if (!calculatedQty || calculatedQty === 0) {
            const sched = item.schedule;
            let dailyDoses = 0;
            if (sched) {
              if (sched.morning) dailyDoses += parseFloat(sched.morning_dose) || 1;
              if (sched.afternoon) dailyDoses += parseFloat(sched.afternoon_dose) || 1;
              if (sched.evening) dailyDoses += parseFloat(sched.evening_dose) || 1;
              if (sched.night) dailyDoses += parseFloat(sched.night_dose) || 1;
            }
            if (dailyDoses === 0) dailyDoses = 2; // default
            calculatedQty = Math.ceil(dailyDoses * dur);
          }

          return {
            ...item,
            medicine_id: medId,
            duration_days: dur,
            total_quantity: calculatedQty,
            dosage_form: item.dosage_form || 'TABLET',
            dose_amount: item.dose_amount || '1',
            dose_unit: item.dose_unit || 'Tablet',
            route: item.route || 'Oral',
            food_instruction: item.food_instruction || 'AFTER_FOOD',
            instructions: item.instructions || `Take ${item.dose_amount || '1'} ${item.dose_unit || 'Tablet'} ${item.frequency || 'after food'}`,
            schedule: item.schedule || {
              morning: true,
              morning_dose: '1',
              afternoon: false,
              afternoon_dose: '0',
              evening: false,
              evening_dose: '0',
              night: true,
              night_dose: '1',
            },
            review_flags: item.review_flags || [],
            expanded: true,
          };
        });

        setExtractedItems(enriched);
        setHasExtracted(true);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to extract structured prescription.';
      setExtractionError(msg);
    } finally {
      setIsExtracting(false);
    }
  };

  // Modify item fields manually
  const updateItem = (index: number, field: string, value: any) => {
    setExtractedItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };

      if (field.startsWith('schedule.')) {
        const sub = field.split('.')[1];
        const prevSched = item.schedule || {
          morning: true,
          morning_dose: '1',
          afternoon: false,
          afternoon_dose: '0',
          evening: false,
          evening_dose: '0',
          night: true,
          night_dose: '1',
        };
        const updatedSched = { ...prevSched, [sub]: value };
        item.schedule = updatedSched;

        // recalculate quantity if schedule changed
        const dur = item.duration_days || 5;
        let daily = 0;
        if (updatedSched.morning) daily += parseFloat(updatedSched.morning_dose) || 1;
        if (updatedSched.afternoon) daily += parseFloat(updatedSched.afternoon_dose) || 1;
        if (updatedSched.evening) daily += parseFloat(updatedSched.evening_dose) || 1;
        if (updatedSched.night) daily += parseFloat(updatedSched.night_dose) || 1;
        if (daily > 0) item.total_quantity = Math.ceil(daily * dur);
      } else if (field === 'duration_days') {
        item.duration_days = parseInt(value) || 1;
        const dur = item.duration_days;
        let daily = 0;
        if (item.schedule?.morning) daily += parseFloat(item.schedule.morning_dose || '1') || 1;
        if (item.schedule?.afternoon) daily += parseFloat(item.schedule.afternoon_dose || '1') || 1;
        if (item.schedule?.evening) daily += parseFloat(item.schedule.evening_dose || '1') || 1;
        if (item.schedule?.night) daily += parseFloat(item.schedule.night_dose || '1') || 1;
        if (daily > 0) item.total_quantity = Math.ceil(daily * dur);
      } else {
        (item as any)[field] = value;
      }

      copy[index] = item;
      return copy;
    });
  };

  const removeItem = (index: number) => {
    setExtractedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItemManually = () => {
    const defaultMed = formularyMedicines[0];
    const newItem: StructuredPrescriptionItem = {
      medicine_id: defaultMed?.id || null,
      medicine_name: defaultMed?.brand_name || 'New Medication',
      generic_name: defaultMed?.generic_name || '',
      strength: defaultMed?.strength || '',
      dosage_form: 'TABLET',
      dose_amount: '1',
      dose_unit: 'Tablet',
      frequency: '1-0-1 (After Food)',
      duration_days: 5,
      total_quantity: 10,
      route: 'Oral',
      food_instruction: 'AFTER_FOOD',
      is_prn: false,
      schedule: {
        morning: true,
        morning_dose: '1',
        afternoon: false,
        afternoon_dose: '0',
        evening: false,
        evening_dose: '0',
        night: true,
        night_dose: '1',
      },
      instructions: 'Take after meals',
      review_flags: [],
      expanded: true,
    };
    setExtractedItems((prev) => [...prev, newItem]);
    setHasExtracted(true);
  };

  // Confirm & Apply to Main Prescription Form
  const handleApplyToConsultation = () => {
    if (extractedItems.length === 0) {
      setExtractionError('Please add or extract at least one medication item.');
      return;
    }
    onApplyPrescriptions(extractedItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 z-[110]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Voice Prescription Dictation & AI Extraction</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Clinical Speech-to-Rx
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Dictate prescription details naturally. Review structured medicines, dosing, and schedule before saving.
                {patientName && <span className="text-white font-medium"> • Patient: {patientName}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Allergy Alert Banner if Patient has Allergies */}
        {patientAllergies.length > 0 && (
          <div className="px-5 py-2.5 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>Known Patient Allergies:</strong> {patientAllergies.join(', ')}. All dictated items are checked automatically.
            </span>
          </div>
        )}

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* STEP 1: Voice Recording & Dictation Controls */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Step 1: Doctor Dictation (Speech / Text)
              </div>

              {/* Dictation Status Badge */}
              <div className="flex items-center gap-2">
                {isRecording ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Recording ({formatTimer(recordingDuration)})
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">Ready to dictate or type</span>
                )}
              </div>
            </div>

            {/* Dictation Box */}
            <div className="relative">
              <textarea
                rows={3}
                value={interimText ? `${transcript} ${interimText}` : transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Dictate or type prescription here... (e.g. 'Paracetamol 500 mg, one tablet three times daily for three days, after food, morning, afternoon and night.')"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Microphone Action Row */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <div className="flex items-center gap-2">
                {isRecording ? (
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-slate-950 transition shadow-lg shadow-rose-500/20"
                  >
                    <MicOff className="w-4 h-4" /> Stop Recording
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-lg shadow-cyan-500/20"
                  >
                    <Mic className="w-4 h-4" /> Start Voice Dictation
                  </button>
                )}

                {transcript && (
                  <button
                    type="button"
                    onClick={() => {
                      setTranscript('');
                      setInterimText('');
                    }}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Clear Text
                  </button>
                )}
              </div>

              {/* Extract structured data button */}
              <button
                type="button"
                onClick={handleExtractPrescriptions}
                disabled={isExtracting || (!transcript.trim() && !interimText.trim())}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {isExtracting ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" /> Extracting Structured Rx...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Extract Structured Prescription
                  </>
                )}
              </button>
            </div>

            {/* Error notifications */}
            {micError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{micError}</span>
              </div>
            )}
            {extractionError && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{extractionError}</span>
              </div>
            )}
          </div>

          {/* STEP 2: Extracted Structured Prescription Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Step 2: Structured Medication Review & Safety Validation ({extractedItems.length} items)
              </div>
              <button
                type="button"
                onClick={addItemManually}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Medication Manually
              </button>
            </div>

            {extractedItems.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-slate-800 text-slate-500 text-xs space-y-1">
                <Pill className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="font-medium text-slate-400">No structured medications parsed yet.</p>
                <p>Dictate in the box above and click "Extract Structured Prescription", or add an item manually.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {extractedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 transition hover:border-slate-700"
                  >
                    {/* Item Header & Warning Flags */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">
                            #{idx + 1}. {item.medicine_name || 'Medication'}
                          </span>
                          {item.generic_name && (
                            <span className="text-[11px] text-slate-400">
                              ({item.generic_name})
                            </span>
                          )}
                          {item.dosage_form && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-cyan-300">
                              {item.dosage_form}
                            </span>
                          )}
                          {item.is_prn && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              PRN / As-Needed
                            </span>
                          )}
                        </div>

                        {/* Warnings / Flags */}
                        {item.review_flags && item.review_flags.length > 0 && (
                          <div className="space-y-1 pt-1">
                            {item.review_flags.map((flag, fIdx) => (
                              <div
                                key={fIdx}
                                className={`text-[11px] flex items-center gap-1.5 px-2.5 py-1 rounded-md ${
                                  flag.includes('ALLERGY')
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{flag}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
                          title="Remove Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Structured Grid Form */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
                      {/* Linked Formulary Medicine */}
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-semibold text-slate-400">
                          Hospital Formulary Medicine
                        </label>
                        <select
                          value={item.medicine_id || ''}
                          onChange={(e) => updateItem(idx, 'medicine_id', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                        >
                          <option value="">-- Non-Formulary / Custom Medication --</option>
                          {formularyMedicines.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.brand_name} ({m.generic_name} • {m.strength})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Dosage & Strength */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">
                          Dose / Strength
                        </label>
                        <input
                          type="text"
                          value={item.dosage_form ? `${item.dose_amount || '1'} ${item.dose_unit || 'Tablet'}` : (item.strength || '1 Tablet')}
                          onChange={(e) => updateItem(idx, 'dosage_form', e.target.value)}
                          placeholder="e.g. 1 Tablet (500mg)"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                        />
                      </div>

                      {/* Frequency */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">
                          Frequency
                        </label>
                        <input
                          type="text"
                          value={item.frequency || '1-0-1'}
                          onChange={(e) => updateItem(idx, 'frequency', e.target.value)}
                          placeholder="e.g. 3 times daily"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                        />
                      </div>

                      {/* Duration & Calculated Qty */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">
                          Duration (Days)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={item.duration_days || 5}
                          onChange={(e) => updateItem(idx, 'duration_days', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">
                          Total Quantity
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={item.total_quantity || 10}
                          onChange={(e) => updateItem(idx, 'total_quantity', parseInt(e.target.value) || 1)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                        />
                      </div>

                      {/* Food Instruction */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">
                          Food Instructions
                        </label>
                        <select
                          value={item.food_instruction || 'AFTER_FOOD'}
                          onChange={(e) => updateItem(idx, 'food_instruction', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                        >
                          <option value="AFTER_FOOD">After Food</option>
                          <option value="BEFORE_FOOD">Before Food</option>
                          <option value="WITH_FOOD">With Food</option>
                          <option value="EMPTY_STOMACH">On an Empty Stomach</option>
                          <option value="BEDTIME">At Bedtime</option>
                          <option value="NONE">As Directed / No Food Restriction</option>
                        </select>
                      </div>

                      {/* Route */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">
                          Route of Administration
                        </label>
                        <select
                          value={item.route || 'Oral'}
                          onChange={(e) => updateItem(idx, 'route', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                        >
                          <option value="Oral">Oral (PO)</option>
                          <option value="Intravenous">Intravenous (IV)</option>
                          <option value="Intramuscular">Intramuscular (IM)</option>
                          <option value="Inhalation">Inhalation</option>
                          <option value="Sublingual">Sublingual</option>
                          <option value="Topical">Topical</option>
                        </select>
                      </div>
                    </div>

                    {/* Time-of-Day Schedule (Morning, Afternoon, Evening, Night) */}
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                      <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        Time-of-Day Schedule & Variable Dosing
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {/* Morning */}
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                          <input
                            type="checkbox"
                            checked={!!item.schedule?.morning}
                            onChange={(e) => updateItem(idx, 'schedule.morning', e.target.checked)}
                            className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                          />
                          <div className="flex-1">
                            <span className="text-[10px] text-slate-400 block">Morning</span>
                            <input
                              type="text"
                              value={item.schedule?.morning_dose || '1'}
                              onChange={(e) => updateItem(idx, 'schedule.morning_dose', e.target.value)}
                              disabled={!item.schedule?.morning}
                              className="w-full px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[11px] text-white disabled:opacity-30"
                              placeholder="Dose"
                            />
                          </div>
                        </div>

                        {/* Afternoon */}
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                          <input
                            type="checkbox"
                            checked={!!item.schedule?.afternoon}
                            onChange={(e) => updateItem(idx, 'schedule.afternoon', e.target.checked)}
                            className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                          />
                          <div className="flex-1">
                            <span className="text-[10px] text-slate-400 block">Afternoon</span>
                            <input
                              type="text"
                              value={item.schedule?.afternoon_dose || '1'}
                              onChange={(e) => updateItem(idx, 'schedule.afternoon_dose', e.target.value)}
                              disabled={!item.schedule?.afternoon}
                              className="w-full px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[11px] text-white disabled:opacity-30"
                              placeholder="Dose"
                            />
                          </div>
                        </div>

                        {/* Evening */}
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                          <input
                            type="checkbox"
                            checked={!!item.schedule?.evening}
                            onChange={(e) => updateItem(idx, 'schedule.evening', e.target.checked)}
                            className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                          />
                          <div className="flex-1">
                            <span className="text-[10px] text-slate-400 block">Evening</span>
                            <input
                              type="text"
                              value={item.schedule?.evening_dose || '0'}
                              onChange={(e) => updateItem(idx, 'schedule.evening_dose', e.target.value)}
                              disabled={!item.schedule?.evening}
                              className="w-full px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[11px] text-white disabled:opacity-30"
                              placeholder="Dose"
                            />
                          </div>
                        </div>

                        {/* Night */}
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                          <input
                            type="checkbox"
                            checked={!!item.schedule?.night}
                            onChange={(e) => updateItem(idx, 'schedule.night', e.target.checked)}
                            className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                          />
                          <div className="flex-1">
                            <span className="text-[10px] text-slate-400 block">Night</span>
                            <input
                              type="text"
                              value={item.schedule?.night_dose || '1'}
                              onChange={(e) => updateItem(idx, 'schedule.night_dose', e.target.value)}
                              disabled={!item.schedule?.night}
                              className="w-full px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[11px] text-white disabled:opacity-30"
                              placeholder="Dose"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Specific Instructions */}
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400">
                        Doctor's Specific Instructions
                      </label>
                      <input
                        type="text"
                        value={item.instructions || ''}
                        onChange={(e) => updateItem(idx, 'instructions', e.target.value)}
                        placeholder="e.g. Take with warm water, avoid dairy for 2 hours..."
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-slate-400">
            {extractedItems.length > 0 ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {extractedItems.length} medication{extractedItems.length > 1 ? 's' : ''} ready for clinician confirmation
              </span>
            ) : (
              <span>Review extracted prescriptions before applying to consultation</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyToConsultation}
              disabled={extractedItems.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
            >
              <Check className="w-4 h-4" /> Apply to Consultation & Finalize
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
