import { LEGACY_EXERCISE_IDS, EXERCISES } from '../domain/exercises';
import { isBuiltInFood } from '../domain/foods';
import { clamp } from '../domain/format';
import { FAT_MAX, FAT_MIN } from '../domain/calc';
import { MAX_COOKED_WEIGHT, MAX_INGREDIENT_SERVINGS, MAX_PORTIONS, roundAmount } from '../domain/recipes';
import { DAY_COUNT, SCHEMA_VERSION, type AppState, type DayPlan, type ExerciseDef, type Fields, type Food, type FoodWeight, type MealSlot, type PlanItem, type Recipe, type RecipeIngredient, type ScheduleEntry, type YieldOverride } from '../domain/types';
import { DEFAULT_FIELDS, DEFAULT_MEAL_SLOTS, defaultState } from './defaults';

export const APP_ID = 'body-composition-meal-planner';
export const MAX_BACKUP_BYTES = 2_000_000;

type Raw = Record<string, unknown>;
const isObject = (x: unknown): x is Raw => typeof x === 'object' && x !== null && !Array.isArray(x);
const text = (x: unknown, max = 200) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
const finite = (x: unknown): number | null => {
  if (typeof x === 'string' && x.trim() === '') return null;
  const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x) : NaN;
  return Number.isFinite(n) ? n : null;
};
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface ParseOk { ok: true; state: AppState; warnings: string[]; }
export interface ParseError { ok: false; error: string; }
export type ParseResult = ParseOk | ParseError;

/** Every setting she can change, so an export restores the app exactly. */
export function makeBackup(state: AppState, now = new Date()): string {
  return JSON.stringify({ app: APP_ID, schema: SCHEMA_VERSION, exportedAt: now.toISOString(), state: { ...state, lastBackupAt: null } }, null, 2);
}

