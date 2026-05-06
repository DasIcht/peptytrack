import { Home, Syringe, TrendingUp, Weight, Pill, FlaskConical, Settings } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import type { PageId } from '../stores/uiStore';

const NAV_ITEMS: { id: PageId; label: string; icon: typeof Home }[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'log', label: 'Log', icon: Syringe },
  { id: 'chart', label: 'Chart', icon: TrendingUp },
  { id: 'weight', label: 'Weight', icon: Weight },
  { id: 'medications', label: 'Meds', icon: Pill },
  { id: 'vials', label: 'Vials', icon: FlaskConical },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function BottomNav() {
  const { activePage, setPage } = useUIStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-900/90 backdrop-blur-lg border-t border-white/5 safe-area-pb">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-primary-400 scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.5}
                className={isActive ? 'drop-shadow-[0_0_8px_rgba(45,212,191,0.4)]' : ''}
              />
              <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
