import { useMemo } from 'react';
import { useMedicationStore } from '../stores/medicationStore';
import { useProtocolStore } from '../stores/protocolStore';
import { useSymptomLogStore } from '../stores/symptomLogStore';
import { useWeightStore } from '../stores/weightStore';
import { useSettingsStore } from '../stores/settingsStore';
import { evaluateTitration } from '../lib/titrationAnalytics';
import { AlertTriangle, Info } from 'lucide-react';

interface MedicalWarningBannerProps {
  medicationId?: string; // If provided, only show warning for this medication
}

export function MedicalWarningBanner({ medicationId }: MedicalWarningBannerProps) {
  const { medications, doses } = useMedicationStore();
  const { protocols } = useProtocolStore();
  const { logs: symptomLogs } = useSymptomLogStore();
  const { entries: weightEntries } = useWeightStore();
  const { settings } = useSettingsStore();

  const warnings = useMemo(() => {
    if (!settings.titrationWizardEnabled) return [];

    const activeMeds = medicationId 
      ? medications.filter(m => m.id === medicationId)
      : medications.filter(m => m.enabled);

    const found: { medName: string; reason: string }[] = [];

    for (const med of activeMeds) {
      const protocol = protocols.find(p => p.medicationId === med.id);
      if (!protocol) continue;

      const recommendation = evaluateTitration(
        protocol, 
        doses, 
        symptomLogs, 
        weightEntries, 
        settings.severeSideEffectThreshold || 5
      );

      if (recommendation.warningLevel === 'severe') {
        found.push({ medName: med.name, reason: recommendation.reason });
      }
    }

    return found;
  }, [medications, doses, protocols, symptomLogs, weightEntries, settings, medicationId]);

  if (warnings.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 mb-6 stagger-children">
      {warnings.map((w, i) => (
        <div 
          key={i}
          className="relative overflow-hidden group bg-red-500/10 border border-red-500/20 rounded-2xl p-4 animate-in fade-in slide-in-from-top-4 duration-500"
        >
          {/* Pulsing red accent */}
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse" />
          
          <div className="flex gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 h-fit">
              <AlertTriangle size={20} className="animate-bounce-subtle" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-500/60 bg-red-500/10 px-1.5 py-0.5 rounded">
                  Medical Warning
                </span>
                <span className="text-xs font-bold text-red-400">
                  {w.medName}
                </span>
              </div>
              <p className="text-sm font-medium text-red-200 leading-relaxed">
                {w.reason}
              </p>
              
              <div className="mt-3 flex items-center gap-2 text-[11px] text-red-400/70 italic">
                <Info size={12} />
                <span>Consult your healthcare provider immediately.</span>
              </div>
            </div>
          </div>

          {/* Subtle background glow */}
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-red-500/10 blur-3xl rounded-full" />
        </div>
      ))}
    </div>
  );
}
