import { compareNames, gw, servingsText } from './format';
import { RECIPE_CATEGORY, allFoods, foodLookup, foodWeight } from './foods';
import { totalsFor } from './plan';
import type { AmountUnit, Food, PlanItem, Recipe, RecipeIngredient, Totals, YieldOverride } from './types';

export { RECIPE_CATEGORY };
export const MAX_PORTIONS = 100;
export const MAX_INGREDIENT_SERVINGS = 1000;
export const MAX_COOKED_WEIGHT = 100000;

export const isRecipeId = (id: string) => id.startsWith('recipe-');
/** Ingredient amounts keep three decimals, so 450 g of a 100 g food stays exactly 4.5 servings. */
export const roundAmount = (n: number) => Math.round(n * 1000) / 1000;

export function recipeTotals(recipe: Recipe, baseFoods: Map<string, Food>): Totals {
  return totalsFor(recipe.ingredients, baseFoods);
}

export function portionWeight(recipe: Recipe): number {
  return recipe.cookedWeight && recipe.cookedWeight > 0 ? recipe.cookedWeight / recipe.portions : 0;
}

export function portionServing(recipe: Recipe): string {
  const g = portionWeight(recipe);
  if (recipe.portions === 1) return g ? `Whole recipe (${gw(g)} g)` : 'Whole recipe';
  const share = `1/${recipe.portions} of recipe`;
  return g ? `1 portion (${gw(g)} g, ${share})` : `1 portion (${share})`;
}

/**
 * The food a recipe appears as everywhere else. Nutrition is worked out from the ingredients
 * each time, so editing an ingredient or a custom food updates every plan that uses it.
 */
export function recipeFood(recipe: Recipe, baseFoods: Map<string, Food>): Food {
  const t = recipeTotals(recipe, baseFoods);
  const n = recipe.portions;
  const g = portionWeight(recipe);
  return {
    id: recipe.id,
    name: recipe.name,
    category: RECIPE_CATEGORY,
    serving: portionServing(recipe),
    kcal: t.kcal / n,
    p: t.p / n,
    c: t.c / n,
    f: t.f / n,
    recipe: true,
    ...(g ? { weight: { g, stage: 'ready' as const, label: 'Finished dish' } } : {}),
  };
}

/** Every food by id, recipes included. */
export function foodLookupWithRecipes(customFoods: Food[], recipes: Recipe[]): Map<string, Food> {
  const map = foodLookup(customFoods);
  const base = new Map(map);
  for (const r of recipes) map.set(r.id, recipeFood(r, base));
  return map;
}

/** Every food alphabetically, recipes included, for pickers and the library. */
/** Every food she can plan: her recipes first, then single foods, each alphabetical. */
export function allFoodsWithRecipes(customFoods: Food[], foodMap: Map<string, Food>, recipes: Recipe[]): Food[] {
  const recipeFoods = sortRecipes(recipes).map((r) => foodMap.get(r.id)).filter((f): f is Food => !!f);
  return [...recipeFoods, ...allFoods(customFoods)];
}

export interface FoodGroup { title: 'Recipes' | 'Foods'; foods: Food[] }

/** Splits a list into recipes and single foods, recipes first, leaving out an empty group. */
export function groupFoods(foods: Food[]): FoodGroup[] {
  const groups: FoodGroup[] = [
    { title: 'Recipes', foods: foods.filter((f) => f.recipe) },
    { title: 'Foods', foods: foods.filter((f) => !f.recipe) },
  ];
  return groups.filter((g) => g.foods.length > 0);
}

export function sortRecipes(recipes: Recipe[]): Recipe[] {
  return [...recipes].sort((a, b) => compareNames(a.name, b.name));
}

/** The ways an amount of this food can be entered: servings always, grams and raw grams when known. */
export function unitsFor(food: Food, overrides: Record<string, YieldOverride> = {}): AmountUnit[] {
  const w = foodWeight(food, overrides);
  const units: AmountUnit[] = ['servings'];
  if (w.g && w.g > 0) units.push('g');
  if (w.stage === 'cooked' && (w.unit ?? 'g') === 'g' && w.yield && w.yield > 0) units.push('raw');
  return units;
}

export function unitLabel(food: Food, unit: AmountUnit, overrides: Record<string, YieldOverride> = {}): string {
  if (unit === 'servings') return 'Servings';
  if (unit === 'raw') return 'Grams raw';
  const w = foodWeight(food, overrides);
  if (w.unit === 'ml') return 'Millilitres';
  return w.stage === 'cooked' ? 'Grams cooked' : w.stage === 'dry' ? 'Grams dry' : 'Grams';
}

