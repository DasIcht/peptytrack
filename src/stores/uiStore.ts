import { create } from 'zustand';
import { uuid } from '../lib/uuid';

export type PageId = 'dashboard' | 'log' | 'chart' | 'weight' | 'medications' | 'vials' | 'settings';

const PAGE_ORDER: PageId[] = ['dashboard', 'log', 'chart', 'weight', 'medications', 'vials', 'settings'];

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UIState {
  activePage: PageId;
  logDoseMedId: string | null;
  isModalOpen: boolean;
  modalContent: React.ReactNode | null;
  toasts: Toast[];

  setPage: (page: PageId) => void;
  nextPage: () => void;
  prevPage: () => void;
  setLogDoseMedId: (id: string | null) => void;
  openModal: (content: React.ReactNode) => void;
  closeModal: () => void;
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activePage: 'dashboard',
  logDoseMedId: null,
  isModalOpen: false,
  modalContent: null,
  toasts: [],

  setPage: (page) => set({ activePage: page }),
  nextPage: () => set((state) => {
    const idx = PAGE_ORDER.indexOf(state.activePage);
    return { activePage: idx < PAGE_ORDER.length - 1 ? PAGE_ORDER[idx + 1] : state.activePage };
  }),
  prevPage: () => set((state) => {
    const idx = PAGE_ORDER.indexOf(state.activePage);
    return { activePage: idx > 0 ? PAGE_ORDER[idx - 1] : state.activePage };
  }),
  setLogDoseMedId: (id) => set({ logDoseMedId: id }),
  openModal: (content) => set({ isModalOpen: true, modalContent: content }),
  closeModal: () => set({ isModalOpen: false, modalContent: null }),
  addToast: (message, type = 'info') => {
    const id = uuid();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
