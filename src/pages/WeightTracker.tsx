import { useState, useEffect } from 'react';
import { useWeightStore } from '../stores/weightStore';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { TrendingDown, TrendingUp, Minus, Scale, Trash2, Pencil } from 'lucide-react';

export function WeightTracker() {
  const { entries, addEntry, updateEntry, deleteEntry, getTrend } = useWeightStore();
  const { addToast } = useUIStore();
  const { settings } = useSettingsStore();

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');

  useEffect(() => {
    if (!editingEntryId) {
      setUnit(settings.weightUnit);
    }
  }, [settings.weightUnit, editingEntryId]);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trend = getTrend();
  const sortedEntries = [...entries].sort((a, b) => a.dateTime - b.dateTime);

  const chartData = sortedEntries.map((e) => ({
    date: e.dateTime,
    weight: e.weight,
    unit: e.unit,
  }));

  const resetForm = () => {
    setEditingEntryId(null);
    setWeight('');
    setUnit('kg');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setTime(format(new Date(), 'HH:mm'));
    setNotes('');
  };

  const handleEdit = (entry: (typeof entries)[0]) => {
    setEditingEntryId(entry.id);
    setWeight(String(entry.weight));
    setUnit(entry.unit);
    const d = new Date(entry.dateTime);
    setDate(format(d, 'yyyy-MM-dd'));
    setTime(format(d, 'HH:mm'));
    setNotes(entry.notes);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight) return;

    setSubmitting(true);
    try {
      const dateTime = new Date(`${date}T${time}`).getTime();
      if (editingEntryId) {
        await updateEntry(editingEntryId, {
          weight: parseFloat(weight),
          unit,
          dateTime,
          notes,
        });
        addToast('Weight updated!', 'success');
      } else {
        await addEntry({
          weight: parseFloat(weight),
          unit,
          dateTime,
          notes,
        });
        addToast('Weight logged!', 'success');
      }
      resetForm();
    } catch {
      addToast(editingEntryId ? 'Failed to update weight' : 'Failed to log weight', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const { openModal } = useUIStore();

  const handleDelete = (id: string) => {
    openModal(
      <ConfirmDialog
        title="Delete Weight Entry?"
        message="This action cannot be undone. The weight entry will be permanently removed from your history."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={async () => {
          try {
            await deleteEntry(id);
            addToast('Weight entry deleted', 'info');
            if (editingEntryId === id) resetForm();
          } catch {
            addToast('Failed to delete entry', 'error');
          }
        }}
      />
    );
  };

  const submitLabel = editingEntryId
    ? (submitting ? 'Updating...' : 'Update Weight')
    : (submitting ? 'Saving...' : 'Log Weight');

  return (
    <div className="min-h-full pb-24 px-5 pt-6">
      <h1 className="text-2xl font-bold text-content-primary mb-1">
        {editingEntryId ? 'Update Weight' : 'Weight Tracker'}
      </h1>
      <p className="text-sm text-content-secondary mb-6">Monitor your progress over time</p>

      {/* Trend Card */}
      {trend && (
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-4 mb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-content-secondary uppercase tracking-wider">Overall Change</p>
              <div className="flex items-center gap-2 mt-1">
                {trend.change < 0 ? (
                  <TrendingDown size={20} className="text-emerald-400" />
                ) : trend.change > 0 ? (
                  <TrendingUp size={20} className="text-red-400" />
                ) : (
                  <Minus size={20} className="text-content-secondary" />
                )}
                <span className={`text-2xl font-bold ${ trend.change < 0 ? 'text-emerald-400' : trend.change > 0 ? 'text-red-400' : 'text-content-secondary' }`}>
                  {Math.abs(trend.change)} {entries[0]?.unit || unit}
                </span>
              </div>
              <p className="text-xs text-content-muted mt-1">
                Over {trend.periodDays} days
              </p>
            </div>
            {entries[0] && (
              <div className="text-right">
                <p className="text-xs text-content-secondary">Latest</p>
                <p className="text-xl font-bold text-content-primary">{entries[0].weight} {entries[0].unit}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-4 mb-5">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => format(new Date(v), 'MMM d')}
                stroke="rgba(255,255,255,0.15)"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="rgba(255,255,255,0.15)"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
                labelFormatter={(v) => format(new Date(Number(v)), 'PPP')}
                formatter={(value, _name, props) => [`${value} ${(props as { payload: { unit: string } }).payload.unit}`, 'Weight']}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#14b8a6"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#14b8a6', stroke: '#0f172a', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: '#14b8a6', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Entry Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-6">
        <h3 className="text-sm font-semibold text-content-secondary uppercase tracking-wider">
          {editingEntryId ? 'Edit Entry' : 'Log Weight'}
        </h3>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Scale size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-secondary" />
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Weight"
              className="w-full bg-surface-800 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-content-primary text-sm focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
          <div className="flex rounded-xl border border-white/10 overflow-hidden">
            {(['kg', 'lb'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`px-4 py-2.5 text-xs font-medium transition-colors ${ unit === u ? 'bg-primary-600 text-white' : 'bg-surface-800 text-slate-400 hover:text-white' }`}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-content-muted mb-1.5 uppercase tracking-wider">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-content-primary text-sm focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted mb-1.5 uppercase tracking-wider">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-content-primary text-sm focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
        </div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-content-primary text-sm focus:outline-none focus:border-primary-500 transition-colors"
        />
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!weight || submitting}
            className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-sm transition-all active:scale-[0.98] shadow-lg shadow-primary-900/30"
          >
            {submitLabel}
          </button>
          {editingEntryId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-3 rounded-xl bg-surface-800 hover:bg-surface-700 border border-white/10 text-content-secondary text-sm transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* History */}
      {entries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-content-secondary uppercase tracking-wider mb-3">History</h3>
          <div className="flex flex-col gap-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${ editingEntryId === entry.id ? 'border-primary-500/40 bg-primary-600/10' : 'border-white/5 bg-surface-800/30' }`}
              >
                <button
                  onClick={() => handleEdit(entry)}
                  className="flex-1 text-left"
                >
                  <p className="text-sm font-medium text-content-primary">
                    {entry.weight} {entry.unit}
                  </p>
                  <p className="text-xs text-content-secondary">
                    {format(new Date(entry.dateTime), 'PPP p')}
                  </p>
                  {entry.notes && (
                    <p className="text-xs text-content-muted mt-0.5">{entry.notes}</p>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(entry)}
                    className="p-2 rounded-lg text-slate-500 hover:text-primary-300 hover:bg-primary-500/10 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
