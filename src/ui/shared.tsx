import { useState } from 'preact/hooks';
import { FOOD_CATEGORIES, allFoods, filterFoods, foodCategories, foodWeight } from '../domain/foods';
import { makeCustomId } from '../domain/exercises';
import { num, one, fmt, servingsText } from '../domain/format';
import { addServings, moveAmount, moveOneServing, reorderItem, setServings, copyMeals } from '../domain/plan';
import { prepInfo } from '../domain/prep';
import { DAYS, type Food, type FoodWeight, type Stage } from '../domain/types';
import { getFoodMap, getState, setUi, showToast, update, updateWithUndo, useStore } from '../state/store';
import { Field, NumberInput, Select, Sheet, Stepper, TextInput } from './components';
import { DownIcon, PlusIcon, RightIcon, UpIcon } from './icons';

export function macrosLine(food: Food, n: number): string {
  return `${fmt(food.kcal * n)} kcal · P ${one(food.p * n)}g · C ${one(food.c * n)}g · F ${one(food.f * n)}g`;
}

export function PrepLines({ food, servings }: { food: Food; servings: number }) {
  const { state } = useStore();
  const info = prepInfo(food, servings, state.yieldOverrides);
  if (info.leadsWithRaw) {
    return (
      <>
        <div class="weight-primary">{info.lines[0]}</div>
        <div class="weight-secondary">{info.primary}</div>
        {info.lines.slice(1).map((x) => <div class="weight-secondary" key={x}>{x}</div>)}
      </>
    );
  }
  return <div class="weight-primary">{info.primary}</div>;
}

export function PrepPreview({ food, servings }: { food: Food; servings: number }) {
  return (
    <div class="weight-preview">
      <PrepLines food={food} servings={servings} />
      <div class="tiny" style={{ marginTop: '5px' }}>{macrosLine(food, servings)}</div>
    </div>
  );
}

