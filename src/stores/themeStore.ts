import { create } from 'zustand';
import { applyTheme } from '../lib/themeUtils';
import { useSettingsStore } from './settingsStore';
import type { ThemeId } from '../types';

interface ThemeState {
  themeId: ThemeId;
  customAccentColor: string | null;

  /** Switch to a named preset theme. Clears any custom accent. */
  setTheme: (id: ThemeId) => void;

  /** Apply a custom accent colour override on top of the current preset. */
  setCustomAccent: (hex: string) => void;

  /** Remove the custom accent, reverting to the preset's colours. */
  clearCustomAccent: () => void;

  /**
   * Called once on app startup after settingsStore has loaded.
   * Reads persisted theme from settings and applies it to the document.
   */
  initTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeId: 'teal-night',
  customAccentColor: null,

  setTheme: (id) => {
    set({ themeId: id, customAccentColor: null });
    applyTheme(id, null);
    const { updateSetting } = useSettingsStore.getState();
    updateSetting('theme', id);
    updateSetting('customAccentColor', null);
  },

  setCustomAccent: (hex) => {
    const { themeId } = get();
    set({ customAccentColor: hex });
    applyTheme(themeId, hex);
    const { updateSetting } = useSettingsStore.getState();
    updateSetting('customAccentColor', hex);
  },

  clearCustomAccent: () => {
    const { themeId } = get();
    set({ customAccentColor: null });
    applyTheme(themeId, null);
    const { updateSetting } = useSettingsStore.getState();
    updateSetting('customAccentColor', null);
  },

  initTheme: () => {
    const { settings } = useSettingsStore.getState();
    const themeId = settings?.theme ?? 'teal-night';
    const customAccentColor = settings?.customAccentColor ?? null;
    set({ themeId, customAccentColor });
    applyTheme(themeId, customAccentColor);
  },
}));
