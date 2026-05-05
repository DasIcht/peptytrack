import { useState, useEffect } from 'react';
import { useMedicationStore } from '../stores/medicationStore';
import { useUIStore } from '../stores/uiStore';
import { scheduleReminder } from '../lib/notifications';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Dose, InjectionSite } from '../types';
import { ChevronDown, MapPin, Calendar, Clock, FileText, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const INJECTION_SITES: { id: InjectionSite; label: string }[] = [
  { id: 'abdomen-upper-left', label: 'Abdomen — Upper Left' },
  { id: 'abdomen-upper-right', label: 'Abdomen — Upper Right' },
  { id: 'abdomen-lower-left', label: 'Abdomen — Lower Left' },
  { id: 'abdomen-lower-right', label: 'Abdomen — Lower Right' },
  { id: 'thigh-left', label: 'Thigh — Left' },
  { id: 'thigh-right', label: 'Thigh — Right' },
  { id: 'arm-left', label: 'Upper Arm — Left' },
  { id: 'arm-right', label: 'Upper Arm — Right' },
];

export function LogDose() {
  const { medications, doses, logDose, updateDose, deleteDose } = useMedicationStore();
  const { addToast, logDoseMedId, setLogDoseMedId } = useUIStore();

  const initialMedId = logDoseMedId || medications[0]?.id || '';
  const [selectedMedId, setSelectedMedId] = useState(initialMedId);

  useEffect(() => {
    if (logDoseMedId) setLogDoseMedId(null);
  }, [logDoseMedId, setLogDoseMedId]);

  const [editingDoseId, setEditingDoseId] = useState<string | null>(null);
  const [dosage, setDosage] = useState('');
  const [customDosage, setCustomDosage] = useState(false);
  const [injectionSite, setInjectionSite] = useState<InjectionSite>('abdomen-upper-left');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedMed = medications.find((m) => m.id === selectedMedId);

  // Dropdown only shows meds with logged doses (plus current selection for preselection)
  const medsWithDoses = medications.filter(
    (m) => m.id === selectedMedId || doses.some((d) => d.medicationId === m.id)
  );

  const medDoses = doses
    .filter((d) => d.medicationId === selectedMedId)
    .sort((a, b) => b.dateTime - a.dateTime);

  const resetForm = () => {
    setEditingDoseId(null);
    setDosage('');
    setCustomDosage(false);
    setInjectionSite('abdomen-upper-left');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setTime(format(new Date(), 'HH:mm'));
    setNotes('');
  };

  const handleEdit = (dose: Dose) => {
    setEditingDoseId(dose.id);
    setSelectedMedId(dose.medicationId);
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMed || !dosage) return;

    setSubmitting(true);
    const dateTime = new Date(`${date}T${time}`).getTime();

    try {
      if (editingDoseId) {
        await updateDose(editingDoseId, {
          medicationId: selectedMed.id,
          dosage: parseFloat(dosage),
          unit: selectedMed.unit,
          injectionSite,
          dateTime,
          notes,
        });
        addToast('Dose updated!', 'success');
      } else {
        await logDose({
          medicationId: selectedMed.id,
          dosage: parseFloat(dosage),
          unit: selectedMed.unit,
          injectionSite,
          dateTime,
          notes,
        });
        const createdAt = Date.now(); // eslint-disable-line react-hooks/purity
        scheduleReminder(selectedMed, [...doses, {
          id: '', medicationId: selectedMed.id, dosage: parseFloat(dosage),
          unit: selectedMed.unit, injectionSite, dateTime, notes, createdAt
        }]);
        addToast('Dose logged successfully!', 'success');
      }
      resetForm();
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

  const submitLabel = editingDoseId
    ? (submitting ? 'Updating...' : 'Update Dose')
    : (submitting ? 'Logging...' : 'Log Dose');

  return (
    <div className="min-h-full pb-24 px-5 pt-6">
      <h1 className="text-2xl font-bold text-white mb-6">{editingDoseId ? 'Update Dose' : 'Log Dose'}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Medication Select */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Medication</label>
          <div className="relative">
            <select
              value={selectedMedId}
              onChange={(e) => {
                setSelectedMedId(e.target.value);
                setDosage('');
                setCustomDosage(false);
              }}
              disabled={!!editingDoseId}
              className="w-full appearance-none bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors disabled:opacity-50"
            >
              {medsWithDoses.map((m) => (
                <option key={m.id} value={m.id}>{m.name} — {m.brand}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Dosage */}
        {selectedMed && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
              Dosage ({selectedMed.unit})
            </label>
            {!customDosage ? (
              <div className="flex flex-wrap gap-2">
                {selectedMed.dosageOptions.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDosage(String(d))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      dosage === String(d)
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/30'
                        : 'bg-surface-800 border border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setCustomDosage(true); setDosage(''); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-800 border border-white/10 text-slate-400 hover:border-white/20"
                >
                  Custom
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder={`Enter dosage in ${selectedMed.unit}`}
                  className="flex-1 bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setCustomDosage(false); setDosage(''); }}
                  className="px-3 py-2 rounded-lg text-xs bg-surface-800 border border-white/10 text-slate-400"
                >
                  Presets
                </button>
              </div>
            )}
          </div>
        )}

        {/* Injection Site */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
            <MapPin size={12} className="inline mr-1" />
            Injection Site
          </label>
          <div className="grid grid-cols-2 gap-2">
            {INJECTION_SITES.map((site) => (
              <button
                key={site.id}
                type="button"
                onClick={() => setInjectionSite(site.id)}
                className={`px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-all ${
                  injectionSite === site.id
                    ? 'bg-primary-600/20 border border-primary-500/40 text-primary-300'
                    : 'bg-surface-800 border border-white/5 text-slate-400 hover:border-white/15'
                }`}
              >
                {site.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
              <Calendar size={12} className="inline mr-1" />Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
              <Clock size={12} className="inline mr-1" />Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
            <FileText size={12} className="inline mr-1" />Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any side effects, observations..."
            rows={3}
            className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors resize-none"
          />
        </div>

        {/* Submit + Cancel */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!selectedMed || !dosage || submitting}
            className="flex-1 py-3.5 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-sm transition-all active:scale-[0.98] shadow-lg shadow-primary-900/30"
          >
            {submitLabel}
          </button>
          {editingDoseId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-3.5 rounded-xl bg-surface-800 hover:bg-surface-700 border border-white/10 text-slate-300 text-sm transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Dose History */}
      {selectedMed && medDoses.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            {selectedMed.name} History
          </h3>
          <div className="flex flex-col gap-2">
            {medDoses.map((dose) => {
              const med = medications.find((m) => m.id === dose.medicationId);
              return (
                <div
                  key={dose.id}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                    editingDoseId === dose.id
                      ? 'border-primary-500/40 bg-primary-600/10'
                      : 'border-white/5 bg-surface-800/30'
                  }`}
                >
                  <button
                    onClick={() => handleEdit(dose)}
                    className="flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-white">
                      {dose.dosage} {med?.unit || dose.unit}
                    </p>
                    <p className="text-xs text-slate-400">
                      {format(new Date(dose.dateTime), 'PPP p')}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">
                      {dose.injectionSite.replace(/-/g, ' ')} {dose.notes && `· ${dose.notes}`}
                    </p>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(dose)}
                      className="p-2 rounded-lg text-slate-500 hover:text-primary-300 hover:bg-primary-500/10 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(dose.id)}
                      className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
