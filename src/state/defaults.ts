import { DAY_COUNT, SCHEMA_VERSION, type AppState, type Fields, type MealSlot } from '../domain/types';
import { emptyDay } from '../domain/plan';

export const DEFAULT_MEAL_SLOTS: MealSlot[] = [
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'dinner', name: 'Dinner' },
  { id: 'snack', name: 'Snack' },
];

export const DEFAULT_FIELDS: Fields = {
  age: '', sex: '', unitMode: 'us', feet: '', inches: '', height: '', weight: '', bodyfat: '', goal: '', goalBf: '',
  weeks: '16', focus: 'cut', pal: '1.4', credit: '0.75', nihMaint: '', nihGoal: '', neck: '', waist: '', hip: '',
};

export function defaultState(): AppState {
  return {
    schema: SCHEMA_VERSION,
    fields: { ...DEFAULT_FIELDS },
    nihEnabled: false,
    protein: 2.2,
    fat: 27,
    customFoods: [],
    recipes: [],
    customExercises: [],
    yieldOverrides: {},
    mealSlots: DEFAULT_MEAL_SLOTS.map((s) => ({ ...s })),
    plan: Array.from({ length: DAY_COUNT }, () => emptyDay(DEFAULT_MEAL_SLOTS)),
    schedule: Array.from({ length: DAY_COUNT }, () => []),
    moduleOrder: [],
    hiddenModules: [],
    shoppingDays: [0, 1, 2, 3, 4, 5, 6],
    shoppingChecked: [],
    lastBackupAt: null,
    lastChangedAt: null,
  };
}
