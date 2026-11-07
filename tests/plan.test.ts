import { describe, expect, it } from 'vitest';
import { addServings, aggregate, copyMeals, countFoodUses, moveAmount, moveOneServing, removeFoodEverywhere, removeServings, reorderItem, setServings, totalsFor } from '../src/domain/plan';
import { allFoods, foodLookup, FOODS } from '../src/domain/foods';
import { allExercises, EXERCISES } from '../src/domain/exercises';
import { prepInfo, shoppingAmount } from '../src/domain/prep';
import { arrangeModules, moveModule } from '../src/modules/arrange';
import { defaultState } from '../src/state/defaults';
import type { DayPlan, Food } from '../src/domain/types';

const blank = (): DayPlan[] => defaultState().plan;
const foods = foodLookup([]);
const dayKcal = (plan: DayPlan[], day = 0) => totalsFor(Object.values(plan[day]).flat(), foods).kcal;
const custom = (over: Partial<Food> = {}): Food => ({ id: 'custom-x', name: 'Stew', category: 'Custom', serving: '100 g', kcal: 100, p: 1, c: 1, f: 1, custom: true, ...over });

describe('moving servings', () => {
  it('moves only what exists: half a serving stays half a serving', () => {
    const plan = addServings(blank(), 0, 'breakfast', 'potato', 0.5);
    const moved = moveOneServing(plan, 0, 'breakfast', 0, 'dinner', 'potato');
    expect(moved[0].breakfast).toEqual([]);
    expect(moved[0].dinner).toEqual([{ foodId: 'potato', servings: 0.5 }]);
    expect(dayKcal(moved)).toBeCloseTo(dayKcal(plan), 6);
  });

  it('moves exactly one serving out of a larger quantity', () => {
    const plan = addServings(blank(), 0, 'lunch', 'egg', 2.5);
    const moved = moveOneServing(plan, 0, 'lunch', 0, 'dinner', 'egg');
    expect(moved[0].lunch).toEqual([{ foodId: 'egg', servings: 1.5 }]);
    expect(moved[0].dinner).toEqual([{ foodId: 'egg', servings: 1 }]);
    expect(dayKcal(moved)).toBeCloseTo(dayKcal(plan), 6);
  });

  it('merges into an existing item and works across days', () => {
    let plan = addServings(blank(), 0, 'lunch', 'egg', 1);
    plan = addServings(plan, 1, 'lunch', 'egg', 1);
    const moved = moveOneServing(plan, 0, 'lunch', 1, 'lunch', 'egg');
    expect(moved[0].lunch).toEqual([]);
    expect(moved[1].lunch).toEqual([{ foodId: 'egg', servings: 2 }]);
  });

  it('does nothing when the source and target are the same meal', () => {
    const plan = addServings(blank(), 0, 'lunch', 'egg', 1);
    expect(moveOneServing(plan, 0, 'lunch', 0, 'lunch', 'egg')).toBe(plan);
    expect(moveAmount(0.25)).toBe(0.25);
    expect(moveAmount(3)).toBe(1);
  });
});

describe('editing servings', () => {
  it('rounds to quarter steps and caps at 100', () => {
    let plan = addServings(blank(), 0, 'lunch', 'egg', 0.3);
    expect(plan[0].lunch[0].servings).toBe(0.25);
    plan = setServings(plan, 0, 'lunch', 'egg', 500);
    expect(plan[0].lunch[0].servings).toBe(100);
  });

  it('never loses a tiny add', () => {
    expect(addServings(blank(), 0, 'lunch', 'egg', 0.01)[0].lunch[0].servings).toBe(0.25);
  });

  it('removes at zero', () => {
    const plan = addServings(blank(), 0, 'lunch', 'egg', 1);
    expect(setServings(plan, 0, 'lunch', 'egg', 0)[0].lunch).toEqual([]);
    expect(removeServings(plan, 0, 'lunch', 'egg', 1)[0].lunch).toEqual([]);
  });

  it('does not change the original plan', () => {
    const plan = blank();
    addServings(plan, 0, 'lunch', 'egg', 1);
    expect(plan[0].lunch).toEqual([]);
  });
});

