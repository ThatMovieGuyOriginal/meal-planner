import { useRef, useState } from 'preact/hooks';
import { allFoods, filterFoods, foodCategories } from '../../domain/foods';
import { makeCustomId } from '../../domain/exercises';
import { fmt, gw, one } from '../../domain/format';
import { countFoodUses, removeFoodEverywhere, totalsFor } from '../../domain/plan';
import {
  MAX_COOKED_WEIGHT, MAX_INGREDIENT_SERVINGS, MAX_PORTIONS, addIngredient, amountText, fromServings, listedWeight,
  roundAmount, toServings, unitLabel, unitsFor,
} from '../../domain/recipes';
import type { AmountUnit, Food, Recipe, RecipeIngredient } from '../../domain/types';
import { getFoodMap, showToast, update, updateWithUndo, useStore } from '../../state/store';
import { ConfirmSheet, Field, MacroSplit, NumberInput, Select, Sheet, StatTile, Stepper, TextInput } from '../../ui/components';
import { PlusIcon, RightIcon } from '../../ui/icons';
import { PrepPreview, macrosLine } from '../../ui/shared';

type View =
  | { kind: 'edit' }
  | { kind: 'pick' }
  | { kind: 'amount'; foodId: string }
  | { kind: 'discard' }
  | { kind: 'delete' };

interface Draft { name: string; portions: string; cookedWeight: string; ingredients: RecipeIngredient[]; }

function draftFrom(recipe: Recipe | undefined, startWith: RecipeIngredient[] | undefined): Draft {
  if (recipe) return { name: recipe.name, portions: String(recipe.portions), cookedWeight: recipe.cookedWeight ? String(recipe.cookedWeight) : '', ingredients: recipe.ingredients };
  return { name: '', portions: startWith ? '1' : '4', cookedWeight: '', ingredients: startWith ?? [] };
}

/** Rounds a converted amount to something sensible to show in an input. */
const inputValue = (n: number, unit: AmountUnit) => String(unit === 'servings' ? Math.round(n * 100) / 100 : Math.round(n));

function AmountSheet({ food, current, onSave, onRemove, onBack }: {
  food: Food;
  current?: RecipeIngredient;
  onSave: (ingredient: RecipeIngredient) => void;
  onRemove: () => void;
  onBack: () => void;
}) {
  const { state } = useStore();
  const overrides = state.yieldOverrides;
  const units = unitsFor(food, overrides);
  const startUnit: AmountUnit = current?.unit && units.includes(current.unit) ? current.unit : 'servings';
  const [unit, setUnit] = useState<AmountUnit>(startUnit);
  const [value, setValue] = useState(current ? inputValue(fromServings(food, current.servings, startUnit, overrides), startUnit) : '1');
  const servings = toServings(food, Number(value), unit, overrides);
  const ok = servings > 0 && servings <= MAX_INGREDIENT_SERVINGS;
  const switchTo = (next: AmountUnit) => {
    if (servings > 0) setValue(inputValue(fromServings(food, servings, next, overrides), next));
    else if (next === 'servings') setValue('1');
    setUnit(next);
  };
  return (
    <Sheet title={food.name} onClose={onBack}>
      <p class="small muted">One serving: {food.serving}</p>
      {units.length > 1 && (
        <div class="segmented" role="group" aria-label="Enter the amount in">
          {units.map((u) => <button key={u} type="button" aria-pressed={unit === u} onClick={() => switchTo(u)}>{unitLabel(food, u, overrides)}</button>)}
        </div>
      )}
      <div class="label">{unitLabel(food, unit, overrides)}</div>
      {unit === 'servings'
        ? <Stepper label="servings" value={value} onValue={setValue} step={0.25} max={MAX_INGREDIENT_SERVINGS} />
        : <Stepper label={unitLabel(food, unit, overrides).toLowerCase()} value={value} onValue={setValue} step={10} max={100000} />}
      {unit === 'raw' && <p class="note">Raw weight is converted using this food's cooking yield, so the nutrition matches what you'll eat.</p>}
      {ok && <PrepPreview food={food} servings={servings} />}
      {!ok && value.trim() !== '' && <div class="notice danger">Enter an amount above zero.</div>}
      <button
        type="button"
        class="btn primary block"
        disabled={!ok}
        onClick={() => onSave({ foodId: food.id, servings: roundAmount(servings), ...(unit !== 'servings' ? { unit } : {}) })}
      >
        {current ? 'Update ingredient' : 'Add to recipe'}
      </button>
      {current && <button type="button" class="btn danger block" onClick={onRemove}>Remove from recipe</button>}
    </Sheet>
  );
}

