import { describe, expect, it } from 'vitest';
import { foodLookup } from '../src/domain/foods';
import { aggregate, totalsFor } from '../src/domain/plan';
import { prepInfo } from '../src/domain/prep';
import {
  addIngredient, amountText, foodLookupWithRecipes, fromServings, ingredientsFromItems, listedWeight, recipeFood,
  removeIngredientEverywhere, scaleIngredients, toServings, unitsFor,
} from '../src/domain/recipes';
import { makeBackup, parseBackup } from '../src/state/backup';
import { defaultState } from '../src/state/defaults';
import type { Recipe } from '../src/domain/types';

const base = foodLookup([]);
const food = (id: string) => base.get(id)!;

const bowls: Recipe = {
  id: 'recipe-bowls',
  name: 'Chicken rice bowls',
  portions: 4,
  ingredients: [
    { foodId: 'chicken', servings: 4 },
    { foodId: 'rice', servings: 6 },
    { foodId: 'olive', servings: 2 },
  ],
};

describe('recipe nutrition', () => {
  it('adds up the ingredients and divides by the portions', () => {
    const whole = totalsFor(bowls.ingredients, base);
    expect(whole.kcal).toBeCloseTo(4 * 165 + 6 * 130 + 2 * 119, 6);
    const portion = recipeFood(bowls, base);
    expect(portion.kcal).toBeCloseTo(whole.kcal / 4, 6);
    expect(portion.p).toBeCloseTo(whole.p / 4, 6);
    expect(portion.f).toBeCloseTo(whole.f / 4, 6);
    expect(portion.category).toBe('Recipes');
    expect(portion.recipe).toBe(true);
  });

  it('describes a portion by share, and by weight once the finished weight is known', () => {
    expect(recipeFood(bowls, base).serving).toBe('1 portion (1/4 of recipe)');
    expect(recipeFood(bowls, base).weight).toBeUndefined();
    const weighed = recipeFood({ ...bowls, cookedWeight: 1400 }, base);
    expect(weighed.serving).toBe('1 portion (350 g, 1/4 of recipe)');
    expect(prepInfo(weighed, 2).primary).toBe('Finished dish: 700 g');
    expect(recipeFood({ ...bowls, portions: 1 }, base).serving).toBe('Whole recipe');
  });

  it('is planned like any food, by the portion', () => {
    const foods = foodLookupWithRecipes([], [bowls]);
    const t = totalsFor([{ foodId: 'recipe-bowls', servings: 1.5 }], foods);
    expect(t.kcal).toBeCloseTo(recipeFood(bowls, base).kcal * 1.5, 6);
  });

  it('follows changes to a custom food used in it', () => {
    const custom = { id: 'custom-sauce', name: 'Sauce', category: 'Custom', serving: '1 tbsp', kcal: 50, p: 0, c: 10, f: 1, custom: true };
    const r: Recipe = { ...bowls, ingredients: [{ foodId: 'custom-sauce', servings: 4 }] };
    expect(foodLookupWithRecipes([custom], [r]).get(r.id)!.kcal).toBe(50);
    expect(foodLookupWithRecipes([{ ...custom, kcal: 80 }], [r]).get(r.id)!.kcal).toBe(80);
  });
});

describe('ingredient amounts', () => {
  it('converts grams and raw grams to servings and back', () => {
    const chicken = food('chicken');
    expect(unitsFor(chicken)).toEqual(['servings', 'g', 'raw']);
    expect(toServings(chicken, 450, 'g')).toBeCloseTo(4.5, 6);
    // 500 g raw chicken at a 72% yield is 360 g cooked, which is 3.6 servings of 100 g.
    expect(toServings(chicken, 500, 'raw')).toBeCloseTo(3.6, 6);
    expect(fromServings(chicken, 3.6, 'raw')).toBeCloseTo(500, 6);
    expect(amountText(chicken, { foodId: 'chicken', servings: 3.6, unit: 'raw' })).toBe('500 g raw');
    expect(amountText(chicken, { foodId: 'chicken', servings: 4.5, unit: 'g' })).toBe('450 g cooked');
  });

  it('accounts for skin removed after baking when converting raw weight', () => {
    const potato = food('potato');
    expect(toServings(potato, 1000, 'raw')).toBeCloseTo((1000 * 0.78 * 0.78) / 100, 6);
  });

  it('uses the yield she set for that food', () => {
    expect(toServings(food('rice'), 100, 'raw', { rice: { yield: 3, edibleYield: 1 } })).toBeCloseTo(3, 6);
  });

  it('only offers units that make sense for the food', () => {
    expect(unitsFor(food('egg'))).toEqual(['servings', 'g']);
    expect(unitsFor(food('milk'))).toEqual(['servings', 'g']);
    expect(amountText(food('milk'), { foodId: 'milk', servings: 2, unit: 'g' })).toBe('474 ml');
    expect(unitsFor({ id: 'custom-x', name: 'Bar', category: 'Custom', serving: '1 bar', kcal: 1, p: 0, c: 0, f: 0 })).toEqual(['servings']);
  });

  it('merges a food added twice', () => {
    const next = addIngredient(bowls.ingredients, { foodId: 'rice', servings: 1.5 });
    expect(next).toHaveLength(3);
    expect(next.find((i) => i.foodId === 'rice')!.servings).toBe(7.5);
  });

  it('adds up listed weights only when every ingredient has one', () => {
    expect(listedWeight(bowls.ingredients, base)).toBeCloseTo(400 + 600 + 27, 6);
    expect(listedWeight([...bowls.ingredients, { foodId: 'milk', servings: 1 }], base)).toBe(0);
  });
});

