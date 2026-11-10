import { describe, it, expect } from 'vitest';
import { subDays } from 'date-fns';
import {
  TIME_RANGES,
  MAX_CHART_POINTS,
  getRangeStart,
  getResolutionMs,
  getTickFormat,
} from './chartRange';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-11-10T12:00:00Z').getTime();

describe('TIME_RANGES', () => {
  it('offers 7, 30, 90 days and full history', () => {
    expect(TIME_RANGES.map((r) => r.value)).toEqual([7, 30, 90, 'all']);
    expect(TIME_RANGES.at(-1)?.label).toBe('All');
  });
});

describe('getRangeStart', () => {
  it('uses a fixed day offset for numeric ranges', () => {
    expect(getRangeStart(30, NOW)).toBe(subDays(NOW, 30).getTime());
    // Data timestamps are ignored for fixed ranges
    expect(getRangeStart(7, NOW, [NOW - 400 * DAY])).toBe(subDays(NOW, 7).getTime());
  });

  it('starts at the earliest data point for "all"', () => {
    const earliest = NOW - 500 * DAY;
    expect(getRangeStart('all', NOW, [NOW - 10 * DAY, earliest, NOW - 200 * DAY])).toBe(earliest);
  });

  it('ignores non-finite timestamps for "all"', () => {
    const earliest = NOW - 50 * DAY;
    expect(getRangeStart('all', NOW, [NaN, earliest, -Infinity])).toBe(earliest);
  });

  it('falls back to 30 days when there is no history', () => {
    expect(getRangeStart('all', NOW, [])).toBe(subDays(NOW, 30).getTime());
  });

  it('spans at least one day when all data is recent', () => {
    expect(getRangeStart('all', NOW, [NOW - HOUR])).toBe(NOW - DAY);
  });
});

describe('getResolutionMs', () => {
  it('keeps the existing resolutions for fixed ranges', () => {
    expect(getResolutionMs(7, subDays(NOW, 7).getTime(), NOW)).toBe(1 * HOUR);
    expect(getResolutionMs(30, subDays(NOW, 30).getTime(), NOW)).toBe(4 * HOUR);
    expect(getResolutionMs(90, subDays(NOW, 90).getTime(), NOW)).toBe(12 * HOUR);
  });

  it('matches fixed-range resolution for short full histories', () => {
    expect(getResolutionMs('all', NOW - 5 * DAY, NOW)).toBe(1 * HOUR);
    expect(getResolutionMs('all', NOW - 20 * DAY, NOW)).toBe(4 * HOUR);
    expect(getResolutionMs('all', NOW - 200 * DAY, NOW)).toBe(12 * HOUR);
  });

  it('caps the number of points for long histories', () => {
    const start = NOW - 3 * 365 * DAY;
    const step = getResolutionMs('all', start, NOW);
    expect(step).toBeGreaterThan(12 * HOUR);
    expect(Math.floor((NOW - start) / step) + 1).toBeLessThanOrEqual(MAX_CHART_POINTS + 1);
  });
});

describe('getTickFormat', () => {
  it('shows month and day for spans up to a year', () => {
    expect(getTickFormat(NOW - 90 * DAY, NOW)).toBe('MMM d');
  });

  it('includes the year for spans over a year', () => {
    expect(getTickFormat(NOW - 400 * DAY, NOW)).toBe('MMM yy');
  });
});
