import { subDays } from 'date-fns';

/** A chart range is either a fixed number of days back from now, or the full history. */
export type ChartRange = number | 'all';

export const TIME_RANGES: { label: string; value: ChartRange }[] = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
  { label: 'All', value: 'all' },
];

/** Upper bound on generated sample points so long histories stay responsive. */
export const MAX_CHART_POINTS = 600;

/** Used for "All" when there is no logged data at all. */
const EMPTY_HISTORY_FALLBACK_DAYS = 30;

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Resolve the start timestamp of a chart range.
 * For 'all', this is the earliest timestamp found in any of the given series,
 * clamped so it never lies after `now`.
 */
export function getRangeStart(
  range: ChartRange,
  now: number,
  timestamps: Iterable<number> = [],
): number {
  if (range !== 'all') {
    return subDays(now, range).getTime();
  }

  let earliest = Infinity;
  for (const t of timestamps) {
    if (Number.isFinite(t) && t < earliest) earliest = t;
  }

  if (earliest === Infinity) {
    return subDays(now, EMPTY_HISTORY_FALLBACK_DAYS).getTime();
  }

  // Ensure there is at least a day of span so the chart isn't a single point.
  return Math.min(earliest, now - DAY_MS);
}

/**
 * Pick the sampling step for a span. Keeps the original resolutions for
 * the fixed ranges (1h / 4h / 12h) and grows the step for longer spans so
 * the number of points never exceeds MAX_CHART_POINTS.
 */
export function getResolutionMs(range: ChartRange, start: number, end: number): number {
  const spanMs = Math.max(0, end - start);
  const spanDays = range === 'all' ? spanMs / DAY_MS : range;

  const baseMinutes = spanDays <= 7 ? 60 : spanDays <= 30 ? 240 : 720;
  const baseMs = baseMinutes * MINUTE_MS;

  const minStepForCap = Math.ceil(spanMs / MAX_CHART_POINTS);
  return Math.max(baseMs, minStepForCap);
}

/** Axis tick format: include the year once the span runs past a year. */
export function getTickFormat(start: number, end: number): string {
  return end - start > 365 * DAY_MS ? 'MMM yy' : 'MMM d';
}