describe('ordering', () => {
  it('reorders items inside a meal and respects the ends', () => {
    let plan = addServings(blank(), 0, 'lunch', 'egg', 1);
    plan = addServings(plan, 0, 'lunch', 'rice', 1);
    const down = reorderItem(plan, 0, 'lunch', 'egg', 1);
    expect(down[0].lunch.map((x) => x.foodId)).toEqual(['rice', 'egg']);
    expect(reorderItem(plan, 0, 'lunch', 'egg', -1)).toBe(plan);
    expect(reorderItem(plan, 0, 'lunch', 'rice', 1)).toBe(plan);
  });

  it('puts custom exercises in alphabetical order with the built-in list', () => {
    const list = allExercises([
      { id: 'customex-a', name: 'Barre', level: 'Moderate', met: 4, custom: true },
      { id: 'customex-b', name: 'aqua jogging', level: 'Moderate', met: 6, custom: true },
      { id: 'customex-c', name: 'Zumba', level: 'Moderate', met: 6.5, custom: true },
    ]);
    const names = list.map((x) => x.name);
    expect(names.indexOf('aqua jogging')).toBe(0);
    expect(names.indexOf('Barre')).toBeGreaterThan(names.indexOf('Badminton'));
    expect(names.indexOf('Barre')).toBeLessThan(names.indexOf('Basketball'));
    expect(names.at(-1)).toBe('Zumba');
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true }));
    expect(names).toEqual(sorted);
  });

  it('puts custom foods in alphabetical order with the built-in list', () => {
    const names = allFoods([custom({ name: 'apple pie' }), custom({ id: 'custom-y', name: 'Zucchini' })]).map((x) => x.name);
    expect(names[0]).toBe('Almonds');
    expect(names.indexOf('apple pie')).toBeLessThan(names.indexOf('Apple, with skin') + 2);
    expect(names.at(-1)).toBe('Zucchini');
  });

  it('keeps a saved module order and adds newly released modules at the end', () => {
    const modules = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(arrangeModules(modules, ['c', 'a']).map((m) => m.id)).toEqual(['c', 'a', 'b']);
    expect(arrangeModules(modules, ['gone', 'b']).map((m) => m.id)).toEqual(['b', 'a', 'c']);
    expect(moveModule(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveModule(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
  });
});

describe('copying and removal', () => {
  it('replaces or adds when copying', () => {
    let plan = addServings(blank(), 0, 'lunch', 'egg', 1);
    plan = addServings(plan, 1, 'lunch', 'egg', 2);
    expect(copyMeals(plan, 0, [1], ['lunch'], true)[1].lunch[0].servings).toBe(1);
    expect(copyMeals(plan, 0, [1], ['lunch'], false)[1].lunch[0].servings).toBe(3);
  });

  it('counts and removes a food everywhere', () => {
    let plan = addServings(blank(), 0, 'lunch', 'custom-x', 1);
    plan = addServings(plan, 3, 'dinner', 'custom-x', 1);
    expect(countFoodUses(plan, 'custom-x')).toBe(2);
    expect(countFoodUses(removeFoodEverywhere(plan, 'custom-x'), 'custom-x')).toBe(0);
  });

  it('combines servings across meals and days', () => {
    let plan = addServings(blank(), 0, 'lunch', 'egg', 1);
    plan = addServings(plan, 0, 'dinner', 'egg', 2);
    plan = addServings(plan, 1, 'lunch', 'egg', 3);
    expect(aggregate(plan, [0, 1], defaultState().mealSlots, foods)).toEqual([{ food: foods.get('egg'), servings: 6 }]);
    expect(aggregate(plan, [0], defaultState().mealSlots, foods)[0].servings).toBe(3);
  });
});

describe('prep weights', () => {
  const food = (id: string) => FOODS.find((f) => f.id === id)!;

  it('gives the raw weight for cooked foods', () => {
    expect(prepInfo(food('rice'), 6).lines[0]).toContain('≈222 g dry white rice');
  });

  it('applies both sweet-potato yields', () => {
    const info = prepInfo(food('potato'), 6);
    expect(info.lines[0]).toContain('≈986 g');
    expect(info.lines[1]).toContain('≈769 g whole');
  });

  it('uses a yield override', () => {
    expect(prepInfo(food('rice'), 1, { rice: { yield: 2, edibleYield: 1 } }).lines[0]).toContain('≈50 g');
  });

  it('lists milk in a real cup volume', () => {
    expect(food('milk').serving).toBe('1 cup (237 ml)');
    expect(prepInfo(food('milk'), 1).primary).toBe('Milk volume: 237 ml');
  });

  it('handles a cooked custom food with no yield', () => {
    const info = prepInfo(custom({ weight: { g: 100, stage: 'cooked' } }), 2);
    expect(info.primary).toBe('Cooked edible portion: 200 g');
    expect(info.lines).toEqual([]);
    expect(shoppingAmount(custom({ weight: { g: 100, stage: 'cooked' } }), 2)).toContain('200 g cooked');
  });

  it('falls back to a count when a food has no weight', () => {
    expect(prepInfo(custom({ serving: '1 bar' }), 2).primary).toBe('2 × 1 bar');
  });

  it('shops by raw weight for cooked foods', () => {
    expect(shoppingAmount(food('chicken'), 2)).toContain('≈278 g raw boneless, skinless chicken');
    expect(shoppingAmount(food('egg'), 6)).toContain('300 g');
  });
});

describe('catalog integrity', () => {
  it('has unique ids', () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });
});
