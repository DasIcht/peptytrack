import { useState, useEffect, useRef } from 'react';
import { useMedicationStore } from '../stores/medicationStore';
import { useVialStore } from '../stores/vialStore';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSideEffectsStore } from '../stores/sideEffectsStore';
import { scheduleReminder } from '../lib/notifications';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SideEffectChips } from '../components/SideEffectChips';
import { CircularProgress } from '../components/CircularProgress';
import type { Dose, InjectionSite } from '../types';
import { getSideEffectsOrderedForMedication } from '../lib/sideEffects';
import { getNextInjectionSite } from '../lib/injectionRotation';
import {
  ChevronDown,
  MapPin,
  Calendar,
  Clock,
  FileText,
  Pencil,
  Trash2,
  FlaskConical,
  AlertTriangle,
  Syringe,
  RotateCw,
  Check,
  ChevronUp,
  ArrowLeft,
  Zap,
  List,
} from 'lucide-react';
import { format } from 'date-fns';

const INJECTION_SITES: { id: InjectionSite; label: string; emoji: string }[] = [
  { id: 'abdomen-upper-left', label: 'Upper Left', emoji: '🫃' },
  { id: 'abdomen-upper-right', label: 'Upper Right', emoji: '🫃' },
  { id: 'abdomen-lower-left', label: 'Lower Left', emoji: '🫃' },
  { id: 'abdomen-lower-right', label: 'Lower Right', emoji: '🫃' },
  { id: 'thigh-left', label: 'Left', emoji: '🦵' },
  { id: 'thigh-right', label: 'Right', emoji: '🦵' },
  { id: 'arm-left', label: 'Left', emoji: '💪' },
  { id: 'arm-right', label: 'Right', emoji: '💪' },
];

const SITE_ZONES: { key: string; label: string; emoji: string; sites: InjectionSite[] }[] = [
  { key: 'abdomen', label: 'Abdomen', emoji: '🫃', sites: ['abdomen-upper-left', 'abdomen-upper-right', 'abdomen-lower-left', 'abdomen-lower-right'] },
  { key: 'thigh', label: 'Thigh', emoji: '🦵', sites: ['thigh-left', 'thigh-right'] },
  { key: 'arm', label: 'Upper Arm', emoji: '💪', sites: ['arm-left', 'arm-right'] },
];

const LOG_MODE_KEY = 'pepty-log-mode';
type LogMode = 'quick' | 'full';

function useAnimatedNumber(target: number, duration = 600) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number>(0);
  const fromRef = useRef<number>(0);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = fromRef.current + (target - fromRef.current) * eased;
      setDisplay(current);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

