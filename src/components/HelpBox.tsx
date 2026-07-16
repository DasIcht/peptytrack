import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export interface HelpBoxProps {
  children: React.ReactNode;
  className?: string;
  position?: 'left' | 'center' | 'right';
}

export function HelpBox({ children, className = '', position = 'center' }: HelpBoxProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isExpanded) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isExpanded]);

  const positionClasses = {
    left: 'left-0 mt-2 w-64 max-w-[85vw]',
    center: 'left-1/2 -translate-x-1/2 mt-2 w-64 max-w-[85vw]',
    right: 'right-0 mt-2 w-64 max-w-[85vw]',
  };

  return (
    <div ref={containerRef} className={`inline-flex relative ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className={`transition-colors inline-flex items-center justify-center rounded-full p-1 -m-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 self-start ${ isExpanded ? 'text-primary-400' : 'text-content-secondary hover:text-content-primary' }`}
        aria-label={isExpanded ? "Hide help" : "Show help"}
        aria-expanded={isExpanded}
      >
        <HelpCircle size={18} />
      </button>

      <div
        className={`absolute z-[100] top-full ${positionClasses[position]} shadow-xl transition-all duration-200 ease-out origin-top ${ isExpanded ? 'opacity-100 visible translate-y-0 scale-100' : 'opacity-0 invisible -translate-y-2 scale-95' }`}
      >
        <div className="p-3 bg-surface-800 border border-white/10 rounded-xl text-sm leading-relaxed text-content-secondary shadow-elevated">
          {children}
        </div>
      </div>
    </div>
  );
}
