import type { Food, FoodWeight, YieldOverride } from './types';
import { compareNames } from './format';

type Row = [string, string, string, string, number, number, number, number, FoodWeight];

/**
 * Amounts per reference serving, approximate (USDA FoodData Central reference values).
 * Columns: id, name, category, serving, kcal, protein, carbs, fat, measurable quantity.
 * Ids are stored in saved plans and backups, so never rename one.
 *
 * Raw input conversions are prep estimates, not a second set of raw nutrient macros.
 * For cooked foods, yield = cooked weight / starting raw weight. Sweet potatoes baked in
 * skin have two documented USDA steps: 78% cooking yield, then 78% edible flesh recovered
 * after baking if the skin is discarded (AH-102 items 2499, 2512).
 */
const ROWS: Row[] = [
  ['egg', 'Egg, large', 'Protein', '1 large (50 g)', 72, 6.3, 0.4, 4.8, { g: 50, stage: 'ready', label: 'Edible egg (shell excluded)' }],
  ['white', 'Egg whites', 'Protein', '100 g', 52, 11, 0.7, 0.2, { g: 100, stage: 'ready', label: 'Egg whites' }],
  ['chicken', 'Chicken breast, skinless roasted', 'Protein', '100 g cooked', 165, 31, 0, 3.6, { g: 100, stage: 'cooked', yield: 0.72, rawLabel: 'raw boneless, skinless chicken' }],
  ['thigh', 'Chicken thigh, skinless roasted', 'Protein', '100 g cooked', 209, 26, 0, 10.9, { g: 100, stage: 'cooked', yield: 0.75, rawLabel: 'raw boneless, skinless thigh' }],
  ['porkchop', 'Pork chop, boneless', 'Protein', '100 g cooked', 196, 29.4, 0, 7.9, { g: 100, stage: 'cooked', yield: 0.75, rawLabel: 'raw boneless pork' }],
  ['tenderloin', 'Pork tenderloin', 'Protein', '100 g cooked', 143, 26, 0, 3.5, { g: 100, stage: 'cooked', yield: 0.75, rawLabel: 'raw pork tenderloin' }],
  ['turkey', 'Ground turkey, 93% lean', 'Protein', '100 g cooked', 213, 27.1, 0, 11.6, { g: 100, stage: 'cooked', yield: 0.7, rawLabel: 'raw ground turkey' }],
  ['beef', 'Ground beef, 90% lean', 'Protein', '100 g cooked', 217, 26, 0, 12, { g: 100, stage: 'cooked', yield: 0.8, rawLabel: 'raw ground beef' }],
  ['salmon', 'Salmon, Atlantic', 'Protein', '100 g cooked', 206, 22.1, 0, 12.4, { g: 100, stage: 'cooked', yield: 0.85, rawLabel: 'raw salmon fillet' }],
  ['tuna', 'Tuna, canned in water', 'Protein', '100 g drained', 116, 25.5, 0, 0.8, { g: 100, stage: 'ready', label: 'Drained tuna' }],
  ['tofu', 'Tofu, firm', 'Protein', '100 g', 144, 17.3, 2.8, 8.7, { g: 100, stage: 'ready' }],
  ['shake', 'Whey protein shake (water)', 'Protein', '1 scoop powder (30 g), example label', 120, 24, 3, 2, { g: 30, stage: 'dry', label: 'Dry powder; mix with water' }],
  ['yogurt', 'Greek yogurt, plain nonfat', 'Dairy', '170 g', 100, 17.3, 6.1, 0.7, { g: 170, stage: 'ready' }],
  ['cottage', 'Cottage cheese, 2%', 'Dairy', '100 g', 84, 11.1, 4.3, 2.3, { g: 100, stage: 'ready' }],
  ['milk', 'Milk, 2%', 'Dairy', '1 cup (237 ml)', 122, 8.1, 11.7, 4.8, { g: 237, unit: 'ml', stage: 'ready', label: 'Milk volume' }],
  ['rice', 'White rice, cooked', 'Grains', '100 g cooked', 130, 2.4, 28.6, 0.2, { g: 100, stage: 'cooked', yield: 2.7, rawLabel: 'dry white rice' }],
  ['brownrice', 'Brown rice, cooked', 'Grains', '100 g cooked', 123, 2.7, 25.6, 1, { g: 100, stage: 'cooked', yield: 2.6, rawLabel: 'dry brown rice' }],
  ['oats', 'Rolled oats, dry', 'Grains', '40 g dry', 150, 5.1, 27, 3, { g: 40, stage: 'dry', label: 'Dry oats before adding water' }],
  ['bread', 'Whole-wheat bread', 'Grains', '1 slice (~28 g)', 69, 3.6, 11.6, 1.1, { g: 28, stage: 'ready' }],
  ['quinoa', 'Quinoa, cooked', 'Grains', '100 g cooked', 120, 4.4, 21.3, 1.9, { g: 100, stage: 'cooked', yield: 3, rawLabel: 'dry quinoa' }],
  ['potato', 'Sweet potato, baked', 'Vegetables', '100 g cooked', 90, 2, 20.7, 0.2, { g: 100, stage: 'cooked', yield: 0.78, edibleYield: 0.78, rawLabel: 'raw whole sweet potato, skin on', alternativeRaw: 'raw peeled before baking (approx.)', method: 'bake with skin; remove skin after baking', source: 'USDA AH-102 items 2499 (baking) and 2512 (edible flesh)' }],
  ['regularpotato', 'Potato, baked', 'Vegetables', '100 g cooked', 93, 2.5, 21.2, 0.1, { g: 100, stage: 'cooked', yield: 0.85, rawLabel: 'raw potato, before baking' }],
  ['broccoli', 'Broccoli, steamed', 'Vegetables', '100 g cooked', 35, 2.4, 7.2, 0.4, { g: 100, stage: 'cooked', yield: 1, rawLabel: 'raw trimmed broccoli before steaming' }],
  ['spinach', 'Spinach, raw', 'Vegetables', '100 g', 23, 2.9, 3.6, 0.4, { g: 100, stage: 'ready' }],
  ['carrots', 'Carrots, raw', 'Vegetables', '100 g', 41, 0.9, 9.6, 0.2, { g: 100, stage: 'ready' }],
  ['banana', 'Banana', 'Fruit', '1 medium (~118 g)', 105, 1.3, 27, 0.4, { g: 118, stage: 'ready', label: 'Edible fruit; peel excluded' }],
  ['apple', 'Apple, with skin', 'Fruit', '1 medium (~182 g)', 95, 0.5, 25.1, 0.3, { g: 182, stage: 'ready', label: 'Edible apple' }],
  ['berries', 'Blueberries', 'Fruit', '100 g', 57, 0.7, 14.5, 0.3, { g: 100, stage: 'ready' }],
  ['avocado', 'Avocado', 'Fats', '100 g', 160, 2, 8.5, 14.7, { g: 100, stage: 'ready', label: 'Edible avocado, skin/pit excluded' }],
  ['olive', 'Olive oil', 'Fats', '1 tbsp (13.5 g)', 119, 0, 0, 13.5, { g: 13.5, stage: 'ready', label: 'Olive oil' }],
  ['almond', 'Almonds', 'Fats', '28 g', 164, 6, 6.1, 14.2, { g: 28, stage: 'ready' }],
  ['pb', 'Peanut butter', 'Fats', '2 tbsp (32 g)', 188, 8, 7, 16, { g: 32, stage: 'ready' }],
];

