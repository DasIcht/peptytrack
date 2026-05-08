export type Frequency = 'daily' | 'twice-daily' | 'weekly' | 'biweekly';

export interface MedicationTemplate {
  id: string;
  name: string;
  brand: string;
  activeIngredient: string;
  dosageOptions: number[];
  unit: string;
  frequency: Frequency;
  halfLifeHours: number;
  color: string;
}

export interface Medication {
  id: string;
  templateId: string;
  name: string;
  brand: string;
  activeIngredient: string;
  dosageOptions: number[];
  unit: string;
  frequency: Frequency;
  halfLifeHours: number;
  color: string;
  reminderHoursBefore: number;
  enabled: boolean;
  createdAt: number;
}

export type InjectionSite =
  | 'abdomen-upper-left'
  | 'abdomen-upper-right'
  | 'abdomen-lower-left'
  | 'abdomen-lower-right'
  | 'thigh-left'
  | 'thigh-right'
  | 'arm-left'
  | 'arm-right';

export type RotationStrategy = 'sequential' | 'quadrant' | 'lru';

export interface Dose {
  id: string;
  medicationId: string;
  vialId?: string;
  dosage: number;
  unit: string;
  injectionSite: InjectionSite;
  dateTime: number;
  notes: string;
  sideEffects?: string[];
  createdAt: number;
}

export interface CustomSideEffects {
  medicationId: string;
  labels: string[];
}

export interface Vial {
  id: string;
  medicationId: string;
  name: string;
  peptideAmount: number;
  peptideUnit: string;
  bacWaterAmount: number;
  reconstitutedAt: number;
  remainingOverride: number | null;
  notes: string;
  createdAt: number;
}

export interface WeightEntry {
  id: string;
  weight: number;
  unit: 'kg' | 'lb';
  dateTime: number;
  notes: string;
  createdAt: number;
}

export interface AppSettings {
  weightUnit: 'kg' | 'lb';
  medicationUnit: 'mg' | 'mcg' | 'units';
  notificationsEnabled: boolean;
  injectionRotationStrategy: RotationStrategy;
  injectionRotationSites: InjectionSite[];
}

export interface MedLevelPoint {
  timestamp: number;
  level: number;
  doseEvents?: { medicationId: string; dosage: number }[];
}
