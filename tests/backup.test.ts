import { describe, expect, it } from 'vitest';
import { LEGACY_EXERCISE_IDS, EXERCISES } from '../src/domain/exercises';
import { backupFilename, makeBackup, needsBackup, parseBackup, summarize, type ParseOk } from '../src/state/backup';
import { defaultState } from '../src/state/defaults';
import { SCHEMA_VERSION, type AppState } from '../src/domain/types';

/** The original v6 exercise table and its sort, frozen to prove the id migration is exact. */
const V6_TABLE: [string, string, number][] = [['Badminton','Moderate',5.5],['Basketball','Moderate',6.5],['Boxing','Moderate',7.8],['Boxing','Vigorous',12.3],['Cycling outdoors','Light',4],['Cycling outdoors','Moderate',8],['Cycling outdoors','Vigorous',10],['Cycling outdoors','Very vigorous',12],['Elliptical','Moderate',5],['Elliptical','Vigorous',8],['HIIT','Vigorous',11],['Hiking','Moderate',5.3],['Hiking','Vigorous',7],['Kickboxing','Moderate',7.8],['Kickboxing','Vigorous',12.3],['Muay Thai','Moderate',10.3],['Muay Thai','Vigorous',12.3],['Pilates','Light',3],['Rowing machine','Light',3.5],['Rowing machine','Moderate',5],['Rowing machine','Vigorous',8.5],['Running','Moderate',9.3],['Running','Vigorous',11.8],['Stair climber','Moderate',6],['Stationary cycling','Moderate',6.8],['Swimming laps','Moderate',6],['Swimming laps','Vigorous',9.8],['Tennis','Moderate',6],['Tennis','Vigorous',8],['Walking','Light',2.8],['Walking','Moderate',3.8],['Walking','Brisk',4.8],['Weight lifting','Light',2.5],['Weight lifting','Moderate',3.5],['Weight lifting','Vigorous',6],['Yoga','Light',2.5]];

function fullState(): AppState {
  const s = defaultState();
  s.fields = { ...s.fields, age: '32', sex: 'female', unitMode: 'metric', height: '168', weight: '68', bodyfat: '28', goal: '62', goalBf: '24', weeks: '20', focus: 'recomp', pal: '1.7', credit: '1', nihMaint: '2000', nihGoal: '1700', neck: '33', waist: '75', hip: '98' };
  s.nihEnabled = true;
  s.protein = 1.8;
  s.fat = 33;
  s.customFoods = [{ id: 'custom-abc', name: 'Stew', category: 'Dairy', serving: '1 bowl', kcal: 300, p: 20, c: 30, f: 10, custom: true, weight: { g: 300, stage: 'cooked', yield: 0.9, rawLabel: 'raw ingredient for cooking' } }];
  s.customExercises = [{ id: 'customex-abc', name: 'Barre', level: 'Moderate', met: 4, custom: true }];
  s.yieldOverrides = { rice: { yield: 2.5, edibleYield: 1 } };
  s.mealSlots = [{ id: 'lunch', name: 'Midday' }, { id: 'breakfast', name: 'Breakfast' }, { id: 'meal-x1', name: 'Pre-workout' }];
  s.plan = s.plan.map(() => ({ lunch: [], breakfast: [], 'meal-x1': [] }));
  s.plan[2] = { lunch: [{ foodId: 'rice', servings: 1.5 }, { foodId: 'custom-abc', servings: 0.25 }], breakfast: [], 'meal-x1': [{ foodId: 'egg', servings: 2 }] };
  s.schedule[4] = [{ exerciseId: 'customex-abc', minutes: 45 }, { exerciseId: 'walking-brisk', minutes: 30 }];
  s.moduleOrder = ['meals', 'today', 'foods'];
  s.hiddenModules = ['timeline'];
  s.shoppingDays = [0, 5];
  s.shoppingChecked = ['rice'];
  s.lastChangedAt = 1234;
  return s;
}