/** Search, then pick how much. The sheet stays open so several foods can go in at once. */
export function FoodPickerSheet({ mealId, onClose }: { mealId: string; onClose: () => void }) {
  const { state, ui } = useStore();
  const [meal, setMeal] = useState(mealId);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [picked, setPicked] = useState<Food | null>(null);
  const [amount, setAmount] = useState('1');
  const foods = allFoods(state.customFoods);
  const shown = filterFoods(foods, query, category);
  const slot = state.mealSlots.find((s) => s.id === meal);

  if (picked) {
    const n = Number(amount);
    const ok = n > 0 && n <= 100;
    return (
      <Sheet title={picked.name} onClose={() => setPicked(null)}>
        <p class="small muted">{picked.serving} per serving</p>
        <div class="label">Servings</div>
        <Stepper label="servings" value={amount} onValue={setAmount} step={0.25} />
        <div class="chips">
          {[0.5, 1, 1.5, 2, 3].map((v) => <button key={v} type="button" class="chip" aria-pressed={n === v} onClick={() => setAmount(String(v))}>{servingsText(v)}</button>)}
        </div>
        {ok && <PrepPreview food={picked} servings={n} />}
        <button
          type="button"
          class="btn primary block"
          disabled={!ok}
          onClick={() => {
            const food = picked;
            const day = ui.day;
            updateWithUndo((s) => ({ ...s, plan: addServings(s.plan, day, meal, food.id, n) }), `Added ${servingsText(n)} × ${food.name} to ${slot?.name ?? 'meal'}, ${DAYS[day].slice(0, 3)}`);
            setUi({ mealId: meal });
            setPicked(null);
            setAmount('1');
          }}
        >
          Add to {slot?.name} on {DAYS[ui.day].slice(0, 3)}
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title={`Add food · ${DAYS[ui.day]}`} onClose={onClose}>
      <div class="form-grid">
        <Field label="Meal"><Select value={meal} onValue={setMeal} options={state.mealSlots.map((s) => ({ value: s.id, label: s.name }))} /></Field>
        <Field label="Category"><Select value={category} onValue={setCategory} options={foodCategories(foods).map((c) => ({ value: c, label: c }))} /></Field>
      </div>
      <Field label="Search"><TextInput type="search" value={query} onValue={setQuery} placeholder="Egg, rice, chicken…" /></Field>
      <div class="list">
        {shown.map((f) => (
          <button key={f.id} type="button" class="list-row" onClick={() => setPicked(f)}>
            <div><b>{f.name}</b><div class="tiny">{f.serving} · {fmt(f.kcal)} kcal · P {one(f.p)} · C {one(f.c)} · F {one(f.f)}</div></div>
            <PlusIcon class="chev" />
          </button>
        ))}
        {!shown.length && <div class="empty">No foods match. You can add your own on the Foods screen.</div>}
      </div>
      <button type="button" class="btn subtle block" onClick={onClose}>Done</button>
    </Sheet>
  );
}

/** Quantity, order, moving and removal for one planned food. */
export function EditItemSheet({ mealId, foodId, onClose }: { mealId: string; foodId: string; onClose: () => void }) {
  const { state, ui } = useStore();
  const food = getFoodMap().get(foodId);
  const items = state.plan[ui.day][mealId] ?? [];
  const index = items.findIndex((x) => x.foodId === foodId);
  const stored = items[index]?.servings ?? 0;
  const [qty, setQty] = useState(String(stored));
  const others = state.mealSlots.filter((s) => s.id !== mealId);
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? '');
  const [yieldOpen, setYieldOpen] = useState(false);
  const [error, setError] = useState('');
  if (!food) return null;
  if (yieldOpen) return <YieldSheet food={food} onClose={() => setYieldOpen(false)} />;
  const n = qty.trim() === '' ? NaN : Number(qty);
  const valid = Number.isFinite(n) && n >= 0 && n <= 100;
  const slotName = state.mealSlots.find((s) => s.id === mealId)?.name ?? '';
  const amount = moveAmount(stored);
  const day = ui.day;
  const reorder = (direction: -1 | 1) => update((s) => ({ ...s, plan: reorderItem(s.plan, day, mealId, foodId, direction) }));

  return (
    <Sheet title={food.name} onClose={onClose}>
      <p class="small muted">One serving: {food.serving}. Weights and nutrition scale with quantity.</p>
      <div class="label">Servings in {slotName}</div>
      <Stepper label="servings" value={qty} onValue={(v) => { setQty(v); setError(''); }} step={0.25} />
      {valid && n > 0 && <PrepPreview food={food} servings={n} />}
      {error && <div class="notice danger">{error}</div>}
      <div class="row">
        <button
          type="button"
          class="btn primary grow"
          onClick={() => {
            if (!valid) { setError('Enter a number from 0 to 100, or use Remove to delete this food.'); return; }
            const before = stored;
            updateWithUndo((s) => ({ ...s, plan: setServings(s.plan, day, mealId, foodId, n) }), n > 0 ? `${food.name}: ${servingsText(n)} serving${n === 1 ? '' : 's'}` : `Removed ${food.name}`);
            if (before !== n) setQty(String(n));
            onClose();
          }}
        >
          Save
        </button>
        <button type="button" class="btn danger grow" onClick={() => { updateWithUndo((s) => ({ ...s, plan: setServings(s.plan, day, mealId, foodId, 0) }), `Removed ${food.name}`); onClose(); }}>Remove</button>
      </div>
      {items.length > 1 && (
        <div class="row between">
          <span class="label">Position in {slotName}</span>
          <span class="row">
            <button type="button" class="btn subtle" aria-label="Move up in meal" disabled={index <= 0} onClick={() => reorder(-1)}><UpIcon /></button>
            <button type="button" class="btn subtle" aria-label="Move down in meal" disabled={index >= items.length - 1} onClick={() => reorder(1)}><DownIcon /></button>
          </span>
        </div>
      )}
      {others.length > 0 && (
        <>
          <Field label={`Move ${servingsText(amount)} serving${amount === 1 ? '' : 's'} to another meal`}>
            <Select value={moveTo} onValue={setMoveTo} options={others.map((s) => ({ value: s.id, label: s.name }))} />
          </Field>
          <button
            type="button"
            class="btn subtle block"
            onClick={() => {
              const to = others.find((s) => s.id === moveTo);
              updateWithUndo((s) => ({ ...s, plan: moveOneServing(s.plan, day, mealId, day, moveTo, foodId) }), `Moved ${servingsText(amount)} × ${food.name} to ${to?.name ?? 'meal'}`);
              onClose();
            }}
          >
            Move <RightIcon />
          </button>
        </>
      )}
      {foodWeight(food, state.yieldOverrides).stage === 'cooked' && (
        <button type="button" class="btn subtle block" onClick={() => setYieldOpen(true)}>Adjust cooking yield</button>
      )}
    </Sheet>
  );
}

