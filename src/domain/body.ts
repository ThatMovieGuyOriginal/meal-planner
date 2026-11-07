/** Body-composition formulas. All are population estimates, not measurements. */

export const bmi = (kg: number, cm: number) => (kg > 0 && cm > 0 ? kg / (cm / 100) ** 2 : 0);

export function bmiCategory(value: number): string {
  if (value <= 0) return '';
  if (value < 18.5) return 'Underweight';
  if (value < 25) return 'Healthy range';
  if (value < 30) return 'Overweight';
  return 'Obesity range';
}

/** Fat-free mass index, height-normalised to 1.8 m. */
export function ffmi(leanKg: number, cm: number): number {
  if (!(leanKg > 0 && cm > 0)) return 0;
  const m = cm / 100;
  return leanKg / (m * m) + 6.1 * (1.8 - m);
}

/** US Navy circumference method. Lengths in cm. Returns 0 when the inputs can't produce a result. */
export function navyBodyFat(sex: string, heightCm: number, neckCm: number, waistCm: number, hipCm: number): number {
  if (!(heightCm > 0 && neckCm > 0 && waistCm > 0)) return 0;
  let result: number;
  if (sex === 'male') {
    if (waistCm <= neckCm) return 0;
    result = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
  } else if (sex === 'female') {
    if (!(hipCm > 0) || waistCm + hipCm <= neckCm) return 0;
    result = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450;
  } else {
    return 0;
  }
  return Number.isFinite(result) && result > 0 && result < 75 ? result : 0;
}

/** The weight that gives a goal body-fat percentage while keeping current fat-free mass. */
export function weightAtBodyFat(leanKg: number, goalBfPct: number): number {
  if (!(leanKg > 0 && goalBfPct > 0 && goalBfPct < 65)) return 0;
  return leanKg / (1 - goalBfPct / 100);
}
