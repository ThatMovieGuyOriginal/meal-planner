import { useState } from 'preact/hooks';
import { allFoods, filterFoods, foodCategories } from '../../domain/foods';
import { addServings, dayItems, moveOneServing, removeServings, totalsFor, emptyDay } from '../../domain/plan';
import { fmt, one, servingsText } from '../../domain/format';
import { DAYS, type MealSlot } from '../../domain/types';
import { getFoodMap, getMacros, getTargets, updateWithUndo, useStore } from '../../state/store';
import { Card, ConfirmSheet, DayMeters, DayStrip, Field, Meter, Select, StatTile, TextInput } from '../../ui/components';
import { MealIcon, PlusIcon, RightIcon } from '../../ui/icons';
import { CopySheet, EditItemSheet, FoodPickerSheet, PrepLines, macrosLine } from '../../ui/shared';
import type { AppModule } from '../types';

/** The item being dragged on desktop. Touch screens use the Add food sheet instead. */
type Dragged = { type: 'library'; id: string } | { type: 'meal'; id: string; meal: string; day: number };
let dragged: Dragged | null = null;
const canDrag = () => typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;

function MealCard({ slot, day, onAdd, onEdit, onCopy }: { slot: MealSlot; day: number; onAdd: () => void; onEdit: (foodId: string) => void; onCopy: () => void }) {
  const { state } = useStore();
  const [over, setOver] = useState(false);
  const foods = getFoodMap();
  const items = state.plan[day][slot.id] ?? [];
  const t = totalsFor(items, foods);
  const draggable = canDrag();

  const drop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    const d = dragged;
    dragged = null;
    if (!d) return;
    const name = foods.get(d.id)?.name ?? 'food';
    if (d.type === 'library') {
      updateWithUndo((s) => ({ ...s, plan: addServings(s.plan, day, slot.id, d.id, 1) }), `Added 1 × ${name} to ${slot.name}`);
    } else if (!(d.day === day && d.meal === slot.id)) {
      updateWithUndo((s) => ({ ...s, plan: moveOneServing(s.plan, d.day, d.meal, day, slot.id, d.id) }), `Moved ${name} to ${slot.name}`);
    }
  };

  return (
    <section
      class={`card meal ${over ? 'over' : ''}`}
      aria-label={slot.name}
      onDragOver={(e) => { if (dragged) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={drop}
    >
      <div class="card-head">
        <h3>{slot.name}</h3>
        <button type="button" class="btn subtle" onClick={onCopy}>Copy <RightIcon /></button>
      </div>
      {items.length === 0 && <div class="empty">Nothing planned yet</div>}
      {items.map(({ foodId, servings }) => {
        const food = foods.get(foodId);
        if (!food) return null;
        return (
          <button
            key={foodId}
            type="button"
            class="meal-item"
            draggable={draggable}
            onDragStart={(e) => { dragged = { type: 'meal', id: foodId, meal: slot.id, day }; if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; e.dataTransfer?.setData('text/plain', foodId); }}
            onClick={() => onEdit(foodId)}
          >
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              <b class="small">{food.name} · {servingsText(servings)}×</b> <span class="tiny">({food.serving} each)</span>
              <PrepLines food={food} servings={servings} />
              <span class="tiny" style={{ display: 'block', marginTop: '2px' }}>{macrosLine(food, servings)}</span>
            </span>
            <RightIcon class="chev" />
          </button>
        );
      })}
      <button type="button" class="btn block" onClick={onAdd}><PlusIcon /> Add food</button>
      <div class="meal-totals tabular">
        <strong>{fmt(t.kcal)} kcal</strong><span>P {one(t.p)}g</span><span>C {one(t.c)}g</span><span>F {one(t.f)}g</span>
      </div>
    </section>
  );
}

function LibraryPanel() {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const foods = allFoods(state.customFoods);
  return (
    <section class="card library-panel" aria-label="Food library">
      <h2>Foods</h2>
      <div class="stack">
        <Field label="Search"><TextInput type="search" value={query} onValue={setQuery} placeholder="Egg, rice, chicken…" /></Field>
        <Field label="Category"><Select value={category} onValue={setCategory} options={foodCategories(foods).map((c) => ({ value: c, label: c }))} /></Field>
        <p class="note">Drag a food into a meal to add one serving.</p>
      </div>
      <div class="food-scroll">
        {filterFoods(foods, query, category).map((f) => (
          <div
            key={f.id}
            class="list-row"
            draggable
            onDragStart={(e) => { dragged = { type: 'library', id: f.id }; if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer?.setData('text/plain', f.id); }}
          >
            <div><b>{f.name}</b><div class="tiny">{f.serving} · {fmt(f.kcal)} kcal</div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MealsScreen() {
  const { state, ui } = useStore();
  const day = ui.day;
  const foods = getFoodMap();
  const targets = getTargets();
  const macros = getMacros(day);
  const totals = totalsFor(dayItems(state.plan[day], state.mealSlots), foods);
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ mealId: string; foodId: string } | null>(null);
  const [copying, setCopying] = useState<{ mealId?: string } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [trashOver, setTrashOver] = useState(false);
  const diff = totals.kcal - macros.calories;
  const dropRemove = (e: DragEvent) => {
    e.preventDefault();
    setTrashOver(false);
    const d = dragged;
    dragged = null;
    if (d?.type !== 'meal') return;
    const name = foods.get(d.id)?.name ?? 'food';
    updateWithUndo((s) => ({ ...s, plan: removeServings(s.plan, d.day, d.meal, d.id, 1) }), `Removed one serving of ${name}`);
  };

  return (
    <>
      <DayStrip />
      <div class="card day-summary"><Meter label={DAYS[day]} actual={totals.kcal} goal={macros.calories} unit="kcal" /></div>
      <div class="planner-layout with-library">
        <LibraryPanel />
        <div class="stack">
          <p class="note pointer-only">Drag a food in from the list, or use Add food. Drag an item to another meal to move one serving. Click an item to edit it.</p>
          <div class="meals-grid">
            {state.mealSlots.map((slot) => (
              <MealCard
                key={slot.id}
                slot={slot}
                day={day}
                onAdd={() => setAdding(slot.id)}
                onEdit={(foodId) => setEditing({ mealId: slot.id, foodId })}
                onCopy={() => setCopying({ mealId: slot.id })}
              />
            ))}
          </div>
          <div
            class={`trash pointer-only ${trashOver ? 'over' : ''}`}
            onDragOver={(e) => { if (dragged?.type === 'meal') { e.preventDefault(); setTrashOver(true); } }}
            onDragLeave={() => setTrashOver(false)}
            onDrop={dropRemove}
          >
            Drop a meal item here to remove one serving
          </div>
          <Card title={`Planned for ${DAYS[day]}`}>
            <DayMeters totals={totals} macros={macros} />
            <div class="tiles">
              <StatTile label="Planned" value={`${fmt(totals.kcal)} kcal`} />
              <StatTile label="Difference" value={targets.valid ? `${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff))}` : '—'} sub={targets.valid ? (diff > 0 ? 'kcal over target' : diff < 0 ? 'kcal under target' : 'on target') : 'add your profile to compare'} />
            </div>
            <p class="note">
              {targets.valid && macros.feasible
                ? `Left to plan: ${one(macros.proteinGrams - totals.p)} g protein · ${one(macros.carbGrams - totals.c)} g carbs · ${one(macros.fatGrams - totals.f)} g fat. Negative means over target. Planned meals aren't logged as eaten.`
                : 'Add your profile on the Targets screen to compare this plan with your targets.'}
            </p>
            <div class="row">
              <button type="button" class="btn grow" onClick={() => setCopying({})}>Copy whole day <RightIcon /></button>
              <a class="btn grow" href="#/prep">Prep list</a>
              <button type="button" class="btn subtle grow" onClick={() => setClearing(true)}>Clear day</button>
            </div>
          </Card>
        </div>
      </div>
      {adding && <FoodPickerSheet mealId={adding} onClose={() => setAdding(null)} />}
      {editing && <EditItemSheet {...editing} onClose={() => setEditing(null)} />}
      {copying && <CopySheet mealId={copying.mealId} onClose={() => setCopying(null)} />}
      {clearing && (
        <ConfirmSheet
          title={`Clear ${DAYS[day]}?`}
          message="This removes every planned food for this day. You can undo it straight afterwards."
          confirmLabel="Clear day"
          danger
          onConfirm={() => updateWithUndo((s) => ({ ...s, plan: s.plan.map((d, i) => (i === day ? emptyDay(s.mealSlots) : d)) }), `Cleared ${DAYS[day]}`)}
          onClose={() => setClearing(false)}
        />
      )}
    </>
  );
}

export const mealsModule: AppModule = {
  id: 'meals',
  title: 'Meal planner',
  navLabel: 'Meals',
  description: 'Build each day, compare it with your targets and copy meals across days.',
  icon: MealIcon,
  component: MealsScreen,
};