export function YieldSheet({ food, onClose }: { food: Food; onClose: () => void }) {
  const { state } = useStore();
  const w = foodWeight(food, state.yieldOverrides);
  const [yieldPct, setYieldPct] = useState(w.yield ? String(Math.round(w.yield * 1000) / 10) : '');
  const [ediblePct, setEdiblePct] = useState(String(Math.round((w.edibleYield ?? 1) * 1000) / 10));
  const [error, setError] = useState('');
  const y = num(yieldPct) / 100;
  const e = num(ediblePct) / 100;
  const ok = y >= 0.1 && y <= 5 && e >= 0.1 && e <= 1;
  const preview = ok ? prepInfo(food, 1, { [food.id]: { yield: y, edibleYield: e } }) : null;
  return (
    <Sheet title={`Cooking yield: ${food.name}`} onClose={onClose}>
      <p class="small muted">These values change weights, not nutrition, and apply everywhere this food appears.</p>
      <Field label="Cooked weight as % of starting raw/dry weight"><NumberInput value={yieldPct} onValue={(v) => { setYieldPct(v); setError(''); }} /></Field>
      <Field label="Edible portion after cooking (% of cooked food)"><NumberInput value={ediblePct} onValue={(v) => { setEdiblePct(v); setError(''); }} /></Field>
      <p class="note">{w.source ?? 'Illustrative starting yield. Actual yield changes with cooking method and moisture loss.'} {w.edibleYield && w.edibleYield < 1 ? 'The second percentage accounts for discarding baked skin.' : 'Usually 100% when the cooked serving is all edible.'}</p>
      {preview && <div class="weight-preview small"><div class="weight-primary">{preview.lines[0] ?? preview.primary}</div><div class="weight-secondary">{preview.primary}</div></div>}
      {error && <div class="notice danger">{error}</div>}
      <div class="row">
        <button
          type="button"
          class="btn primary grow"
          onClick={() => {
            if (!ok) { setError('Enter a cooking yield from 10 to 500% and an edible portion from 10 to 100%.'); return; }
            update((s) => ({ ...s, yieldOverrides: { ...s.yieldOverrides, [food.id]: { yield: y, edibleYield: e } } }));
            showToast(`Saved yield for ${food.name}`);
            onClose();
          }}
        >
          Save
        </button>
        <button
          type="button"
          class="btn subtle grow"
          onClick={() => {
            update((s) => {
              const next = { ...s.yieldOverrides };
              delete next[food.id];
              return { ...s, yieldOverrides: next };
            });
            showToast(`Reset yield for ${food.name}`);
            onClose();
          }}
        >
          Reset default
        </button>
      </div>
    </Sheet>
  );
}

