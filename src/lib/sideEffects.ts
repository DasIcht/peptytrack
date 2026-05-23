import type { Dose, SideEffectSeverity } from '../types';

export type SideEffectRarity = 'very-common' | 'common' | 'uncommon' | 'rare' | 'very-rare';
export type SymptomRiskTier = 'emergency' | 'urgent' | 'moderate' | 'routine';

export interface SideEffectDef {
  label: string;
  rarity: SideEffectRarity;
  tier: SymptomRiskTier;
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
  { label: 'Nausea', rarity: 'very-common', tier: 'moderate' },
  { label: 'Vomiting', rarity: 'very-common', tier: 'moderate' },
  { label: 'Diarrhea', rarity: 'very-common', tier: 'moderate' },
  { label: 'Constipation', rarity: 'very-common', tier: 'moderate' },
  { label: 'Abdominal pain', rarity: 'very-common', tier: 'moderate' },
  { label: 'Decreased appetite', rarity: 'very-common', tier: 'moderate' },

  // Common (1–10%)
  { label: 'Headache', rarity: 'common', tier: 'routine' },
  { label: 'Dizziness', rarity: 'common', tier: 'moderate' },
  { label: 'Fatigue', rarity: 'common', tier: 'moderate' },
  { label: 'Injection site reaction', rarity: 'common', tier: 'routine' },
  { label: 'Indigestion', rarity: 'common', tier: 'moderate' },
  { label: 'Bloating', rarity: 'common', tier: 'moderate' },

  // Uncommon (0.1–1%)
  { label: 'Severe abdominal pain', rarity: 'uncommon', tier: 'urgent' },
  { label: 'Gallbladder issues', rarity: 'uncommon', tier: 'urgent' },
  { label: 'Hypoglycemia', rarity: 'uncommon', tier: 'urgent' },
  { label: 'Allergic reaction', rarity: 'uncommon', tier: 'moderate' },
  { label: 'Hair loss', rarity: 'uncommon', tier: 'routine' },
  { label: 'Acid reflux', rarity: 'uncommon', tier: 'moderate' },

  // Rare (0.01–0.1%)
  { label: 'Neck lump / hoarseness', rarity: 'rare', tier: 'routine' },
  { label: 'Severe allergic reaction', rarity: 'rare', tier: 'emergency' },
  { label: 'Kidney injury signs', rarity: 'rare', tier: 'urgent' },
  { label: 'Severe injection site necrosis', rarity: 'rare', tier: 'urgent' },

  // Very Rare (<0.01%)
  { label: 'Anaphylaxis', rarity: 'very-rare', tier: 'emergency' },
];

/**
 * Resolve a symptom's clinical risk tier, applying escalation rules for severe states.
 */
export function getSymptomRiskTier(label: string, severity?: SideEffectSeverity): SymptomRiskTier {
  const std = STANDARD_SIDE_EFFECTS.find(se => se.label.toLowerCase() === label.toLowerCase());
  const baseTier = std ? std.tier : 'moderate'; // default custom symptoms to moderate

  if (severity === 'severe') {
    // Escalation 1: Hypoglycemia or severe/abdominal pain escalates to emergency
    if (
      label.toLowerCase() === 'hypoglycemia' ||
      label.toLowerCase() === 'severe abdominal pain' ||
      label.toLowerCase() === 'abdominal pain'
    ) {
      return 'emergency';
    }
    // Escalation 2: Vomiting or Diarrhea escalates to urgent (due to dehydration/renal injury risk)
    if (
      label.toLowerCase() === 'vomiting' ||
      label.toLowerCase() === 'diarrhea'
    ) {
      return 'urgent';
    }
  }

  return baseTier;
}

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
