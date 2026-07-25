import { create } from 'zustand';
import { db } from '../db/database';
import { uuid } from '../lib/uuid';
import type { Protocol } from '../types';

interface ProtocolState {
  protocols: Protocol[];
  loading: boolean;
  initialized: boolean;

  loadData: () => Promise<void>;
  addProtocol: (protocol: Omit<Protocol, 'id' | 'createdAt'>) => Promise<void>;
  updateProtocol: (id: string, updates: Partial<Protocol>) => Promise<void>;
  deleteProtocol: (id: string) => Promise<void>;
  getActiveProtocolForMedication: (medicationId: string) => Protocol | undefined;
}

export const useProtocolStore = create<ProtocolState>((set, get) => ({
  protocols: [],
  loading: false,
  initialized: false,

  loadData: async () => {
    set({ loading: true });
    const protocols = await db.protocols.toArray();
    set({ protocols, loading: false, initialized: true });
  },

  addProtocol: async (protocol) => {
    const newProtocol: Protocol = {
      ...protocol,
      id: uuid(),
      createdAt: Date.now(),
    };
    await db.protocols.add(newProtocol);
    set((state) => ({ protocols: [...state.protocols, newProtocol] }));
  },

  updateProtocol: async (id, updates) => {
    set((state) => ({
      protocols: state.protocols.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
    try {
      const existing = await db.protocols.get(id);
      if (existing) {
        await db.protocols.update(id, updates);
      } else {
        const fullProtocol = get().protocols.find((p) => p.id === id);
        if (fullProtocol) {
          await db.protocols.put(fullProtocol);
        }
      }
    } catch (err) {
      console.warn('Failed to persist protocol update in DB:', err);
    }
  },

  deleteProtocol: async (id) => {
    await db.protocols.delete(id);
    set((state) => ({
      protocols: state.protocols.filter((p) => p.id !== id),
    }));
  },

  getActiveProtocolForMedication: (medicationId) => {
    // Return the active protocol for the given medication. Currently we just assume one protocol per medication at a time, or find the one that has steps.
    return get().protocols.find((p) => p.medicationId === medicationId);
  },
}));
