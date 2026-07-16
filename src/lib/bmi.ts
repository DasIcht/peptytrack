export type BMICategory = 'Underweight' | 'Normal' | 'Overweight' | 'Obese' | 'Unknown';

export function calculateBMI(
  weight: number,
  weightUnit: 'kg' | 'lb',
  height: number,
  heightUnit: 'cm' | 'in'
): number | null {
  if (!weight || !height || height <= 0) return null;

  // Convert weight to kg
  const weightKg = weightUnit === 'kg' ? weight : weight * 0.453592;
  
  // Convert height to meters
  const heightMeters = heightUnit === 'cm' ? height / 100 : height * 0.0254;

  const bmi = weightKg / (heightMeters * heightMeters);
  return Number(bmi.toFixed(1));
}

export function getBMICategory(bmi: number | null): BMICategory {
  if (bmi === null) return 'Unknown';
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

export const BMI_THRESHOLDS = {
  UNDERWEIGHT_MAX: 18.5,
  NORMAL_MAX: 25,
  OVERWEIGHT_MAX: 30
};
