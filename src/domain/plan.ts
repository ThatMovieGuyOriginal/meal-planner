import { clamp } from './format';
import type { DayPlan, Food, MealSlot, PlanItem, Recipe, Totals } from './types';

const MAX_SERVINGS = 100;
const roundQuarter = (n: number) => Math.round(n * 4) / 4;

export function emptyDay(slots: MealSlot[]): DayPlan {
  return Object.fromEntries(slots.map((s) => [s.id, []]));
}

function withMeal(plan: DayPlan[], day: number, mealId: string, items: PlanItem[]): DayPlan[] {
  return plan.map((d, i) => (i === day ? { ...d, [mealId]: items } : d));
}

export function addServings(plan: DayPlan[], day: number, mealId: string, foodId: string, amount: number): DayPlan[] {
  const items = plan[day][mealId] ?? [];
  const existing = items.find((x) => x.foodId === foodId);
  if (!(amount > 0)) return plan;
  // Tiny amounts round up to the smallest step instead of silently doing nothing.
  const add = Math.max(0.25, roundQuarter(amount));
  if (existing) {
    const servings = clamp(roundQuarter(existing.servings + add), 0.25, MAX_SERVINGS);
    return withMeal(plan, day, mealId, items.map((x) => (x === existing ? { ...x, servings } : x)));
  }
  return withMeal(plan, day, mealId, [...items, { foodId, servings: clamp(add, 0.25, MAX_SERVINGS) }]);
}

export function setServings(plan: DayPlan[], day: number, mealId: string, foodId: string, amount: number): DayPlan[] {
  const items = plan[day][mealId] ?? [];
  if (!(amount > 0)) return withMeal(plan, day, mealId, items.filter((x) => x.foodId !== foodId));
  const servings = clamp(roundQuarter(amount), 0.25, MAX_SERVINGS);
  return withMeal(plan, day, mealId, items.map((x) => (x.foodId === foodId ? { ...x, servings } : x)));
}

export function removeServings(plan: DayPlan[], day: number, mealId: string, foodId: string, amount: number): DayPlan[] {
  const item = (plan[day][mealId] ?? []).find((x) => x.foodId === foodId);
  if (!item) return plan;
  return setServings(plan, day, mealId, foodId, roundQuarter(item.servings - amount));
}

/** The amount a "move one serving" actually moves: never more than what is there. */
export function moveAmount(servings: number): number {
  return Math.min(1, servings);
}

/** Moves up to one serving between meals. Total food in the plan never changes. */
export function moveOneServing(plan: DayPlan[], fromDay: number, fromMeal: string, toDay: number, toMeal: string, foodId: string): DayPlan[] {
  const item = (plan[fromDay][fromMeal] ?? []).find((x) => x.foodId === foodId);
  if (!item || (fromDay === toDay && fromMeal === toMeal)) return plan;
  const amount = moveAmount(item.servings);
  return addServings(removeServings(plan, fromDay, fromMeal, foodId, amount), toDay, toMeal, foodId, amount);
}

/** Moves an item up (-1) or down (+1) within its meal. */
export function reorderItem(plan: DayPlan[], day: number, mealId: string, foodId: string, direction: -1 | 1): DayPlan[] {
  const items = plan[day][mealId] ?? [];
  const index = items.findIndex((x) => x.foodId === foodId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return plan;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return withMeal(plan, day, mealId, next);
}

export function copyMeals(plan: DayPlan[], fromDay: number, toDays: number[], mealIds: string[], replace: boolean): DayPlan[] {
  let next = plan;
  for (const day of toDays) {
    if (day === fromDay) continue;
    for (const mealId of mealIds) {
      const source = plan[fromDay][mealId] ?? [];
      if (replace) {
        next = withMeal(next, day, mealId, source.map((x) => ({ ...x })));
      } else {
        for (const item of source) next = addServings(next, day, mealId, item.foodId, item.servings);
      }
    }
  }
  return next;
}

export function totalsFor(items: PlanItem[], foods: Map<string, Food>): Totals {
  const t: Totals = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const { foodId, servings } of items) {
    const food = foods.get(foodId);
    if (!food) continue;
    t.kcal += food.kcal * servings;
    t.p += food.p * servings;
    t.c += food.c * servings;
    t.f += food.f * servings;
  }
  return t;
}

export function dayItems(day: DayPlan, slots: MealSlot[]): PlanItem[] {
  return slots.flatMap((s) => day[s.id] ?? []);
}

export interface Aggregated {
  food: Food;
  servings: number;
}

/**
 * Combines every serving of each food across the given days, alphabetical by food name.
 * Pass recipes to break them into their ingredients, as a shopping list needs.
 */
export function aggregate(plan: DayPlan[], days: number[], slots: MealSlot[], foods: Map<string, Food>, expandRecipes: Recipe[] = []): Aggregated[] {
  const sums = new Map<string, number>();
  const add = (id: string, n: number) => sums.set(id, (sums.get(id) ?? 0) + n);
  for (const day of days) {
    for (const { foodId, servings } of dayItems(plan[day], slots)) {
      const recipe = expandRecipes.find((r) => r.id === foodId);
      if (recipe) for (const i of recipe.ingredients) add(i.foodId, (i.servings * servings) / recipe.portions);
      else add(foodId, servings);
    }
  }
  const out: Aggregated[] = [];
  for (const [id, servings] of sums) {
    const food = foods.get(id);
    if (food) out.push({ food, servings });
  }
  return out.sort((a, b) => a.food.name.localeCompare(b.food.name, 'en', { sensitivity: 'base', numeric: true }));
}

export function countFoodUses(plan: DayPlan[], foodId: string): number {
  return plan.reduce((n, day) => n + Object.values(day).reduce((m, items) => m + items.filter((x) => x.foodId === foodId).length, 0), 0);
}

export function removeFoodEverywhere(plan: DayPlan[], foodId: string): DayPlan[] {
  return plan.map((day) => Object.fromEntries(Object.entries(day).map(([k, items]) => [k, items.filter((x) => x.foodId !== foodId)])));
}
