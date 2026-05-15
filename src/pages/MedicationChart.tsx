import { useState, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMedicationStore } from '../stores/medicationStore';
import { useWeightStore } from '../stores/weightStore';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Line, Legend
} from 'recharts';
import { format, subDays } from 'date-fns';
import { medicationLevelAtTime } from '../lib/halfLifeEngine';
import { useProtocolStore } from '../stores/protocolStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSymptomLogStore } from '../stores/symptomLogStore';
import { TitrationDecisionChart } from '../components/TitrationDecisionChart';
import { calculateWeightedSymptomScore } from '../lib/titrationAnalytics';
import { RefreshCw, Activity } from 'lucide-react';

const TIME_RANGES = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
];

interface ChartPoint {
  date: number;
  weight: number | null;
  weightUnit: string;
  symptomScore: number | null;
  symptomDetails: string[];
  [key: string]: number | string | string[] | null;
}

interface DosePoint {
  medId: string;
  x: number;
  y: number;
}

interface TooltipPayloadItem {
  value: number | string;
  name: string;
  dataKey: string;
  payload?: ChartPoint;
}

export function MedicationChart() {
  const medications = useMedicationStore(
    useShallow((state) => state.medications.filter((m) => m.enabled))
  );
  const doses = useMedicationStore(useShallow((state) => state.doses));
  const { entries: weightEntries } = useWeightStore();
  const { logs: symptomLogs } = useSymptomLogStore();
  const { protocols } = useProtocolStore();
  const { settings } = useSettingsStore();

  const [rangeDays, setRangeDays] = useState(30);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [titrationChartIndex, setTitrationChartIndex] = useState(0);

  const activeProtocols = useMemo(() => {
    return protocols.filter(p => medications.some(m => m.id === p.medicationId));
  }, [protocols, medications]);

  const currentProtocol = activeProtocols.length > 0 ? activeProtocols[titrationChartIndex % activeProtocols.length] : null;
  const currentProtocolMed = currentProtocol ? medications.find(m => m.id === currentProtocol.medicationId) : null;

  // eslint-disable-next-line react-hooks/purity
  const now = useMemo(() => Date.now(), []);

  const chartResult = useMemo(() => {
    if (medications.length === 0) {
      return { data: [] as ChartPoint[], dosePoints: [] as DosePoint[], maxLevel: 1 };
    }

    const end = now;
    const start = subDays(end, rangeDays).getTime();
    const resolutionMinutes = rangeDays <= 7 ? 60 : rangeDays <= 30 ? 240 : 720;
    const stepMs = resolutionMinutes * 60 * 1000;

    const timestamps: number[] = [];
    for (let t = start; t <= end; t += stepMs) {
      timestamps.push(t);
    }

    const data: ChartPoint[] = timestamps.map((t) => {
      const point: ChartPoint = { 
        date: t, 
        weight: null, 
        weightUnit: '',
        symptomScore: null,
        symptomDetails: []
      };
      for (const med of medications) {
        point[`level_${med.id}`] = medicationLevelAtTime(med, doses, t);
      }
      return point;
    });

    const weightsInRange = weightEntries
      .filter((w) => w.dateTime >= start && w.dateTime <= end)
      .sort((a, b) => a.dateTime - b.dateTime);

    for (const w of weightsInRange) {
      const existing = data.find((p) => Math.abs(p.date - w.dateTime) < stepMs / 2);
      if (existing) {
        existing.weight = w.weight;
        existing.weightUnit = w.unit;
      } else {
        const closest = data.reduce(
          (best, p) =>
            Math.abs(p.date - w.dateTime) < Math.abs(best.date - w.dateTime) ? p : best,
          data[0]
        );
        if (closest) {
          const newPoint: ChartPoint = {
            date: w.dateTime,
            weight: w.weight,
            weightUnit: w.unit,
            symptomScore: null,
            symptomDetails: [],
          };
          for (const med of medications) {
            newPoint[`level_${med.id}`] = medicationLevelAtTime(med, doses, w.dateTime);
          }
          data.push(newPoint);
        }
      }
    }

    // Process Symptom Logs
    const symptomsInRange = symptomLogs
      .filter((s) => s.dateTime >= start && s.dateTime <= end)
      .sort((a, b) => a.dateTime - b.dateTime);

    for (const s of symptomsInRange) {
      const score = calculateWeightedSymptomScore(s.symptoms, s.dateTime, now);
      const details = s.symptoms.map(se => se.label);
      const existing = data.find((p) => Math.abs(p.date - s.dateTime) < stepMs / 2);
      if (existing) {
        existing.symptomScore = (existing.symptomScore || 0) + score;
        existing.symptomDetails = [...(existing.symptomDetails || []), ...details];
      } else {
        const newPoint: ChartPoint = {
          date: s.dateTime,
          weight: null,
          weightUnit: '',
          symptomScore: score,
          symptomDetails: details,
        };
        for (const med of medications) {
          newPoint[`level_${med.id}`] = medicationLevelAtTime(med, doses, s.dateTime);
        }
        data.push(newPoint);
      }
    }

    // Process Doses for symptoms too
    const medDosesInRange = doses
      .filter((d) => d.dateTime >= start && d.dateTime <= end)
      .sort((a, b) => a.dateTime - b.dateTime);
    
    for (const d of medDosesInRange) {
      if (!d.sideEffects || d.sideEffects.length === 0) continue;
      const score = calculateWeightedSymptomScore(d.sideEffects, d.dateTime, now);
      const details = d.sideEffects.map(se => se.label);
      const existing = data.find((p) => Math.abs(p.date - d.dateTime) < stepMs / 2);
      if (existing) {
        existing.symptomScore = (existing.symptomScore || 0) + score;
        existing.symptomDetails = [...(existing.symptomDetails || []), ...details];
      }
    }

    data.sort((a, b) => a.date - b.date);

    let max = 1;
    for (const point of data) {
      for (const med of medications) {
        const level = (point[`level_${med.id}`] as number) || 0;
        if (level > max) max = level;
      }
    }

    const dosePoints: DosePoint[] = [];
    for (const med of medications) {
      const medDoses = doses.filter((d) => d.medicationId === med.id);
      for (const d of medDoses) {
        const closest = data.reduce(
          (best, p) =>
            Math.abs(p.date - d.dateTime) < Math.abs(best.date - d.dateTime) ? p : best,
          data[0]
        );
        if (closest) {
          dosePoints.push({
            medId: med.id,
            x: d.dateTime,
            y: (closest[`level_${med.id}`] as number) || 0,
          });
        }
      }
    }

    return { data, dosePoints, maxLevel: max * 1.2 };
  }, [medications, doses, weightEntries, symptomLogs, rangeDays, now]);

  const { data: chartData, dosePoints } = chartResult;

  const visibleMaxLevel = useMemo(() => {
    let max = 1;
    for (const point of chartData) {
      for (const med of medications) {
        const key = `level_${med.id}`;
        if (hiddenKeys.has(key)) continue;
        const level = (point[key] as number) || 0;
        if (level > max) max = level;
      }
    }
    return max * 1.2 || 1;
  }, [chartData, medications, hiddenKeys]);

  const weightRange = useMemo(() => {
    const weights = chartData
      .filter((p) => p.weight !== null)
      .map((p) => p.weight as number);
    if (weights.length === 0) return { min: 0, max: 100 };
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const pad = (max - min) * 0.2;
    return { min: Math.max(0, min - pad), max: max + pad };
  }, [chartData]);

  const symptomMax = useMemo(() => {
    const scores = chartData
      .filter((p) => p.symptomScore !== null)
      .map((p) => p.symptomScore as number);
    if (scores.length === 0) return 10;
    return Math.max(10, Math.max(...scores) * 1.2);
  }, [chartData]);

  const handleLegendClick = (e: unknown) => {
    const dataKey = (e as { dataKey?: string }).dataKey;
    const key = dataKey;
    if (!key) return;
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const legendFormatter = (value: string) => {
    if (value === 'weight') return 'Weight';
    if (value === 'symptomScore') return 'Symptoms';
    const med = medications.find((m) => `level_${m.id}` === value);
    return med?.name || value;
  };

  if (medications.length === 0) {
    return (
      <div className="min-h-full pb-24 px-5 pt-6">
        <h1 className="text-2xl font-bold text-white mb-1">Medication Levels</h1>
        <p className="text-sm text-slate-400 mb-6">No enabled medications to display.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-24 px-3 pt-6">
      <h1 className="text-2xl font-bold text-white mb-1">Medication Levels</h1>
      <p className="text-sm text-slate-400 mb-6">Estimated concentration based on half-life</p>

      {/* Time range selector */}
      <div className="flex rounded-xl border border-white/10 overflow-hidden mb-5 self-start">
        {TIME_RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setRangeDays(r.days)}
            className={`px-3 py-2.5 text-xs font-medium transition-colors ${
              rangeDays === r.days
                ? 'bg-primary-600 text-white'
                : 'bg-surface-800 text-slate-400 hover:text-white'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {chartData.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-2">
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                {medications.map((med) => (
                  <linearGradient key={med.id} id={`grad_${med.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={med.color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={med.color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
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
                yAxisId="left"
                domain={[0, visibleMaxLevel]}
                stroke="rgba(255,255,255,0.15)"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                label={false}
                tickFormatter={(v: number) => v.toFixed(2)}
              />
              {chartData.some((p) => p.weight !== null) && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[weightRange.min, weightRange.max]}
                  stroke="rgba(255,255,255,0.15)"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  label={false}
                  tickFormatter={(v: number) => v.toFixed(2)}
                />
              )}
              {chartData.some((p) => p.symptomScore !== null) && (
                <YAxis
                  yAxisId="symptoms"
                  orientation="right"
                  domain={[0, symptomMax]}
                  stroke="rgba(167, 139, 250, 0.3)"
                  tick={{ fill: '#a78bfa', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  label={false}
                  tickFormatter={(v: number) => Math.round(v).toString()}
                  width={20}
                />
              )}
              <Legend
                onClick={handleLegendClick}
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                formatter={legendFormatter}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                }}
                labelFormatter={(v) => format(new Date(Number(v)), 'PPP p')}
                formatter={(value: unknown, name: unknown, props: unknown) => {
                  const tooltipProps = props as TooltipPayloadItem;
                  if (name === 'weight') {
                    const unit = tooltipProps?.payload?.weightUnit || 'kg';
                    return [`${value} ${unit}`, 'Weight'];
                  }
                  if (name === 'symptomScore') {
                    const details = tooltipProps?.payload?.symptomDetails || [];
                    const label = details.length > 0 ? `Score: ${value} (${details.join(', ')})` : `Score: ${value}`;
                    return [label, 'Symptoms'];
                  }
                  const med = medications.find((m) => `level_${m.id}` === name);
                  if (med) {
                    return [`${Number(value).toFixed(2)} ${med.unit}`, `${med.name} Level`];
                  }
                  return [String(value), String(name)];
                }}
              />
              {medications.map((med) => (
                <Area
                  key={med.id}
                  yAxisId="left"
                  type="monotone"
                  dataKey={`level_${med.id}`}
                  name={`level_${med.id}`}
                  stroke={med.color}
                  strokeWidth={2}
                  fill={`url(#grad_${med.id})`}
                  dot={false}
                  activeDot={{ r: 4, fill: med.color, stroke: '#fff', strokeWidth: 2 }}
                  connectNulls
                  hide={hiddenKeys.has(`level_${med.id}`)}
                />
              ))}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="weight"
                name="weight"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                connectNulls
                hide={hiddenKeys.has('weight')}
              />
              <Line
                yAxisId="symptoms"
                type="monotone"
                dataKey="symptomScore"
                name="symptomScore"
                stroke="#a78bfa"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#a78bfa', stroke: '#0f172a', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: '#a78bfa', stroke: '#fff', strokeWidth: 2 }}
                connectNulls
                hide={hiddenKeys.has('symptomScore')}
              />
              {dosePoints
                .filter((dp) => !hiddenKeys.has(`level_${dp.medId}`))
                .map((dp, i) => (
                  <ReferenceDot
                    key={i}
                    yAxisId="left"
                    x={dp.x}
                    y={dp.y}
                    r={5}
                    fill={medications.find((m) => m.id === dp.medId)?.color || '#fff'}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                ))}
            </AreaChart>
          </ResponsiveContainer>

          <p className="text-[10px] text-slate-500 mt-2 text-center">
            Dots indicate logged doses. Click legend items to toggle visibility.
          </p>
        </div>
      )}

      {/* Titration Decision Parameters */}
      {settings.titrationWizardEnabled && activeProtocols.length > 0 && currentProtocol && currentProtocolMed && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity size={18} className="text-primary-400" />
                Titration Parameters
              </h2>
              <p className="text-xs text-slate-400">{currentProtocolMed.name}</p>
            </div>
            {activeProtocols.length > 1 && (
              <button
                onClick={() => setTitrationChartIndex(prev => prev + 1)}
                className="btn-tactile p-2 rounded-lg bg-surface-800 text-slate-400 hover:text-white border border-white/5"
              >
                <RefreshCw size={16} />
              </button>
            )}
          </div>
          <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-4">
            <TitrationDecisionChart
              protocol={currentProtocol}
              doses={doses}
              symptomLogs={symptomLogs}
              weightEntries={weightEntries}
              severeThreshold={settings.severeSideEffectThreshold || 5}
            />
          </div>
        </div>
      )}
    </div>
  );
}
