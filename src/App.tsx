import { useState, useEffect, useRef } from 'react';
import { useUIStore } from './stores/uiStore';
import { useMedicationStore } from './stores/medicationStore';
import { useWeightStore } from './stores/weightStore';
import { useVialStore } from './stores/vialStore';
import { useSettingsStore } from './stores/settingsStore';
import { useSideEffectsStore } from './stores/sideEffectsStore';
import { useProtocolStore } from './stores/protocolStore';
import { useSymptomLogStore } from './stores/symptomLogStore';
import { checkAndFireReminders, rescheduleAllReminders } from './lib/notifications';
import { getAutoBackup, clearAutoBackup, saveAutoBackup } from './lib/autoBackup';
import { importData, exportData } from './lib/cloudSync';
import { BottomNav } from './components/BottomNav';
import { ToastContainer } from './components/Toast';
import { Modal } from './components/Modal';
import { Dashboard } from './pages/Dashboard';
import { LogDose } from './pages/LogDose';
import { MedicationChart } from './pages/MedicationChart';
import { WeightTracker } from './pages/WeightTracker';
import { Medications } from './pages/Medications';
import { Vials } from './pages/Vials';
import { Settings } from './pages/Settings';
import './styles/global.css';

const PAGE_COMPONENTS = {
  dashboard: Dashboard,
  log: LogDose,
  chart: MedicationChart,
  weight: WeightTracker,
  medications: Medications,
  vials: Vials,
  settings: Settings,
};

function App() {
  const { activePage, addToast, nextPage, prevPage } = useUIStore();
  const { loadData: loadMeds, initialized: medsInitialized, medications, doses } = useMedicationStore();
  const { loadData: loadWeight, entries: weightEntries } = useWeightStore();
  const { loadData: loadVials, initialized: vialsInitialized, vials } = useVialStore();
  const { loadSettings, initialized: settingsInitialized, settings } = useSettingsStore();
  const { loadData: loadSideEffects, initialized: sideEffectsInitialized } = useSideEffectsStore();
  const { loadData: loadProtocols, initialized: protocolsInitialized, protocols } = useProtocolStore();
  const { loadData: loadSymptomLogs, initialized: symptomLogsInitialized, logs: symptomLogs } = useSymptomLogStore();
  const [restorePrompt, setRestorePrompt] = useState(false);

  const initialized = medsInitialized && settingsInitialized && vialsInitialized && sideEffectsInitialized && protocolsInitialized && symptomLogsInitialized;

  // Swipe navigation
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    const init = async () => {
      try {
        await loadMeds();
        if (useMedicationStore.getState().medications.length === 0) {
          await loadMeds();
        }
        await Promise.all([loadWeight(), loadVials(), loadSettings(), loadSideEffects(), loadProtocols(), loadSymptomLogs()]);
      } catch (err) {
        console.error('App initialization failed:', err);
        addToast('Failed to initialize app data', 'error');
      }
    };
    init();
  }, [loadMeds, loadWeight, loadVials, loadSettings, loadSideEffects, loadProtocols, loadSymptomLogs, addToast]);

  useEffect(() => {
    if (!initialized) return;
    if (!settings.notificationsEnabled) return;
    const interval = setInterval(() => { checkAndFireReminders().catch(() => {}); }, 60000);
    checkAndFireReminders().catch(() => {});
    return () => clearInterval(interval);
  }, [initialized, settings.notificationsEnabled]);

  // Synchronize reminders when data or notification settings change
  useEffect(() => {
    if (!initialized) return;
    if (settings.notificationsEnabled) {
      rescheduleAllReminders(medications, doses);
    } else {
      localStorage.setItem('pepty-reminders', '[]');
    }
  }, [initialized, medications, doses, settings.notificationsEnabled]);

  // Auto-backup whenever data changes
  useEffect(() => {
    if (!initialized) return;
    const totalItems = medications.length + doses.length + weightEntries.length + vials.length + protocols.length + symptomLogs.length;
    if (totalItems === 0) return;
    exportData().then((data) => {
      saveAutoBackup(JSON.stringify(data));
    });
  }, [initialized, medications.length, doses.length, weightEntries.length, vials.length, protocols.length, symptomLogs.length]);

  // Prompt to restore if DB is empty but localStorage backup exists
  useEffect(() => {
    if (!initialized) return;
    const totalItems = medications.length + doses.length + weightEntries.length + vials.length + protocols.length + symptomLogs.length;
    if (totalItems > 0) return;
    const backup = getAutoBackup();
    if (backup) {
      // Defer to next tick to avoid synchronous setState in effect
      const t = setTimeout(() => setRestorePrompt(true), 0);
      return () => clearTimeout(t);
    }
  }, [initialized, medications.length, doses.length, weightEntries.length, vials.length, protocols.length]);

  const handleRestore = async () => {
    const backup = getAutoBackup();
    if (!backup) return;
    try {
      await importData(JSON.parse(backup));
      await loadMeds();
      await loadWeight();
      await loadVials();
      await loadSettings();
      await loadSideEffects();
      await loadProtocols();
      addToast('Data restored from backup!', 'success');
    } catch {
      addToast('Failed to restore backup', 'error');
    } finally {
      setRestorePrompt(false);
    }
  };

  const handleDismissRestore = () => {
    clearAutoBackup();
    setRestorePrompt(false);
  };

  const PageComponent = PAGE_COMPONENTS[activePage];

  return (
    <div className="min-h-screen bg-surface-950 text-white font-sans overflow-x-hidden">
      <main className="max-w-lg mx-auto relative" onTouchStart={(e) => { touchStartX.current = e.changedTouches[0].screenX; touchStartY.current = e.changedTouches[0].screenY; }} onTouchEnd={(e) => { const deltaX = e.changedTouches[0].screenX - touchStartX.current; const deltaY = e.changedTouches[0].screenY - touchStartY.current; if (Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY)) { if (deltaX < 0) nextPage(); else prevPage(); } }}>
        {restorePrompt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-5 bg-black/70 backdrop-blur-sm">
            <div className="bg-surface-800 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Restore Backup?</h3>
              <p className="text-sm text-slate-400 mb-5">
                We found a local backup from a previous session. Would you like to restore your medications, doses, and weight entries?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleRestore}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-all"
                >
                  Restore
                </button>
                <button
                  onClick={handleDismissRestore}
                  className="flex-1 py-2.5 rounded-xl bg-surface-700 hover:bg-surface-600 text-slate-300 text-sm transition-all"
                >
                  Start Fresh
                </button>
              </div>
            </div>
          </div>
        )}
        <PageComponent />
      </main>
      <BottomNav />
      <ToastContainer />
      <Modal />
    </div>
  );
}

export default App;
