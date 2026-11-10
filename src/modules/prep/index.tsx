import { useState } from 'preact/hooks';
import { aggregate } from '../../domain/plan';
import { compareNames, servingsText } from '../../domain/format';
import { prepInfo, shoppingAmount } from '../../domain/prep';
import { scaleIngredients } from '../../domain/recipes';
import { DAYS, type Food, type Recipe, type YieldOverride } from '../../domain/types';
import { getFoodMap, update, useStore } from '../../state/store';
import { Card, DayStrip } from '../../ui/components';
import { ListIcon } from '../../ui/icons';
import { ManualCopySheet, PrepLines, copyText } from '../../ui/shared';
import type { AppModule } from '../types';

/** What goes into the planned portions of a recipe, as the weight to measure for each ingredient. */
function recipeParts(recipe: Recipe, portions: number, foods: Map<string, Food>, overrides: Record<string, YieldOverride>): { name: string; text: string }[] {
  return scaleIngredients(recipe, portions).flatMap((i) => {
    const food = foods.get(i.foodId);
    if (!food) return [];
    const info = prepInfo(food, i.servings, overrides);
    return [{ name: food.name, text: info.leadsWithRaw ? info.lines[0] : info.primary }];
  });
}

function portionShare(recipe: Recipe, portions: number): string {
  const whole = portions === recipe.portions;
  return whole ? 'the whole recipe' : `${servingsText(portions)} of its ${recipe.portions} portions`;
}

function DayPrep({ onManualCopy }: { onManualCopy: (text: string) => void }) {
  const { state, ui } = useStore();
  const rows = aggregate(state.plan, [ui.day], state.mealSlots, getFoodMap());
  const copy = () => {
    const foods = getFoodMap();
    const lines = rows.map(({ food, servings }) => {
      const line = `${food.name} (${servingsText(servings)} ${food.recipe ? 'portions' : 'servings'}): ${prepInfo(food, servings, state.yieldOverrides).text}`;
      const recipe = food.recipe ? state.recipes.find((r) => r.id === food.id) : undefined;
      if (!recipe) return line;
      return [line, `  For ${portionShare(recipe, servings)}:`, ...recipeParts(recipe, servings, foods, state.yieldOverrides).map((p) => `  - ${p.name}: ${p.text}`)].join('\n');
    });
    copyText([`PREP LIST: ${DAYS[ui.day]}`, ...lines].join('\n'), onManualCopy);
  };
  return (
    <>
      <DayStrip />
      <Card title={`Combined prep for ${DAYS[ui.day]}`} action={<button type="button" class="btn subtle" disabled={!rows.length} onClick={copy}>Copy</button>}>
        {!rows.length && <p class="muted small">Add foods to this day to see combined raw, dry and cooked amounts.</p>}
        <div>
          {rows.map(({ food, servings }) => (
            <div class="check-row" style={{ cursor: 'default' }} key={food.id}>
              <div>
                <b class="small">{food.name} · {servingsText(servings)} {food.recipe ? 'portion' : 'serving'}{servings === 1 ? '' : 's'}</b>
                <PrepLines food={food} servings={servings} />
                <RecipeParts food={food} servings={servings} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function RecipeParts({ food, servings }: { food: Food; servings: number }) {
  const { state } = useStore();
  const recipe = food.recipe ? state.recipes.find((r) => r.id === food.id) : undefined;
  if (!recipe) return null;
  return (
    <div class="recipe-parts">
      <div class="tiny">For {portionShare(recipe, servings)}:</div>
      <ul>{recipeParts(recipe, servings, getFoodMap(), state.yieldOverrides).map((p) => <li key={p.name}><span>{p.name}</span> {p.text}</li>)}</ul>
    </div>
  );
}

function ShoppingList({ onManualCopy }: { onManualCopy: (text: string) => void }) {
  const { state } = useStore();
  const rows = aggregate(state.plan, state.shoppingDays, state.mealSlots, getFoodMap(), state.recipes);
  const groups = [...new Set(rows.map((r) => r.food.category))].sort(compareNames);
  const toggleDay = (d: number) => update((s) => ({ ...s, shoppingDays: s.shoppingDays.includes(d) ? s.shoppingDays.filter((x) => x !== d) : [...s.shoppingDays, d].sort((a, b) => a - b) }));
  const toggleItem = (id: string) => update((s) => ({ ...s, shoppingChecked: s.shoppingChecked.includes(id) ? s.shoppingChecked.filter((x) => x !== id) : [...s.shoppingChecked, id] }));
  const copy = () => {
    const lines = groups.flatMap((g) => [g.toUpperCase(), ...rows.filter((r) => r.food.category === g).map((r) => `- ${r.food.name}: ${shoppingAmount(r.food, r.servings, state.yieldOverrides)}`), '']);
    copyText(['SHOPPING LIST', ...lines].join('\n').trim(), onManualCopy);
  };
  return (
    <>
      <Card title="Days to shop for">
        <div class="chips">
          {DAYS.map((d, i) => <button key={d} type="button" class="chip" aria-pressed={state.shoppingDays.includes(i)} onClick={() => toggleDay(i)}>{d.slice(0, 3)}</button>)}
        </div>
      </Card>
      <Card
        title="Shopping list"
        action={
          <span class="row">
            <button type="button" class="btn subtle" disabled={!state.shoppingChecked.length} onClick={() => update((s) => ({ ...s, shoppingChecked: [] }))}>Untick all</button>
            <button type="button" class="btn subtle" disabled={!rows.length} onClick={copy}>Copy</button>
          </span>
        }
      >
        {!rows.length && <p class="muted small">Nothing planned for the selected days.</p>}
        {groups.map((g) => (
          <div key={g}>
            <div class="label" style={{ marginTop: '6px' }}>{g}</div>
            {rows.filter((r) => r.food.category === g).map(({ food, servings }) => {
              const done = state.shoppingChecked.includes(food.id);
              return (
                <label class={`check-row ${done ? 'done' : ''}`} key={food.id}>
                  <input type="checkbox" checked={done} onChange={() => toggleItem(food.id)} />
                  <span><b class="small">{food.name}</b><span class="small muted" style={{ display: 'block' }}>{shoppingAmount(food, servings, state.yieldOverrides)}</span></span>
                </label>
              );
            })}
          </div>
        ))}
        <p class="note">Recipes are listed as their ingredients. Raw and dry weights are estimates. Foods you already have can just be ticked off.</p>
      </Card>
    </>
  );
}

function PrepScreen() {
  const [tab, setTab] = useState<'prep' | 'shop'>('prep');
  const [manual, setManual] = useState<string | null>(null);
  return (
    <>
      <div class="segmented" role="group" aria-label="Choose a list">
        <button type="button" aria-pressed={tab === 'prep'} onClick={() => setTab('prep')}>Day prep</button>
        <button type="button" aria-pressed={tab === 'shop'} onClick={() => setTab('shop')}>Shopping list</button>
      </div>
      {tab === 'prep' ? <DayPrep onManualCopy={setManual} /> : <ShoppingList onManualCopy={setManual} />}
      {manual !== null && <ManualCopySheet text={manual} onClose={() => setManual(null)} />}
    </>
  );
}

export const prepModule: AppModule = {
  id: 'prep',
  title: 'Prep & shopping',
  navLabel: 'Prep',
  description: 'Combined prep weights for a day and a shopping list for the week.',
  icon: ListIcon,
  component: PrepScreen,
};
