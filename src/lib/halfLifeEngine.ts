import type { Medication, Dose, MedLevelPoint } from '../types';

/**
 * Calculate the concentration of a single dose at a given time.
 * C(t) = C0 * (0.5)^(t / t_half)
 */
export function concentrationAtTime(
  doseAmount: number,
  halfLifeHours: number,
  hoursSinceDose: number
): number {
  if (hoursSinceDose < 0) return 0;
  return doseAmount * Math.pow(0.5, hoursSinceDose / halfLifeHours);
}

/**
 * Calculate total medication level at a specific point in time
 * from all historical doses of a given medication.
 */
export function medicationLevelAtTime(
  medication: Medication,
  doses: Dose[],
  timestamp: number
): number {
  return doses
    .filter((d) => d.medicationId === medication.id)
    .reduce((total, dose) => {
      const hoursSince = (timestamp - dose.dateTime) / (1000 * 60 * 60);
      return total + concentrationAtTime(dose.dosage, medication.halfLifeHours, hoursSince);
    }, 0);
}

/**
 * Generate a time-series of medication levels for charting.
 */
export function generateLevelSeries(
  medication: Medication,
  doses: Dose[],
  options: {
    startTime: number;
    endTime: number;
    resolutionMinutes?: number;
  }
): MedLevelPoint[] {
  const { startTime, endTime, resolutionMinutes = 60 } = options;
  const points: MedLevelPoint[] = [];
  const stepMs = resolutionMinutes * 60 * 1000;

  for (let t = startTime; t <= endTime; t += stepMs) {
    const level = medicationLevelAtTime(medication, doses, t);
    const doseEvents = doses
      .filter((d) => d.medicationId === medication.id && Math.abs(d.dateTime - t) < stepMs / 2)
      .map((d) => ({ medicationId: d.medicationId, dosage: d.dosage }));

    points.push({
      timestamp: t,
      level,
      doseEvents: doseEvents.length > 0 ? doseEvents : undefined,
    });
  }

  return points;
}

/**
 * Calculate the estimated steady-state level for a medication
 * given a regular dosing schedule.
 */
export function estimateSteadyStateLevel(medication: Medication): number {
  const frequencyHours =
    medication.frequency === 'daily'
      ? 24
      : medication.frequency === 'twice-daily'
        ? 12
        : medication.frequency === 'weekly'
          ? 168
          : 336;

  const avgDose =
    medication.dosageOptions.reduce((a, b) => a + b, 0) /
    medication.dosageOptions.length;

  // Steady state: C_ss = Dose / (1 - e^(-λ * τ))
  // where λ = ln(2) / t_half, τ = dosing interval
  const lambda = Math.LN2 / medication.halfLifeHours;
  return avgDose / (1 - Math.exp(-lambda * frequencyHours));
}

/**
 * Get the next recommended dose time based on last dose and frequency.
 */
export function getNextDoseTime(medication: Medication, doses: Dose[]): Date | null {
  const medDoses = doses
    .filter((d) => d.medicationId === medication.id)
    .sort((a, b) => b.dateTime - a.dateTime);

  if (medDoses.length === 0) return null;

  const lastDose = medDoses[0];
  const intervalMs =
    medication.frequency === 'daily'
      ? 24 * 60 * 60 * 1000
      : medication.frequency === 'twice-daily'
        ? 12 * 60 * 60 * 1000
        : medication.frequency === 'weekly'
          ? 7 * 24 * 60 * 60 * 1000
          : 14 * 24 * 60 * 60 * 1000;

  return new Date(lastDose.dateTime + intervalMs);
}

/**
 * Get time until next dose in human-readable format.
 */
export function getTimeUntilNextDose(medication: Medication, doses: Dose[]): string {
  const next = getNextDoseTime(medication, doses);
  if (!next) return 'Not started';

  const now = Date.now();
  const diff = next.getTime() - now;

  if (diff < 0) return 'Overdue';

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Calculate all medication levels at a point in time (for multiple meds).
 */
export function allMedicationLevelsAtTime(
  medications: Medication[],
  doses: Dose[],
  timestamp: number
): Record<string, number> {
  return Object.fromEntries(
    medications.map((med) => [
      med.id,
      medicationLevelAtTime(med, doses, timestamp),
    ])
  );
}
