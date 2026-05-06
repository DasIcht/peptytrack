import { create } from 'zustand';
import { db } from '../db/database';
import { uuid } from '../lib/uuid';
import type { Vial, Dose } from '../types';

interface VialState {
  vials: Vial[];
  loading: boolean;
  initialized: boolean;

  loadData: () => Promise<void>;
  addVial: (vial: Omit<Vial, 'id' | 'createdAt'>) => Promise<void>;
  updateVial: (id: string, updates: Partial<Vial>) => Promise<void>;
  deleteVial: (id: string) => Promise<void>;
  getVialsForMedication: (medicationId: string) => Vial[];
  getVialRemaining: (vialId: string, doses: Dose[]) => number;
  getVialPercentage: (vialId: string, doses: Dose[]) => number;
  getLastUsedVialId: (medicationId: string, doses: Dose[]) => string | undefined;
}

export const useVialStore = create<VialState>((set, get) => ({
  vials: [],
  loading: false,
  initialized: false,

  loadData: async () => {
    set({ loading: true });
    const vials = await db.vials.toArray();
    set({ vials, loading: false, initialized: true });
  },

  addVial: async (vial) => {
    const newVial: Vial = {
      ...vial,
      id: uuid(),
      createdAt: Date.now(),
    };
    await db.vials.add(newVial);
    set((state) => ({ vials: [...state.vials, newVial] }));
  },

  updateVial: async (id, updates) => {
    await db.vials.update(id, updates);
    set((state) => ({
      vials: state.vials.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    }));
  },

  deleteVial: async (id) => {
    await db.vials.delete(id);
    set((state) => ({
      vials: state.vials.filter((v) => v.id !== id),
    }));
  },

  getVialsForMedication: (medicationId) => {
    return get()
      .vials.filter((v) => v.medicationId === medicationId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  getVialRemaining: (vialId, doses) => {
    const vial = get().vials.find((v) => v.id === vialId);
    if (!vial) return 0;
    // Manual override takes precedence
    if (vial.remainingOverride !== null && vial.remainingOverride !== undefined) {
      return Math.max(0, vial.remainingOverride);
    }
    const totalDosed = doses
      .filter((d) => d.vialId === vialId)
      .reduce((sum, d) => sum + d.dosage, 0);
    return Math.max(0, vial.peptideAmount - totalDosed);
  },

  getVialPercentage: (vialId, doses) => {
    const vial = get().vials.find((v) => v.id === vialId);
    if (!vial || vial.peptideAmount <= 0) return 0;
    const remaining = get().getVialRemaining(vialId, doses);
    return Math.min(100, Math.max(0, (remaining / vial.peptideAmount) * 100));
  },

  getLastUsedVialId: (medicationId, doses) => {
    const medVialIds = new Set(
      get().vials.filter((v) => v.medicationId === medicationId).map((v) => v.id)
    );
    const vialDoses = doses
      .filter((d) => d.vialId && medVialIds.has(d.vialId))
      .sort((a, b) => b.dateTime - a.dateTime);
    return vialDoses[0]?.vialId;
  },
}));