function PickSheet({ onPick, onBack }: { onPick: (food: Food) => void; onBack: () => void }) {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  // Recipes can't contain other recipes, so only plain foods are offered.
  const foods = allFoods(state.customFoods);
  const shown = filterFoods(foods, query, category);
  return (
    <Sheet title="Add an ingredient" onClose={onBack}>
      <div class="form-grid">
        <Field label="Search"><TextInput type="search" value={query} onValue={setQuery} placeholder="Egg, rice, chicken…" /></Field>
        <Field label="Category"><Select value={category} onValue={setCategory} options={foodCategories(foods).map((c) => ({ value: c, label: c }))} /></Field>
      </div>
      <div class="list">
        {shown.map((f) => (
          <button key={f.id} type="button" class="list-row" onClick={() => onPick(f)}>
            <div><b>{f.name}</b><div class="tiny">{f.serving} · {fmt(f.kcal)} kcal · P {one(f.p)} · C {one(f.c)} · F {one(f.f)}</div></div>
            <PlusIcon class="chev" />
          </button>
        ))}
        {!shown.length && <div class="empty">No foods match. You can add your own on the Foods screen.</div>}
      </div>
    </Sheet>
  );
}

/**
 * Create or edit a recipe. Changes stay in a draft until saved, and closing with unsaved
 * changes asks first. Pass startWith to begin a new recipe from foods already chosen.
 */
