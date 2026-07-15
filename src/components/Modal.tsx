import { useUIStore } from '../stores/uiStore';
import { X } from 'lucide-react';

export function Modal() {
  const { isModalOpen, modalContent, closeModal } = useUIStore();

  if (!isModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg mx-4 mb-8 bg-surface-800 rounded-2xl border border-white/10 shadow-2xl animate-slide-up overflow-hidden max-h-[85vh] overflow-y-auto">
        <button
          onClick={closeModal}
          className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-content-secondary hover:text-content-primary transition-colors z-10"
        >
          <X size={18} />
        </button>
        {modalContent}
      </div>
    </div>
  );
}