export function backupFilename(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `meal-plan-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

const SELECTS: Partial<Record<keyof Fields, string[]>> = {
  sex: ['', 'male', 'female'],
  unitMode: ['us', 'metric'],
  focus: ['cut', 'recomp', 'gain'],
  pal: ['1.4', '1.55', '1.7', '1.9'],
  credit: ['0.5', '0.75', '1'],
};

function sanitizeFields(raw: unknown, warnings: string[]): Fields {
  const out: Fields = { ...DEFAULT_FIELDS };
  if (!isObject(raw)) return out;
  for (const key of Object.keys(DEFAULT_FIELDS) as (keyof Fields)[]) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    const options = SELECTS[key];
    if (options) {
      // Tolerates "1.40" or "1.0" style values from hand-edited files.
      const match = options.find((o) => o === str || (o !== '' && Number(o) === Number(str)));
      if (match !== undefined) (out as unknown as Record<string, string>)[key] = match;
      else warnings.push(`Ignored an unrecognised value for "${key}".`);
    } else if (str === '' || Number.isFinite(Number(str))) {
      (out as unknown as Record<string, string>)[key] = str;
    } else {
      warnings.push(`Ignored a non-numeric value for "${key}".`);
    }
  }
  return out;
}

function sanitizeWeight(raw: unknown): FoodWeight | undefined {
  if (!isObject(raw)) return undefined;
  const g = finite(raw.g);
  if (g === null || g <= 0 || g > 100000) return undefined;
  const stage = raw.stage === 'dry' || raw.stage === 'cooked' ? raw.stage : 'ready';
  const out: FoodWeight = { g, stage };
  if (raw.unit === 'ml') out.unit = 'ml';
  const y = finite(raw.yield);
  if (y !== null && y >= 0.1 && y <= 5) out.yield = y;
  const e = finite(raw.edibleYield);
  if (e !== null && e >= 0.1 && e <= 1) out.edibleYield = e;
  for (const key of ['label', 'rawLabel', 'alternativeRaw', 'method', 'source'] as const) {
    const s = text(raw[key]);
    if (s) out[key] = s;
  }
  return out;
}

function sanitizeFood(raw: unknown): Food | null {
  if (!isObject(raw)) return null;
  const id = text(raw.id, 80);
  const name = text(raw.name, 120);
  const serving = text(raw.serving, 120);
  if (!id.startsWith('custom-') || !SAFE_ID.test(id) || !name || !serving) return null;
  const nums = [raw.kcal, raw.p, raw.c, raw.f].map(finite);
  if (nums.some((n) => n === null || n < 0 || n > 100000)) return null;
  const [kcal, p, c, f] = nums as number[];
  const food: Food = { id, name, category: text(raw.category, 40) || 'Custom', serving, kcal, p, c, f, custom: true };
  const weight = sanitizeWeight(raw.weight);
  if (weight) food.weight = weight;
  return food;
}

/** Ingredients must be plain foods that exist. A recipe left with none is kept, since plans may use it. */
function sanitizeRecipe(raw: unknown, isBaseFood: (id: string) => boolean, dropped: { ingredients: number }): Recipe | null {
  if (!isObject(raw)) return null;
  const id = text(raw.id, 80);
  const name = text(raw.name, 120);
  const portions = finite(raw.portions);
  if (!id.startsWith('recipe-') || !SAFE_ID.test(id) || !name || portions === null) return null;
  const ingredients: RecipeIngredient[] = [];
  for (const entry of Array.isArray(raw.ingredients) ? raw.ingredients : []) {
    if (!isObject(entry)) continue;
    const foodId = text(entry.foodId, 80);
    const servings = finite(entry.servings);
    if (servings === null || servings <= 0) continue;
    if (!isBaseFood(foodId)) { dropped.ingredients++; continue; }
    const amount = clamp(roundAmount(servings), 0.001, MAX_INGREDIENT_SERVINGS);
    const same = ingredients.find((i) => i.foodId === foodId);
    if (same) { same.servings = Math.min(MAX_INGREDIENT_SERVINGS, roundAmount(same.servings + amount)); continue; }
    const item: RecipeIngredient = { foodId, servings: amount };
    if (entry.unit === 'g' || entry.unit === 'raw') item.unit = entry.unit;
    ingredients.push(item);
  }
  const recipe: Recipe = { id, name, portions: clamp(Math.round(portions), 1, MAX_PORTIONS), ingredients };
  const weight = finite(raw.cookedWeight);
  if (weight !== null && weight > 0 && weight <= MAX_COOKED_WEIGHT) recipe.cookedWeight = weight;
  return recipe;
}

function sanitizeExercise(raw: unknown): ExerciseDef | null {
  if (!isObject(raw)) return null;
  const id = text(raw.id, 80);
  const name = text(raw.name, 120);
  const met = finite(raw.met);
  if (!id.startsWith('customex-') || !SAFE_ID.test(id) || !name || met === null || met < 1 || met > 25) return null;
  return { id, name, level: text(raw.level, 40) || 'Moderate', met, custom: true };
}

function sanitizeSlots(raw: unknown): MealSlot[] {
  if (!Array.isArray(raw)) return DEFAULT_MEAL_SLOTS.map((s) => ({ ...s }));
  const seen = new Set<string>();
  const slots: MealSlot[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const id = text(entry.id, 64);
    const name = text(entry.name, 40);
    if (SAFE_ID.test(id) && name && !seen.has(id)) {
      seen.add(id);
      slots.push({ id, name });
    }
  }
  return slots.length ? slots : DEFAULT_MEAL_SLOTS.map((s) => ({ ...s }));
}

function sanitizeItems(raw: unknown, knownFoods: { has(id: string): boolean }, dropped: { foods: number }): PlanItem[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<string, number>();
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const foodId = text(entry.foodId, 80);
    const servings = finite(entry.servings);
    if (servings === null || servings <= 0 || servings > 100) continue;
    if (!knownFoods.has(foodId)) { dropped.foods++; continue; }
    merged.set(foodId, Math.min(100, (merged.get(foodId) ?? 0) + servings));
  }
  return [...merged].map(([foodId, servings]) => ({ foodId, servings }));
}

function sanitizeSchedule(raw: unknown, knownExercises: Set<string>, dropped: { exercises: number }): ScheduleEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ScheduleEntry[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const exerciseId = text(entry.exerciseId, 80);
    const minutes = finite(entry.minutes);
    if (minutes === null || minutes <= 0) continue;
    if (!knownExercises.has(exerciseId)) { dropped.exercises++; continue; }
    out.push({ exerciseId, minutes: clamp(minutes, 1, 360) });
  }
  return out;
}

function sanitizeOverrides(raw: unknown, knownFoods: { has(id: string): boolean }): Record<string, YieldOverride> {
  const out: Record<string, YieldOverride> = {};
  if (!isObject(raw)) return out;
  for (const [id, value] of Object.entries(raw)) {
    if (!knownFoods.has(id) || !isObject(value)) continue;
    const y = finite(value.yield);
    const e = finite(value.edibleYield);
    if (y !== null && y >= 0.1 && y <= 5) out[id] = { yield: y, edibleYield: e !== null && e >= 0.1 && e <= 1 ? e : 1 };
  }
  return out;
}

const stringList = (raw: unknown, max = 64) => (Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string' && x.length <= max))] : []);

/** Rebuilds a complete, safe state from untrusted data. Assumes `plan` and `schedule` are 7-long arrays. */
export function sanitizeState(raw: Raw, warnings: string[]): AppState {
  const base = defaultState();
  const customFoods = Array.isArray(raw.customFoods) ? raw.customFoods.map(sanitizeFood).filter((x): x is Food => !!x) : [];
  const customExercises = Array.isArray(raw.customExercises) ? raw.customExercises.map(sanitizeExercise).filter((x): x is ExerciseDef => !!x) : [];
  const customIds = new Set(customFoods.map((f) => f.id));
  const isBaseFood = (id: string) => customIds.has(id) || isBuiltInFood(id);
  const droppedIngredients = { ingredients: 0 };
  const recipes: Recipe[] = [];
  for (const entry of Array.isArray(raw.recipes) ? raw.recipes : []) {
    const recipe = sanitizeRecipe(entry, isBaseFood, droppedIngredients);
    if (recipe && !recipes.some((r) => r.id === recipe.id)) recipes.push(recipe);
  }
  const skipped = droppedIngredients.ingredients;
  if (skipped) warnings.push(`Skipped ${skipped} recipe ingredient${skipped === 1 ? '' : 's'} that aren't in the food list.`);
  const recipeIds = new Set(recipes.map((r) => r.id));
  const isKnownFood = { has: (id: string) => isBaseFood(id) || recipeIds.has(id) };
  const knownExercises = new Set([...EXERCISES.map((e) => e.id), ...customExercises.map((e) => e.id)]);
  const mealSlots = sanitizeSlots(raw.mealSlots);
  const dropped = { foods: 0, exercises: 0 };
  const plan: DayPlan[] = (raw.plan as unknown[]).map((day) => {
    const source = isObject(day) ? day : {};
    return Object.fromEntries(mealSlots.map((s) => [s.id, sanitizeItems(Object.prototype.hasOwnProperty.call(source, s.id) ? source[s.id] : [], isKnownFood, dropped)]));
  });
  const schedule = (raw.schedule as unknown[]).map((d) => sanitizeSchedule(d, knownExercises, dropped));
  if (dropped.foods) warnings.push(`Skipped ${dropped.foods} planned food${dropped.foods === 1 ? '' : 's'} that aren't in the food list.`);
  if (dropped.exercises) warnings.push(`Skipped ${dropped.exercises} scheduled exercise${dropped.exercises === 1 ? '' : 's'} that aren't in the exercise list.`);
  const protein = finite(raw.protein);
  const fat = finite(raw.fat);
  const days = Array.isArray(raw.shoppingDays) ? raw.shoppingDays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d < DAY_COUNT) : base.shoppingDays;
  return {
    ...base,
    fields: sanitizeFields(raw.fields, warnings),
    nihEnabled: raw.nihEnabled === true,
    protein: protein !== null ? clamp(Math.round(protein * 10) / 10, 1.6, 2.2) : base.protein,
    fat: fat !== null ? clamp(fat, FAT_MIN, FAT_MAX) : base.fat,
    customFoods,
    customExercises,
    recipes,
    yieldOverrides: sanitizeOverrides(raw.yieldOverrides, { has: isBaseFood }),
    mealSlots,
    plan,
    schedule,
    moduleOrder: stringList(raw.moduleOrder),
    hiddenModules: stringList(raw.hiddenModules),
    shoppingDays: [...new Set(days)].sort((a, b) => a - b),
    shoppingChecked: stringList(raw.shoppingChecked, 80),
    lastBackupAt: finite(raw.lastBackupAt),
    lastChangedAt: finite(raw.lastChangedAt),
  };
}

