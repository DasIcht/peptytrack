import { useState, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMedicationStore } from '../stores/medicationStore';
import { useVialStore } from '../stores/vialStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { HelpBox } from '../components/HelpBox';
import { FlaskConical, Plus, ChevronRight, Edit3, Trash2 } from 'lucide-react';

export function Vials() {
  const medications = useMedicationStore(
    useShallow((state) => state.medications)
  );
  const doses = useMedicationStore(useShallow((state) => state.doses));
  const { vials, addVial, updateVial, deleteVial, getVialRemaining, getVialPercentage } = useVialStore();
  const { addToast, openModal } = useUIStore();
  const { getSetting } = useSettingsStore();

  const defaultUnit = (getSetting('medicationUnit') as 'mg' | 'mcg' | 'units' | undefined) || 'mg';

  // Expand/collapse per medication
  const [expandedMedIds, setExpandedMedIds] = useState<Set<string>>(new Set());
  const [addingForMedId, setAddingForMedId] = useState<string | null>(null);
  const [editingVialId, setEditingVialId] = useState<string | null>(null);

  // Filter: default to last-logged medication
  const initializedRef = useRef(false);
  const [filterMedId, setFilterMedId] = useState<string>('all');

  useEffect(() => {
    if (!initializedRef.current && doses.length > 0) {
      initializedRef.current = true;
      const lastDose = [...doses].sort((a, b) => b.dateTime - a.dateTime)[0];
      if (lastDose) {
        setFilterMedId(lastDose.medicationId);
      }
    }
  }, [doses]);

  const [vialForm, setVialForm] = useState({
    name: '',
    peptideAmount: '',
    peptideUnit: defaultUnit,
    bacWaterAmount: '',
    reconstitutedAt: '',
    notes: '',
  });

  const [editVialForm, setEditVialForm] = useState({
    name: '',
    peptideAmount: '',
    peptideUnit: 'mg' as 'mg' | 'mcg' | 'units',
    bacWaterAmount: '',
    reconstitutedAt: '',
    remainingOverride: '',
    notes: '',
  });

  const toggleExpanded = (medId: string) => {
    setExpandedMedIds((prev) => {
      const next = new Set(prev);
      if (next.has(medId)) next.delete(medId);
      else next.add(medId);
      return next;
    });
  };

  const getMedVials = (medId: string) =>
    vials
      .filter((v) => v.medicationId === medId)
      .sort((a, b) => b.createdAt - a.createdAt);

  const getNextVialNumber = (medId: string) => getMedVials(medId).length + 1;

  const resetVialForm = () =>
    setVialForm({ name: '', peptideAmount: '', peptideUnit: defaultUnit, bacWaterAmount: '', reconstitutedAt: '', notes: '' });

  const handleAddVial = async (medicationId: string) => {
    const peptideAmount = parseFloat(vialForm.peptideAmount);
    const bacWaterAmount = parseFloat(vialForm.bacWaterAmount);

    if (!vialForm.name.trim()) {
      addToast('Vial name is required', 'error');
      return;
    }
    if (isNaN(peptideAmount) || peptideAmount <= 0) {
      addToast('Enter a valid peptide amount', 'error');
      return;
    }
    if (isNaN(bacWaterAmount) || bacWaterAmount <= 0) {
      addToast('Enter a valid bac water amount', 'error');
      return;
    }

    await addVial({
      medicationId,
      name: vialForm.name.trim(),
      peptideAmount,
      peptideUnit: vialForm.peptideUnit,
      bacWaterAmount,
      reconstitutedAt: vialForm.reconstitutedAt
        ? new Date(vialForm.reconstitutedAt).getTime()
        : Date.now(),
      remainingOverride: null,
      notes: vialForm.notes.trim(),
    });

    resetVialForm();
    setAddingForMedId(null);
    addToast('Vial added!', 'success');
  };

  const startEditVial = (vial: typeof vials[0]) => {
    setEditingVialId(vial.id);
    setEditVialForm({
      name: vial.name,
      peptideAmount: String(vial.peptideAmount),
      peptideUnit: vial.peptideUnit as 'mg' | 'mcg' | 'units',
      bacWaterAmount: String(vial.bacWaterAmount),
      reconstitutedAt: vial.reconstitutedAt
        ? new Date(vial.reconstitutedAt).toISOString().split('T')[0]
        : '',
      remainingOverride:
        vial.remainingOverride !== null && vial.remainingOverride !== undefined
          ? String(vial.remainingOverride)
          : '',
      notes: vial.notes,
    });
  };

  const handleSaveEditVial = async (vialId: string) => {
    const peptideAmount = parseFloat(editVialForm.peptideAmount);
    const bacWaterAmount = parseFloat(editVialForm.bacWaterAmount);
    const remainingOverride = editVialForm.remainingOverride.trim()
      ? parseFloat(editVialForm.remainingOverride)
      : null;

    if (!editVialForm.name.trim()) {
      addToast('Vial name is required', 'error');
      return;
    }
    if (isNaN(peptideAmount) || peptideAmount <= 0) {
      addToast('Enter a valid peptide amount', 'error');
      return;
    }
    if (isNaN(bacWaterAmount) || bacWaterAmount <= 0) {
      addToast('Enter a valid bac water amount', 'error');
      return;
    }
    if (remainingOverride !== null && (isNaN(remainingOverride) || remainingOverride < 0)) {
      addToast('Enter a valid remaining amount', 'error');
      return;
    }

    await updateVial(vialId, {
      name: editVialForm.name.trim(),
      peptideAmount,
      peptideUnit: editVialForm.peptideUnit,
      bacWaterAmount,
      reconstitutedAt: editVialForm.reconstitutedAt
        ? new Date(editVialForm.reconstitutedAt).getTime()
        : Date.now(),
      remainingOverride,
      notes: editVialForm.notes.trim(),
    });

    setEditingVialId(null);
    addToast('Vial updated', 'success');
  };

  const handleDeleteVial = (id: string) => {
    openModal(
      <ConfirmDialog
        title="Delete Vial?"
        message="This will remove the vial record. Doses previously linked to this vial will remain in your history."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={async () => {
          await deleteVial(id);
          addToast('Vial deleted', 'info');
        }}
      />
    );
  };

  const totalVials = vials.length;

  const filteredMeds = filterMedId === 'all' ? medications : medications.filter((m) => m.id === filterMedId);

  return (
    <div className="min-h-full pb-24 px-5 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-content-primary">Vials</h1>
            <HelpBox position="left">
              Reconstitution is the process of mixing your freeze-dried peptide (mg) with bacteriostatic water (ml). Fill out the total mg of peptide and the total ml of water added to calculate your vial's concentration.
            </HelpBox>
          </div>
          <p className="text-sm text-content-secondary">
            {totalVials} vial{totalVials !== 1 ? 's' : ''} across {medications.length} medication{medications.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filter */}
      {medications.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs text-content-secondary mb-1.5 uppercase tracking-wider">Filter by Medication</label>
          <select
            value={filterMedId}
            onChange={(e) => setFilterMedId(e.target.value)}
            className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-content-primary text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="all">All Medications</option>
            {medications.map((med) => (
              <option key={med.id} value={med.id}>{med.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Vial list grouped by medication */}
      <div className="flex flex-col gap-3">
        {filteredMeds.map((med) => {
          const medVials = getMedVials(med.id);
          const isExpanded = expandedMedIds.has(med.id);
          const isAdding = addingForMedId === med.id;

          return (
            <div
              key={med.id}
              className="rounded-2xl border border-white/5 bg-surface-800/50 overflow-hidden"
            >
              {/* Medication header */}
              <button
                onClick={() => toggleExpanded(med.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${med.color}20`, border: `1px solid ${med.color}40` }}
                  >
                    <FlaskConical size={16} style={{ color: med.color }} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-content-primary">{med.name}</p>
                    <p className="text-xs text-content-secondary">
                      {medVials.length} vial{medVials.length !== 1 ? 's' : ''} · {med.dosageOptions.join(', ')} {med.unit}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: `${med.color}15`,
                      color: med.color,
                    }}
                  >
                    {med.brand}
                  </span>
                  <ChevronRight
                    size={16}
                    className={`text-content-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>

              {/* Vials for this medication */}
              {isExpanded && (
                <div className="px-4 pb-4 flex flex-col gap-2">
                  {medVials.map((vial) => {
                    const remaining = getVialRemaining(vial.id, doses);
                    const percentage = getVialPercentage(vial.id, doses);
                    const concentration = vial.bacWaterAmount > 0 ? vial.peptideAmount / vial.bacWaterAmount : 0;
                    const remainingMl = concentration > 0 ? remaining / concentration : 0;
                    const reconstitutedDate = vial.reconstitutedAt
                      ? new Date(vial.reconstitutedAt).toLocaleDateString()
                      : null;

                    if (editingVialId === vial.id) {
                      return (
                        <div
                          key={vial.id}
                          className="flex flex-col gap-2 p-3 rounded-xl border border-primary-500/30 bg-surface-900/80"
                        >
                          <input
                            type="text"
                            value={editVialForm.name}
                            onChange={(e) => setEditVialForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="Vial name"
                            className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-content-primary text-xs focus:outline-none focus:border-primary-500"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={editVialForm.peptideAmount}
                              onChange={(e) => setEditVialForm((f) => ({ ...f, peptideAmount: e.target.value }))}
                              placeholder="Peptide amount"
                              className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-content-primary text-xs focus:outline-none focus:border-primary-500"
                            />
                            <select
                              value={editVialForm.peptideUnit}
                              onChange={(e) => setEditVialForm((f) => ({ ...f, peptideUnit: e.target.value as 'mg' | 'mcg' | 'units' }))}
                              className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-content-primary text-xs focus:outline-none focus:border-primary-500"
                            >
                              <option value="mg">mg</option>
                              <option value="mcg">mcg</option>
                              <option value="units">units</option>
                            </select>
                          </div>
                          <input
                            type="number"
                            step="0.1"
                            value={editVialForm.bacWaterAmount}
                            onChange={(e) => setEditVialForm((f) => ({ ...f, bacWaterAmount: e.target.value }))}
                            placeholder="Bac water (ml)"
                            className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-content-primary text-xs focus:outline-none focus:border-primary-500"
                          />
                          <input
                            type="date"
                            value={editVialForm.reconstitutedAt}
                            onChange={(e) => setEditVialForm((f) => ({ ...f, reconstitutedAt: e.target.value }))}
                            className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-content-primary text-xs focus:outline-none focus:border-primary-500"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={editVialForm.remainingOverride}
                            onChange={(e) => setEditVialForm((f) => ({ ...f, remainingOverride: e.target.value }))}
                            placeholder={`Remaining override (auto: ${remaining.toFixed(2)})`}
                            className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-content-primary text-xs focus:outline-none focus:border-primary-500"
                          />
                          <input
                            type="text"
                            value={editVialForm.notes}
                            onChange={(e) => setEditVialForm((f) => ({ ...f, notes: e.target.value }))}
                            placeholder="Notes"
                            className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-content-primary text-xs focus:outline-none focus:border-primary-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEditVial(vial.id)}
                              className="flex-1 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium transition-all"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingVialId(null)}
                              className="px-3 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 border border-white/10 text-content-secondary text-xs transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={vial.id}
                        className="rounded-lg border border-white/5 bg-surface-900/50 px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-content-primary truncate">{vial.name}</p>
                            {reconstitutedDate && (
                              <p className="text-[10px] text-content-muted">Reconstituted: {reconstitutedDate}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditVial(vial)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 transition-colors"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteVial(vial.id)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="mb-1">
                          <div className="flex items-center justify-between text-[10px] mb-0.5">
                            <span className="text-content-secondary">
                              {remaining.toFixed(2)} {vial.peptideUnit} remaining
                            </span>
                            <span className="text-content-muted">{percentage.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${ percentage > 50 ? 'bg-emerald-500' : percentage > 25 ? 'bg-amber-500' : 'bg-red-500' }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-content-muted">
                          {concentration > 0 && `~${remainingMl.toFixed(2)} ml · `}
                          {vial.peptideAmount} {vial.peptideUnit} / {vial.bacWaterAmount} ml
                        </p>
                      </div>
                    );
                  })}

                  {medVials.length === 0 && (
                    <p className="text-xs text-content-muted py-2 text-center">No vials for this medication yet.</p>
                  )}

                  {/* Add vial form */}
                  {isAdding ? (
                    <div className="flex flex-col gap-2 mt-1 p-3 rounded-xl border border-white/5 bg-surface-900/50">
                      <input
                        type="text"
                        value={vialForm.name}
                        onChange={(e) => setVialForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder={`Vial name (e.g., Vial #${getNextVialNumber(med.id)})`}
                        className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-content-primary text-xs focus:outline-none focus:border-primary-500"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={vialForm.peptideAmount}
                          onChange={(e) => setVialForm((f) => ({ ...f, peptideAmount: e.target.value }))}
                          placeholder="Peptide amount"
                          className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-content-primary text-xs focus:outline-none focus:border-primary-500"
                        />
                        <select
                          value={vialForm.peptideUnit}
                          onChange={(e) => setVialForm((f) => ({ ...f, peptideUnit: e.target.value as 'mg' | 'mcg' | 'units' }))}
                          className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-content-primary text-xs focus:outline-none focus:border-primary-500"
                        >
                          <option value="mg">mg</option>
                          <option value="mcg">mcg</option>
                          <option value="units">units</option>
                        </select>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={vialForm.bacWaterAmount}
                        onChange={(e) => setVialForm((f) => ({ ...f, bacWaterAmount: e.target.value }))}
                        placeholder="Bac water (ml)"
                        className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-content-primary text-xs focus:outline-none focus:border-primary-500"
                      />
                      <input
                        type="date"
                        value={vialForm.reconstitutedAt}
                        onChange={(e) => setVialForm((f) => ({ ...f, reconstitutedAt: e.target.value }))}
                        className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-content-primary text-xs focus:outline-none focus:border-primary-500"
                      />
                      <input
                        type="text"
                        value={vialForm.notes}
                        onChange={(e) => setVialForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Notes (optional)"
                        className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-content-primary text-xs focus:outline-none focus:border-primary-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddVial(med.id)}
                          className="flex-1 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium transition-all"
                        >
                          Add Vial
                        </button>
                        <button
                          onClick={() => {
                            setAddingForMedId(null);
                            resetVialForm();
                          }}
                          className="px-3 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 border border-white/10 text-content-secondary text-xs transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAddingForMedId(med.id);
                        setVialForm((f) => ({ ...f, name: `Vial #${getNextVialNumber(med.id)}` }));
                      }}
                      className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors mt-1"
                    >
                      <Plus size={12} />
                      Add Vial
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredMeds.length === 0 && (
          <div className="text-center py-16 text-content-muted">
            <FlaskConical size={40} className="mx-auto mb-3 opacity-30" />
            <p>No medications configured.</p>
            <p className="text-xs mt-1">Add a medication first to manage vials.</p>
          </div>
        )}
      </div>
    </div>
  );
}
