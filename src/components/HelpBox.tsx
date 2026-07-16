import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface HelpBoxProps {
  children: React.ReactNode;
  className?: string;
  position?: 'left' | 'center' | 'right';
}

export function HelpBox({ children, className = '', position = 'center' }: HelpBoxProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [align, setAlign] = useState<'left' | 'center' | 'right'>(position);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    
    setCoords({
      top: rect.bottom + scrollY + 8,
      left: rect.left + (rect.width / 2)
    });

    const screenWidth = window.innerWidth;
    const centerPoint = rect.left + (rect.width / 2);
    let computedAlign = position;

    if (computedAlign === 'center') {
      if (centerPoint < 140) computedAlign = 'left';
      else if (screenWidth - centerPoint < 140) computedAlign = 'right';
    }

    if (computedAlign === 'left' && screenWidth - centerPoint < 260) {
      computedAlign = 'right';
    }

    if (computedAlign === 'right' && centerPoint < 260) {
      computedAlign = 'left';
    }

    // Final fallback
    if (computedAlign === 'left' && screenWidth - centerPoint < 260) {
       computedAlign = 'center';
    }
    if (computedAlign === 'right' && centerPoint < 260) {
       computedAlign = 'center';
    }

    setAlign(computedAlign);
  };

  useEffect(() => {
    if (isExpanded) {
      updatePosition();
      
      const handleScrollOrResize = () => {
        setIsExpanded(false);
      };
      
      window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
      window.addEventListener('resize', handleScrollOrResize, { passive: true });
      
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isExpanded, position]);

  useEffect(() => {
    if (!isExpanded) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        tooltipRef.current && !tooltipRef.current.contains(target)
      ) {
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

  const getTransform = () => {
    switch(align) {
      case 'left': return 'translateX(0)';
      case 'right': return 'translateX(-100%)';
      case 'center': default: return 'translateX(-50%)';
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className={`inline-flex items-center justify-center rounded-full p-1 -m-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 self-start transition-colors ${ isExpanded ? 'text-primary-400' : 'text-content-secondary hover:text-content-primary' } ${className}`}
        aria-label={isExpanded ? "Hide help" : "Show help"}
        aria-expanded={isExpanded}
      >
        <HelpCircle size={18} />
      </button>

      {isExpanded && createPortal(
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: align === 'left' ? `${coords.left - 16}px` : align === 'right' ? `${coords.left + 16}px` : `${coords.left}px`,
            transform: getTransform(),
            zIndex: 999999,
          }}
          className="w-64 max-w-[85vw] bg-surface-800 text-content-primary p-3 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/10 normal-case tracking-normal font-normal text-left"
        >
          {/* Arrow */}
          <div 
            className="absolute -top-[6px] w-3 h-3 bg-surface-800 border-t border-l border-white/10 rotate-45"
            style={{
              left: align === 'left' ? '10px' : align === 'right' ? 'calc(100% - 22px)' : '50%',
              marginLeft: align === 'center' ? '-6px' : '0'
            }}
          />
          <div className="relative z-10 text-[12px] leading-relaxed text-content-secondary">
            {children}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
