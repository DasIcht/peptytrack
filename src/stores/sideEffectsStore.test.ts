import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSideEffectsStore } from './sideEffectsStore';
import { db, _resetSeedPromiseForTests } from '../db/database';

describe('sideEffectsStore', () => {
  beforeEach(async () => {
    _resetSeedPromiseForTests();
    await db.customSideEffects.clear();
    useSideEffectsStore.setState({ customEffects: {}, loading: false, initialized: false });
  });

  it('loads empty custom effects initially', async () => {
    await useSideEffectsStore.getState().loadData();
    expect(useSideEffectsStore.getState().customEffects).toEqual({});
    expect(useSideEffectsStore.getState().initialized).toBe(true);
  });

  it('adds a custom side effect and persists it', async () => {
    await useSideEffectsStore.getState().addCustomSideEffect('med1', 'Itchy palms');
    expect(useSideEffectsStore.getState().customEffects['med1']).toContain('Itchy palms');

    // Reload and verify persistence
    useSideEffectsStore.setState({ customEffects: {}, initialized: false });
    await useSideEffectsStore.getState().loadData();
    expect(useSideEffectsStore.getState().customEffects['med1']).toContain('Itchy palms');
  });

  it('does not duplicate custom side effects', async () => {
    await useSideEffectsStore.getState().addCustomSideEffect('med1', 'Itchy palms');
    await useSideEffectsStore.getState().addCustomSideEffect('med1', 'Itchy palms');
    expect(useSideEffectsStore.getState().customEffects['med1'].length).toBe(1);
  });

  it('ignores empty custom side effect labels', async () => {
    await useSideEffectsStore.getState().addCustomSideEffect('med1', '  ');
    expect(useSideEffectsStore.getState().customEffects['med1']).toBeUndefined();
  });

  it('removes a custom side effect', async () => {
    await useSideEffectsStore.getState().addCustomSideEffect('med1', 'Itchy palms');
    await useSideEffectsStore.getState().addCustomSideEffect('med1', 'Dry mouth');
    await useSideEffectsStore.getState().removeCustomSideEffect('med1', 'Itchy palms');
    expect(useSideEffectsStore.getState().customEffects['med1']).not.toContain('Itchy palms');
    expect(useSideEffectsStore.getState().customEffects['med1']).toContain('Dry mouth');
  });

  it('deletes the row when last custom effect is removed', async () => {
    await useSideEffectsStore.getState().addCustomSideEffect('med1', 'Itchy palms');
    await useSideEffectsStore.getState().removeCustomSideEffect('med1', 'Itchy palms');
    expect(useSideEffectsStore.getState().customEffects['med1']).toBeUndefined();

    const rows = await db.customSideEffects.toArray();
    expect(rows.length).toBe(0);
  });

  it('keeps custom effects separate per medication', async () => {
    await useSideEffectsStore.getState().addCustomSideEffect('med1', 'Effect A');
    await useSideEffectsStore.getState().addCustomSideEffect('med2', 'Effect B');
    expect(useSideEffectsStore.getState().customEffects['med1']).toEqual(['Effect A']);
    expect(useSideEffectsStore.getState().customEffects['med2']).toEqual(['Effect B']);
  });
});
