import { describe, it, expect } from 'vitest';
import {
  getSideEffectsByRarity,
  getSideEffectsOrderedForMedication,
  STANDARD_SIDE_EFFECTS,
} from './sideEffects';
import type { Dose } from '../types';

describe('sideEffects library', () => {
  describe('getSideEffectsByRarity', () => {
    it('returns all standard side effects ordered from very-common to very-rare', () => {
      const result = getSideEffectsByRarity();
      expect(result.length).toBe(STANDARD_SIDE_EFFECTS.length);
      // Very-common items should appear before rare ones
      const nauseaIdx = result.indexOf('Nausea');
      const anaphylaxisIdx = result.indexOf('Anaphylaxis');
      expect(nauseaIdx).toBeLessThan(anaphylaxisIdx);
    });
  });

  describe('getSideEffectsOrderedForMedication', () => {
    it('on first use returns standard effects ordered by rarity', () => {
      const result = getSideEffectsOrderedForMedication('med1', [], []);
      expect(result).toEqual(getSideEffectsByRarity());
    });

    it('on second use places previously selected effects first alphabetically', () => {
      const doses: Dose[] = [
        {
          id: '1',
          medicationId: 'med1',
          dosage: 1,
          unit: 'mg',
          injectionSite: 'abdomen-upper-left',
          dateTime: Date.now(),
          notes: '',
          sideEffects: ['Headache', 'Nausea'],
          createdAt: Date.now(),
        },
      ];
      const result = getSideEffectsOrderedForMedication('med1', doses, []);
      expect(result[0]).toBe('Headache'); // alphabetically first among previously selected
      expect(result[1]).toBe('Nausea');
      // Remaining standard effects follow
      expect(result.includes('Diarrhea')).toBe(true);
    });

    it('ignores doses for other medications', () => {
      const doses: Dose[] = [
        {
          id: '1',
          medicationId: 'med2',
          dosage: 1,
          unit: 'mg',
          injectionSite: 'abdomen-upper-left',
          dateTime: Date.now(),
          notes: '',
          sideEffects: ['Headache'],
          createdAt: Date.now(),
        },
      ];
      const result = getSideEffectsOrderedForMedication('med1', doses, []);
      expect(result).toEqual(getSideEffectsByRarity());
    });

    it('includes custom effects after standard ones', () => {
      const standard = getSideEffectsByRarity();
      const result = getSideEffectsOrderedForMedication('med1', [], ['Custom A', 'Custom B']);
      expect(result.slice(0, standard.length)).toEqual(standard);
      expect(result[standard.length]).toBe('Custom A');
      expect(result[standard.length + 1]).toBe('Custom B');
    });

    it('deduplicates previously selected and custom effects', () => {
      const doses: Dose[] = [
        {
          id: '1',
          medicationId: 'med1',
          dosage: 1,
          unit: 'mg',
          injectionSite: 'abdomen-upper-left',
          dateTime: Date.now(),
          notes: '',
          sideEffects: ['Nausea'],
          createdAt: Date.now(),
        },
      ];
      const result = getSideEffectsOrderedForMedication('med1', doses, ['Nausea', 'Custom']);
      const nauseaCount = result.filter((l) => l === 'Nausea').length;
      expect(nauseaCount).toBe(1);
      expect(result.indexOf('Nausea')).toBe(0); // previously selected first
    });

    it('does not duplicate custom effects that are also standard', () => {
      const doses: Dose[] = [
        {
          id: '1',
          medicationId: 'med1',
          dosage: 1,
          unit: 'mg',
          injectionSite: 'abdomen-upper-left',
          dateTime: Date.now(),
          notes: '',
          sideEffects: ['Nausea'],
          createdAt: Date.now(),
        },
      ];
      const result = getSideEffectsOrderedForMedication('med1', doses, ['Nausea']);
      expect(result.filter((l) => l === 'Nausea').length).toBe(1);
    });

    it('returns empty array when no medication is selected', () => {
      const result = getSideEffectsOrderedForMedication('', [], []);
      expect(result).toEqual([]);
    });
  });
});
