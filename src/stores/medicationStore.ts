import { create } from 'zustand';
import { db } from '../db/database';
import type { Medication, Dose } from '../types';
import {
  medicationLevelAtTime,
  getNextDoseTime,
  getTimeUntilNextDose,
} from '../lib/halfLifeEngine';

interface MedicationState {
  medications: Medication[];
  doses: Dose[];
  loading: boolean;
  initialized: boolean;

  loadData: () => Promise<void>;
  addMedication: (med: Omit<Medication, 'id' | 'createdAt'>) => Promise<void>;
  updateMedication: (id: string, updates: Partial<Medication>) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  enableMedication: (id: string, enabled: boolean) => Promise<void>;
  logDose: (dose: Omit<Dose, 'id' | 'createdAt'>) => Promise<void>;
  updateDose: (id: string, updates: Partial<Dose>) => Promise<void>;
  deleteDose: (id: string) => Promise<void>;
  getMedicationLevel: (medId: string) => number;
  getNextDose: (medId: string) => Date | null;
  getTimeUntil: (medId: string) => string;
  getDosesForMedication: (medId: string) => Dose[];
}

export const useMedicationStore = create<MedicationState>((set, get) => ({
  medications: [],
  doses: [],
  loading: false,
  initialized: false,

  loadData: async () => {
    set({ loading: true });
    const medications = await db.medications.toArray();
    const doses = await db.doses.toArray();
    set({ medications, doses, loading: false, initialized: true });
  },

  addMedication: async (med) => {
    const newMed: Medication = {
      ...med,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    await db.medications.add(newMed);
    set((state) => ({ medications: [...state.medications, newMed] }));
  },

  updateMedication: async (id, updates) => {
    await db.medications.update(id, updates);
    set((state) => ({
      medications: state.medications.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    }));
  },

  deleteMedication: async (id) => {
    await db.medications.delete(id);
    await db.doses.where('medicationId').equals(id).delete();
    set((state) => ({
      medications: state.medications.filter((m) => m.id !== id),
      doses: state.doses.filter((d) => d.medicationId !== id),
    }));
  },

  enableMedication: async (id, enabled) => {
    await db.medications.update(id, { enabled });
    set((state) => ({
      medications: state.medications.map((m) =>
        m.id === id ? { ...m, enabled } : m
      ),
    }));
  },

  logDose: async (dose) => {
    const newDose: Dose = {
      ...dose,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    await db.doses.add(newDose);
    set((state) => ({ doses: [...state.doses, newDose] }));
  },

  updateDose: async (id, updates) => {
    await db.doses.update(id, updates);
    set((state) => ({
      doses: state.doses.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    }));
  },

  deleteDose: async (id) => {
    await db.doses.delete(id);
    set((state) => ({ doses: state.doses.filter((d) => d.id !== id) }));
  },

  getMedicationLevel: (medId) => {
    const state = get();
    const med = state.medications.find((m) => m.id === medId);
    if (!med) return 0;
    return medicationLevelAtTime(med, state.doses, Date.now());
  },

  getNextDose: (medId) => {
    const state = get();
    const med = state.medications.find((m) => m.id === medId);
    if (!med) return null;
    return getNextDoseTime(med, state.doses);
  },

  getTimeUntil: (medId) => {
    const state = get();
    const med = state.medications.find((m) => m.id === medId);
    if (!med) return 'Not started';
    return getTimeUntilNextDose(med, state.doses);
  },

  getDosesForMedication: (medId) => {
    return get()
      .doses.filter((d) => d.medicationId === medId)
      .sort((a, b) => b.dateTime - a.dateTime);
  },
}));
