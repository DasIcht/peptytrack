import { useMedicationStore } from '../stores/medicationStore';
import { useVialStore } from '../stores/vialStore';
import { Clock, ChevronRight, FlaskConical } from 'lucide-react';
import { format } from 'date-fns';

interface MedicationCardProps {
  medId: string;
  onClick?: () => void;
}

export function MedicationCard({ medId, onClick }: MedicationCardProps) {
  const { medications, getMedicationLevel, getTimeUntil, getDosesForMedication } =
    useMedicationStore();
  const { vials } = useVialStore();
  const med = medications.find((m) => m.id === medId);
  if (!med) return null;

  const medVialCount = vials.filter((v) => v.medicationId === medId).length;

  const level = getMedicationLevel(medId);
  const timeUntil = getTimeUntil(medId);
  const recentDoses = getDosesForMedication(medId).slice(0, 3);

  const maxLevel = med.dosageOptions[med.dosageOptions.length - 1];
  const levelPercent = Math.min((level / maxLevel) * 100, 100);

  return (
    <button
      onClick={onClick}
      className="w-full text-left group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-surface-800 to-surface-900 p-4 transition-all duration-300 hover:border-white/10 hover:shadow-lg hover:shadow-black/20 active:scale-[0.98]"
    >
      <div className="absolute top-0 right-0 w-32 h-32 opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" style={{ backgroundColor: med.color }} />

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${med.color}20`, border: `1px solid ${med.color}40` }}
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: med.color }} />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">{med.name}</h3>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-slate-400">{med.brand}</p>
              {medVialCount > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded-full bg-primary-500/10 text-primary-400">
                  <FlaskConical size={8} />
                  {medVialCount}
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronRight size={16} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-400">Medication Level</span>
          <span className="font-medium" style={{ color: med.color }}>
            {level.toFixed(2)} {med.unit}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${levelPercent}%`,
              backgroundColor: med.color,
              boxShadow: `0 0 8px ${med.color}60`,
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Clock size={12} />
        <span>
          {timeUntil === 'Not started'
            ? 'Not started yet'
            : timeUntil === 'Overdue'
              ? 'Overdue — log your dose!'
              : `Next dose in ${timeUntil}`}
        </span>
      </div>

      {recentDoses.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Recent Doses</p>
          <div className="flex flex-wrap gap-1.5">
            {recentDoses.map((d) => (
              <span
                key={d.id}
                className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-300"
              >
                {d.dosage}{med.unit} · {format(new Date(d.dateTime), 'MMM d')}
              </span>
            ))}
          </div>
        </div>
      )}
    </button>
  );
}
