import type { Targets } from './calc';

const KCAL_PER_KG = 7700;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

export interface ProjectionRow {
  week: number;
  kg: number;
}

export interface Projection {
  /** Average planned intake minus average maintenance. Negative means a deficit. */
  dailyDelta: number;
  weeklyKg: number;
  weeksToGoal: number | null;
  /** Earliest timeline this app's conservative pace limit allows for the goal. */
  earliestWeeks: number | null;
  rows: ProjectionRow[];
}

/** Simple energy-balance arithmetic: it ignores metabolic adaptation, so real progress usually slows. */
export function project(t: Targets, maxRows = 52): Projection {
  // The NIH planner's figure already includes her typical activity, so workouts aren't added again.
  const maintenance = t.usingNih ? t.nihMaint : avg(t.maintenance);
  const dailyDelta = avg(t.target) - maintenance;
  const weeklyKg = (dailyDelta * 7) / KCAL_PER_KG;
  const toGoal = t.goalKg - t.kg;
  const heading = t.goalKg > 0 && weeklyKg !== 0 && Math.sign(toGoal) === Math.sign(weeklyKg);
  // The small subtraction stops floating-point noise turning exactly 16 weeks into 17.
  const weeksToGoal = heading ? Math.ceil(Math.abs(toGoal / weeklyKg) - 1e-9) : null;
  const earliestWeeks =
    t.goalKg > 0 && t.goalKg < t.kg && t.maxDeficit > 0 ? Math.ceil(((t.kg - t.goalKg) * KCAL_PER_KG) / (t.maxDeficit * 7) - 1e-9) : null;
  const horizon = Math.min(maxRows, weeksToGoal ?? (t.weeks > 0 ? t.weeks : 16));
  const rows: ProjectionRow[] = [];
  for (let week = 0; week <= horizon; week++) {
    let kg = t.kg + weeklyKg * week;
    if (heading && (weeklyKg < 0 ? kg < t.goalKg : kg > t.goalKg)) kg = t.goalKg;
    rows.push({ week, kg });
  }
  return { dailyDelta, weeklyKg, weeksToGoal, earliestWeeks, rows };
}
