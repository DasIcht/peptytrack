import type { Dose } from '../types';

export type SideEffectRarity = 'very-common' | 'common' | 'uncommon' | 'rare' | 'very-rare';

export interface SideEffectDef {
  label: string;
  rarity: SideEffectRarity;
}

const RARITY_ORDER: Record<SideEffectRarity, number> = {
  'very-common': 0,
  common: 1,
  uncommon: 2,
  rare: 3,
  'very-rare': 4,
};

export const STANDARD_SIDE_EFFECTS: SideEffectDef[] = [
  // Very Common (>10%)
  { label: 'Nausea', rarity: 'very-common' },
  { label: 'Vomiting', rarity: 'very-common' },
  { label: 'Diarrhea', rarity: 'very-common' },
  { label: 'Constipation', rarity: 'very-common' },
  { label: 'Abdominal pain', rarity: 'very-common' },
  { label: 'Decreased appetite', rarity: 'very-common' },

  // Common (1–10%)
  { label: 'Headache', rarity: 'common' },
  { label: 'Dizziness', rarity: 'common' },
  { label: 'Fatigue', rarity: 'common' },
  { label: 'Injection site reaction', rarity: 'common' },
  { label: 'Indigestion', rarity: 'common' },
  { label: 'Bloating', rarity: 'common' },

  // Uncommon (0.1–1%)
  { label: 'Severe abdominal pain', rarity: 'uncommon' },
  { label: 'Gallbladder issues', rarity: 'uncommon' },
  { label: 'Hypoglycemia', rarity: 'uncommon' },
  { label: 'Allergic reaction', rarity: 'uncommon' },
  { label: 'Hair loss', rarity: 'uncommon' },
  { label: 'Acid reflux', rarity: 'uncommon' },

  // Rare (0.01–0.1%)
  { label: 'Neck lump / hoarseness', rarity: 'rare' },
  { label: 'Severe allergic reaction', rarity: 'rare' },
  { label: 'Kidney injury signs', rarity: 'rare' },
  { label: 'Severe injection site necrosis', rarity: 'rare' },

  // Very Rare (<0.01%)
  { label: 'Anaphylaxis', rarity: 'very-rare' },
];

/**
 * Return standard side effects sorted by rarity (most common first).
 */
export function getSideEffectsByRarity(): string[] {
  return [...STANDARD_SIDE_EFFECTS]
    .sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity])
    .map((se) => se.label);
}

/**
 * Build the ordered list of side effects for a specific medication.
 *
 * Ordering rules:
 * 1. Previously selected side effects for this medication (alphabetically).
 * 2. Remaining standard side effects (by rarity, most common first).
 * 3. Custom side effects for this medication (alphabetically).
 */
export function getSideEffectsOrderedForMedication(
  medicationId: string,
  doses: Dose[],
  customEffects: string[]
): string[] {
  if (!medicationId) return [];

  const allLabels = new Set<string>();
  const previouslySelected = new Set<string>();

  for (const dose of doses) {
    if (dose.medicationId !== medicationId) continue;
    for (const se of dose.sideEffects ?? []) {
      const label = typeof se === 'string' ? se : se.label;
      if (label) {
        previouslySelected.add(label);
        allLabels.add(label);
      }
    }
  }

  const standardByRarity = getSideEffectsByRarity();
  const standardLabels = new Set(standardByRarity);

  const previouslySelectedOrdered = Array.from(previouslySelected).sort((a, b) =>
    a.localeCompare(b)
  );

  const remainingStandard = standardByRarity.filter(
    (label) => !previouslySelected.has(label)
  );

  const customNotPreviouslySelected = customEffects
    .filter((label) => !previouslySelected.has(label) && !standardLabels.has(label))
    .sort((a, b) => a.localeCompare(b));

  const result = [
    ...previouslySelectedOrdered,
    ...remainingStandard,
    ...customNotPreviouslySelected,
  ];

  // Deduplicate while preserving order
  const seen = new Set<string>();
  return result.filter((label) => {
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}
