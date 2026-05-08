import { useEffect, useState } from 'react';

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  label?: string;
  sublabel?: string;
  animate?: boolean;
}

export function CircularProgress({
  percentage,
  size = 72,
  strokeWidth = 5,
  color,
  bgColor = 'rgba(255,255,255,0.06)',
  label,
  sublabel,
  animate = true,
}: CircularProgressProps) {
  const [displayPct, setDisplayPct] = useState(animate ? 0 : percentage);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayPct / 100) * circumference;

  const ringColor = color ?? (percentage > 50 ? '#10b981' : percentage > 25 ? '#f59e0b' : '#ef4444');

  useEffect(() => {
    if (!animate) return;
    const timer = setTimeout(() => setDisplayPct(percentage), 80);
    return () => clearTimeout(timer);
  }, [percentage, animate]);

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={bgColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ringColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white">{Math.round(displayPct)}%</span>
        </div>
      </div>
      {(label || sublabel) && (
        <div className="flex flex-col min-w-0">
          {label && <span className="text-sm font-semibold text-white truncate">{label}</span>}
          {sublabel && <span className="text-xs text-slate-400 truncate">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}