/** Add or edit a custom food. Blank nutrition is rejected instead of being saved as zero. */
export function FoodFormSheet({ food, onClose }: { food?: Food; onClose: () => void }) {
  const initial = food?.weight;
  const [name, setName] = useState(food?.name ?? '');
  const [serving, setServing] = useState(food?.serving ?? '');
  const [category, setCategory] = useState(food?.category ?? 'Custom');
  const [mass, setMass] = useState(initial?.g ? String(initial.g) : '');
  const [stage, setStage] = useState<Stage>(initial?.stage ?? 'ready');
  const [yieldPct, setYieldPct] = useState(initial?.yield ? String(Math.round(initial.yield * 1000) / 10) : '');
  const [kcal, setKcal] = useState(food ? String(food.kcal) : '');
  const [p, setP] = useState(food ? String(food.p) : '');
  const [c, setC] = useState(food ? String(food.c) : '');
  const [f, setF] = useState(food ? String(food.f) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter a name.';
    if (!serving.trim()) e.serving = 'Describe the serving, such as 1 bar or 100 g.';
    const nutrition: [string, string, string][] = [['kcal', kcal, 'calories'], ['p', p, 'protein'], ['c', c, 'carbs'], ['f', f, 'fat']];
    for (const [key, value, label] of nutrition) {
      if (value.trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0) e[key] = `Enter ${label} (use 0 if there is none).`;
    }
    const massNum = num(mass);
    if (mass.trim() && massNum <= 0) e.mass = 'Enter a positive weight or leave this blank.';
    const yieldNum = num(yieldPct);
    if (yieldPct.trim() && (yieldNum < 10 || yieldNum > 500)) e.yield = 'Enter 10 to 500%, or leave this blank if unknown.';
    setErrors(e);
    if (Object.keys(e).length) return;

    let weight: FoodWeight | undefined;
    if (massNum > 0) {
      weight = { g: massNum, stage };
      if (stage === 'cooked') {
        weight.rawLabel = 'raw ingredient for cooking';
        if (yieldNum) weight.yield = yieldNum / 100;
      }
    }
    const next: Food = {
      id: food?.id ?? makeCustomId('custom'),
      name: name.trim(), serving: serving.trim(), category,
      kcal: Number(kcal), p: Number(p), c: Number(c), f: Number(f), custom: true,
      ...(weight ? { weight } : {}),
    };
    update((s) => ({ ...s, customFoods: food ? s.customFoods.map((x) => (x.id === food.id ? next : x)) : [...s.customFoods, next] }));
    showToast(food ? `Saved ${next.name}` : `Added ${next.name} to your foods`);
    onClose();
  };

  return (
    <Sheet title={food ? 'Edit food' : 'Add your own food'} onClose={onClose}>
      <Field label="Food name" error={errors.name}><TextInput value={name} onValue={setName} maxLength={120} /></Field>
      <div class="form-grid">
        <Field label="Serving" error={errors.serving}><TextInput value={serving} onValue={setServing} placeholder="1 bar / 100 g" maxLength={120} /></Field>
        <Field label="Category"><Select value={category} onValue={setCategory} options={FOOD_CATEGORIES.map((v) => ({ value: v, label: v }))} /></Field>
        <Field label="Calories" error={errors.kcal}><NumberInput value={kcal} onValue={setKcal} min={0} /></Field>
        <Field label="Protein (g)" error={errors.p}><NumberInput value={p} onValue={setP} min={0} /></Field>
        <Field label="Carbs (g)" error={errors.c}><NumberInput value={c} onValue={setC} min={0} /></Field>
        <Field label="Fat (g)" error={errors.f}><NumberInput value={f} onValue={setF} min={0} /></Field>
        <Field label="Serving weight (g)" hint="Optional. Enables total weights." error={errors.mass}><NumberInput value={mass} onValue={setMass} min={0} /></Field>
        <Field label="Weight measured as">
          <Select value={stage} onValue={(v) => setStage(v as Stage)} options={[{ value: 'ready', label: 'Ready to eat / raw' }, { value: 'dry', label: 'Dry' }, { value: 'cooked', label: 'Cooked' }]} />
        </Field>
        {stage === 'cooked' && (
          <Field class="wide" label="Cooking yield (%)" hint="Optional. Cooked weight ÷ raw weight × 100. Leave blank if unknown; you just won't see a raw weight estimate." error={errors.yield}>
            <NumberInput value={yieldPct} onValue={setYieldPct} min={10} max={500} />
          </Field>
        )}
      </div>
      <button type="button" class="btn primary block" onClick={submit}>{food ? 'Save food' : 'Add food'}</button>
    </Sheet>
  );
}

export function CopySheet({ mealId, onClose }: { mealId?: string; onClose: () => void }) {
  const { state, ui } = useStore();
  const [days, setDays] = useState<number[]>([]);
  const [replace, setReplace] = useState(true);
  const slot = state.mealSlots.find((s) => s.id === mealId);
  const label = slot ? slot.name : 'all meals';
  const toggle = (d: number) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));
  const others = DAYS.map((_, i) => i).filter((i) => i !== ui.day);
  return (
    <Sheet title={`Copy ${label} from ${DAYS[ui.day]}`} onClose={onClose}>
      <p class="small muted">Exercises and calorie goals are never changed.</p>
      <div class="chips">
        {others.map((d) => <button key={d} type="button" class="chip" aria-pressed={days.includes(d)} onClick={() => toggle(d)}>{DAYS[d].slice(0, 3)}</button>)}
        <button type="button" class="chip" onClick={() => setDays(days.length === others.length ? [] : others)}>{days.length === others.length ? 'None' : 'All'}</button>
      </div>
      <label class="toggle-row"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.currentTarget.checked)} /> Replace what's there (otherwise add to it)</label>
      <button
        type="button"
        class="btn primary block"
        disabled={!days.length}
        onClick={() => {
          const from = ui.day;
          const ids = mealId ? [mealId] : getState().mealSlots.map((s) => s.id);
          updateWithUndo((s) => ({ ...s, plan: copyMeals(s.plan, from, days, ids, replace) }), `Copied ${label} to ${days.length} day${days.length === 1 ? '' : 's'}`);
          onClose();
        }}
      >
        Copy to {days.length || 'selected'} day{days.length === 1 ? '' : 's'}
      </button>
    </Sheet>
  );
}

/** Copies to the clipboard, or shows the text for manual copying where that isn't allowed. */
export async function copyText(content: string, fallback: (text: string) => void): Promise<void> {
  try {
    await navigator.clipboard.writeText(content);
    showToast('Copied');
  } catch {
    fallback(content);
  }
}

export function ManualCopySheet({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <Sheet title="Copy this text" onClose={onClose}>
      <textarea readOnly value={text} rows={10} aria-label="Text to copy" onFocus={(e) => e.currentTarget.select()} />
    </Sheet>
  );
}

