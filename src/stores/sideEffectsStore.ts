import { create } from 'zustand';
import { db } from '../db/database';

interface SideEffectsState {
  customEffects: Record<string, string[]>;
  loading: boolean;
  initialized: boolean;

  loadData: () => Promise<void>;
  addCustomSideEffect: (medicationId: string, label: string) => Promise<void>;
  removeCustomSideEffect: (medicationId: string, label: string) => Promise<void>;
}

export const useSideEffectsStore = create<SideEffectsState>((set, get) => ({
  customEffects: {},
  loading: false,
  initialized: false,

  loadData: async () => {
    set({ loading: true });
    const rows = await db.customSideEffects.toArray();
    const map: Record<string, string[]> = {};
    for (const row of rows) {
      map[row.medicationId] = row.labels;
    }
    set({ customEffects: map, loading: false, initialized: true });
  },

  addCustomSideEffect: async (medicationId, label) => {
    const normalized = label.trim();
    if (!normalized) return;

    const state = get();
    const existing = state.customEffects[medicationId] ?? [];
    if (existing.includes(normalized)) return;

    const updated = [...existing, normalized];
    await db.customSideEffects.put({ medicationId, labels: updated });
    set((s) => ({
      customEffects: { ...s.customEffects, [medicationId]: updated },
    }));
  },

  removeCustomSideEffect: async (medicationId, label) => {
    const state = get();
    const existing = state.customEffects[medicationId] ?? [];
    const updated = existing.filter((l) => l !== label);

    if (updated.length === 0) {
      await db.customSideEffects.delete(medicationId);
    } else {
      await db.customSideEffects.put({ medicationId, labels: updated });
    }

    set((s) => {
      const next = { ...s.customEffects };
      if (updated.length === 0) {
        delete next[medicationId];
      } else {
        next[medicationId] = updated;
      }
      return { customEffects: next };
    });
  },
}));
