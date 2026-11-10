import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/database';
import { useVialStore } from './vialStore';
import type { Vial } from '../types';

const TEST_VIAL = {
  medicationId: 'med-1',
  name: 'Vial #1',
  peptideAmount: 10,
  peptideUnit: 'mg',
  bacWaterAmount: 2,
  reconstitutedAt: Date.now(),
  remainingOverride: null,
  notes: 'Test vial',
};

describe('vialStore', () => {
  beforeEach(async () => {
    await db.vials.clear();
    await db.doses.clear();
    useVialStore.setState({ vials: [], initialized: false });
  });

  it('loads vials from database', async () => {
    await db.vials.add({ ...TEST_VIAL, id: 'vial-1', createdAt: Date.now() });
    await useVialStore.getState().loadData();
    const state = useVialStore.getState();
    expect(state.vials).toHaveLength(1);
    expect(state.vials[0].name).toBe('Vial #1');
    expect(state.initialized).toBe(true);
  });

  it('adds a vial and persists to DB', async () => {
    await useVialStore.getState().addVial(TEST_VIAL);
    const state = useVialStore.getState();
    expect(state.vials).toHaveLength(1);
    expect(state.vials[0].peptideAmount).toBe(10);

    const fromDb = await db.vials.toArray();
    expect(fromDb).toHaveLength(1);
    expect(fromDb[0].name).toBe('Vial #1');
  });

  it('deletes a vial', async () => {
    await useVialStore.getState().addVial(TEST_VIAL);
    const vialId = useVialStore.getState().vials[0].id;
    await useVialStore.getState().deleteVial(vialId);
    expect(useVialStore.getState().vials).toHaveLength(0);

    const fromDb = await db.vials.toArray();
    expect(fromDb).toHaveLength(0);
  });

  it('filters vials by medication', async () => {
    await useVialStore.getState().addVial(TEST_VIAL);
    await useVialStore.getState().addVial({
      ...TEST_VIAL,
      medicationId: 'med-2',
      name: 'Vial #2',
    });

    const med1Vials = useVialStore.getState().getVialsForMedication('med-1');
    expect(med1Vials).toHaveLength(1);
    expect(med1Vials[0].name).toBe('Vial #1');
  });

  it('computes remaining peptide correctly', async () => {
    await useVialStore.getState().addVial(TEST_VIAL);
    const vialId = useVialStore.getState().vials[0].id;

    const doses = [
      { id: 'd1', medicationId: 'med-1', vialId, dosage: 1, unit: 'mg', injectionSite: 'abdomen-upper-left' as const, dateTime: Date.now(), notes: '', createdAt: Date.now() },
      { id: 'd2', medicationId: 'med-1', vialId, dosage: 2.5, unit: 'mg', injectionSite: 'abdomen-upper-right' as const, dateTime: Date.now(), notes: '', createdAt: Date.now() },
    ];

    const remaining = useVialStore.getState().getVialRemaining(vialId, doses);
    expect(remaining).toBe(6.5); // 10 - 1 - 2.5
  });

  it('converts mcg doses into the vial unit when computing remaining', async () => {
    await useVialStore.getState().addVial(TEST_VIAL); // 10 mg vial
    const vialId = useVialStore.getState().vials[0].id;

    const doses = [
      { id: 'd1', medicationId: 'med-1', vialId, dosage: 500, unit: 'mcg', injectionSite: 'abdomen-upper-left' as const, dateTime: Date.now(), notes: '', createdAt: Date.now() },
      { id: 'd2', medicationId: 'med-1', vialId, dosage: 1, unit: 'mg', injectionSite: 'abdomen-upper-right' as const, dateTime: Date.now(), notes: '', createdAt: Date.now() },
    ];

    const remaining = useVialStore.getState().getVialRemaining(vialId, doses);
    expect(remaining).toBeCloseTo(8.5); // 10 mg - 0.5 mg - 1 mg
  });

  it('converts mg doses into a mcg vial', async () => {
    await useVialStore.getState().addVial({ ...TEST_VIAL, peptideAmount: 5000, peptideUnit: 'mcg' });
    const vialId = useVialStore.getState().vials[0].id;

    const doses = [
      { id: 'd1', medicationId: 'med-1', vialId, dosage: 2, unit: 'mg', injectionSite: 'abdomen-upper-left' as const, dateTime: Date.now(), notes: '', createdAt: Date.now() },
    ];

    expect(useVialStore.getState().getVialRemaining(vialId, doses)).toBe(3000);
  });

  it('returns 0 remaining when vial not found', async () => {
    const remaining = useVialStore.getState().getVialRemaining('nonexistent', []);
    expect(remaining).toBe(0);
  });

  it('does not count doses from other vials', async () => {
    await useVialStore.getState().addVial(TEST_VIAL);
    const vialId = useVialStore.getState().vials[0].id;

    const doses = [
      { id: 'd1', medicationId: 'med-1', vialId, dosage: 1, unit: 'mg', injectionSite: 'abdomen-upper-left' as const, dateTime: Date.now(), notes: '', createdAt: Date.now() },
      { id: 'd2', medicationId: 'med-1', vialId: 'other-vial', dosage: 5, unit: 'mg', injectionSite: 'abdomen-upper-right' as const, dateTime: Date.now(), notes: '', createdAt: Date.now() },
    ];

    const remaining = useVialStore.getState().getVialRemaining(vialId, doses);
    expect(remaining).toBe(9); // 10 - 1 only
  });

  it('respects remaining override', async () => {
    await useVialStore.getState().addVial({ ...TEST_VIAL, remainingOverride: 3.5 });
    const vialId = useVialStore.getState().vials[0].id;

    const doses = [
      { id: 'd1', medicationId: 'med-1', vialId, dosage: 1, unit: 'mg', injectionSite: 'abdomen-upper-left' as const, dateTime: Date.now(), notes: '', createdAt: Date.now() },
    ];

    const remaining = useVialStore.getState().getVialRemaining(vialId, doses);
    expect(remaining).toBe(3.5); // override ignores doses
  });

  it('computes percentage correctly', async () => {
    await useVialStore.getState().addVial(TEST_VIAL);
    const vialId = useVialStore.getState().vials[0].id;

    const doses = [
      { id: 'd1', medicationId: 'med-1', vialId, dosage: 2.5, unit: 'mg', injectionSite: 'abdomen-upper-left' as const, dateTime: Date.now(), notes: '', createdAt: Date.now() },
    ];

    const pct = useVialStore.getState().getVialPercentage(vialId, doses);
    expect(pct).toBe(75); // (10 - 2.5) / 10 * 100 = 75
  });

  it('finds last used vial from doses', async () => {
    await useVialStore.getState().addVial(TEST_VIAL);
    await useVialStore.getState().addVial({ ...TEST_VIAL, name: 'Vial #2' });
    const [vial1, vial2] = useVialStore.getState().vials;

    const doses = [
      { id: 'd1', medicationId: 'med-1', vialId: vial1.id, dosage: 1, unit: 'mg', injectionSite: 'abdomen-upper-left' as const, dateTime: Date.now() - 86400000, notes: '', createdAt: Date.now() - 86400000 },
      { id: 'd2', medicationId: 'med-1', vialId: vial2.id, dosage: 1, unit: 'mg', injectionSite: 'abdomen-upper-right' as const, dateTime: Date.now(), notes: '', createdAt: Date.now() },
    ];

    const lastUsed = useVialStore.getState().getLastUsedVialId('med-1', doses);
    expect(lastUsed).toBe(vial2.id);
  });

  describe('getNextAvailableVialId', () => {
    const DAY = 86400000;
    const now = Date.now();
    const vial = (id: string, peptideAmount: number, reconstitutedAgoDays: number, extra: Partial<Vial> = {}) => ({
      ...TEST_VIAL,
      id,
      peptideAmount,
      reconstitutedAt: now - reconstitutedAgoDays * DAY,
      createdAt: now - reconstitutedAgoDays * DAY,
      ...extra,
    });
    const dose = (id: string, vialId: string, dosage: number, agoDays: number) => ({
      id, medicationId: 'med-1', vialId, dosage, unit: 'mg',
      injectionSite: 'abdomen-upper-left' as const,
      dateTime: now - agoDays * DAY, notes: '', createdAt: now - agoDays * DAY,
    });

    it('keeps the last-used vial while it still has medication left', () => {
      useVialStore.setState({ vials: [vial('old', 10, 30), vial('used', 10, 5)] });
      const doses = [dose('d1', 'used', 2, 1)];
      expect(useVialStore.getState().getNextAvailableVialId('med-1', doses)).toBe('used');
    });

    it('moves on to the oldest non-empty vial once the last-used vial is empty', () => {
      useVialStore.setState({ vials: [vial('empty', 2, 40), vial('newer', 5, 2), vial('older', 5, 10)] });
      const doses = [dose('d1', 'empty', 1, 14), dose('d2', 'empty', 1, 7)];
      expect(useVialStore.getState().getNextAvailableVialId('med-1', doses)).toBe('older');
    });

    it('picks the oldest non-empty vial when nothing has been used yet', () => {
      useVialStore.setState({ vials: [vial('newer', 5, 1), vial('older', 5, 3)] });
      expect(useVialStore.getState().getNextAvailableVialId('med-1', [])).toBe('older');
    });

    it('treats a remaining override of 0 as empty', () => {
      useVialStore.setState({ vials: [vial('overridden', 5, 10, { remainingOverride: 0 }), vial('fresh', 5, 1)] });
      expect(useVialStore.getState().getNextAvailableVialId('med-1', [])).toBe('fresh');
    });

    it('ignores vials that belong to other medications', () => {
      useVialStore.setState({ vials: [vial('other', 5, 10, { medicationId: 'med-2' }), vial('mine', 5, 1)] });
      expect(useVialStore.getState().getNextAvailableVialId('med-1', [])).toBe('mine');
    });

    it('returns undefined when every vial is empty', () => {
      useVialStore.setState({ vials: [vial('a', 1, 20), vial('b', 1, 10)] });
      const doses = [dose('d1', 'a', 1, 14), dose('d2', 'b', 1, 7)];
      expect(useVialStore.getState().getNextAvailableVialId('med-1', doses)).toBeUndefined();
    });

    it('returns undefined when the medication has no vials', () => {
      expect(useVialStore.getState().getNextAvailableVialId('med-1', [])).toBeUndefined();
    });
  });
});
