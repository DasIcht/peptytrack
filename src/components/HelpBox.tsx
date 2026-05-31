import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export interface HelpBoxProps {
  children: React.ReactNode;
  className?: string;
}

export function HelpBox({ children, className = '' }: HelpBoxProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`transition-colors inline-flex items-center justify-center rounded-full p-1 -m-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 self-start ${
          isExpanded ? 'text-primary-400' : 'text-slate-400 hover:text-slate-300'
        }`}
        aria-label={isExpanded ? "Hide help" : "Show help"}
        aria-expanded={isExpanded}
      >
        <HelpCircle size={18} />
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-3 mt-3 bg-surface-800/50 border border-white/5 rounded-xl text-sm leading-relaxed text-slate-300 shadow-elevated">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
