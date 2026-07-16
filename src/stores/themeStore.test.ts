import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore } from './themeStore';

// Mock settingsStore so we don't need IndexedDB
vi.mock('./settingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      settings: { theme: 'teal-night', customAccentColor: null, },
      updateSetting: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Mock applyTheme so we don't need a DOM
vi.mock('../lib/themeUtils', () => ({
  applyTheme: vi.fn(),
  THEMES: [
    { id: 'teal-night', name: 'Teal Night', accentColor: '#14b8a6', bgColor: '#020617', isLight: false },
  ],
}));

describe('themeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ themeId: 'teal-night', customAccentColor: null, });
  });

  it('has correct initial state', () => {
    const state = useThemeStore.getState();
    expect(state.themeId).toBe('teal-night');
    expect(state.customAccentColor).toBeNull();
  });

  it('setTheme updates themeId in state', () => {
    useThemeStore.getState().setTheme('violet-storm');
    expect(useThemeStore.getState().themeId).toBe('violet-storm');
  });

  it('setTheme calls settingsStore.updateSetting with theme', async () => {
    const { useSettingsStore } = await import('./settingsStore');
    const updateSetting = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: { theme: 'teal-night', customAccentColor: null, } as never,
      updateSetting,
    } as never);

    useThemeStore.getState().setTheme('solar-amber');
    expect(updateSetting).toHaveBeenCalledWith('theme', 'solar-amber');
  });

  it('setCustomAccent updates customAccentColor in state', () => {
    useThemeStore.getState().setCustomAccent('#e11d48');
    expect(useThemeStore.getState().customAccentColor).toBe('#e11d48');
  });

  it('clearCustomAccent resets customAccentColor to null', () => {
    useThemeStore.setState({ customAccentColor: '#e11d48' });
    useThemeStore.getState().clearCustomAccent();
    expect(useThemeStore.getState().customAccentColor).toBeNull();
  });
});