export const FOODS: Food[] = ROWS.map(([id, name, category, serving, kcal, p, c, f, weight]) => ({
  id, name, category, serving, kcal, p, c, f, weight,
}));

const BUILT_IN_IDS = new Set(FOODS.map((f) => f.id));
export const isBuiltInFood = (id: string) => BUILT_IN_IDS.has(id);

export const FOOD_CATEGORIES = ['Custom', 'Dairy', 'Fats', 'Fruit', 'Grains', 'Protein', 'Vegetables'];

/** Built-in and custom foods together, alphabetical. */
export function allFoods(customFoods: Food[]): Food[] {
  return [...FOODS, ...customFoods].sort((a, b) => compareNames(a.name, b.name));
}

export function foodLookup(customFoods: Food[]): Map<string, Food> {
  return new Map([...FOODS, ...customFoods].map((f) => [f.id, f]));
}

export function filterFoods(foods: Food[], query: string, category: string): Food[] {
  const q = query.trim().toLowerCase();
  return foods.filter((f) => f.name.toLowerCase().includes(q) && (category === 'All' || f.category === category));
}

export function foodCategories(foods: Food[]): string[] {
  return ['All', ...[...new Set(foods.map((f) => f.category))].sort(compareNames)];
}

function inferredWeight(food: Food): FoodWeight | null {
  const match = (food.serving || '').match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/i);
  return match ? { g: Number(match[1]), unit: match[2].toLowerCase() as 'g' | 'ml', stage: 'ready' } : null;
}

export function foodWeight(food: Food, overrides: Record<string, YieldOverride> = {}): Partial<FoodWeight> {
  const base = food.weight ?? inferredWeight(food) ?? {};
  const override = Object.prototype.hasOwnProperty.call(overrides, food.id) ? overrides[food.id] : undefined;
  return override ? { ...base, ...override } : { ...base };
}
