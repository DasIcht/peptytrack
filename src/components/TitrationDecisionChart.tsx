import { useMemo } from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { CircularProgress } from './CircularProgress';
import type { Protocol, SymptomLog, Dose, WeightEntry } from '../types';
import { calculateTitrationMetrics } from '../lib/titrationAnalytics';
import { useMedicationStore } from '../stores/medicationStore';

interface TitrationDecisionChartProps {
  protocol: Protocol;
  doses: Dose[];
  symptomLogs: SymptomLog[];
  weightEntries: WeightEntry[];
  severeThreshold: number;
}

export function TitrationDecisionChart({
  protocol,
  doses,
  symptomLogs,
  weightEntries,
  severeThreshold
}: TitrationDecisionChartProps) {
  const chartStyle = protocol.chartStyle || 'spider';
  const medications = useMedicationStore(state => state.medications);
  const metrics = useMemo(() => calculateTitrationMetrics(protocol, doses, symptomLogs, weightEntries, medications), [protocol, doses, symptomLogs, weightEntries, medications]);

  // Transform metrics for the Spider Chart
  // We want higher values to mean "ready to advance" for visualization clarity.
  // - Time Progress: 0-100%
  // - Symptom Tolerance: (severeThreshold - score) / severeThreshold * 100
  // - Weight Stability: 1.0 kg/week is threshold. (1.5 - loss) / 1.5 * 100
  const spiderData = useMemo(() => {
    const symptomTolerance = metrics.hasSymptomData 
      ? Math.min(100, Math.max(0, ((severeThreshold - metrics.symptomScore) / severeThreshold) * 100))
      : 0;
      
    const weightStability = metrics.hasWeightData
      ? Math.min(100, Math.max(0, ((1.5 - metrics.weightLossRateKgPerWeek) / 1.5) * 100))
      : 0;
    
    return [
      { subject: 'Time Progress', A: metrics.timeProgressPercent, fullMark: 100 },
      { subject: 'Symptom Tolerance', A: symptomTolerance, fullMark: 100 },
      { subject: 'Weight Stability', A: weightStability, fullMark: 100 },
    ];
  }, [metrics, severeThreshold]);

  // Timeline Data: Symptoms over the last 14 days
  const timelineData = useMemo(() => {
    const days: { date: string; score: number }[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let i = 13; i >= 0; i--) {
      const targetDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      days.push({
        date: targetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        score: 0,
      });
    }

    const fourteenDaysAgo = now.getTime() - 13 * 24 * 60 * 60 * 1000;
    
    // Process Doses
    doses.filter(d => d.medicationId === protocol.medicationId && d.dateTime >= fourteenDaysAgo).forEach(d => {
      const dateStr = new Date(d.dateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const day = days.find(x => x.date === dateStr);
      if (day && d.sideEffects) {
        day.score += d.sideEffects.reduce((acc, se) => acc + (se.severity === 'severe' ? 3 : se.severity === 'moderate' ? 2 : 1), 0);
      }
    });

    // Process Symptom Logs
    symptomLogs.filter(l => l.medicationId === protocol.medicationId && l.dateTime >= fourteenDaysAgo).forEach(l => {
      const dateStr = new Date(l.dateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const day = days.find(x => x.date === dateStr);
      if (day && l.symptoms) {
        day.score += l.symptoms.reduce((acc, se) => acc + (se.severity === 'severe' ? 3 : se.severity === 'moderate' ? 2 : 1), 0);
      }
    });

    return days;
  }, [doses, symptomLogs, protocol.medicationId]);

  if (chartStyle === 'gauges') {
    return (
      <div className="grid grid-cols-3 gap-4 py-4">
        <div className="flex flex-col items-center justify-center">
          <CircularProgress
            percentage={metrics.timeProgressPercent}
            size={80}
            strokeWidth={8}
            label={`${metrics.daysRemaining}d`}
            sublabel="Left"
            color={metrics.timeProgressPercent >= 100 ? '#10b981' : '#14b8a6'}
          />
          <div className="text-[10px] text-content-secondary mt-2 font-semibold uppercase tracking-widest text-center">Time Progress</div>
        </div>
        <div className="flex flex-col items-center justify-center">
          <CircularProgress
            percentage={metrics.hasSymptomData ? Math.max(0, 100 - (metrics.symptomScore / severeThreshold) * 100) : 0}
            size={80}
            strokeWidth={8}
            label={metrics.hasSymptomData ? `${metrics.symptomScore}/${severeThreshold}` : 'N/A'}
            sublabel="Score"
            color={!metrics.hasSymptomData ? '#64748b' : metrics.symptomScore >= severeThreshold ? '#ef4444' : metrics.symptomScore > 3 ? '#f59e0b' : '#10b981'}
          />
          <div className="text-[10px] text-content-secondary mt-2 font-semibold uppercase tracking-widest text-center">Side Effects</div>
        </div>
        <div className="flex flex-col items-center justify-center">
          <CircularProgress
            percentage={metrics.hasWeightData ? Math.max(0, 100 - (metrics.weightLossRateKgPerWeek / 1.5) * 100) : 0}
            size={80}
            strokeWidth={8}
            label={metrics.hasWeightData ? `${metrics.weightLossRateKgPerWeek.toFixed(1)}` : 'N/A'}
            sublabel="kg/wk"
            color={!metrics.hasWeightData ? '#64748b' : metrics.weightLossRateKgPerWeek > 1.0 ? '#ef4444' : '#10b981'}
          />
          <div className="text-[10px] text-content-secondary mt-2 font-semibold uppercase tracking-widest text-center">Weight Rate</div>
        </div>
      </div>
    );
  }

  if (chartStyle === 'timeline') {
    return (
      <div className="h-48 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={timelineData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--color-text-secondary)" fontSize={10} tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis stroke="var(--color-text-secondary)" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, 'dataMax + 1']} />
            <RechartsTooltip
              contentStyle={{ backgroundColor: 'var(--color-surface-800)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ color: 'var(--color-primary-500)', fontWeight: 'bold' }}
              labelStyle={{ color: 'var(--color-text-secondary)', marginBottom: '4px' }}
              formatter={(val: any) => [`${val} points`, 'Symptom Score']}
            />
            <Bar dataKey="score" fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // default to spider
  return (
    <div className="h-56 w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={spiderData}>
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10, fontWeight: 600 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <RechartsTooltip
            contentStyle={{ backgroundColor: 'var(--color-surface-800)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
            itemStyle={{ color: 'var(--color-primary-500)', fontWeight: 'bold' }}
            formatter={(val: any) => [`${Number(val).toFixed(0)}%`, 'Readiness']}
          />
          <Radar
            name="Titration Readiness"
            dataKey="A"
            stroke="var(--color-primary-500)"
            fill="var(--color-primary-500)"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      {/* Ready indicator */}
      {spiderData.every(d => d.A > 30) && metrics.timeProgressPercent === 100 ? (
         <div className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
           Ready
         </div>
      ) : (
         <div className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
           Not Ready
         </div>
      )}
    </div>
  );
}
