import { useState, useEffect } from 'react';
import { useMedicationStore } from '../stores/medicationStore';
import { useProtocolStore } from '../stores/protocolStore';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { uuid } from '../lib/uuid';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TitrationWizard } from '../components/TitrationWizard';
import { MEDICATION_LIBRARY } from '../db/seed';
import { HelpBox } from '../components/HelpBox';
import type { Frequency } from '../types';
import { Pill, Trash2, Edit3, Clock, ChevronRight, X, Plus, Save, Activity } from 'lucide-react';

const COLOR_PRESETS = [
  '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899',
  '#3b82f6', '#06b6d4', '#84cc16', '#ef4444', '#a855f7',
];

function useDefaultUnit(): 'mg' | 'mcg' | 'units' {
  const { getSetting } = useSettingsStore();
  return (getSetting('medicationUnit') as 'mg' | 'mcg' | 'units' | undefined) || 'mg';
}

function useCustomFormDefaults() {
  const defaultUnit = useDefaultUnit();
  const [customForm, setCustomForm] = useState({
    name: '',
    brand: '',
    activeIngredient: '',
    dosageOptions: '',
    unit: defaultUnit,
    frequency: 'weekly' as Frequency,
    customFrequencyDays: 5,
    halfLifeHours: '',
    color: COLOR_PRESETS[0],
  });
  return { customForm, setCustomForm, defaultUnit };
}

