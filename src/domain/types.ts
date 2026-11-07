export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const DAY_COUNT = DAYS.length;
export const SCHEMA_VERSION = 7;

export type Stage = 'ready' | 'dry' | 'cooked';

export interface FoodWeight {
  g: number;
  unit?: 'g' | 'ml';
  stage: Stage;
  label?: string;
  /** Cooked weight divided by starting raw/dry weight. Absent when the yield is unknown. */
  yield?: number;
  /** Edible share of the cooked food, for items such as a potato baked in its skin. */
  edibleYield?: number;
  rawLabel?: string;
  alternativeRaw?: string;
  method?: string;
  source?: string;
}

export interface Food {
  id: string;
  name: string;
  category: string;
  serving: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  weight?: FoodWeight;
  custom?: boolean;
}

export interface ExerciseDef {
  id: string;
  name: string;
  level: string;
  met: number;
  custom?: boolean;
}

export interface MealSlot {
  id: string;
  name: string;
}

export interface PlanItem {
  foodId: string;
  servings: number;
}

/** Items per meal slot id, in the order she arranged them. */
export type DayPlan = Record<string, PlanItem[]>;

export interface ScheduleEntry {
  exerciseId: string;
  minutes: number;
}

export type Focus = 'cut' | 'recomp' | 'gain';
export type UnitMode = 'us' | 'metric';

/** Form values stay as strings so a blank field stays blank instead of turning into 0. */
export interface Fields {
  age: string;
  sex: string;
  unitMode: UnitMode;
  feet: string;
  inches: string;
  height: string;
  weight: string;
  bodyfat: string;
  goal: string;
  goalBf: string;
  weeks: string;
  focus: Focus;
  pal: string;
  credit: string;
  nihMaint: string;
  nihGoal: string;
  neck: string;
  waist: string;
  hip: string;
}

export interface YieldOverride {
  yield: number;
  edibleYield: number;
}

export interface AppState {
  schema: number;
  fields: Fields;
  nihEnabled: boolean;
  /** Protein in g per kg of body weight. */
  protein: number;
  /** Fat as a percentage of the day's calories. */
  fat: number;
  customFoods: Food[];
  customExercises: ExerciseDef[];
  yieldOverrides: Record<string, YieldOverride>;
  mealSlots: MealSlot[];
  plan: DayPlan[];
  schedule: ScheduleEntry[][];
  moduleOrder: string[];
  hiddenModules: string[];
  shoppingDays: number[];
  shoppingChecked: string[];
  lastBackupAt: number | null;
  lastChangedAt: number | null;
}

export interface Notice {
  level: 'warn' | 'info';
  text: string;
}

export interface Totals {
  kcal: number;
  p: number;
  c: number;
  f: number;
}
