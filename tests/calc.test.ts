import { describe, expect, it } from 'vitest';
import { computeMacros, computeTargets, convertUnits, fatFromCarb } from '../src/domain/calc';
import { navyBodyFat, weightAtBodyFat, ffmi, bmiCategory } from '../src/domain/body';
import { project } from '../src/domain/projection';
import { defaultState } from '../src/state/defaults';
import type { AppState } from '../src/domain/types';

function profile(over: Partial<AppState['fields']> = {}, state: Partial<AppState> = {}): AppState {
  const base = defaultState();
  return { ...base, ...state, fields: { ...base.fields, age: '32', sex: 'female', feet: '5', inches: '6', weight: '150', ...over } };
}

describe('calorie targets', () => {
  it('matches the Mifflin-St Jeor formula', () => {
    const t = computeTargets(profile());
    const kg = 150 * 0.45359237;
    const cm = 66 * 2.54;
    expect(t.bmr).toBeCloseTo(10 * kg + 6.25 * cm - 5 * 32 - 161, 6);
    expect(t.baseMaintenance).toBeCloseTo(t.bmr * 1.4, 6);
  });

  it('stays blank until the profile is complete', () => {
    const t = computeTargets(defaultState());
    expect(t.valid).toBe(false);
    expect(t.bmr).toBe(0);
  });

  it('applies a default fat-loss pace when no goal weight is entered', () => {
    const t = computeTargets(profile());
    expect(t.pace).toBe('default');
    expect(t.deficit).toBeGreaterThan(300);
    expect(t.target[0]).toBeCloseTo(t.maintenance[0] - t.deficit, 6);
    expect(t.target[0]).toBeLessThan(t.baseMaintenance);
    expect(t.notices.some((n) => n.text.includes('default pace'))).toBe(true);
  });

  it('uses the goal and timeline when they make sense', () => {
    const t = computeTargets(profile({ goal: '135', weeks: '16' }));
    expect(t.pace).toBe('goal');
    expect(t.deficit).toBeCloseTo(((15 * 0.45359237) * 7700) / (16 * 7), 4);
  });

  it('warns when fat loss is selected but the goal weight is higher', () => {
    const t = computeTargets(profile({ goal: '165' }));
    expect(t.pace).toBe('default');
    expect(t.deficit).toBeGreaterThan(0);
    expect(t.notices.some((n) => n.level === 'warn' && n.text.includes('not below'))).toBe(true);
  });

  it('warns when gaining but the goal weight is lower', () => {
    const t = computeTargets(profile({ goal: '135', focus: 'gain' }));
    expect(t.surplus).toBeGreaterThan(0);
    expect(t.notices.some((n) => n.level === 'warn' && n.text.includes('below your current weight'))).toBe(true);
  });

  it('applies no deficit for a goal under BMI 18.5', () => {
    const t = computeTargets(profile({ goal: '100' }));
    expect(t.deficit).toBe(0);
    expect(t.notices.some((n) => n.text.includes('18.5'))).toBe(true);
  });

  it('applies no deficit when she is already under BMI 18.5, even with no goal', () => {
    const t = computeTargets(profile({ weight: '100' }));
    expect(t.deficit).toBe(0);
    expect(t.notices.some((n) => n.text.includes('current BMI'))).toBe(true);
  });

  it('never drops a built-in target below the calorie floor because of the deficit', () => {
    const t = computeTargets(profile({ goal: '125', weeks: '1' }));
    expect(Math.min(...t.target)).toBeGreaterThanOrEqual(1200);
  });

  it('caps the deficit and says so when the timeline is too aggressive', () => {
    const t = computeTargets(profile({ goal: '125', weeks: '2' }));
    expect(t.deficit).toBeLessThanOrEqual(500);
    expect(t.notices.some((n) => n.text.includes('larger deficit'))).toBe(true);
  });

  it('holds NIH mode at the minimum instead of accepting 600 kcal', () => {
    const t = computeTargets(profile({ nihMaint: '2000', nihGoal: '600' }, { nihEnabled: true }));
    expect(t.usingNih).toBe(true);
    expect(Math.min(...t.target)).toBeGreaterThanOrEqual(1200);
    expect(t.notices.some((n) => n.level === 'warn' && n.text.includes('below 1,200'))).toBe(true);
  });

  it('keeps the NIH weekly average when the goal is sensible', () => {
    const state = profile({ nihMaint: '2000', nihGoal: '1700' }, { nihEnabled: true });
    state.schedule[0] = [{ exerciseId: 'running-moderate', minutes: 60 }];
    const t = computeTargets(state);
    const avg = t.target.reduce((a, b) => a + b, 0) / 7;
    expect(avg).toBeCloseTo(1700, 6);
    expect(t.target[0]).toBeGreaterThan(t.target[1]);
  });

  it('counts custom exercises by their stable id', () => {
    const state = profile({}, { customExercises: [{ id: 'customex-a', name: 'Barre', level: 'Moderate', met: 4, custom: true }] });
    state.schedule[2] = [{ exerciseId: 'customex-a', minutes: 60 }];
    const t = computeTargets(state);
    expect(t.workout[2]).toBeCloseTo((4 - 1.4) * t.kg * 0.75, 6);
  });
});

