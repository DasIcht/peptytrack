import { useState, useEffect } from 'react';
import { useMedicationStore } from '../stores/medicationStore';
import { useWeightStore } from '../stores/weightStore';
import { useVialStore } from '../stores/vialStore';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSymptomLogStore } from '../stores/symptomLogStore';
import { useProtocolStore } from '../stores/protocolStore';
import { exportData, downloadBackupJSON, importData } from '../lib/cloudSync';
import { generatePDF, downloadPDF } from '../lib/pdfExport';
import { requestNotificationPermission } from '../lib/notifications';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Bell, FileText, Download, Upload,
  RotateCw, MapPin, Wand2,
  Scale, Pill, ToggleRight, ToggleLeft,
  Shield, ChevronRight, Trash2, AlertTriangle
} from 'lucide-react';

export function Settings() {
  const { medications, doses } = useMedicationStore();
  const { entries: weightEntries } = useWeightStore();
  const { logs: symptomLogs } = useSymptomLogStore();
  const { addToast, openModal } = useUIStore();
  const { settings, updateSetting } = useSettingsStore();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (settings.notificationsEnabled) {
      requestNotificationPermission().then((granted) => {
        setNotificationsEnabled(granted);
      });
    }
  }, [settings.notificationsEnabled]);

  const handleExportPDF = async () => {
    const doc = generatePDF(medications, doses, weightEntries, symptomLogs);
    downloadPDF(doc);
    addToast('PDF report downloaded', 'success');
  };

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      const data = await exportData();
      downloadBackupJSON(data);
      addToast('Backup downloaded', 'success');
    } catch {
      addToast('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importData(data);
      await useMedicationStore.getState().loadData();
      await useWeightStore.getState().loadData();
      await useVialStore.getState().loadData();
      await useSettingsStore.getState().loadSettings();
      await useSymptomLogStore.getState().loadData();
      await useProtocolStore.getState().loadData();
      addToast('Data restored successfully!', 'success');
    } catch (err) {
      addToast(`Import failed: ${err instanceof Error ? err.message : 'Invalid file'}`, 'error');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleClearAll = () => {
    openModal(
      <ConfirmDialog
        title="Clear All Data?"
        message="This will permanently delete ALL your medications, doses, and weight entries. This action cannot be undone."
        confirmLabel="Clear Everything"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {
          openModal(
            <ConfirmDialog
              title="Are You Really Sure?"
              message="All your data will be permanently erased. There is no way to recover it unless you have a backup file."
              confirmLabel="Yes, Clear Everything"
              cancelLabel="Cancel"
              danger
              onConfirm={async () => {
                const { db } = await import('../db/database');
                await db.medications.clear();
                await db.doses.clear();
                await db.weightEntries.clear();
                await db.vials.clear();
                await db.settings.clear();
                await db.customSideEffects.clear();
                await db.protocols.clear();
                await db.symptomLogs.clear();
                await useMedicationStore.getState().loadData();
                await useWeightStore.getState().loadData();
                await useVialStore.getState().loadData();
                await useSettingsStore.getState().loadSettings();
                await useSymptomLogStore.getState().loadData();
                await useProtocolStore.getState().loadData();
                addToast('All data cleared', 'info');
              }}
            />
          );
        }}
      />
    );
  };

  const handleTitrationWizardToggle = (enable: boolean) => {
    if (enable) {
      openModal(
        <ConfirmDialog
          title="Medical Disclaimer"
          message="The Titration Wizard provides dosage and scheduling recommendations based on standard protocols. It is intended for informational purposes only and does NOT constitute medical advice. Always consult your healthcare provider before making any changes to your medication regimen."
          confirmLabel="I Understand & Accept"
          cancelLabel="Decline"
          onConfirm={() => {
            updateSetting('titrationWizardEnabled', true);
            addToast('Titration Wizard enabled', 'success');
          }}
        />
      );
    } else {
      updateSetting('titrationWizardEnabled', false);
    }
  };

  return (
    <div className="min-h-full pb-24 px-5 pt-6">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      {/* Preferences */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Preferences</h2>
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 overflow-hidden">
          {/* Weight Unit */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <Scale size={18} className="text-primary-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Default Weight Unit</p>
                <p className="text-xs text-slate-400">
                  Used when logging new weight entries
                </p>
              </div>
            </div>
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              {(['kg', 'lb'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => updateSetting('weightUnit', u)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    settings.weightUnit === u
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {u.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Medication Unit */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <Pill size={18} className="text-primary-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Default Medication Unit</p>
                <p className="text-xs text-slate-400">
                  Used when adding custom medications and vials
                </p>
              </div>
            </div>
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              {(['mg', 'mcg', 'units'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => updateSetting('medicationUnit', u)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    settings.medicationUnit === u
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Notification Master Switch */}
          <button
            onClick={async () => {
              const newValue = !settings.notificationsEnabled;
              await updateSetting('notificationsEnabled', newValue);
              if (newValue) {
                const granted = await requestNotificationPermission();
                setNotificationsEnabled(granted);
                addToast(granted ? 'Notifications enabled!' : 'Notifications denied', granted ? 'success' : 'error');
              } else {
                setNotificationsEnabled(false);
                addToast('Notifications disabled', 'info');
              }
            }}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Bell size={18} className="text-primary-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Dose Reminders</p>
                <p className="text-xs text-slate-400">
                  {settings.notificationsEnabled
                    ? notificationsEnabled
                      ? 'Enabled'
                      : 'Permission needed — tap to request'
                    : 'Disabled'}
                </p>
              </div>
            </div>
            {settings.notificationsEnabled ? (
              <ToggleRight size={22} className="text-primary-400" />
            ) : (
              <ToggleLeft size={22} className="text-slate-500" />
            )}
          </button>
        </div>
      </div>

      {/* Injection Rotation */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Injection Rotation</h2>
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 overflow-hidden">
          {/* Strategy Selector */}
          <div className="px-4 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <RotateCw size={18} className="text-primary-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Rotation Strategy</p>
                <p className="text-xs text-slate-400">How the next injection site is chosen</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(['sequential', 'quadrant', 'lru'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updateSetting('injectionRotationStrategy', s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    settings.injectionRotationStrategy === s
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {s === 'sequential' && 'Sequential'}
                  {s === 'quadrant' && 'Quadrant'}
                  {s === 'lru' && 'Least Used'}
                </button>
              ))}
            </div>
          </div>

          {/* Active Sites */}
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-3 mb-2">
              <MapPin size={18} className="text-primary-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Active Sites</p>
                <p className="text-xs text-slate-400">
                  Select at least 2 sites to rotate between
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {([
                { id: 'abdomen-upper-left', label: 'Abdomen — Upper Left' },
                { id: 'abdomen-upper-right', label: 'Abdomen — Upper Right' },
                { id: 'abdomen-lower-left', label: 'Abdomen — Lower Left' },
                { id: 'abdomen-lower-right', label: 'Abdomen — Lower Right' },
                { id: 'thigh-left', label: 'Thigh — Left' },
                { id: 'thigh-right', label: 'Thigh — Right' },
                { id: 'arm-left', label: 'Upper Arm — Left' },
                { id: 'arm-right', label: 'Upper Arm — Right' },
              ] as const).map((site) => {
                const checked = settings.injectionRotationSites.includes(site.id);
                return (
                  <label
                    key={site.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      checked
                        ? 'bg-primary-600/15 text-primary-300 border border-primary-500/30'
                        : 'bg-surface-700/50 text-slate-500 border border-white/5'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? settings.injectionRotationSites.filter((s) => s !== site.id)
                          : [...settings.injectionRotationSites, site.id];
                        if (next.length >= 2) {
                          updateSetting('injectionRotationSites', next as typeof settings.injectionRotationSites);
                        } else {
                          addToast('At least 2 sites must be selected', 'error');
                        }
                      }}
                      className="accent-primary-500 w-3.5 h-3.5"
                    />
                    {site.label}
                  </label>
                );
              })}
            </div>
            {settings.injectionRotationSites.length < 2 && (
              <p className="text-xs text-red-400 mt-2">⚠ Select at least 2 sites to enable rotation.</p>
            )}
          </div>
        </div>
      </div>

      {/* Global Safety Settings */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Global Safety Settings</h2>
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 overflow-hidden card-premium">
          {/* Toggle */}
          <button
            onClick={() => handleTitrationWizardToggle(!settings.titrationWizardEnabled)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors border-b border-white/5"
          >
            <div className="flex items-center gap-3">
              <Wand2 size={18} className="text-accent-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Enable Titration Wizard</p>
                <p className="text-xs text-slate-400">
                  Step-up recommendations and safety warnings
                </p>
              </div>
            </div>
            {settings.titrationWizardEnabled ? (
              <ToggleRight size={22} className="text-accent-400" />
            ) : (
              <ToggleLeft size={22} className="text-slate-500" />
            )}
          </button>

          {/* Severe Side Effect Threshold */}
          <div className="flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Severe Side Effect Threshold</p>
                <p className="text-xs text-slate-400">
                  Points required to trigger a medical warning
                </p>
              </div>
            </div>
            <input
              type="number"
              min={3}
              max={20}
              value={settings.severeSideEffectThreshold}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 3) {
                  updateSetting('severeSideEffectThreshold', val);
                }
              }}
              className="w-16 input-premium border border-white/10 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-primary-500 bg-surface-900"
            />
          </div>
        </div>
      </div>

      {/* Reports */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Reports</h2>
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 overflow-hidden">
          <button
            onClick={handleExportPDF}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-accent-500" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Export PDF Report</p>
                <p className="text-xs text-slate-400">Doctor-ready summary</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-500" />
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Data</h2>
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 overflow-hidden">
          <button
            onClick={handleExportJSON}
            disabled={exporting}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors border-b border-white/5"
          >
            <div className="flex items-center gap-3">
              <Download size={18} className="text-emerald-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Backup Data</p>
                <p className="text-xs text-slate-400">Download JSON backup file</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-500" />
          </button>

          <label className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5">
            <div className="flex items-center gap-3">
              <Upload size={18} className="text-primary-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Restore Data</p>
                <p className="text-xs text-slate-400">Upload JSON backup file</p>
              </div>
            </div>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportJSON}
              className="hidden"
            />
            {importing ? (
              <span className="text-xs text-primary-400">Restoring...</span>
            ) : (
              <ChevronRight size={16} className="text-slate-500" />
            )}
          </label>

          <button
            onClick={handleClearAll}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-red-500/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trash2 size={18} className="text-red-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-red-400">Clear All Data</p>
                <p className="text-xs text-slate-400">Permanently delete everything</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-red-400/50" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Stats</h2>
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-white">{medications.length}</p>
              <p className="text-[10px] text-slate-400 uppercase">Meds</p>
            </div>
            <div>
              <p className="text-xl font-bold text-white">{doses.length}</p>
              <p className="text-[10px] text-slate-400 uppercase">Doses</p>
            </div>
            <div>
              <p className="text-xl font-bold text-white">{weightEntries.length}</p>
              <p className="text-[10px] text-slate-400 uppercase">Weights</p>
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="mb-6">
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={14} className="text-primary-400" />
            <p className="text-sm font-medium text-white">Privacy First</p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            All your data stays on this device. PeptyTrack does not send any health information to external servers.
            Internet is only used for optional cloud backup when you explicitly choose to sync.
          </p>
        </div>
      </div>

      <div className="text-center pb-4">
        <p className="text-[10px] text-slate-600">
          PeptyTrack v1.0 — Free GLP-1 tracker
        </p>
        <p className="text-[10px] text-slate-600 mt-0.5">
          Not medical advice. Consult your healthcare provider.
        </p>
      </div>
    </div>
  );
}
