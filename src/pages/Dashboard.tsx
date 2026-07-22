import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMedicationStore } from '../stores/medicationStore';
import { useVialStore } from '../stores/vialStore';
import { useWeightStore } from '../stores/weightStore';
import { useUIStore } from '../stores/uiStore';
import { MedicationCard } from '../components/MedicationCard';
import { MedicalWarningBanner } from '../components/MedicalWarningBanner';
import { HelpBox } from '../components/HelpBox';
import { Weight, TrendingDown, TrendingUp, Minus, Download, Beaker } from 'lucide-react';
import { loadDemoData } from '../lib/demoData';

export function Dashboard() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const medications = useMedicationStore(
    useShallow((state) => state.medications.filter((m) => m.enabled))
  );
  const { loadData, initialized, doses } = useMedicationStore();
  const { loadData: loadWeight, getTrend, getLatest, entries: weightEntries } = useWeightStore();
  const { vials } = useVialStore();
  const { setPage, setLogDoseMedId } = useUIStore();

  useEffect(() => {
    if (!initialized) loadData();
    loadWeight();
    
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [loadData, loadWeight, initialized]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const trend = getTrend();
  const latestWeight = getLatest();

  const showWelcomeState = medications.length === 0 && doses.length === 0 && vials.length === 0 && weightEntries.length === 0;

  if (showWelcomeState) {
    return (
      <div className="min-h-full pb-24 flex flex-col items-center justify-center px-5 pt-12 animate-fade-in">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary-500/10 mb-6">
            <Beaker className="w-10 h-10 text-primary-400" />
          </div>
          <h1 className="text-3xl font-bold text-content-primary tracking-tight mb-3">
            Welcome to Pepty<span className="text-primary-400">Track</span>!
          </h1>
          <p className="text-content-secondary text-sm">Your private, offline-first GLP-1 companion.</p>
        </div>

        <div className="w-full max-w-sm space-y-5">
          <button
            onClick={() => setPage('medications')}
            className="w-full py-4 rounded-2xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-base transition-all shadow-lg shadow-primary-500/20 active:scale-[0.98]"
          >
            + Add Your First Medication
          </button>
          
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface-950 px-4 text-xs font-semibold text-content-muted uppercase tracking-wider">or</span>
            </div>
          </div>

          <button
            onClick={async () => {
              if (window.confirm('This will load a fake 8-week history of Tirzepatide to help you explore the app. Proceed?')) {
                await loadDemoData();
              }
            }}
            className="w-full py-4 rounded-2xl bg-surface-800 hover:bg-surface-700 border border-white/10 text-content-primary font-bold text-base transition-all active:scale-[0.98]"
          >
            Load Demo Data to Explore
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary tracking-tight">
            Pepty<span className="text-primary-400">Track</span>
          </h1>
          <p className="text-sm text-content-secondary mt-1">Your GLP-1 companion</p>
        </div>
        <HelpBox position="left">
          Welcome to PeptyTrack! Use the bottom navigation to manage your medications, vials, and charts. Log your doses consistently to get accurate half-life predictions.
        </HelpBox>
      </div>

      <div className="px-5">
        <MedicalWarningBanner />
      </div>

      {/* Install Banner */}
      {!isStandalone && (
        <div className="px-5 mb-6">
          <div className="p-4 rounded-xl border border-primary-500/20 bg-primary-500/5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-primary-400">
              <Download size={18} />
              <h3 className="text-sm font-bold">Install PeptyTrack</h3>
            </div>
            <p className="text-xs text-content-secondary">
              Install the app to your home screen for the best native experience and quick access.
            </p>
            {deferredPrompt ? (
              <button onClick={handleInstallClick} className="w-full py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-bold transition-colors">
                Install Now
              </button>
            ) : (
              <div className="text-[11px] text-content-secondary bg-surface-900/50 p-2.5 rounded-lg border border-border">
                <p className="mb-1"><strong>iOS / Safari:</strong> Tap the Share icon <span className="text-xl leading-none px-1">⍗</span> below, scroll down and select "Add to Home Screen".</p>
                <p><strong>Android / Chrome:</strong> Tap the menu (⋮) and select "Install app" or "Add to Home screen".</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="px-5 grid grid-cols-4 gap-3 mb-6">
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-3 text-center">
          <p className="text-xs text-content-secondary mb-1">Medications</p>
          <p className="text-xl font-bold text-content-primary">{medications.length}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-3 text-center">
          <p className="text-xs text-content-secondary mb-1">Vials</p>
          <p className="text-xl font-bold text-content-primary">{vials.length}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-3 text-center">
          <p className="text-xs text-content-secondary mb-1">Weight Trend</p>
          <div className="flex items-center justify-center gap-1">
            {trend ? (
              trend.change < 0 ? (
                <TrendingDown size={14} className="text-emerald-400" />
              ) : trend.change > 0 ? (
                <TrendingUp size={14} className="text-red-400" />
              ) : (
                <Minus size={14} className="text-content-secondary" />
              )
            ) : (
              <Minus size={14} className="text-content-secondary" />
            )}
            <p className={`text-xl font-bold ${trend ? (trend.change < 0 ? 'text-emerald-400' : trend.change > 0 ? 'text-red-400' : 'text-content-secondary') : 'text-content-secondary'}`}>
              {trend ? `${Math.abs(trend.change)} ${latestWeight?.unit || 'kg'}` : '-'}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-3 text-center">
          <p className="text-xs text-content-secondary mb-1">Latest</p>
          <p className="text-xl font-bold text-content-primary">
            {latestWeight ? `${latestWeight.weight}` : '-'}
          </p>
          {latestWeight && <p className="text-[10px] text-content-muted">{latestWeight.unit}</p>}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 mb-6">
        <button
          onClick={() => setPage('weight')}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-800 hover:bg-surface-700 border border-white/10 text-content-primary font-medium text-sm transition-all active:scale-[0.98]"
        >
          <Weight size={16} />
          Log Weight
        </button>
      </div>

      {/* Medication Cards */}
      <div className="px-5">
        <h2 className="text-sm font-semibold text-content-secondary mb-3 uppercase tracking-wider">Your Medications</h2>
        <div className="flex flex-col gap-3">
          {medications.map((med) => (
            <MedicationCard
              key={med.id}
              medId={med.id}
              onClick={() => {
                setLogDoseMedId(med.id);
                setPage('log');
              }}
            />
          ))}
          {medications.length === 0 && (
            <div className="text-center py-10 text-content-muted">
              <p>No medications yet.</p>
              <button
                onClick={() => setPage('medications')}
                className="mt-2 text-primary-400 text-sm hover:underline"
              >
                Add your first medication
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
