import { useState, useRef, useEffect } from 'react';
import { Plus, Check, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import type { SideEffectLog, SideEffectSeverity } from '../types';

interface SideEffectChipsProps {
  sideEffects: string[];
  selected: SideEffectLog[];
  onToggle: (label: string, severity?: SideEffectSeverity) => void;
  onAddCustom: (label: string) => void;
}

const SEVERITY_ORDER: (SideEffectSeverity | null)[] = ['mild', 'moderate', 'severe', null];

const SEVERITY_STYLES: Record<SideEffectSeverity, string> = {
  mild: 'bg-primary-600/20 border-primary-500/50 text-primary-300 shadow-primary-900/10',
  moderate: 'bg-amber-600/20 border-amber-500/50 text-amber-300 shadow-amber-900/10',
  severe: 'bg-red-600/20 border-red-500/50 text-red-300 shadow-red-900/10',
};

export function SideEffectChips({ sideEffects, selected, onToggle, onAddCustom }: SideEffectChipsProps) {
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [adding]);

  const handleAdd = () => {
    const trimmed = customLabel.trim();
    if (trimmed) {
      onAddCustom(trimmed);
      setCustomLabel('');
    }
    setAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      setAdding(false);
      setCustomLabel('');
    }
  };

  const handleCycle = (label: string) => {
    const current = selected.find(s => s.label === label);
    const currentIndex = current ? SEVERITY_ORDER.indexOf(current.severity) : -1;
    const nextSeverity = SEVERITY_ORDER[currentIndex + 1];

    if (nextSeverity === null) {
      onToggle(label); // Remove
    } else {
      onToggle(label, nextSeverity); // Set next
    }
  };

  const displayEffects = expanded ? sideEffects : sideEffects.slice(0, 6);
  const canExpand = sideEffects.length > 6;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {displayEffects.map((label) => {
          const activeLog = selected.find(s => s.label === label);
          const isSelected = !!activeLog;
          const severityClass = activeLog ? SEVERITY_STYLES[activeLog.severity] : 'bg-surface-900/50 border-white/5 text-slate-400 hover:border-white/15 hover:bg-surface-800';

          return (
            <button
              key={label}
              type="button"
              onClick={() => handleCycle(label)}
              className={`btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${severityClass}`}
            >
              {activeLog?.severity === 'mild' && <Check size={11} className="text-primary-400" />}
              {activeLog?.severity === 'moderate' && <AlertCircle size={11} className="text-amber-400" />}
              {activeLog?.severity === 'severe' && <AlertCircle size={11} className="text-red-400 font-bold" />}
              {label}
              {activeLog && (
                <span className="text-[10px] opacity-60 uppercase font-bold ml-0.5">
                  {activeLog.severity.slice(0, 3)}
                </span>
              )}
            </button>
          );
        })}

        {adding ? (
          <div className="flex items-center gap-2 animate-pop-in">
            <input
              ref={inputRef}
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleAdd}
              placeholder="New symptom..."
              className="w-40 bg-surface-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)] transition-all"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn-tactile inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-900/50 border border-dashed border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20 hover:bg-surface-800 transition-all"
          >
            <Plus size={12} />
            Add Custom
          </button>
        )}
      </div>
      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Show less' : `Show ${sideEffects.length - 6} more`}
        </button>
      )}
    </div>
  );
}
