import { clamp, num } from './format';
import { exerciseLookup } from './exercises';
import type { AppState, Fields, Notice, UnitMode } from './types';

export const KG_PER_LB = 0.45359237;
const KCAL_PER_KG = 7700;
const CM_PER_IN = 2.54;
/** Fat-loss pace used when she picks fat loss but gives no usable goal weight. */
export const DEFAULT_PACE_PER_WEEK = 0.005;
const MAX_PACE_PER_WEEK = 0.0075;
const MAX_DEFICIT = 500;
const MIN_BMI = 18.5;

export interface Targets {
  valid: boolean;
  age: number;
  sex: string;
  kg: number;
  cm: number;
  bmi: number;
  bmr: number;
  pal: number;
  baseMaintenance: number;
  lean: number;
  hasBf: boolean;
  hasGoalBf: boolean;
  goalKg: number;
  goalBmi: number;
  goalFfm: number;
  goalBf: number;
  weeks: number;
  /** Where the fat-loss deficit came from. */
  pace: 'goal' | 'default' | 'none';
  requested: number;
  maxDeficit: number;
  deficit: number;
  surplus: number;
  cutoff: number;
  usingNih: boolean;
  nihMaint: number;
  nihGoal: number;
  workout: number[];
  maintenance: number[];
  target: number[];
  proteinGrams: number;
  notices: Notice[];
}

export const toKg = (value: number, units: UnitMode) => (units === 'us' ? value * KG_PER_LB : value);
export const fromKg = (kg: number, units: UnitMode) => (units === 'us' ? kg / KG_PER_LB : kg);
export const massUnit = (units: UnitMode) => (units === 'us' ? 'lb' : 'kg');
export const lengthUnit = (units: UnitMode) => (units === 'us' ? 'in' : 'cm');
export const toCm = (value: number, units: UnitMode) => (units === 'us' ? value * CM_PER_IN : value);

export function exerciseKcal(met: number, minutes: number, kg: number, pal: number, credit: number): number {
  return Math.max(0, met - pal) * kg * (minutes / 60) * credit;
}