const ok = (json: string): ParseOk => {
  const r = parseBackup(json);
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('export and import', () => {
  it('round-trips every single setting', () => {
    const state = fullState();
    const result = ok(makeBackup(state));
    expect(result.warnings).toEqual([]);
    expect(result.state).toEqual({ ...state, lastBackupAt: null });
  });

  it('exports every key of the app state', () => {
    const exported = JSON.parse(makeBackup(fullState()));
    expect(Object.keys(exported.state).sort()).toEqual(Object.keys(defaultState()).sort());
    expect(exported.schema).toBe(SCHEMA_VERSION);
    expect(exported.state.protein).toBe(1.8);
    expect(exported.state.fat).toBe(33);
    expect(exported.state.nihEnabled).toBe(true);
  });

  it('names files by date', () => {
    expect(backupFilename(new Date(2026, 10, 7))).toBe('meal-plan-backup-2026-11-07.json');
  });

  it('summarizes what a backup holds', () => {
    expect(summarize(fullState())).toEqual({ foods: 3, exercises: 2, customFoods: 1, customExercises: 1, profile: true });
  });

  it('rejects files it cannot use, leaving nothing changed', () => {
    for (const bad of ['not json', 'null', '[]', '{}', '{"schema":7}', '{"schema":7,"state":{}}']) {
      expect(parseBackup(bad).ok).toBe(false);
    }
    expect(parseBackup(JSON.stringify({ meals: Array(7).fill({}), exercises: [1, 2, 3, 4, 5, 6, 7] })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ schema: 7, state: { plan: [1, 2, 3, 4, 5, 6, 7], schedule: Array(7).fill([]) } })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ schema: 7, state: { plan: Array(7).fill({}), schedule: [1, 2, 3, 4, 5, 6, 7] } })).ok).toBe(false);
  });

  it('refuses a backup from a newer version', () => {
    const r = parseBackup(JSON.stringify({ schema: SCHEMA_VERSION + 1, state: {} }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('newer');
  });

  it('cleans malicious or broken contents instead of trusting them', () => {
    const s = fullState() as unknown as Record<string, unknown>;
    s.protein = 99;
    s.fat = 70;
    s.customFoods = [{ id: 'custom-ok', name: '<img src=x onerror=alert(1)>', serving: '1', kcal: 1, p: 1, c: 1, f: 1 }, { id: 'egg', name: 'Fake', serving: '1', kcal: 1, p: 1, c: 1, f: 1 }, { id: 'custom-bad', name: 'No macros', serving: '1' }];
    s.yieldOverrides = JSON.parse('{"__proto__":{"yield":2,"edibleYield":1},"rice":{"yield":99}}');
    (s.schedule as unknown[][])[0] = [{ exerciseId: 'nope', minutes: 10 }, { exerciseId: 'yoga-light', minutes: 99999 }, 7];
    const fields = s.fields as Record<string, string>;
    fields.weight = '<script>';
    fields.pal = '9';
    const result = ok(makeBackup(s as unknown as AppState));
    expect(result.state.protein).toBe(2.2);
    expect(result.state.fat).toBe(40);
    expect(result.state.customFoods.map((f) => f.id)).toEqual(['custom-ok']);
    expect(result.state.yieldOverrides).toEqual({});
    expect(({} as Record<string, unknown>).yield).toBeUndefined();
    expect(result.state.schedule[0]).toEqual([{ exerciseId: 'yoga-light', minutes: 360 }]);
    expect(result.state.fields.weight).toBe('');
    expect(result.state.fields.pal).toBe('1.4');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('drops planned foods it cannot find, and says how many', () => {
    const s = fullState();
    s.plan[0] = { lunch: [{ foodId: 'gone', servings: 1 }], breakfast: [], 'meal-x1': [] };
    const result = ok(makeBackup(s));
    expect(result.state.plan[0].lunch).toEqual([]);
    expect(result.warnings.join()).toContain('Skipped 1 planned food');
  });
});

describe('v5/v6 migration', () => {
  it('keeps the frozen id table in exactly the old sort order', () => {
    const sorted = [...V6_TABLE].sort((a, b) => a[0].localeCompare(b[0]) || a[2] - b[2]);
    expect(LEGACY_EXERCISE_IDS).toHaveLength(sorted.length);
    LEGACY_EXERCISE_IDS.forEach((id, i) => {
      const def = EXERCISES.find((e) => e.id === id)!;
      expect([def.name, def.level, def.met]).toEqual(sorted[i]);
    });
  });

  function v6Export(extra: Record<string, unknown> = {}) {
    const empty = { Breakfast: {}, Lunch: {}, Dinner: {}, Snack: {} };
    const meals = Array.from({ length: 7 }, () => ({ ...empty }));
    meals[1] = { ...empty, Lunch: { rice: 6, egg: 6 }, Dinner: { potato: 3, 'custom-old': 0.5 } } as never;
    const exercises: unknown[][] = Array.from({ length: 7 }, () => []);
    exercises[0] = [{ id: 'ex31', min: 45 }, { id: 'ex21', min: 30 }];
    return JSON.stringify({
      version: 6,
      yieldOverrides: { potato: { yield: 0.85, edibleYield: 0.78 } },
      profile: { age: '32', sex: 'female', unitMode: 'us', feet: '5', inches: '6', height: '', weight: '150', bodyfat: '', goal: '135', goalBf: '', weeks: '16', focus: 'cut', pal: '1.55', credit: '0.75', nihMaint: '', nihGoal: '' },
      foods: [{ id: 'egg', name: 'Egg, large', serving: '1 large', kcal: 72, p: 6, c: 0, f: 5 }, { id: 'custom-old', name: 'Old bar', category: 'Custom', serving: '1 bar', kcal: 200, p: 10, c: 20, f: 8, weight: { g: 50, stage: 'ready' } }],
      meals,
      exercises,
      dayNames: [],
      notes: '',
      ...extra,
    });
  }

  it('imports an old export with exercises pointing at the right workouts', () => {
    const { state } = ok(v6Export());
    expect(state.schedule[0]).toEqual([{ exerciseId: 'walking-brisk', minutes: 45 }, { exerciseId: 'running-moderate', minutes: 30 }]);
    expect(state.plan[1].lunch).toEqual([{ foodId: 'rice', servings: 6 }, { foodId: 'egg', servings: 6 }]);
    expect(state.plan[1].dinner).toEqual([{ foodId: 'potato', servings: 3 }, { foodId: 'custom-old', servings: 0.5 }]);
    expect(state.customFoods.map((f) => f.name)).toEqual(['Old bar']);
    expect(state.fields.weight).toBe('150');
    expect(state.fields.pal).toBe('1.55');
    expect(state.yieldOverrides.potato.yield).toBe(0.85);
  });

  it('warns that an unpatched v6 export lacks macro and NIH settings', () => {
    const { state, warnings } = ok(v6Export());
    expect(state.protein).toBe(2.2);
    expect(state.fat).toBe(27);
    expect(warnings.join()).toContain("didn't include: protein, fat, NIH toggle");
  });

  it('reads those settings from the patched v6 export', () => {
    const { state, warnings } = ok(v6Export({ protein: 1.8, fat: 33, nihSwitch: true, units: 'us' }));
    expect(state.protein).toBe(1.8);
    expect(state.fat).toBe(33);
    expect(state.nihEnabled).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('survives an out-of-range fat value saved by the old carb slider', () => {
    expect(ok(v6Export({ protein: 2, fat: 69.6, nihSwitch: false })).state.fat).toBe(40);
  });

  it('skips exercise positions past the end of the old list and says so', () => {
    const raw = JSON.parse(v6Export());
    raw.exercises[0] = [{ id: 'ex99', min: 30 }];
    const { state, warnings } = ok(JSON.stringify(raw));
    expect(state.schedule[0]).toEqual([]);
    expect(warnings.join()).toContain('Skipped 1 scheduled exercise');
  });
});

describe('backup reminders', () => {
  const day = 86400000;
  it('stays quiet until there are unsaved changes that are several days old', () => {
    const now = 100 * day;
    expect(needsBackup(null, null, now)).toBe(false);
    expect(needsBackup(null, now - day, now)).toBe(false);
    expect(needsBackup(null, now - 6 * day, now)).toBe(true);
    expect(needsBackup(now - 2 * day, now - 3 * day, now)).toBe(false);
    expect(needsBackup(now - 6 * day, now - day, now)).toBe(true);
    expect(needsBackup(now - 2 * day, now - day, now)).toBe(false);
  });
});