/** Grams of cooked edible food per gram of raw food entered. */
function rawFactor(food: Food, overrides: Record<string, YieldOverride>): number {
  const w = foodWeight(food, overrides);
  return (w.yield ?? 0) * (w.edibleYield && w.edibleYield > 0 ? w.edibleYield : 1);
}

/** Converts an amount in the chosen unit to servings. Returns 0 if the unit doesn't apply. */
export function toServings(food: Food, amount: number, unit: AmountUnit, overrides: Record<string, YieldOverride> = {}): number {
  if (!(amount > 0)) return 0;
  if (unit === 'servings') return amount;
  const g = foodWeight(food, overrides).g ?? 0;
  if (!(g > 0)) return 0;
  return unit === 'raw' ? (amount * rawFactor(food, overrides)) / g : amount / g;
}

/** The inverse of toServings, for showing a saved amount in the unit it was entered in. */
export function fromServings(food: Food, servings: number, unit: AmountUnit, overrides: Record<string, YieldOverride> = {}): number {
  if (unit === 'servings') return servings;
  const g = foodWeight(food, overrides).g ?? 0;
  if (!(g > 0)) return 0;
  if (unit === 'raw') {
    const factor = rawFactor(food, overrides);
    return factor > 0 ? (servings * g) / factor : 0;
  }
  return servings * g;
}

/** Ingredient amounts for some number of portions of the recipe. */
export function scaleIngredients(recipe: Recipe, portions: number): RecipeIngredient[] {
  return recipe.ingredients.map((i) => ({ ...i, servings: (i.servings * portions) / recipe.portions }));
}

/**
 * The listed weights added up: cooked weights for cooked foods, dry for dry, and so on. Only
 * reported when every ingredient has a gram weight, because otherwise it would be misleading.
 */
export function listedWeight(ingredients: RecipeIngredient[], baseFoods: Map<string, Food>, overrides: Record<string, YieldOverride> = {}): number {
  let total = 0;
  for (const i of ingredients) {
    const food = baseFoods.get(i.foodId);
    if (!food) continue;
    const w = foodWeight(food, overrides);
    if (!(w.g && w.g > 0) || w.unit === 'ml') return 0;
    total += w.g * i.servings;
  }
  return total;
}

/** Adds an ingredient, merging with the same food if it's already there. */
export function addIngredient(ingredients: RecipeIngredient[], next: RecipeIngredient): RecipeIngredient[] {
  const existing = ingredients.find((i) => i.foodId === next.foodId);
  if (!existing) return [...ingredients, next];
  const servings = Math.min(MAX_INGREDIENT_SERVINGS, roundAmount(existing.servings + next.servings));
  return ingredients.map((i) => (i === existing ? { ...next, servings } : i));
}

/**
 * Turns planned foods into recipe ingredients. A recipe already in the meal is broken back
 * into its own ingredients, since recipes can't contain other recipes.
 */
export function ingredientsFromItems(items: PlanItem[], recipes: Recipe[], baseFoods: Map<string, Food>): RecipeIngredient[] {
  let out: RecipeIngredient[] = [];
  for (const item of items) {
    const recipe = recipes.find((r) => r.id === item.foodId);
    const parts = recipe ? scaleIngredients(recipe, item.servings) : [{ foodId: item.foodId, servings: item.servings }];
    for (const part of parts) {
      if (baseFoods.has(part.foodId)) out = addIngredient(out, { foodId: part.foodId, servings: roundAmount(part.servings), ...(part.unit ? { unit: part.unit } : {}) });
    }
  }
  return out;
}

export function countRecipesUsing(recipes: Recipe[], foodId: string): number {
  return recipes.filter((r) => r.ingredients.some((i) => i.foodId === foodId)).length;
}

export function removeIngredientEverywhere(recipes: Recipe[], foodId: string): Recipe[] {
  return recipes.map((r) => (r.ingredients.some((i) => i.foodId === foodId) ? { ...r, ingredients: r.ingredients.filter((i) => i.foodId !== foodId) } : r));
}

/** An ingredient amount as she entered it, such as "450 g raw" or "2 × 1 large (50 g)". */
export function amountText(food: Food, ingredient: RecipeIngredient, overrides: Record<string, YieldOverride> = {}): string {
  const unit = ingredient.unit && unitsFor(food, overrides).includes(ingredient.unit) ? ingredient.unit : 'servings';
  if (unit === 'servings') return `${servingsText(ingredient.servings)} × ${food.serving}`;
  const value = gw(fromServings(food, ingredient.servings, unit, overrides));
  if (unit === 'raw') return `${value} g raw`;
  const w = foodWeight(food, overrides);
  if (w.unit === 'ml') return `${value} ml`;
  return `${value} g${w.stage === 'cooked' ? ' cooked' : w.stage === 'dry' ? ' dry' : ''}`;
}
