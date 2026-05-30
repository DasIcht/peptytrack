import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { useProtocolStore } from './protocolStore';
import { db, _resetSeedPromiseForTests } from '../db/database';

describe('useProtocolStore', () => {
  beforeEach(async () => {
    _resetSeedPromiseForTests();
    await db.protocols.clear();
    useProtocolStore.setState({ protocols: [], loading: false, initialized: false });
  });

  it('adds and loads a protocol', async () => {
    const store = useProtocolStore.getState();
    await store.addProtocol({
      medicationId: 'm1',
      name: 'Test Protocol',
      steps: [{ id: 's1', dosage: 0.25, durationWeeks: 4 }],
      currentStepIndex: 0,
      startDate: null,
      currentStepStartDate: null,
      autoAdvance: true,
      targetType: 'weekly-equivalent'
    });

    const newStore = useProtocolStore.getState();
    expect(newStore.protocols.length).toBe(1);
    expect(newStore.protocols[0].name).toBe('Test Protocol');

    await useProtocolStore.getState().loadData();
    expect(useProtocolStore.getState().protocols.length).toBe(1);
  });

  it('updates a protocol', async () => {
    const store = useProtocolStore.getState();
    await store.addProtocol({
      medicationId: 'm1',
      name: 'Test Protocol',
      steps: [{ id: 's1', dosage: 0.25, durationWeeks: 4 }],
      currentStepIndex: 0,
      startDate: null,
      currentStepStartDate: null,
      autoAdvance: true,
      targetType: 'weekly-equivalent'
    });

    const pId = useProtocolStore.getState().protocols[0].id;
    await useProtocolStore.getState().updateProtocol(pId, { name: 'Updated Protocol' });

    expect(useProtocolStore.getState().protocols[0].name).toBe('Updated Protocol');
    
    // verify db
    const pDb = await db.protocols.get(pId);
    expect(pDb?.name).toBe('Updated Protocol');
  });

  it('deletes a protocol', async () => {
    const store = useProtocolStore.getState();
    await store.addProtocol({
      medicationId: 'm1',
      name: 'Test Protocol',
      steps: [{ id: 's1', dosage: 0.25, durationWeeks: 4 }],
      currentStepIndex: 0,
      startDate: null,
      currentStepStartDate: null,
      autoAdvance: true,
      targetType: 'weekly-equivalent'
    });

    const pId = useProtocolStore.getState().protocols[0].id;
    await useProtocolStore.getState().deleteProtocol(pId);

    expect(useProtocolStore.getState().protocols.length).toBe(0);
    const pDb = await db.protocols.get(pId);
    expect(pDb).toBeUndefined();
  });

  it('gets active protocol for medication', async () => {
    const store = useProtocolStore.getState();
    await store.addProtocol({
      medicationId: 'm1',
      name: 'Test Protocol',
      steps: [{ id: 's1', dosage: 0.25, durationWeeks: 4 }],
      currentStepIndex: 0,
      startDate: null,
      currentStepStartDate: null,
      autoAdvance: true,
      targetType: 'weekly-equivalent'
    });

    const p = useProtocolStore.getState().getActiveProtocolForMedication('m1');
    expect(p).toBeDefined();
    expect(p?.medicationId).toBe('m1');

    const p2 = useProtocolStore.getState().getActiveProtocolForMedication('m2');
    expect(p2).toBeUndefined();
  });
});
