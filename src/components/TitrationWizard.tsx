import { useState } from 'react';
import { useProtocolStore } from '../stores/protocolStore';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { uuid } from '../lib/uuid';
import type { ProtocolStep } from '../types';
import { Plus, Trash2, Calendar, Syringe, Settings2, Play, Square, PieChart } from 'lucide-react';

interface TitrationWizardProps {
  medicationId: string;
  medicationUnit: string;
  medicationName: string;
  onClose: () => void;
}

export function TitrationWizard({ medicationId, medicationUnit, medicationName, onClose }: TitrationWizardProps) {
  const { addToast } = useUIStore();
  const { getActiveProtocolForMedication, addProtocol, updateProtocol, deleteProtocol } = useProtocolStore();
  const targetMode = useSettingsStore(state => state.settings.titrationTargetMode);

  const existingProtocol = getActiveProtocolForMedication(medicationId);

  const [steps, setSteps] = useState<ProtocolStep[]>(
    existingProtocol?.steps || [{ id: uuid(), dosage: 0.25, durationWeeks: 4 }]
  );
  const [autoAdvance, setAutoAdvance] = useState(existingProtocol?.autoAdvance ?? false);
  const [chartStyle, setChartStyle] = useState<'spider' | 'gauges' | 'timeline'>(
    existingProtocol?.chartStyle || 'spider'
  );
  const [submitting, setSubmitting] = useState(false);

  const handleAddStep = () => {
    const lastStep = steps[steps.length - 1];
    setSteps([...steps, { id: uuid(), dosage: (lastStep?.dosage || 0) * 2, durationWeeks: 4 }]);
  };

  const handleRemoveStep = (id: string) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter(s => s.id !== id));
  };

  const handleStepChange = (id: string, field: keyof ProtocolStep, value: number) => {
    setSteps(steps.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSave = async () => {
    if (steps.some(s => s.dosage <= 0 || s.durationWeeks <= 0)) {
      addToast('Please ensure all dosages and durations are greater than 0.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (existingProtocol) {
        await updateProtocol(existingProtocol.id, { steps, autoAdvance, chartStyle });
        addToast('Protocol updated', 'success');
      } else {
        await addProtocol({
          medicationId,
          name: `${medicationName} Protocol`,
          steps,
          currentStepIndex: 0,
          startDate: null,
          currentStepStartDate: null,
          autoAdvance,
          chartStyle,
          targetType: targetMode,
        });
        addToast('Protocol created', 'success');
      }
      onClose();
    } catch {
      addToast('Failed to save protocol', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingProtocol) return;
    try {
      await deleteProtocol(existingProtocol.id);
      addToast('Protocol deleted', 'info');
      onClose();
    } catch {
      addToast('Failed to delete protocol', 'error');
    }
  };

  const handleToggleState = async () => {
    if (!existingProtocol) return;
    const isStarting = existingProtocol.startDate === null;
    try {
      await updateProtocol(existingProtocol.id, {
        startDate: isStarting ? Date.now() : null,
        currentStepStartDate: isStarting ? Date.now() : null,
        currentStepIndex: 0,
      });
      addToast(isStarting ? 'Protocol started' : 'Protocol stopped', 'info');
      onClose();
    } catch {
      addToast('Failed to update protocol state', 'error');
    }
  };

  return (
    <div className="bg-surface-800 border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl relative">
      <h3 className="text-xl font-bold text-white mb-1">Titration Protocol</h3>
      <p className="text-sm text-slate-400 mb-6">Define a scheduled step-up plan for {medicationName}.</p>

      <div className="space-y-4 mb-6">
        {steps.map((step, index) => (
          <div key={step.id} className="bg-surface-900/50 rounded-xl p-4 border border-white/5 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-primary-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-primary-500/20 flex items-center justify-center text-[10px]">
                  {index + 1}
                </span>
                Step {index + 1}
              </span>
              {steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveStep(step.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <Syringe size={10} /> Dosage ({medicationUnit})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={step.dosage || ''}
                  onChange={(e) => handleStepChange(step.id, 'dosage', parseFloat(e.target.value))}
                  className="input-premium py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar size={10} /> Duration (Weeks)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={step.durationWeeks || ''}
                  onChange={(e) => handleStepChange(step.id, 'durationWeeks', parseInt(e.target.value, 10))}
                  className="input-premium py-2 text-sm w-full"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddStep}
        className="w-full py-3 mb-6 rounded-xl bg-surface-900 border border-dashed border-white/20 text-slate-400 hover:text-white hover:border-white/40 flex items-center justify-center gap-2 text-sm font-medium transition-all"
      >
        <Plus size={16} /> Add Next Step
      </button>

      <div className="bg-surface-900/30 border border-white/5 rounded-xl p-4 mb-6">
        <label className="flex flex-col gap-2 cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <Settings2 size={14} className="text-primary-400" />
              Auto-Advance Protocol
            </span>
            <div className={`w-10 h-5 rounded-full transition-colors relative ${autoAdvance ? 'bg-primary-500' : 'bg-surface-700'}`}>
              <div className={`absolute top-0.5 bottom-0.5 w-4 bg-white rounded-full transition-transform ${autoAdvance ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </div>
            <input
              type="checkbox"
              className="sr-only"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
            />
          </div>
          <span className="text-xs text-slate-400">
            If enabled, the app will automatically move to the next step when the duration is met and conditions are safe. If disabled, you will be prompted to manually confirm.
          </span>
        </label>
        
        <div className="mt-4 pt-4 border-t border-white/5">
          <label className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
            <PieChart size={14} className="text-primary-400" />
            Visualization Style
          </label>
          <div className="flex bg-surface-800 rounded-xl p-1 border border-white/5">
            <button
              type="button"
              onClick={() => setChartStyle('spider')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                chartStyle === 'spider' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Spider
            </button>
            <button
              type="button"
              onClick={() => setChartStyle('gauges')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                chartStyle === 'gauges' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Gauges
            </button>
            <button
              type="button"
              onClick={() => setChartStyle('timeline')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                chartStyle === 'timeline' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Timeline
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 text-center">
            {chartStyle === 'spider' && 'Shows a readiness radar chart.'}
            {chartStyle === 'gauges' && 'Shows discrete dials for time, symptoms, and weight.'}
            {chartStyle === 'timeline' && 'Shows symptom history over the last 14 days.'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-surface-700 text-white font-medium hover:bg-surface-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-500 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save Protocol'}
          </button>
        </div>
        
        {existingProtocol && (
          <div className="flex gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={handleToggleState}
              className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors ${
                existingProtocol.startDate 
                  ? 'border-amber-500/20 text-amber-400 hover:bg-amber-500/10' 
                  : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              {existingProtocol.startDate ? <><Square size={12} className="fill-current" /> Stop Protocol</> : <><Play size={12} className="fill-current" /> Start Protocol</>}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 py-2.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
