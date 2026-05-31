import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';
import { db } from '../db/database';

describe('SettingsStore', () => {
  beforeEach(async () => {
    await db.settings.clear();
    useSettingsStore.setState({
      settings: {
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
      },
      loading: false,
      initialized: false,
    });
  });

  it('loads default settings when DB is empty', async () => {
    const store = useSettingsStore.getState();
    await store.loadSettings();

    const state = useSettingsStore.getState();
    expect(state.settings.weightUnit).toBe('kg');
    expect(state.settings.medicationUnit).toBe('mg');
    expect(state.settings.notificationsEnabled).toBe(true);
    expect(state.initialized).toBe(true);
  });

  it('persists and reloads settings', async () => {
    const store = useSettingsStore.getState();
    await store.loadSettings();
    await store.updateSetting('weightUnit', 'lb');
    await store.updateSetting('notificationsEnabled', false);

    let state = useSettingsStore.getState();
    expect(state.settings.weightUnit).toBe('lb');
    expect(state.settings.notificationsEnabled).toBe(false);

    // Simulate reload
    useSettingsStore.setState({
      settings: {
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
      },
      initialized: false,
    });
    await useSettingsStore.getState().loadSettings();

    state = useSettingsStore.getState();
    expect(state.settings.weightUnit).toBe('lb');
    expect(state.settings.notificationsEnabled).toBe(false);
  });

  it('getSetting returns correct value', async () => {
    const store = useSettingsStore.getState();
    await store.loadSettings();
    await store.updateSetting('weightUnit', 'lb');

    const value = useSettingsStore.getState().getSetting('weightUnit');
    expect(value).toBe('lb');
  });

  it('merges saved settings with defaults for unknown keys', async () => {
    await db.settings.put({ id: 'weightUnit', value: 'lb' });
    const store = useSettingsStore.getState();
    await store.loadSettings();

    const state = useSettingsStore.getState();
    expect(state.settings.weightUnit).toBe('lb');
    expect(state.settings.notificationsEnabled).toBe(true);
    expect(state.settings.medicationUnit).toBe('mg');
  });
});