export function computeTargets(state: AppState): Targets {
  const f = state.fields;
  const units = f.unitMode;
  const age = num(f.age);
  const kg = toKg(num(f.weight), units);
  const cm = units === 'us' ? (num(f.feet) * 12 + num(f.inches)) * CM_PER_IN : num(f.height);
  const sex = f.sex;
  const pal = num(f.pal) || 1.4;
  const credit = num(f.credit) || 0.75;
  const valid = age >= 18 && age <= 120 && kg > 0 && kg < 500 && cm >= 110 && cm <= 250 && (sex === 'male' || sex === 'female');
  const bmr = valid ? 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161) : 0;
  const bmi = valid ? kg / (cm / 100) ** 2 : 0;

  const bf = num(f.bodyfat);
  const goalBf = num(f.goalBf);
  const hasBf = valid && bf > 0 && bf < 75;
  const hasGoalBf = goalBf > 0 && goalBf < 65;
  const lean = kg * (1 - bf / 100);
  const goalInput = toKg(num(f.goal), units);
  const goalKg = goalInput > 0 ? goalInput : hasBf && hasGoalBf ? lean / (1 - goalBf / 100) : 0;
  const goalFfm = goalKg * (1 - goalBf / 100);
  const goalBmi = goalKg > 0 && cm > 0 ? goalKg / (cm / 100) ** 2 : 0;
  const weeks = num(f.weeks);

  const exercises = exerciseLookup(state.customExercises);
  const workout = state.schedule.map((entries) =>
    entries.reduce((sum, e) => {
      const def = exercises.get(e.exerciseId);
      return sum + (def ? exerciseKcal(def.met, e.minutes, kg, pal, credit) : 0);
    }, 0),
  );
  const maintenance = workout.map((w) => bmr * pal + w);
  const least = Math.min(...maintenance);
  const cutoff = sex === 'male' ? 1500 : 1200;
  const notices: Notice[] = [];
  const focus = f.focus;

  let pace: Targets['pace'] = 'none';
  let requested = 0;
  let deficit = 0;
  const maxDeficit = Math.min(MAX_DEFICIT, (kg * MAX_PACE_PER_WEEK * KCAL_PER_KG) / 7);

  if (valid && focus === 'cut') {
    const goalBelowCurrent = goalKg > 0 && goalKg < kg;
    const timelineOk = weeks >= 1 && weeks <= 520;
    if (bmi < MIN_BMI) {
      notices.push({ level: 'warn', text: 'Your current BMI is below 18.5, so no fat-loss deficit is applied. Calories stay at maintenance.' });
    } else if (goalBelowCurrent && goalBmi < MIN_BMI) {
      notices.push({ level: 'warn', text: 'That goal puts BMI below 18.5, so no fat-loss deficit is applied. Calories stay at maintenance.' });
    } else {
      if (goalBelowCurrent && timelineOk) {
        pace = 'goal';
        requested = ((kg - goalKg) * KCAL_PER_KG) / (weeks * 7);
      } else {
        pace = 'default';
        requested = (kg * DEFAULT_PACE_PER_WEEK * KCAL_PER_KG) / 7;
        if (goalKg > 0 && !goalBelowCurrent) {
          notices.push({ level: 'warn', text: 'Fat loss is selected but your goal weight is not below your current weight. Using a moderate default pace until you change one of them.' });
        } else if (goalBelowCurrent) {
          notices.push({ level: 'warn', text: 'Add a timeline of 1 to 520 weeks to use your goal weight. Using a moderate default pace for now.' });
        } else {
          notices.push({ level: 'info', text: 'No goal weight entered, so this uses a moderate default pace of about 0.5% of body weight per week. Add a goal weight and timeline to tailor it.' });
        }
      }
      deficit = clamp(Math.min(requested, maxDeficit, least - cutoff), 0, MAX_DEFICIT);
      if (deficit <= 0) {
        notices.push({ level: 'warn', text: `Maintenance is already close to the ${cutoff.toLocaleString('en-US')} kcal minimum this app uses, so no deficit is applied.` });
      } else if (pace === 'goal' && requested > deficit + 1) {
        notices.push({ level: 'info', text: 'That timeline needs a larger deficit than this conservative estimate allows. See Goal timeline for the earliest realistic date.' });
      }
    }
  }

  const surplus = focus === 'gain' && valid ? (0.05 * maintenance.reduce((a, b) => a + b, 0)) / 7 : 0;
  if (valid && focus === 'gain' && goalKg > 0 && goalKg < kg) {
    notices.push({ level: 'warn', text: 'Gain muscle is selected but your goal weight is below your current weight. Calories include a surplus; change the goal or the goal weight if that is not what you want.' });
  }
  if (valid && focus === 'recomp' && goalInput > 0) {
    notices.push({ level: 'info', text: 'Recomposition stays at maintenance calories. The goal weight does not change your targets here.' });
  }

  const nihMaint = num(f.nihMaint);
  const nihGoal = num(f.nihGoal);
  const usingNih = state.nihEnabled && valid && nihMaint > 0 && nihGoal > 0 && nihGoal < 10000;
  const avgExercise = workout.reduce((s, x) => s + x, 0) / workout.length;

  let target: number[];
  if (usingNih) {
    // The minimum never sits above that day's own maintenance estimate.
    const floors = maintenance.map((m) => Math.min(cutoff, m));
    const raw = workout.map((w) => nihGoal + w - avgExercise);
    target = raw.map((t, i) => Math.max(floors[i], t));
    if (raw.some((t, i) => t < floors[i])) {
      notices.push({ level: 'warn', text: `Your NIH goal would put at least one day below ${cutoff.toLocaleString('en-US')} kcal. Those days are held at the minimum; check your entry and talk to a clinician before going lower.` });
    }
    notices.push({ level: 'info', text: 'Imported NIH goal calories set the weekly average. The day-by-day split is this app\'s estimate.' });
  } else {
    target = maintenance.map((m) => Math.max(0, m - deficit + surplus));
  }

  if (hasBf && hasGoalBf && goalKg > 0) {
    const delta = fromKg(goalFfm - lean, units);
    notices.push({ level: 'info', text: `Your goal inputs imply ${delta > 0 ? 'a gain' : 'a loss'} of ${Math.abs(delta).toFixed(1)} ${massUnit(units)} of fat-free mass. This compares feasibility; it does not forecast muscle gain.` });
  }
  if (valid && bmi >= 30) {
    notices.push({ level: 'info', text: 'Protein g/kg uses total body weight, which can overstate needs at a higher BMI. Consider the lower end of the slider.' });
  }

  return {
    valid, age, sex, kg, cm, bmi, bmr, pal, baseMaintenance: bmr * pal, lean, hasBf, hasGoalBf, goalKg, goalBmi, goalFfm, goalBf, weeks,
    pace, requested, maxDeficit, deficit, surplus, cutoff, usingNih, nihMaint, nihGoal, workout, maintenance, target,
    proteinGrams: state.protein * kg, notices,
  };
}