export function Medications() {
  const { medications, deleteMedication, updateMedication, enableMedication, loadData } = useMedicationStore();
  const { protocols } = useProtocolStore();
  const { addToast, openModal } = useUIStore();

  const [editingId, setEditingId] = useState<string | null>(null);
interface EditForm {
  name?: string;
  brand?: string;
  activeIngredient?: string;
  dosageOptions?: string;
  unit?: string;
  frequency?: string;
  customFrequencyDays?: number;
  halfLifeHours?: string;
  color?: string;
  reminderHoursBefore?: number;
}
  const [editForm, setEditForm] = useState<EditForm>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [wizardMedId, setWizardMedId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<'library' | 'custom'>('library');
  const { customForm, setCustomForm, defaultUnit } = useCustomFormDefaults();

  // Sync unit when settings change
  useEffect(() => {
    setCustomForm((f) => ({ ...f, unit: defaultUnit }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultUnit]);

  // Close wizard if disabled globally
  const { settings } = useSettingsStore();
  useEffect(() => {
    if (!settings.titrationWizardEnabled) {
      setWizardMedId(null);
    }
  }, [settings.titrationWizardEnabled]);

  const handleDelete = (id: string) => {
    openModal(
      <ConfirmDialog
        title="Delete Medication?"
        message="This will permanently delete the medication and all its dose history. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={async () => {
          await deleteMedication(id);
          addToast('Medication deleted', 'info');
        }}
      />
    );
  };

  const startEdit = (med: typeof medications[0]) => {
    setEditForm({
      name: med.name,
      brand: med.brand,
      activeIngredient: med.activeIngredient,
      dosageOptions: med.dosageOptions.join(', '),
      unit: med.unit,
      frequency: med.frequency,
      customFrequencyDays: med.customFrequencyDays,
      halfLifeHours: String(med.halfLifeHours),
      color: med.color,
      reminderHoursBefore: med.reminderHoursBefore,
    });
    setEditingId(med.id);
  };

  const handleSaveEdit = async (id: string) => {
    const dosages = String(editForm.dosageOptions || '')
      .split(/[,;\s]+/)
      .map((s: string) => parseFloat(s.trim()))
      .filter((n: number) => !isNaN(n) && n > 0);

    if (!String(editForm.name || '').trim()) {
      addToast('Medication name is required', 'error');
      return;
    }
    if (dosages.length === 0) {
      addToast('Enter at least one valid dosage', 'error');
      return;
    }
    const halfLife = parseFloat(String(editForm.halfLifeHours || ''));
    if (isNaN(halfLife) || halfLife <= 0) {
      addToast('Enter a valid half-life in hours', 'error');
      return;
    }

    await updateMedication(id, {
      name: String(editForm.name).trim(),
      brand: String(editForm.brand || '').trim(),
      activeIngredient: String(editForm.activeIngredient || '').trim(),
      dosageOptions: dosages,
      unit: String(editForm.unit || 'mg'),
      frequency: editForm.frequency as Frequency,
      customFrequencyDays: editForm.frequency === 'custom' ? editForm.customFrequencyDays : undefined,
      halfLifeHours: halfLife,
      color: String(editForm.color || COLOR_PRESETS[0]),
      reminderHoursBefore: Number(editForm.reminderHoursBefore || 24),
    });
    setEditingId(null);
    addToast('Medication updated', 'success');
  };

  const handleAddFromLibrary = async (template: typeof MEDICATION_LIBRARY[0]) => {
    try {
      const exists = medications.some((m) => m.templateId === template.id);
      if (exists) {
        addToast('This medication is already in your list', 'error');
        return;
      }

      await useMedicationStore.getState().addMedication({
        templateId: template.id,
        name: template.name,
        brand: template.brand,
        activeIngredient: template.activeIngredient,
        dosageOptions: template.dosageOptions,
        unit: template.unit,
        frequency: template.frequency,
        halfLifeHours: template.halfLifeHours,
        color: template.color,
        reminderHoursBefore: template.frequency === 'daily' ? 1 : 24,
        enabled: true,
      });

      setShowAddModal(false);
      setAddMode('library');
      await loadData();
      addToast('Medication added!', 'success');
    } catch (err) {
      console.error('Failed to add medication from library:', err);
      addToast('Failed to add medication', 'error');
    }
  };

  const handleAddCustom = async () => {
    try {
      const dosages = customForm.dosageOptions
        .split(/[,;\s]+/)
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n) && n > 0);

      if (!customForm.name.trim()) {
        addToast('Medication name is required', 'error');
        return;
      }
      if (dosages.length === 0) {
        addToast('Enter at least one valid dosage (comma-separated numbers)', 'error');
        return;
      }
      const halfLife = parseFloat(customForm.halfLifeHours);
      if (isNaN(halfLife) || halfLife <= 0) {
        addToast('Enter a valid half-life in hours', 'error');
        return;
      }

      await useMedicationStore.getState().addMedication({
        templateId: 'custom-' + uuid(),
        name: customForm.name.trim(),
        brand: customForm.brand.trim() || 'Custom',
        activeIngredient: customForm.activeIngredient.trim() || customForm.name.trim(),
        dosageOptions: dosages,
        unit: customForm.unit,
        frequency: customForm.frequency,
        customFrequencyDays: customForm.frequency === 'custom' ? customForm.customFrequencyDays : undefined,
        halfLifeHours: halfLife,
        color: customForm.color,
        reminderHoursBefore: customForm.frequency === 'daily' ? 1 : 24,
        enabled: true,
      });

      setCustomForm({
        name: '', brand: '', activeIngredient: '', dosageOptions: '',
        unit: defaultUnit, frequency: 'weekly' as Frequency, customFrequencyDays: 5, halfLifeHours: '',
        color: COLOR_PRESETS[0],
      });
      setAddMode('library');
      setShowAddModal(false);
      await loadData();
      addToast('Custom medication added!', 'success');
    } catch (err) {
      console.error('Failed to add custom medication:', err);
      addToast('Failed to add medication', 'error');
    }
  };

  const resetModal = () => {
    setShowAddModal(false);
    setAddMode('library');
    setCustomForm({
      name: '', brand: '', activeIngredient: '', dosageOptions: '',
      unit: defaultUnit, frequency: 'weekly' as Frequency, customFrequencyDays: 5, halfLifeHours: '',
      color: COLOR_PRESETS[0],
    });
  };

  return (
    <div className="min-h-full pb-24 px-5 pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Medications</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-all active:scale-[0.98]"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {medications.map((med) => {
          const isEditing = editingId === med.id;
          const activeProtocol = protocols.find(p => p.medicationId === med.id);

          return (
            <div
              key={med.id}
              className="rounded-2xl border border-white/5 bg-surface-800/50 p-4"
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${med.color}20`, border: `1px solid ${med.color}40` }}
                  >
                    <Pill size={18} style={{ color: med.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white text-sm">{med.name}</h3>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        med.enabled
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-600/20 text-slate-500'
                      }`}>
                        {med.enabled ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{med.brand}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <button
                      onClick={() => handleSaveEdit(med.id)}
                      className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      <Save size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => startEdit(med)}
                      className="p-2 rounded-lg text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 transition-colors"
                    >
                      <Edit3 size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => enableMedication(med.id, !med.enabled)}
                    className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                      med.enabled
                        ? 'text-emerald-400 hover:bg-emerald-500/10'
                        : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                  >
                    {med.enabled ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => handleDelete(med.id)}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Editable fields */}
              {isEditing ? (
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Name"
                      className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary-500"
                    />
                    <input
                      type="text"
                      value={editForm.brand || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))}
                      placeholder="Brand"
                      className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <input
                    type="text"
                    value={editForm.activeIngredient || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, activeIngredient: e.target.value }))}
                    placeholder="Active ingredient"
                    className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary-500"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={editForm.dosageOptions || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, dosageOptions: e.target.value }))}
                      placeholder="Dosages (comma)"
                      className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary-500"
                    />
                    <select
                      value={editForm.unit || 'mg'}
                      onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                      className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary-500"
                    >
                      <option value="mg">mg</option>
                      <option value="mcg">mcg</option>
                      <option value="units">units</option>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                    </select>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={editForm.halfLifeHours || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, halfLifeHours: e.target.value }))}
                      placeholder="Half-life (h)"
                      className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div className={`grid ${editForm.frequency === 'custom' ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                    <select
                      value={editForm.frequency || 'weekly'}
                      onChange={(e) => setEditForm((f) => ({ ...f, frequency: e.target.value }))}
                      className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="twice-daily">Twice Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="custom">Custom (Days)</option>
                    </select>
                    {editForm.frequency === 'custom' && (
                      <input
                        type="number"
                        min={1}
                        value={editForm.customFrequencyDays || ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, customFrequencyDays: Number(e.target.value) }))}
                        placeholder="Days (e.g. 5)"
                        className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary-500"
                      />
                    )}
                    <input
                      type="number"
                      min={0}
                      max={168}
                      value={editForm.reminderHoursBefore || 24}
                      onChange={(e) => setEditForm((f) => ({ ...f, reminderHoursBefore: Number(e.target.value) }))}
                      placeholder="Reminder (h before)"
                      className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">Color</p>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setEditForm((f) => ({ ...f, color }))}
                          className={`w-7 h-7 rounded-full border-2 transition-all ${
                            editForm.color === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingId(null)}
                    className="self-start text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500 uppercase">Frequency</p>
                      <p className="text-xs font-medium text-white capitalize">
                        {med.frequency === 'custom' ? `Every ${med.customFrequencyDays}d` : med.frequency.replace('-', ' ')}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500 uppercase">Half-Life</p>
                      <p className="text-xs font-medium text-white">{med.halfLifeHours}h</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500 uppercase">Dosages</p>
                      <p className="text-xs font-medium text-white">{med.dosageOptions.join(', ')} {med.unit}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <div className="flex items-center gap-2">
                      <Clock size={14} />
                      Reminder: {med.reminderHoursBefore}h before dose
                    </div>
                    {settings.titrationWizardEnabled && activeProtocol && (
                      <span className="flex items-center gap-1 text-primary-400 font-medium">
                        <Activity size={12} /> Protocol Step {activeProtocol.currentStepIndex + 1}
                      </span>
                    )}
                  </div>
                  {settings.titrationWizardEnabled && (
                    <button
                      onClick={() => setWizardMedId(med.id)}
                      className="w-full py-2 rounded-xl border border-white/10 bg-surface-900/50 hover:bg-surface-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                    >
                      <Activity size={14} /> Manage Titration Protocol
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}

        {medications.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <Pill size={40} className="mx-auto mb-3 opacity-30" />
            <p>No medications configured.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 text-primary-400 text-sm hover:underline"
            >
              Add a medication
            </button>
          </div>
        )}
      </div>

      {/* Add Medication Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetModal} />
          <div className="relative w-full max-w-lg mx-4 mb-8 bg-surface-800 rounded-2xl border border-white/10 shadow-2xl max-h-[80vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-surface-800 border-b border-white/5 px-5 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-white">Add Medication</h2>
              <button onClick={resetModal} className="p-2 rounded-lg bg-white/5 hover:bg-white/10">
                <X size={16} className="text-slate-400" />
              </button>
            </div>

            {/* Mode tabs */}
            <div className="px-5 pt-4 flex gap-2">
              <button
                onClick={() => setAddMode('library')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  addMode === 'library'
                    ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                    : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'
                }`}
              >
                Library
              </button>
              <button
                onClick={() => setAddMode('custom')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  addMode === 'custom'
                    ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                    : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'
                }`}
              >
                Custom
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              {addMode === 'library' ? (
                <>
                  <p className="text-xs text-slate-400 mb-1">Select from the GLP-1 library:</p>
                  {MEDICATION_LIBRARY.every((t) => medications.some((m) => m.templateId === t.id)) && (
                    <div className="text-center py-6 text-slate-500">
                      <Pill size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">All medications are already in your list.</p>
                    </div>
                  )}
                  {MEDICATION_LIBRARY.map((template) => {
                    const exists = medications.some((m) => m.templateId === template.id);
                    return (
                      <button
                        key={template.id}
                        onClick={() => !exists && handleAddFromLibrary(template)}
                        disabled={exists}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                          exists
                            ? 'border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed'
                            : 'border-white/10 bg-surface-900 hover:border-primary-500/40 hover:bg-surface-800'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${template.color}20` }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: template.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{template.name}</p>
                          <p className="text-xs text-slate-400 truncate">{template.brand} · {template.frequency} · {template.halfLifeHours}h half-life</p>
                        </div>
                        {exists ? (
                          <span className="text-[10px] text-slate-500 shrink-0">Added</span>
                        ) : (
                          <ChevronRight size={14} className="text-slate-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Name *</label>
                    <input
                      type="text"
                      value={customForm.name}
                      onChange={(e) => setCustomForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Retatrutide"
                      className="w-full bg-surface-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Brand</label>
                    <input
                      type="text"
                      value={customForm.brand}
                      onChange={(e) => setCustomForm((f) => ({ ...f, brand: e.target.value }))}
                      placeholder="e.g. MyBrand"
                      className="w-full bg-surface-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Active Ingredient</label>
                    <input
                      type="text"
                      value={customForm.activeIngredient}
                      onChange={(e) => setCustomForm((f) => ({ ...f, activeIngredient: e.target.value }))}
                      placeholder="e.g. Retatrutide"
                      className="w-full bg-surface-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Dosages * (comma separated)</label>
                      <input
                        type="text"
                        value={customForm.dosageOptions}
                        onChange={(e) => setCustomForm((f) => ({ ...f, dosageOptions: e.target.value }))}
                        placeholder="e.g. 2.5, 5, 10"
                        className="w-full bg-surface-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Unit</label>
                      <select
                        value={customForm.unit}
                        onChange={(e) => setCustomForm((f) => ({ ...f, unit: e.target.value as 'mg' | 'mcg' | 'units' }))}
                        className="w-full bg-surface-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500/50"
                      >
                        <option value="mg">mg</option>
                        <option value="mcg">mcg</option>
                        <option value="units">units</option>
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Frequency</label>
                      <select
                        value={customForm.frequency}
                        onChange={(e) => setCustomForm((f) => ({ ...f, frequency: e.target.value as Frequency }))}
                        className="w-full bg-surface-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500/50"
                      >
                        <option value="daily">Daily</option>
                        <option value="twice-daily">Twice Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="custom">Custom (Days)</option>
                      </select>
                    </div>
                    {customForm.frequency === 'custom' ? (
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Every X Days</label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={customForm.customFrequencyDays}
                          onChange={(e) => setCustomForm((f) => ({ ...f, customFrequencyDays: Number(e.target.value) }))}
                          placeholder="e.g. 5"
                          className="w-full bg-surface-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500/50"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                          Half-Life (hours) *
                          <HelpBox>
                            Half-life is the time required for the concentration of the medication in your body to reduce by half. This value is critical for the app to accurately calculate and graph your estimated blood levels over time.
                          </HelpBox>
                        </label>
                        <input
                          type="number"
                          min={0.1}
                          step={0.1}
                          value={customForm.halfLifeHours}
                          onChange={(e) => setCustomForm((f) => ({ ...f, halfLifeHours: e.target.value }))}
                          placeholder="e.g. 120"
                          className="w-full bg-surface-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500/50"
                        />
                      </div>
                    )}
                  </div>

                  {customForm.frequency === 'custom' && (
                    <div>
                      <label className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                        Half-Life (hours) *
                        <HelpBox>
                          Half-life is the time required for the concentration of the medication in your body to reduce by half. This value is critical for the app to accurately calculate and graph your estimated blood levels over time.
                        </HelpBox>
                      </label>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={customForm.halfLifeHours}
                        onChange={(e) => setCustomForm((f) => ({ ...f, halfLifeHours: e.target.value }))}
                        placeholder="e.g. 120"
                        className="w-full bg-surface-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500/50"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">Color</label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setCustomForm((f) => ({ ...f, color }))}
                          className={`w-7 h-7 rounded-full border-2 transition-all ${
                            customForm.color === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleAddCustom}
                    className="mt-2 w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-all active:scale-[0.98]"
                  >
                    Add Custom Medication
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Titration Wizard Modal */}
      {wizardMedId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setWizardMedId(null)} />
          <TitrationWizard
            medicationId={wizardMedId}
            medicationUnit={medications.find(m => m.id === wizardMedId)?.unit || 'mg'}
            medicationName={medications.find(m => m.id === wizardMedId)?.name || ''}
            onClose={() => setWizardMedId(null)}
          />
        </div>
      )}
    </div>
  );
}