describe('recipes in the plan', () => {
  const plan = defaultState().plan.map((d) => ({ ...d }));
  plan[0] = { ...plan[0], lunch: [{ foodId: 'recipe-bowls', servings: 1 }, { foodId: 'rice', servings: 1 }] };
  plan[1] = { ...plan[1], dinner: [{ foodId: 'recipe-bowls', servings: 2 }] };
  const slots = defaultState().mealSlots;
  const foods = foodLookupWithRecipes([], [bowls]);

  it('breaks recipes into ingredients for shopping', () => {
    const rows = aggregate(plan, [0, 1], slots, foods, [bowls]);
    const by = Object.fromEntries(rows.map((r) => [r.food.id, r.servings]));
    expect(by).toEqual({ chicken: 3, rice: 1 + 4.5, olive: 1.5 });
  });

  it('keeps recipes whole for the day prep list', () => {
    expect(aggregate(plan, [1], slots, foods).map((r) => [r.food.id, r.servings])).toEqual([['recipe-bowls', 2]]);
  });

  it('scales ingredients to the portions planned', () => {
    expect(scaleIngredients(bowls, 2).map((i) => i.servings)).toEqual([2, 3, 1]);
  });

  it('turns a planned meal into ingredients, flattening any recipe in it', () => {
    const result = ingredientsFromItems(plan[0].lunch, [bowls], foods);
    expect(result).toEqual([{ foodId: 'chicken', servings: 1 }, { foodId: 'rice', servings: 2.5 }, { foodId: 'olive', servings: 0.5 }]);
  });

  it('drops a deleted food from recipes that used it', () => {
    const [r] = removeIngredientEverywhere([bowls], 'olive');
    expect(r.ingredients.map((i) => i.foodId)).toEqual(['chicken', 'rice']);
  });
});

describe('recipes in backups', () => {
  const withRecipe = () => {
    const s = defaultState();
    s.recipes = [bowls];
    s.plan[0] = { ...s.plan[0], lunch: [{ foodId: 'recipe-bowls', servings: 1 }] };
    return s;
  };

  it('keeps planned recipes on import', () => {
    const r = parseBackup(makeBackup(withRecipe()));
    expect(r.ok && r.state.plan[0].lunch).toEqual([{ foodId: 'recipe-bowls', servings: 1 }]);
  });

  it('imports older backups that have no recipes', () => {
    const old = JSON.parse(makeBackup(defaultState()));
    old.schema = 7;
    delete old.state.recipes;
    const r = parseBackup(JSON.stringify(old));
    expect(r.ok && r.state.recipes).toEqual([]);
  });

  it('cleans bad recipe data instead of trusting it', () => {
    const s = withRecipe() as unknown as Record<string, unknown>;
    s.recipes = [
      { ...bowls, portions: 900, cookedWeight: -5, ingredients: [...bowls.ingredients, { foodId: 'gone', servings: 1 }, { foodId: 'recipe-bowls', servings: 1 }, { foodId: 'rice', servings: 1 }, { foodId: 'egg', servings: -1 }] },
      { ...bowls, name: 'Duplicate id' },
      { id: 'custom-wrong-prefix', name: 'X', portions: 1, ingredients: [] },
      { id: 'recipe-empty', name: '<b>Empty</b>', portions: 2, ingredients: [] },
    ];
    const r = parseBackup(makeBackup(s as never));
    if (!r.ok) throw new Error(r.error);
    expect(r.state.recipes.map((x) => x.id)).toEqual(['recipe-bowls', 'recipe-empty']);
    const [cleaned] = r.state.recipes;
    expect(cleaned.portions).toBe(100);
    expect(cleaned.cookedWeight).toBeUndefined();
    expect(cleaned.ingredients).toEqual([{ foodId: 'chicken', servings: 4 }, { foodId: 'rice', servings: 7 }, { foodId: 'olive', servings: 2 }]);
    expect(r.warnings.join()).toContain('Skipped 2 recipe ingredients');
  });

  it('drops planned recipes that no longer exist, and says so', () => {
    const s = withRecipe();
    s.recipes = [];
    const r = parseBackup(makeBackup(s));
    expect(r.ok && r.state.plan[0].lunch).toEqual([]);
    expect(r.ok && r.warnings.join()).toContain('Skipped 1 planned food');
  });
});