const validShape = (raw: Raw) =>
  Array.isArray(raw.plan) && raw.plan.length === DAY_COUNT && raw.plan.every(isObject) &&
  Array.isArray(raw.schedule) && raw.schedule.length === DAY_COUNT && raw.schedule.every(Array.isArray);

const LEGACY_MEALS = DEFAULT_MEAL_SLOTS.map((s) => s.name);

/** Converts a v5/v6 export, or the raw v5/v6 localStorage value, to the current shape. */
export function convertLegacy(raw: Raw, warnings: string[]): Raw | null {
  if (!Array.isArray(raw.meals) || raw.meals.length !== DAY_COUNT || !Array.isArray(raw.exercises) || raw.exercises.length !== DAY_COUNT) return null;
  if (!raw.meals.every(isObject) || !raw.exercises.every(Array.isArray)) return null;
  const plan = (raw.meals as Raw[]).map((day) =>
    Object.fromEntries(DEFAULT_MEAL_SLOTS.map((slot, i) => {
      const meal = day[LEGACY_MEALS[i]];
      const items = isObject(meal) ? Object.entries(meal).map(([foodId, servings]) => ({ foodId, servings })) : [];
      return [slot.id, items];
    })),
  );
  const schedule = (raw.exercises as unknown[][]).map((day) =>
    day.map((entry) => {
      if (!isObject(entry) || typeof entry.id !== 'string') return null;
      const match = /^ex(\d+)$/.exec(entry.id);
      const exerciseId = match ? LEGACY_EXERCISE_IDS[Number(match[1])] ?? entry.id : entry.id;
      return { exerciseId, minutes: entry.min };
    }),
  );
  const fields = isObject(raw.profile) ? raw.profile : isObject(raw.fields) ? raw.fields : {};
  const merged: Raw = { ...fields };
  if (raw.units === 'us' || raw.units === 'metric') merged.unitMode = raw.units;
  const missing = [
    raw.protein === undefined && 'protein',
    raw.fat === undefined && 'fat',
    raw.nihSwitch === undefined && 'NIH toggle',
  ].filter(Boolean);
  if (missing.length) warnings.push(`This older file didn't include: ${missing.join(', ')}. Defaults were used, so check them on the Targets screen.`);
  return {
    fields: merged,
    protein: raw.protein,
    fat: raw.fat,
    nihEnabled: raw.nihSwitch === true,
    customFoods: raw.foods,
    yieldOverrides: raw.yieldOverrides,
    plan,
    schedule,
  };
}