export function RecipeEditorSheet({ recipeId, startWith, onClose }: { recipeId?: string; startWith?: RecipeIngredient[]; onClose: () => void }) {
  const { state } = useStore();
  const existing = state.recipes.find((r) => r.id === recipeId);
  const [initial] = useState(() => draftFrom(existing, startWith));
  const [draft, setDraft] = useState(initial);
  const [view, setView] = useState<View>({ kind: 'edit' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const leaving = useRef(false);
  const foods = getFoodMap();
  const overrides = state.yieldOverrides;
  const set = (patch: Partial<Draft>) => { setDraft((d) => ({ ...d, ...patch })); setErrors({}); };
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const requestClose = () => (dirty ? setView({ kind: 'discard' }) : onClose());
  const leave = () => { leaving.current = true; onClose(); };
  const back = () => { if (!leaving.current) setView({ kind: 'edit' }); };

  if (view.kind === 'pick') {
    return <PickSheet onBack={back} onPick={(f) => setView({ kind: 'amount', foodId: f.id })} />;
  }
  if (view.kind === 'amount') {
    const food = foods.get(view.foodId);
    if (!food) return null;
    const current = draft.ingredients.find((i) => i.foodId === food.id);
    return (
      <AmountSheet
        food={food}
        current={current}
        onBack={back}
        onSave={(ingredient) => {
          set({ ingredients: current ? draft.ingredients.map((i) => (i === current ? ingredient : i)) : addIngredient(draft.ingredients, ingredient) });
          back();
        }}
        onRemove={() => { set({ ingredients: draft.ingredients.filter((i) => i !== current) }); back(); }}
      />
    );
  }
  if (view.kind === 'discard') {
    return <ConfirmSheet title="Discard changes?" message="Your changes to this recipe haven't been saved." confirmLabel="Discard" danger onConfirm={leave} onClose={back} />;
  }
  if (view.kind === 'delete' && existing) {
    const uses = countFoodUses(state.plan, existing.id);
    return (
      <ConfirmSheet
        title={`Delete ${existing.name}?`}
        message={`${uses ? `It's in ${uses} planned meal${uses === 1 ? '' : 's'} and will be removed from them. ` : ''}You can undo this straight afterwards.`}
        confirmLabel="Delete recipe"
        danger
        onConfirm={() => {
          const id = existing.id;
          updateWithUndo((s) => ({ ...s, recipes: s.recipes.filter((r) => r.id !== id), plan: removeFoodEverywhere(s.plan, id) }), `Deleted ${existing.name}`);
          leave();
        }}
        onClose={back}
      />
    );
  }

  const portions = Number(draft.portions);
  const portionsOk = Number.isInteger(portions) && portions >= 1 && portions <= MAX_PORTIONS;
  const n = portionsOk ? portions : 1;
  const cooked = draft.cookedWeight.trim() === '' ? 0 : Number(draft.cookedWeight);
  const totals = totalsFor(draft.ingredients, foods);
  const listed = listedWeight(draft.ingredients, foods, overrides);

  const save = () => {
    const name = draft.name.trim();
    const e: Record<string, string> = {};
    if (!name) e.name = 'Enter a recipe name.';
    else if (state.recipes.some((r) => r.id !== recipeId && r.name.toLowerCase() === name.toLowerCase())) e.name = 'You already have a recipe with that name.';
    if (!portionsOk) e.portions = `Enter a whole number from 1 to ${MAX_PORTIONS}.`;
    if (draft.cookedWeight.trim() && !(cooked > 0 && cooked <= MAX_COOKED_WEIGHT)) e.cookedWeight = 'Enter a positive weight in grams, or leave this blank.';
    if (!draft.ingredients.length) e.ingredients = 'Add at least one ingredient.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const recipe: Recipe = { id: existing?.id ?? makeCustomId('recipe'), name, portions, ingredients: draft.ingredients, ...(cooked > 0 ? { cookedWeight: cooked } : {}) };
    if (existing) {
      updateWithUndo((s) => ({ ...s, recipes: s.recipes.map((r) => (r.id === recipe.id ? recipe : r)) }), `Saved ${name}`);
    } else {
      update((s) => ({ ...s, recipes: [...s.recipes, recipe] }));
      showToast(`Saved ${name} to your recipes`);
    }
    leave();
  };

  return (
    <Sheet title={existing ? 'Edit recipe' : 'New recipe'} onClose={requestClose}>
      <Field label="Recipe name" error={errors.name}><TextInput value={draft.name} onValue={(v) => set({ name: v })} maxLength={120} placeholder="Chicken burrito bowls" /></Field>
      <div class="form-grid">
        <Field label="Portions it makes" error={errors.portions}>
          <Stepper label="portions" value={draft.portions} onValue={(v) => set({ portions: v })} min={1} max={MAX_PORTIONS} />
        </Field>
        <Field label="Finished weight (g)" hint="Optional. Weigh the whole dish once it's cooked to portion it by weight." error={errors.cookedWeight}>
          <NumberInput value={draft.cookedWeight} onValue={(v) => set({ cookedWeight: v })} min={0} />
        </Field>
      </div>

      <div class="label">Ingredients</div>
      <div class="list">
        {draft.ingredients.map((i) => {
          const food = foods.get(i.foodId);
          if (!food) return null;
          return (
            <button key={i.foodId} type="button" class="list-row" aria-label={`Change ${food.name}`} onClick={() => setView({ kind: 'amount', foodId: i.foodId })}>
              <div><b>{food.name}</b><div class="tiny">{amountText(food, i, overrides)}</div><div class="tiny">{macrosLine(food, i.servings)}</div></div>
              <RightIcon class="chev" />
            </button>
          );
        })}
        {!draft.ingredients.length && <div class="empty">No ingredients yet</div>}
      </div>
      {errors.ingredients && <small class="error" role="alert">{errors.ingredients}</small>}
      <button type="button" class="btn block" onClick={() => setView({ kind: 'pick' })}><PlusIcon /> Add ingredient</button>

      {draft.ingredients.length > 0 && (
        <div class="recipe-totals stack">
          <div class="tiles">
            <StatTile label="Whole recipe" value={`${fmt(totals.kcal)} kcal`} sub={`P ${one(totals.p)}g · C ${one(totals.c)}g · F ${one(totals.f)}g`} />
            <StatTile
              label={n === 1 ? 'One portion (whole recipe)' : `One portion (1 of ${n})`}
              value={`${fmt(totals.kcal / n)} kcal`}
              sub={`P ${one(totals.p / n)}g · C ${one(totals.c / n)}g · F ${one(totals.f / n)}g`}
            />
          </div>
          <MacroSplit totals={totals} />
          {cooked > 0 && portionsOk && <p class="note">Each portion is {gw(cooked / n)} g of the finished dish.</p>}
          {listed > 0 && (
            <div class="row between">
              <span class="note grow">Ingredients add up to {gw(listed)} g as listed. Cooking changes this, so weighing the finished dish is more accurate.</span>
              {Math.round(listed) !== cooked && <button type="button" class="btn subtle" onClick={() => set({ cookedWeight: String(Math.round(listed)) })}>Use {gw(Math.round(listed))} g</button>}
            </div>
          )}
        </div>
      )}

      {existing && <p class="note">Saved changes update every meal this recipe is planned in.</p>}
      <button type="button" class="btn primary block" onClick={save}>Save recipe</button>
      {existing && <button type="button" class="btn danger block" onClick={() => setView({ kind: 'delete' })}>Delete recipe</button>}
    </Sheet>
  );
}
