import { AlertTriangle } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  danger?: boolean;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
  const { closeModal } = useUIStore();

  const handleConfirm = () => {
    closeModal();
    onConfirm();
  };

  const handleCancel = () => {
    closeModal();
    onCancel?.();
  };

  return (
    <div className="p-6">
      <div className="flex items-start gap-4">
        {danger && (
          <div className="shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
          <p className="text-sm text-slate-400 leading-relaxed">{message}</p>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={handleCancel}
          className="flex-1 py-2.5 rounded-xl bg-surface-700 hover:bg-surface-600 text-slate-300 text-sm font-medium transition-all"
        >
          {cancelLabel}
        </button>
        <button
          onClick={handleConfirm}
          className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-all active:scale-[0.98] ${
            danger
              ? 'bg-red-600 hover:bg-red-500'
              : 'bg-primary-600 hover:bg-primary-500'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
