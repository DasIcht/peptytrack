import { useState, useEffect } from 'react';
import { useUIStore } from './stores/uiStore';
import { useMedicationStore } from './stores/medicationStore';
import { useWeightStore } from './stores/weightStore';
import { seedDatabaseIfEmpty } from './db/database';
import { checkAndFireReminders } from './lib/notifications';
import { getAutoBackup, clearAutoBackup } from './lib/autoBackup';
import { importData, exportData } from './lib/cloudSync';
import { BottomNav } from './components/BottomNav';
import { ToastContainer } from './components/Toast';
import { Modal } from './components/Modal';
import { Dashboard } from './pages/Dashboard';
import { LogDose } from './pages/LogDose';
import { MedicationChart } from './pages/MedicationChart';
import { WeightTracker } from './pages/WeightTracker';
import { Medications } from './pages/Medications';
import { Settings } from './pages/Settings';
import './styles/global.css';

const PAGE_COMPONENTS = {
  dashboard: Dashboard,
  log: LogDose,
  chart: MedicationChart,
  weight: WeightTracker,
  medications: Medications,
  settings: Settings,
};

function App() {
  const { activePage, addToast } = useUIStore();
  const { loadData: loadMeds, initialized, medications, doses } = useMedicationStore();
  const { loadData: loadWeight, entries: weightEntries } = useWeightStore();
  const [restorePrompt, setRestorePrompt] = useState(false);

  useEffect(() => {
    const init = async () => {
      await seedDatabaseIfEmpty();
      await loadMeds();
      await loadWeight();
    };
    init();
  }, [loadMeds, loadWeight]);

  useEffect(() => {
    if (!initialized) return;
    const interval = setInterval(checkAndFireReminders, 60000);
    checkAndFireReminders();
    return () => clearInterval(interval);
  }, [initialized]);

  // Auto-backup whenever data changes
  useEffect(() => {
    if (!initialized) return;
    const totalItems = medications.length + doses.length + weightEntries.length;
    if (totalItems === 0) return;
    exportData().then((data) => {
      try {
        localStorage.setItem('peptytrack-autobackup', JSON.stringify(data));
      } catch {
        // storage full
      }
    });
  }, [initialized, medications.length, doses.length, weightEntries.length]);

  // Prompt to restore if DB is empty but localStorage backup exists
  useEffect(() => {
    if (!initialized) return;
    const totalItems = medications.length + doses.length + weightEntries.length;
    if (totalItems > 0) return;
    const backup = getAutoBackup();
    if (backup) {
      // Defer to next tick to avoid synchronous setState in effect
      const t = setTimeout(() => setRestorePrompt(true), 0);
      return () => clearTimeout(t);
    }
  }, [initialized, medications.length, doses.length, weightEntries.length]);

  const handleRestore = async () => {
    const backup = getAutoBackup();
    if (!backup) return;
    try {
      await importData(JSON.parse(backup));
      await loadMeds();
      await loadWeight();
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
      <main className="max-w-lg mx-auto relative">
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
