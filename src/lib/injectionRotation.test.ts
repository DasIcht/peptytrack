import { describe, it, expect } from 'vitest';
import { getLastUsedSite, getNextInjectionSite } from './injectionRotation';
import type { Dose, InjectionSite } from '../types';

const allSites: InjectionSite[] = [
  'abdomen-upper-left',
  'abdomen-upper-right',
  'abdomen-lower-left',
  'abdomen-lower-right',
  'thigh-left',
  'thigh-right',
  'arm-left',
  'arm-right',
];

describe('injectionRotation', () => {
  describe('getLastUsedSite', () => {
    it('returns null when no doses exist', () => {
      expect(getLastUsedSite([])).toBeNull();
    });

    it('returns the site of the most recent dose', () => {
      const doses: Dose[] = [
        { id: '1', medicationId: 'm1', dosage: 1, unit: 'mg', injectionSite: 'thigh-left', dateTime: 1000, notes: '', createdAt: 1000 },
        { id: '2', medicationId: 'm1', dosage: 1, unit: 'mg', injectionSite: 'arm-right', dateTime: 2000, notes: '', createdAt: 2000 },
      ];
      expect(getLastUsedSite(doses)).toBe('arm-right');
    });
  });

  describe('sequential strategy', () => {
    it('returns first site when no doses exist', () => {
      const result = getNextInjectionSite([], 'sequential', allSites);
      expect(result).toBe('abdomen-upper-left');
    });

    it('advances to next site in order', () => {
      const doses: Dose[] = [
        { id: '1', medicationId: 'm1', dosage: 1, unit: 'mg', injectionSite: 'abdomen-upper-left', dateTime: 1000, notes: '', createdAt: 1000 },
      ];
      expect(getNextInjectionSite(doses, 'sequential', allSites)).toBe('abdomen-upper-right');
    });

    it('wraps around to first site after last', () => {
      const doses: Dose[] = [
        { id: '1', medicationId: 'm1', dosage: 1, unit: 'mg', injectionSite: 'arm-right', dateTime: 1000, notes: '', createdAt: 1000 },
      ];
      expect(getNextInjectionSite(doses, 'sequential', allSites)).toBe('abdomen-upper-left');
    });

    it('respects activeSites subset', () => {
      const active = ['abdomen-upper-left', 'thigh-left', 'arm-right'];
      const doses: Dose[] = [
        { id: '1', medicationId: 'm1', dosage: 1, unit: 'mg', injectionSite: 'thigh-left', dateTime: 1000, notes: '', createdAt: 1000 },
      ];
      expect(getNextInjectionSite(doses, 'sequential', active)).toBe('arm-right');
    });
  });

  describe('quadrant strategy', () => {
    it('cycles through abdomen first, then thighs, then arms', () => {
      const doses: Dose[] = [
        { id: '1', medicationId: 'm1', dosage: 1, unit: 'mg', injectionSite: 'abdomen-upper-left', dateTime: 1000, notes: '', createdAt: 1000 },
      ];
      expect(getNextInjectionSite(doses, 'quadrant', allSites)).toBe('abdomen-upper-right');
    });

    it('wraps around within active quadrant subset', () => {
      const active = ['abdomen-upper-left', 'abdomen-lower-right', 'arm-left'];
      const doses: Dose[] = [
        { id: '1', medicationId: 'm1', dosage: 1, unit: 'mg', injectionSite: 'arm-left', dateTime: 1000, notes: '', createdAt: 1000 },
      ];
      // quadrant order filtered: abdomen-upper-left, abdomen-lower-right, arm-left
      // after arm-left → wraps to abdomen-upper-left
      expect(getNextInjectionSite(doses, 'quadrant', active)).toBe('abdomen-upper-left');
    });
  });

  describe('lru strategy', () => {
    it('picks first site when no doses exist', () => {
      expect(getNextInjectionSite([], 'lru', allSites)).toBe('abdomen-upper-left');
    });

    it('picks least recently used site when all active sites have been used', () => {
      const now = Date.now();
      const doses: Dose[] = [
        { id: '1', medicationId: 'm1', dosage: 1, unit: 'mg', injectionSite: 'thigh-left', dateTime: now - 5000, notes: '', createdAt: now - 5000 },
        { id: '2', medicationId: 'm1', dosage: 1, unit: 'mg', injectionSite: 'arm-right', dateTime: now - 1000, notes: '', createdAt: now - 1000 },
      ];
      // Restrict to only used sites so LRU must pick oldest among them
      const active: InjectionSite[] = ['thigh-left', 'arm-right'];
      expect(getNextInjectionSite(doses, 'lru', active)).toBe('thigh-left');
    });

    it('prefers never-used sites over oldest-used', () => {
      const doses: Dose[] = [
        { id: '1', medicationId: 'm1', dosage: 1, unit: 'mg', injectionSite: 'thigh-left', dateTime: 1000, notes: '', createdAt: 1000 },
        { id: '2', medicationId: 'm1', dosage: 1, unit: 'mg', injectionSite: 'arm-right', dateTime: 2000, notes: '', createdAt: 2000 },
      ];
      // abdomen sites never used → first never-used site in active list
      expect(getNextInjectionSite(doses, 'lru', allSites)).toBe('abdomen-upper-left');
    });

    it('uses oldest among all-used sites when all are used', () => {
      const now = Date.now();
      const doses: Dose[] = allSites.map((site, i) => ({
        id: String(i),
        medicationId: 'm1',
        dosage: 1,
        unit: 'mg',
        injectionSite: site,
        dateTime: now - (allSites.length - i) * 1000,
        notes: '',
        createdAt: now - (allSites.length - i) * 1000,
      }));
      // abdomen-upper-left has oldest timestamp
      expect(getNextInjectionSite(doses, 'lru', allSites)).toBe('abdomen-upper-left');
    });
  });
});
