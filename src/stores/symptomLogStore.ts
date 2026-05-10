import { create } from 'zustand';
import { db } from '../db/database';
import { uuid } from '../lib/uuid';
import type { SymptomLog, SideEffectLog } from '../types';

interface SymptomLogState {
  logs: SymptomLog[];
  loading: boolean;
  initialized: boolean;

  loadData: () => Promise<void>;
  logSymptom: (entry: Omit<SymptomLog, 'id' | 'createdAt'>) => Promise<string>;
  updateLog: (id: string, updates: Partial<SymptomLog>) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  getLogsForMedication: (medicationId: string) => SymptomLog[];
}

export const useSymptomLogStore = create<SymptomLogState>((set, get) => ({
  logs: [],
  loading: false,
  initialized: false,

  loadData: async () => {
    set({ loading: true });
    const logs = await db.symptomLogs.orderBy('dateTime').reverse().toArray();
    set({ logs, loading: false, initialized: true });
  },

  logSymptom: async (entry) => {
    const id = uuid();
    const newLog: SymptomLog = {
      ...entry,
      id,
      createdAt: Date.now(),
    };

    await db.symptomLogs.add(newLog);
    set((state) => ({
      logs: [newLog, ...state.logs].sort((a, b) => b.dateTime - a.dateTime),
    }));
    return id;
  },
  
  updateLog: async (id, updates) => {
    await db.symptomLogs.update(id, updates);
    set((state) => ({
      logs: state.logs.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    }));
  },

  deleteLog: async (id) => {
    await db.symptomLogs.delete(id);
    set((state) => ({
      logs: state.logs.filter((l) => l.id !== id),
    }));
  },

  getLogsForMedication: (medicationId) => {
    return get().logs.filter((l) => l.medicationId === medicationId);
  },
}));
