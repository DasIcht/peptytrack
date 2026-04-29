import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMedicationStore } from '../stores/medicationStore';
import { useWeightStore } from '../stores/weightStore';
import { useUIStore } from '../stores/uiStore';
import { MedicationCard } from '../components/MedicationCard';
import { Weight, TrendingDown, TrendingUp, Minus } from 'lucide-react';

export function Dashboard() {
  const medications = useMedicationStore(
    useShallow((state) => state.medications.filter((m) => m.enabled))
  );
  const { loadData, initialized } = useMedicationStore();
  const { loadData: loadWeight, getTrend, getLatest } = useWeightStore();
  const { setPage, setLogDoseMedId } = useUIStore();

  useEffect(() => {
    if (!initialized) loadData();
    loadWeight();
  }, [loadData, loadWeight, initialized]);

  const trend = getTrend();
  const latestWeight = getLatest();

  return (
    <div className="min-h-full pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Pepty<span className="text-primary-400">Track</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">Your GLP-1 companion</p>
      </div>

      {/* Quick Stats */}
      <div className="px-5 grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Medications</p>
          <p className="text-xl font-bold text-white">{medications.length}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Weight Trend</p>
          <div className="flex items-center justify-center gap-1">
            {trend ? (
              trend.change < 0 ? (
                <TrendingDown size={14} className="text-emerald-400" />
              ) : trend.change > 0 ? (
                <TrendingUp size={14} className="text-red-400" />
              ) : (
                <Minus size={14} className="text-slate-400" />
              )
            ) : (
              <Minus size={14} className="text-slate-400" />
            )}
            <p className={`text-xl font-bold ${trend ? (trend.change < 0 ? 'text-emerald-400' : trend.change > 0 ? 'text-red-400' : 'text-slate-300') : 'text-slate-300'}`}>
              {trend ? `${Math.abs(trend.change)} ${latestWeight?.unit || 'kg'}` : '-'}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Latest</p>
          <p className="text-xl font-bold text-white">
            {latestWeight ? `${latestWeight.weight}` : '-'}
          </p>
          {latestWeight && <p className="text-[10px] text-slate-500">{latestWeight.unit}</p>}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 mb-6">
        <button
          onClick={() => setPage('weight')}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-800 hover:bg-surface-700 border border-white/10 text-white font-medium text-sm transition-all active:scale-[0.98]"
        >
          <Weight size={16} />
          Log Weight
        </button>
      </div>

      {/* Medication Cards */}
      <div className="px-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Your Medications</h2>
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
            <div className="text-center py-10 text-slate-500">
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
