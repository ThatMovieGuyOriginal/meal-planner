import { useState } from 'preact/hooks';
import { allFoods, filterFoods, foodCategories, foodWeight } from '../../domain/foods';
import { addServings, countFoodUses, removeFoodEverywhere } from '../../domain/plan';
import { fmt, one, servingsText } from '../../domain/format';
import { prepInfo } from '../../domain/prep';
import { DAYS, type Food } from '../../domain/types';
import { setUi, updateWithUndo, useStore } from '../../state/store';
import { ConfirmSheet, Card, DayStrip, Field, Select, Sheet, Stepper, TextInput } from '../../ui/components';
import { AppleIcon, EditIcon, PlusIcon, TrashIcon } from '../../ui/icons';
import { FoodFormSheet, PrepPreview, YieldSheet } from '../../ui/shared';
import type { AppModule } from '../types';

function AddToMealSheet({ food, onClose }: { food: Food; onClose: () => void }) {
  const { state, ui } = useStore();
  const [meal, setMeal] = useState(ui.mealId && state.mealSlots.some((s) => s.id === ui.mealId) ? ui.mealId : state.mealSlots[0].id);
  const [amount, setAmount] = useState('1');
  const n = Number(amount);
  const ok = n > 0 && n <= 100;
  const slot = state.mealSlots.find((s) => s.id === meal);
  return (
    <Sheet title={`Add ${food.name}`} onClose={onClose}>
      <DayStrip />
      <Field label="Meal"><Select value={meal} onValue={setMeal} options={state.mealSlots.map((s) => ({ value: s.id, label: s.name }))} /></Field>
      <div class="label">Servings ({food.serving} each)</div>
      <Stepper label="servings" value={amount} onValue={setAmount} step={0.25} />
      {ok && <PrepPreview food={food} servings={n} />}
      <button
        type="button"
        class="btn primary block"
        disabled={!ok}
        onClick={() => {
          const day = ui.day;
          updateWithUndo((s) => ({ ...s, plan: addServings(s.plan, day, meal, food.id, n) }), `Added ${servingsText(n)} × ${food.name} to ${slot?.name}, ${DAYS[day].slice(0, 3)}`);
          setUi({ mealId: meal });
          onClose();
        }}
      >
        Add to {slot?.name} on {DAYS[ui.day].slice(0, 3)}
      </button>
    </Sheet>
  );
}

function FoodsScreen() {
  const { state } = useStore();
  const foods = allFoods(state.customFoods);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [adding, setAdding] = useState<Food | null>(null);
  const [yieldFor, setYieldFor] = useState<Food | null>(null);
  const [form, setForm] = useState<Food | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Food | null>(null);
  const shown = filterFoods(foods, query, category);
  const categories = foodCategories(foods);

  return (
    <>
      <Card title="Food library" action={<span class="tiny">{shown.length} food{shown.length === 1 ? '' : 's'}</span>}>
        <div class="form-grid">
          <Field label="Search"><TextInput type="search" value={query} onValue={setQuery} placeholder="Egg, rice, chicken…" /></Field>
          <Field label="Category"><Select value={categories.includes(category) ? category : 'All'} onValue={setCategory} options={categories.map((c) => ({ value: c, label: c }))} /></Field>
        </div>
        <button type="button" class="btn block" onClick={() => setForm('new')}><PlusIcon /> Add your own food</button>
        <div class="list">
          {shown.map((f) => {
            const w = foodWeight(f, state.yieldOverrides);
            return (
              <div class="list-row" key={f.id}>
                <div>
                  <b>{f.name}</b>
                  <div class="tiny">{f.serving} · {fmt(f.kcal)} kcal · P {one(f.p)}g · C {one(f.c)}g · F {one(f.f)}g</div>
                  {w.g ? <div class="tiny">{prepInfo(f, 1, state.yieldOverrides).primary}</div> : null}
                </div>
                <div class="row-actions">
                  {w.stage === 'cooked' && <button type="button" class="btn subtle" aria-label={`Cooking yield for ${f.name}`} onClick={() => setYieldFor(f)}>Yield</button>}
                  {f.custom && <button type="button" class="icon-btn" aria-label={`Edit ${f.name}`} onClick={() => setForm(f)}><EditIcon /></button>}
                  {f.custom && <button type="button" class="icon-btn danger" aria-label={`Delete ${f.name}`} onClick={() => setDeleting(f)}><TrashIcon /></button>}
                  <button type="button" class="btn" aria-label={`Add ${f.name} to a meal`} onClick={() => setAdding(f)}><PlusIcon /></button>
                </div>
              </div>
            );
          })}
          {!shown.length && <div class="empty">No foods match. Add it as your own food above.</div>}
        </div>
      </Card>
      <p class="tiny" style={{ padding: '0 4px' }}>Approximate USDA FoodData Central reference values. Sources are listed in Settings.</p>
      {adding && <AddToMealSheet food={adding} onClose={() => setAdding(null)} />}
      {yieldFor && <YieldSheet food={yieldFor} onClose={() => setYieldFor(null)} />}
      {form && <FoodFormSheet food={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
      {deleting && (
        <ConfirmSheet
          title={`Delete ${deleting.name}?`}
          message={(() => {
            const uses = countFoodUses(state.plan, deleting.id);
            return uses ? `It's in ${uses} planned meal${uses === 1 ? '' : 's'} and will be removed from them. You can undo this straight afterwards.` : 'You can undo this straight afterwards.';
          })()}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            const id = deleting.id;
            updateWithUndo((s) => {
              const yieldOverrides = { ...s.yieldOverrides };
              delete yieldOverrides[id];
              return { ...s, customFoods: s.customFoods.filter((x) => x.id !== id), plan: removeFoodEverywhere(s.plan, id), yieldOverrides };
            }, `Deleted ${deleting.name}`);
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

export const foodsModule: AppModule = {
  id: 'foods',
  title: 'Foods',
  navLabel: 'Foods',
  description: 'Browse foods, add your own, edit or delete them, and adjust cooking yields.',
  icon: AppleIcon,
  component: FoodsScreen,
};