/** Validates everything before returning, so a bad file can never leave the app half-changed. */
export function parseBackup(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "That isn't a readable backup file. Make sure it's the .json file exported from this app." };
  }
  if (!isObject(raw)) return { ok: false, error: "That file doesn't look like a meal plan backup." };
  const warnings: string[] = [];
  let body: Raw | null = null;
  if (typeof raw.schema === 'number') {
    if (raw.schema > SCHEMA_VERSION) return { ok: false, error: 'This backup came from a newer version of the app. Reload the app and try again.' };
    if (isObject(raw.state)) body = raw.state;
  } else {
    body = convertLegacy(raw, warnings);
  }
  if (!body || !validShape(body)) return { ok: false, error: "That file doesn't look like a complete meal plan backup, so nothing was changed." };
  return { ok: true, state: sanitizeState(body, warnings), warnings };
}

export interface BackupSummary { foods: number; exercises: number; customFoods: number; customExercises: number; recipes: number; profile: boolean; }

export function summarize(state: AppState): BackupSummary {
  return {
    foods: state.plan.reduce((n, day) => n + Object.values(day).reduce((m, items) => m + items.length, 0), 0),
    exercises: state.schedule.reduce((n, d) => n + d.length, 0),
    customFoods: state.customFoods.length,
    customExercises: state.customExercises.length,
    recipes: state.recipes.length,
    profile: !!(state.fields.age && state.fields.sex && state.fields.weight),
  };
}

const DAY_MS = 86400000;
/** Safari can clear site data after 7 days without a visit, so nudge well before that. */
const NUDGE_AFTER_DAYS = 5;

export function needsBackup(lastBackupAt: number | null, lastChangedAt: number | null, now = Date.now()): boolean {
  if (!lastChangedAt) return false;
  if (lastBackupAt !== null && lastChangedAt <= lastBackupAt) return false;
  const since = lastBackupAt ?? lastChangedAt;
  return now - since >= NUDGE_AFTER_DAYS * DAY_MS;
}
