import type { InjectionSite, RotationStrategy, Dose } from '../types';

const ALL_SITES: InjectionSite[] = [
  'abdomen-upper-left',
  'abdomen-upper-right',
  'abdomen-lower-left',
  'abdomen-lower-right',
  'thigh-left',
  'thigh-right',
  'arm-left',
  'arm-right',
];

const QUADRANT_ORDER: InjectionSite[] = [
  'abdomen-upper-left',
  'abdomen-upper-right',
  'abdomen-lower-left',
  'abdomen-lower-right',
  'thigh-left',
  'thigh-right',
  'arm-left',
  'arm-right',
];

/**
 * Get the most recently used injection site across all doses.
 * Returns null if no doses have been logged.
 */
export function getLastUsedSite(doses: Dose[]): InjectionSite | null {
  if (doses.length === 0) return null;
  const sorted = [...doses].sort((a, b) => b.dateTime - a.dateTime);
  return sorted[0].injectionSite;
}

/**
 * Get the next injection site based on the chosen strategy.
 * Only considers sites in the `activeSites` list.
 */
export function getNextInjectionSite(
  doses: Dose[],
  strategy: RotationStrategy,
  activeSites: InjectionSite[]
): InjectionSite | null {
  const sites = activeSites.length > 0 ? activeSites : ALL_SITES;
  if (sites.length === 0) return null;

  const lastSite = getLastUsedSite(doses);
  if (!lastSite) return sites[0];

  switch (strategy) {
    case 'sequential': {
      const idx = sites.indexOf(lastSite);
      const nextIdx = idx >= 0 ? (idx + 1) % sites.length : 0;
      return sites[nextIdx];
    }

    case 'quadrant': {
      // Filter quadrant order to only active sites
      const quadrantSites = QUADRANT_ORDER.filter((s) => sites.includes(s));
      if (quadrantSites.length === 0) return sites[0];
      const idx = quadrantSites.indexOf(lastSite);
      const nextIdx = idx >= 0 ? (idx + 1) % quadrantSites.length : 0;
      return quadrantSites[nextIdx];
    }

    case 'lru': {
      // Build a map of last-used timestamps per site (global across all doses)
      const lastUsedMap = new Map<InjectionSite, number>();
      for (const dose of doses) {
        const existing = lastUsedMap.get(dose.injectionSite);
        if (!existing || dose.dateTime > existing) {
          lastUsedMap.set(dose.injectionSite, dose.dateTime);
        }
      }

      // Find the site in active list with the oldest (or no) last-used timestamp
      let oldestSite: InjectionSite | null = null;
      let oldestTime = Infinity;

      for (const site of sites) {
        const usedAt = lastUsedMap.get(site);
        if (usedAt === undefined) {
          // Never used — highest priority
          return site;
        }
        if (usedAt < oldestTime) {
          oldestTime = usedAt;
          oldestSite = site;
        }
      }

      return oldestSite ?? sites[0];
    }

    default:
      return sites[0];
  }
}
