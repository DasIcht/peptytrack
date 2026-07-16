import { create } from 'zustand';
import { getSettings, setSetting } from '../db/database';
import type { AppSettings } from '../types';

const DEFAULT_SETTINGS: AppSettings = {
  weightUnit: 'kg',
  medicationUnit: 'mg',
  notificationsEnabled: true,
  injectionRotationStrategy: 'sequential',
  injectionRotationSites: [
    'abdomen-upper-left',
    'abdomen-upper-right',
    'abdomen-lower-left',
    'abdomen-lower-right',
    'thigh-left',
    'thigh-right',
    'arm-left',
    'arm-right',
  ],
  titrationWizardEnabled: false,
  severeSideEffectThreshold: 5,
  theme: 'teal-night',
  customAccentColor: null,
  height: null,
  heightUnit: 'cm',
  gender: null,
};

interface SettingsState {
  settings: AppSettings;
  loading: boolean;
  initialized: boolean;

  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  getSetting: <K extends keyof AppSettings>(key: K) => AppSettings[K];
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loading: false,
  initialized: false,

  loadSettings: async () => {
    set({ loading: true });
    const raw = await getSettings();
    const merged: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...raw,
    };
    set({ settings: merged, loading: false, initialized: true });
  },

  updateSetting: async (key, value) => {
    await setSetting(key, value);
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    }));
  },

  getSetting: (key) => {
    return get().settings[key];
  },
}));