export function LogDose() {
  const { medications, doses, logDose, updateDose, deleteDose } = useMedicationStore();
  const { vials, getVialRemaining, getVialPercentage, getLastUsedVialId } = useVialStore();
  const { addToast, logDoseMedId, setLogDoseMedId } = useUIStore();
  const { settings } = useSettingsStore();
  const { customEffects, addCustomSideEffect } = useSideEffectsStore();

  const initialMedId = logDoseMedId || medications[0]?.id || '';
  const [selectedMedId, setSelectedMedId] = useState(initialMedId);
  const [editingDoseId, setEditingDoseId] = useState<string | null>(null);
  const [selectedVialId, setSelectedVialId] = useState<string>('');
  const [dosage, setDosage] = useState('');
  const [customDosage, setCustomDosage] = useState(false);
  const [injectionSite, setInjectionSite] = useState<InjectionSite>('abdomen-upper-left');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [notes, setNotes] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [selectedSideEffects, setSelectedSideEffects] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  // Dual-mode state
  const [logMode, setLogMode] = useState<LogMode>(() => {
    const saved = localStorage.getItem(LOG_MODE_KEY) as LogMode | null;
    return saved === 'full' ? 'full' : 'quick';
  });
  const [switchingMode, setSwitchingMode] = useState(false);

  // Injection site zone expansion
  const [expandedZone, setExpandedZone] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logDoseMedId) setLogDoseMedId(null);
  }, [logDoseMedId, setLogDoseMedId]);

  useEffect(() => {
    if (editingDoseId || !selectedMedId) return;
    const lastUsed = getLastUsedVialId(selectedMedId, doses);
    if (lastUsed) {
      setSelectedVialId(lastUsed);
    } else {
      setSelectedVialId('');
    }
  }, [selectedMedId, editingDoseId]);

  useEffect(() => {
    if (editingDoseId || !selectedMedId) return;
    const activeSites = settings.injectionRotationSites;
    if (activeSites.length < 2) return;
    const nextSite = getNextInjectionSite(doses, settings.injectionRotationStrategy, activeSites);
    if (nextSite) {
      setInjectionSite(nextSite);
    }
  }, [selectedMedId, editingDoseId]);

  // When editing, always open in full mode
  useEffect(() => {
    if (editingDoseId) {
      setLogMode('full');
    }
  }, [editingDoseId]);

  const selectedMed = medications.find((m) => m.id === selectedMedId);

  const orderedSideEffects = selectedMedId
    ? getSideEffectsOrderedForMedication(selectedMedId, doses, customEffects[selectedMedId] ?? [])
    : [];

  const toggleSideEffect = (label: string) => {
    setSelectedSideEffects((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const handleAddCustom = async (label: string) => {
    if (!selectedMedId) return;
    await addCustomSideEffect(selectedMedId, label);
    setSelectedSideEffects((prev) => [...prev, label]);
  };

  const medsWithDoses = medications.filter(
    (m) => m.id === selectedMedId || doses.some((d) => d.medicationId === m.id)
  );

  const vialsForMed = vials
    .filter((v) => v.medicationId === selectedMedId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const selectedVial = vialsForMed.find((v) => v.id === selectedVialId);

  const remainingPeptide = selectedVial
    ? getVialRemaining(selectedVial.id, doses)
    : 0;

  const concentrationPerMl = selectedVial && selectedVial.bacWaterAmount > 0
    ? selectedVial.peptideAmount / selectedVial.bacWaterAmount
    : 0;

  const remainingMl = concentrationPerMl > 0
    ? remainingPeptide / concentrationPerMl
    : 0;

  const vialPercentage = selectedVial ? getVialPercentage(selectedVial.id, doses) : 0;
  const animatedRemaining = useAnimatedNumber(remainingPeptide);
  const animatedRemainingMl = useAnimatedNumber(remainingMl);
  const animatedInjectMl = useAnimatedNumber(
    dosage && parseFloat(dosage) > 0 && concentrationPerMl > 0
      ? parseFloat(dosage) / concentrationPerMl
      : 0
  );

  const medDoses = doses
    .filter((d) => d.medicationId === selectedMedId)
    .sort((a, b) => b.dateTime - a.dateTime);

  const resetForm = () => {
    setEditingDoseId(null);
    setSelectedVialId('');
    setDosage('');
    setCustomDosage(false);
    setInjectionSite('abdomen-upper-left');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setTime(format(new Date(), 'HH:mm'));
    setNotes('');
    setNotesExpanded(false);
    setSelectedSideEffects([]);
    setSubmitSuccess(false);
    setExpandedZone(null);
  };

  const handleEdit = (dose: Dose) => {
    setEditingDoseId(dose.id);
    setSelectedMedId(dose.medicationId);
    setSelectedVialId(dose.vialId || '');
    setDosage(String(dose.dosage));
    const med = medications.find((m) => m.id === dose.medicationId);
    if (med && !med.dosageOptions.includes(dose.dosage)) {
      setCustomDosage(true);
    } else {
      setCustomDosage(false);
    }
    setInjectionSite(dose.injectionSite);
    const d = new Date(dose.dateTime);
    setDate(format(d, 'yyyy-MM-dd'));
    setTime(format(d, 'HH:mm'));
    setNotes(dose.notes);
    setNotesExpanded(!!dose.notes);
    setSelectedSideEffects(dose.sideEffects ?? []);
    // Determine which zone to expand based on the dose's injection site
    const zone = SITE_ZONES.find((z) => z.sites.includes(dose.injectionSite));
    setExpandedZone(zone?.key || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleModeChange = (mode: LogMode) => {
    if (mode === logMode) return;
    setSwitchingMode(true);
    setTimeout(() => {
      setLogMode(mode);
      localStorage.setItem(LOG_MODE_KEY, mode);
      setSwitchingMode(false);
    }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMed || !dosage) return;

    setSubmitting(true);
    // In quick mode, use current date/time if not explicitly set
    const dateTime = logMode === 'quick' && !editingDoseId
      ? Date.now()
      : new Date(`${date}T${time}`).getTime();

    try {
      if (editingDoseId) {
        await updateDose(editingDoseId, {
          medicationId: selectedMed.id,
          vialId: selectedVialId || undefined,
          dosage: parseFloat(dosage),
          unit: selectedMed.unit,
          injectionSite,
          dateTime,
          notes,
          sideEffects: selectedSideEffects,
        });
        addToast('Dose updated!', 'success');
      } else {
        await logDose({
          medicationId: selectedMed.id,
          vialId: selectedVialId || undefined,
          dosage: parseFloat(dosage),
          unit: selectedMed.unit,
          injectionSite,
          dateTime,
          notes,
          sideEffects: selectedSideEffects,
        });
        const createdAt = Date.now();
        scheduleReminder(selectedMed, [...doses, {
          id: '', medicationId: selectedMed.id, vialId: selectedVialId || undefined,
          dosage: parseFloat(dosage), unit: selectedMed.unit, injectionSite, dateTime, notes, sideEffects: selectedSideEffects, createdAt
        }]);
        addToast('Dose logged successfully!', 'success');
      }
      setSubmitSuccess(true);
      setTimeout(() => resetForm(), 600);
    } catch {
      addToast(editingDoseId ? 'Failed to update dose' : 'Failed to log dose', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const { openModal } = useUIStore();

  const handleDelete = (id: string) => {
    openModal(
      <ConfirmDialog
        title="Delete Dose Entry?"
        message="This action cannot be undone. The dose will be permanently removed from your history."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={async () => {
          try {
            await deleteDose(id);
            addToast('Dose deleted', 'info');
            if (editingDoseId === id) resetForm();
          } catch {
            addToast('Failed to delete dose', 'error');
          }
        }}
      />
    );
  };

  const doseExceedsRemaining = selectedVial && dosage && parseFloat(dosage) > remainingPeptide;

  // Determine which zone is currently selected
  const selectedZone = SITE_ZONES.find((z) => z.sites.includes(injectionSite));

  // Active zones based on settings
  const activeZones = SITE_ZONES.filter(
    (z) => z.sites.some((s) => settings.injectionRotationSites.includes(s))
  );

  const isQuick = logMode === 'quick' && !editingDoseId;

  return (
    <div className="min-h-full pb-28 px-5 pt-6" ref={formRef}>
      {/* Hero Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          {editingDoseId && (
            <button
              type="button"
              onClick={resetForm}
              className="p-2 rounded-xl bg-surface-800/60 border border-white/5 text-slate-400 hover:text-white hover:bg-surface-700 transition-all btn-tactile"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="text-gradient">{editingDoseId ? 'Update' : 'Log'}</span>
            <span className="text-white ml-2">Dose</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
              editingDoseId
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                editingDoseId ? 'bg-amber-400' : 'bg-primary-400 animate-pulse'
              }`}
            />
            {editingDoseId ? 'Editing Entry' : 'New Dose'}
          </span>
          {selectedMed && (
            <span className="text-xs text-slate-500">
              {selectedMed.name} — {selectedMed.brand}
            </span>
          )}
        </div>
      </div>

      {/* Mode Toggle — hidden when editing */}
      {!editingDoseId && (
        <div className="mode-toggle mb-6">
          <button
            type="button"
            onClick={() => handleModeChange('quick')}
            className={`mode-toggle-btn ${isQuick ? 'active' : ''}`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Zap size={12} />
              Quick Log
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('full')}
            className={`mode-toggle-btn ${!isQuick ? 'active' : ''}`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <List size={12} />
              Full Log
            </span>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={`flex flex-col gap-5 mode-content ${switchingMode ? 'switching' : ''}`}>
        {/* Medication Select */}
        <div className="card-premium p-5">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-widest">
            <PillIcon size={12} className="text-primary-400" />
            Medication
          </label>
          <div className="relative">
            <select
              value={selectedMedId}
              onChange={(e) => {
                setSelectedMedId(e.target.value);
                setSelectedVialId('');
                setDosage('');
                setCustomDosage(false);
                setSelectedSideEffects([]);
                setExpandedZone(null);
              }}
              disabled={!!editingDoseId}
              className="w-full appearance-none bg-surface-900/50 border border-white/8 rounded-xl px-4 py-3.5 text-white text-sm font-medium focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)] transition-all disabled:opacity-50"
            >
              {medsWithDoses.map((m) => (
                <option key={m.id} value={m.id}>{m.name} — {m.brand}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Vial — Quick Log: compact summary; Full Log: select + dashboard */}
        {selectedMed && vialsForMed.length > 0 && (
          <div className="card-premium p-5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-widest">
              <FlaskConical size={12} className="text-primary-400" />
              Vial
            </label>
            {isQuick ? (
              // Quick Log: 2-column layout — dropdown left, summary right
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <select
                      value={selectedVialId}
                      onChange={(e) => setSelectedVialId(e.target.value)}
                      className="w-full appearance-none bg-surface-900/50 border border-white/8 rounded-xl px-3 py-3 text-white text-sm font-medium focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)] transition-all"
                    >
                      <option value="">No vial</option>
                      {vialsForMed.map((v) => {
                        const rem = getVialRemaining(v.id, doses);
                        return (
                          <option key={v.id} value={v.id}>
                            {v.name} — {rem.toFixed(2)} {v.peptideUnit}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  {selectedVial ? (
                    <div className="vial-summary justify-between">
                      <span className="vial-name truncate">{selectedVial.name}</span>
                      <span className="vial-remaining whitespace-nowrap">
                        <span className={
                          vialPercentage < 25 ? 'low' : vialPercentage < 50 ? 'medium' : 'high'
                        }>
                          {remainingPeptide.toFixed(2)}
                        </span>
                        {' '}{selectedVial.peptideUnit}
                      </span>
                    </div>
                  ) : (
                    <div className="vial-summary justify-center text-slate-500 text-xs">
                      Select a vial
                    </div>
                  )}
                </div>
                {doseExceedsRemaining && (
                  <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2">
                    <AlertTriangle size={14} className="flex-shrink-0" />
                    This dose exceeds the remaining amount.
                  </div>
                )}
                {dosage && parseFloat(dosage) > 0 && concentrationPerMl > 0 && (
                  <div className="rounded-lg border border-white/5 bg-surface-900/40 p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                      <Syringe size={18} className="text-primary-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-white">
                        Inject <strong className="text-primary-300">{animatedInjectMl.toFixed(2)} ml</strong>
                      </div>
                      <div className="text-xs text-slate-400">
                        {Math.round((parseFloat(dosage) / concentrationPerMl) * 100)} units (U-100)
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Full Log: 2-column top row (dropdown + summary), dashboard below
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <select
                      value={selectedVialId}
                      onChange={(e) => setSelectedVialId(e.target.value)}
                      className="w-full appearance-none bg-surface-900/50 border border-white/8 rounded-xl px-3 py-3.5 text-white text-sm font-medium focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)] transition-all"
                    >
                      <option value="">No vial — generic dose</option>
                      {vialsForMed.map((v) => {
                        const rem = getVialRemaining(v.id, doses);
                        return (
                          <option key={v.id} value={v.id}>
                            {v.name} — {rem.toFixed(2)} {v.peptideUnit}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  {selectedVial ? (
                    <div className="vial-summary justify-between">
                      <span className="vial-name truncate">{selectedVial.name}</span>
                      <span className="vial-remaining whitespace-nowrap">
                        <span className={
                          vialPercentage < 25 ? 'low' : vialPercentage < 50 ? 'medium' : 'high'
                        }>
                          {remainingPeptide.toFixed(2)}
                        </span>
                        {' '}{selectedVial.peptideUnit}
                      </span>
                    </div>
                  ) : (
                    <div className="vial-summary justify-center text-slate-500 text-xs">
                      Select a vial
                    </div>
                  )}
                </div>
                {selectedVial && (
                  <div className="rounded-xl border border-primary-500/10 bg-primary-500/[0.03] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <CircularProgress
                        percentage={vialPercentage}
                        size={64}
                        strokeWidth={5}
                        label={selectedVial.name}
                        sublabel={`${remainingPeptide.toFixed(2)} ${selectedVial.peptideUnit}`}
                      />
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white tabular-nums">
                          {animatedRemaining.toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-400">
                          {selectedVial.peptideUnit} remaining
                        </div>
                        {selectedVial.bacWaterAmount > 0 && concentrationPerMl > 0 && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            ≈ {animatedRemainingMl.toFixed(2)} ml
                          </div>
                        )}
                      </div>
                    </div>
                    {doseExceedsRemaining && (
                      <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2">
                        <AlertTriangle size={14} className="flex-shrink-0" />
                        This dose exceeds the remaining amount in the vial.
                      </div>
                    )}
                    {dosage && parseFloat(dosage) > 0 && concentrationPerMl > 0 && (
                      <div className="rounded-lg border border-white/5 bg-surface-900/40 p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                          <Syringe size={18} className="text-primary-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-white">
                            Inject <strong className="text-primary-300">{animatedInjectMl.toFixed(2)} ml</strong>
                          </div>
                          <div className="text-xs text-slate-400">
                            {Math.round((parseFloat(dosage) / concentrationPerMl) * 100)} units (U-100) · {concentrationPerMl.toFixed(2)} {selectedVial.peptideUnit}/ml
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dosage */}
        {selectedMed && (
          <div className="card-premium p-5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-3 uppercase tracking-widest">
              <Syringe size={12} className="text-primary-400" />
              Dosage ({selectedMed.unit})
            </label>
            {!customDosage ? (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {selectedMed.dosageOptions.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDosage(String(d))}
                    className={`btn-tactile flex-shrink-0 h-9 px-3 rounded-lg text-xs font-semibold transition-all ${
                      dosage === String(d)
                        ? 'bg-primary-600 text-white shadow-md shadow-primary-900/30 ring-1 ring-primary-400/30'
                        : 'bg-surface-900/50 border border-white/8 text-slate-300 hover:border-white/15 hover:bg-surface-800'
                    }`}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setCustomDosage(true); setDosage(''); }}
                  className="btn-tactile flex-shrink-0 h-9 px-3 rounded-lg text-xs font-semibold bg-surface-900/50 border border-dashed border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20 transition-all"
                >
                  Custom
                </button>
              </div>
            ) : (
              <div className="flex gap-2 animate-slide-up">
                <input
                  type="number"
                  step="0.01"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder={`Enter dosage in ${selectedMed.unit}`}
                  className="flex-1 input-premium py-2.5 text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setCustomDosage(false); setDosage(''); }}
                  className="btn-tactile px-3 py-2 rounded-lg text-xs font-medium bg-surface-800 border border-white/10 text-slate-400 hover:text-white"
                >
                  Presets
                </button>
              </div>
            )}
          </div>
        )}

        {/* Injection Site — 2-Column: Zone Selector | Site Grid */}
        <div className="card-premium p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              <MapPin size={12} className="text-primary-400" />
              Injection Site
            </label>
            {!editingDoseId && settings.injectionRotationSites.length >= 2 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400 text-[10px] font-medium border border-primary-500/15">
                <RotateCw size={9} />
                {settings.injectionRotationStrategy}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Left: Zone Selector */}
            <div className="flex flex-col gap-1.5">
              {activeZones.map((zone) => {
                const isActive = selectedZone?.key === zone.key;
                return (
                  <button
                    key={zone.key}
                    type="button"
                    onClick={() => {
                      setExpandedZone(zone.key);
                      if (!zone.sites.includes(injectionSite)) {
                        const firstActive = zone.sites.find((s) => settings.injectionRotationSites.includes(s));
                        if (firstActive) setInjectionSite(firstActive);
                      }
                    }}
                    className={`btn-tactile flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all ${
                      isActive
                        ? 'bg-primary-600/15 border border-primary-500/40 text-primary-300 shadow-[0_0_12px_rgba(20,184,166,0.12)]'
                        : 'bg-surface-900/50 border border-white/5 text-slate-400 hover:border-white/15 hover:bg-surface-800'
                    }`}
                  >
                    <span className="text-base leading-none">{zone.emoji}</span>
                    <span className="text-[11px] font-semibold">{zone.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right: Site Grid */}
            <div className="bg-surface-900/30 rounded-xl border border-white/5 p-2">
              <div className="grid grid-cols-2 gap-1.5 h-full">
                {(() => {
                  const zone = activeZones.find((z) => z.key === expandedZone) || activeZones[0];
                  if (!zone) return null;
                  const zoneSites = zone.sites.filter((s) => settings.injectionRotationSites.includes(s));
                  return zoneSites.map((siteId) => {
                    const site = INJECTION_SITES.find((s) => s.id === siteId)!;
                    const isSelected = injectionSite === siteId;
                    return (
                      <button
                        key={siteId}
                        type="button"
                        onClick={() => setInjectionSite(siteId)}
                        className={`btn-tactile flex items-center justify-center gap-1 px-1.5 py-2 rounded-lg text-[10px] font-semibold text-center transition-all ${
                          isSelected
                            ? 'bg-primary-600/20 border border-primary-500/50 text-primary-300 shadow-[0_0_8px_rgba(20,184,166,0.12)]'
                            : 'bg-surface-800/50 border border-white/5 text-slate-500 hover:border-white/15 hover:bg-surface-700 hover:text-slate-300'
                        }`}
                      >
                        {isSelected && <Check size={10} className="text-primary-400 flex-shrink-0" />}
                        <span className="truncate">{site.label}</span>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Current Selection Summary */}
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MapPin size={12} className="text-primary-400" />
              <span>Selected:</span>
              <span className="text-white font-medium capitalize">
                {selectedZone?.label} · {INJECTION_SITES.find((s) => s.id === injectionSite)?.label}
              </span>
            </div>
          </div>
        </div>

        {/* Full Log Only Sections */}
        {!isQuick && (
          <>
            {/* Date & Time */}
            <div className="card-premium p-5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-3 uppercase tracking-widest">
                <Calendar size={12} className="text-primary-400" />
                Date & Time
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full input-premium pl-9 py-3.5"
                  />
                </div>
                <div className="relative">
                  <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full input-premium pl-9 py-3.5"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="card-premium p-5">
              <button
                type="button"
                onClick={() => setNotesExpanded((p) => !p)}
                className="w-full flex items-center justify-between"
              >
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-widest cursor-pointer">
                  <FileText size={12} className="text-primary-400" />
                  Notes {notes && <span className="text-primary-400 text-[10px]">({notes.length})</span>}
                </label>
                {notesExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  notesExpanded ? 'max-h-48 opacity-100 mt-3' : 'max-h-0 opacity-0'
                }`}
              >
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any side effects, observations..."
                  rows={3}
                  className="w-full input-premium resize-none"
                />
                <div className="text-right text-[10px] text-slate-600 mt-1">
                  {notes.length} / 500
                </div>
              </div>
            </div>

            {/* Side Effects */}
            <div className="card-premium p-5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-3 uppercase tracking-widest">
                Side Effects
                <span className="text-slate-600 font-normal normal-case">(tap to log)</span>
              </label>
              <SideEffectChips
                sideEffects={orderedSideEffects}
                selected={selectedSideEffects}
                onToggle={toggleSideEffect}
                onAddCustom={handleAddCustom}
              />
            </div>
          </>
        )}

        {/* Submit + Cancel */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={!selectedMed || !dosage || submitting}
            className={`btn-tactile flex-1 py-4 rounded-xl font-semibold text-sm transition-all shadow-lg ${
              submitSuccess
                ? 'bg-emerald-600 text-white shadow-emerald-900/30'
                : 'bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white shadow-primary-900/30'
            } disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none`}
          >
            <span className="flex items-center justify-center gap-2">
              {submitSuccess ? (
                <>
                  <Check size={18} />
                  Saved!
                </>
              ) : submitting ? (
                <>
                  <Spinner />
                  {editingDoseId ? 'Updating...' : 'Logging...'}
                </>
              ) : (
                editingDoseId ? 'Update Dose' : 'Log Dose'
              )}
            </span>
          </button>
          {editingDoseId && (
            <button
              type="button"
              onClick={resetForm}
              className="btn-tactile px-5 py-4 rounded-xl bg-surface-800 hover:bg-surface-700 border border-white/10 text-slate-300 text-sm font-medium transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Dose History — Timeline */}
      {selectedMed && medDoses.length > 0 && (
        <div className="mt-10">
          <button
            type="button"
            onClick={() => setShowHistory((p) => !p)}
            className="w-full flex items-center justify-between mb-4"
          >
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">
              {selectedMed.name} History
            </h3>
            {showHistory ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
          </button>

          <div
            className={`overflow-hidden transition-all duration-500 ease-out ${
              showHistory ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="relative pl-4">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/8" />

              <div className="flex flex-col gap-4 stagger-children">
                {medDoses.map((dose) => {
                  const med = medications.find((m) => m.id === dose.medicationId);
                  const vial = vials.find((v) => v.id === dose.vialId);
                  const isEditing = editingDoseId === dose.id;
                  return (
                    <div
                      key={dose.id}
                      className={`relative flex gap-3 rounded-xl border px-4 py-3.5 transition-all ${
                        isEditing
                          ? 'border-primary-500/40 bg-primary-600/10 shadow-[0_0_16px_rgba(20,184,166,0.08)]'
                          : 'border-white/5 bg-surface-900/40 hover:border-white/10 hover:bg-surface-800/60'
                      }`}
                    >
                      {/* Timeline dot */}
                      <div className="absolute -left-[9px] top-5 w-[15px] h-[15px] rounded-full border-[3px] border-surface-950 bg-primary-500/80 z-10" />

                      <button
                        onClick={() => handleEdit(dose)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-lg font-bold text-white">
                            {dose.dosage} {med?.unit || dose.unit}
                          </span>
                          {vial && (
                            <span className="text-xs text-slate-500 font-medium">
                              · {vial.name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {format(new Date(dose.dateTime), 'PPP p')}
                        </p>
                        <p className="text-xs text-slate-500 capitalize mt-0.5">
                          {dose.injectionSite.replace(/-/g, ' ')}
                          {dose.notes && ` · ${dose.notes}`}
                        </p>
                        {dose.sideEffects && dose.sideEffects.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {dose.sideEffects.map((ef) => (
                              <span
                                key={ef}
                                className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-400 text-[10px] font-medium border border-primary-500/15"
                              >
                                {ef}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(dose)}
                          className="p-2 rounded-lg text-slate-500 hover:text-primary-300 hover:bg-primary-500/10 transition-colors"
                          aria-label="Edit dose"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(dose.id)}
                          className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          aria-label="Delete dose"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Inline spinner component */
function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* Inline pill icon */
function PillIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </svg>
  );
}