describe('macros', () => {
  const t = computeTargets(profile());

  it('sums to 100% of calories', () => {
    const m = computeMacros(t, 0, 27);
    expect(m.proteinPct + m.fat + m.carb).toBeCloseTo(100, 6);
  });

  it('keeps fat in range when the carb slider is dragged to either end', () => {
    const m = computeMacros(t, 0, 27);
    expect(fatFromCarb(m, 0)).toBeLessThanOrEqual(40);
    expect(fatFromCarb(m, 100)).toBeGreaterThanOrEqual(20);
  });

  it('gives the carb slider the true range, so it never jumps', () => {
    const m = computeMacros(t, 0, 27);
    expect(m.carbMin).toBeCloseTo(100 - m.proteinPct - 40, 6);
    expect(m.carbMax).toBeCloseTo(100 - m.proteinPct - 20, 6);
    expect(fatFromCarb(m, m.carbMin)).toBeCloseTo(40, 6);
    expect(fatFromCarb(m, m.carbMax)).toBeCloseTo(20, 6);
  });

  it('reports infeasible when protein alone would exceed 80% of calories', () => {
    expect(computeMacros({ ...t, proteinGrams: 500 }, 0, 27).feasible).toBe(false);
  });
});

describe('units', () => {
  it('round-trips weight without drifting', () => {
    const metric = convertUnits(profile().fields, 'metric');
    expect(metric.height).toBe('167.6');
    const back = convertUnits(metric, 'us');
    expect(Number(back.weight)).toBeCloseTo(150, 1);
    expect(back.feet).toBe('5');
    expect(back.inches).toBe('6');
  });

  it('gives the same calories in either unit system', () => {
    const us = profile();
    const metric = { ...us, fields: convertUnits(us.fields, 'metric') };
    expect(computeTargets(metric).bmr).toBeCloseTo(computeTargets(us).bmr, 0);
  });
});

describe('body calculators', () => {
  it('estimates Navy body fat in a plausible range', () => {
    expect(navyBodyFat('female', 168, 33, 75, 98)).toBeGreaterThan(18);
    expect(navyBodyFat('female', 168, 33, 75, 98)).toBeLessThan(35);
    expect(navyBodyFat('male', 180, 38, 85, 0)).toBeGreaterThan(10);
    expect(navyBodyFat('male', 180, 38, 85, 0)).toBeLessThan(25);
  });

  it('returns 0 rather than nonsense for missing or impossible input', () => {
    expect(navyBodyFat('female', 168, 33, 75, 0)).toBe(0);
    expect(navyBodyFat('male', 180, 90, 85, 0)).toBe(0);
    expect(navyBodyFat('', 180, 38, 85, 95)).toBe(0);
  });

  it('computes goal weight from fat-free mass', () => {
    expect(weightAtBodyFat(50, 25)).toBeCloseTo(66.67, 2);
    expect(weightAtBodyFat(0, 25)).toBe(0);
  });

  it('computes FFMI and BMI categories', () => {
    expect(ffmi(60, 180)).toBeCloseTo(18.52, 1);
    expect(bmiCategory(17)).toBe('Underweight');
    expect(bmiCategory(22)).toBe('Healthy range');
  });
});

describe('goal timeline', () => {
  it('projects toward the goal and stops there', () => {
    const t = computeTargets(profile({ goal: '135', weeks: '16' }));
    const p = project(t);
    expect(p.dailyDelta).toBeLessThan(0);
    expect(p.weeksToGoal).toBe(16);
    expect(p.rows.at(-1)!.kg).toBeCloseTo(t.goalKg, 1);
    expect(p.rows[0].kg).toBeCloseTo(t.kg, 6);
  });

  it('agrees with the deficit shown for an NIH goal, even with workouts scheduled', () => {
    const state = profile({ nihMaint: '2000', nihGoal: '1700' }, { nihEnabled: true });
    state.schedule[0] = [{ exerciseId: 'running-moderate', minutes: 60 }];
    expect(project(computeTargets(state)).dailyDelta).toBeCloseTo(-300, 6);
  });

  it('gives an earliest realistic timeline for an aggressive goal', () => {
    const t = computeTargets(profile({ goal: '125', weeks: '2' }));
    expect(project(t).earliestWeeks).toBeGreaterThan(2);
  });

  it('reports no arrival when the plan moves the wrong way', () => {
    const t = computeTargets(profile({ goal: '135', focus: 'gain' }));
    expect(project(t).weeksToGoal).toBeNull();
  });
});