export interface Macros {
  calories: number;
  proteinPct: number;
  feasible: boolean;
  fat: number;
  carb: number;
  fatMin: number;
  fatMax: number;
  carbMin: number;
  carbMax: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

export const FAT_MIN = 20;
export const FAT_MAX = 40;

export function computeMacros(targets: Targets, day: number, fatSetting: number): Macros {
  const calories = targets.target[day] ?? 0;
  const proteinGrams = targets.proteinGrams;
  const proteinPct = targets.valid && calories > 0 ? ((proteinGrams * 4) / calories) * 100 : 0;
  const feasible = targets.valid && calories > 0 && proteinPct <= 80;
  const fatMax = Math.min(FAT_MAX, Math.max(0, 100 - proteinPct));
  const fat = feasible ? clamp(fatSetting, FAT_MIN, fatMax) : 0;
  const carb = feasible ? Math.max(0, 100 - proteinPct - fat) : 0;
  return {
    calories, proteinPct, feasible, fat, carb,
    fatMin: FAT_MIN,
    fatMax,
    carbMin: feasible ? Math.max(0, 100 - proteinPct - fatMax) : 0,
    carbMax: feasible ? Math.max(0, 100 - proteinPct - FAT_MIN) : 0,
    proteinGrams,
    carbGrams: (calories * carb) / 400,
    fatGrams: (calories * fat) / 900,
  };
}

/** Moving the carb slider only changes fat; the stored fat value always stays in range. */
export function fatFromCarb(m: Macros, carbPct: number): number {
  return clamp(100 - m.proteinPct - carbPct, m.fatMin, m.fatMax);
}

export function convertUnits(f: Fields, next: UnitMode): Fields {
  if (f.unitMode === next) return f;
  const out: Fields = { ...f, unitMode: next };
  const mass = (key: 'weight' | 'goal') => {
    const v = num(f[key]);
    if (v > 0) out[key] = next === 'metric' ? (v * KG_PER_LB).toFixed(2) : (v / KG_PER_LB).toFixed(1);
  };
  mass('weight');
  mass('goal');
  for (const key of ['neck', 'waist', 'hip'] as const) {
    const v = num(f[key]);
    if (v > 0) out[key] = next === 'metric' ? (v * CM_PER_IN).toFixed(1) : (v / CM_PER_IN).toFixed(1);
  }
  if (next === 'metric') {
    if (num(f.feet) > 0) out.height = ((num(f.feet) * 12 + num(f.inches)) * CM_PER_IN).toFixed(1);
  } else if (num(f.height) > 0) {
    const inches = Math.round(num(f.height) / CM_PER_IN);
    out.feet = String(Math.floor(inches / 12));
    out.inches = String(inches % 12);
  }
  return out;
}
