import { create } from 'zustand';
import { db } from '../db/database';
import { uuid } from '../lib/uuid';
import type { WeightEntry } from '../types';

interface WeightState {
  entries: WeightEntry[];
  loading: boolean;

  loadData: () => Promise<void>;
  addEntry: (entry: Omit<WeightEntry, 'id' | 'createdAt'>) => Promise<void>;
  updateEntry: (id: string, updates: Partial<WeightEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getTrend: () => { change: number; periodDays: number } | null;
  getLatest: () => WeightEntry | null;
}

export const useWeightStore = create<WeightState>((set, get) => ({
  entries: [],
  loading: false,

  loadData: async () => {
    set({ loading: true });
    const entries = await db.weightEntries
      .orderBy('dateTime')
      .reverse()
      .toArray();
    set({ entries, loading: false });
  },

  addEntry: async (entry) => {
    const newEntry: WeightEntry = {
      ...entry,
      id: uuid(),
      createdAt: Date.now(),
    };
    await db.weightEntries.add(newEntry);
    set((state) => ({
      entries: [newEntry, ...state.entries].sort(
        (a, b) => b.dateTime - a.dateTime
      ),
    }));
  },

  updateEntry: async (id, updates) => {
    await db.weightEntries.update(id, updates);
    set((state) => ({
      entries: state.entries
        .map((e) => (e.id === id ? { ...e, ...updates } : e))
        .sort((a, b) => b.dateTime - a.dateTime),
    }));
  },

  deleteEntry: async (id) => {
    await db.weightEntries.delete(id);
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
  },

  getTrend: () => {
    const entries = get().entries;
    if (entries.length < 2) return null;

    const latest = entries[0];
    const oldest = entries[entries.length - 1];
    const change = latest.weight - oldest.weight;
    const periodDays =
      (latest.dateTime - oldest.dateTime) / (1000 * 60 * 60 * 24);

    return { change: Math.round(change * 10) / 10, periodDays: Math.round(periodDays) };
  },

  getLatest: () => {
    const entries = get().entries;
    return entries.length > 0 ? entries[0] : null;
  },
}));
