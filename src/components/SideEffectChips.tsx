import { useState, useRef, useEffect } from 'react';
import { Plus, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface SideEffectChipsProps {
  sideEffects: string[];
  selected: string[];
  onToggle: (label: string) => void;
  onAddCustom: (label: string) => void;
}

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

  const displayEffects = expanded ? sideEffects : sideEffects.slice(0, 6);
  const canExpand = sideEffects.length > 6;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {displayEffects.map((label) => {
          const isSelected = selected.includes(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() => onToggle(label)}
              className={`btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-primary-600/15 border border-primary-500/40 text-primary-300 shadow-[0_0_8px_rgba(20,184,166,0.1)]'
                  : 'bg-surface-900/50 border border-white/5 text-slate-400 hover:border-white/15 hover:bg-surface-800 hover:shadow-sm'
              }`}
            >
              {isSelected && <Check size={11} className="text-primary-400" />}
              {label}
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
              placeholder="New side effect..."
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
