import { useState } from 'preact/hooks';
import { defaultState } from '../../state/defaults';
import { replaceState, showToast, update, updateWithUndo, useStore } from '../../state/store';
import { Card, ConfirmSheet, Field, Sheet, TextInput } from '../../ui/components';
import { DownIcon, EditIcon, GearIcon, PlusIcon, TrashIcon, UpIcon } from '../../ui/icons';
import { arrangeModules, moveModule } from '../arrange';
import type { AppModule } from '../types';
import { BackupCard } from './backup';

function ArrangeCard({ modules }: { modules: AppModule[] }) {
  const { state } = useStore();
  const ordered = arrangeModules(modules, state.moduleOrder);
  return (
    <Card title="Arrange the app">
      <p class="note">The first four visible screens go in the tab bar on your phone, and the rest are under More.</p>
      <div class="list">
        {ordered.map((m, i) => {
          const hidden = state.hiddenModules.includes(m.id);
          return (
            <div class="list-row" key={m.id}>
              <label class="toggle-row grow">
                <input
                  type="checkbox"
                  checked={!hidden}
                  aria-label={`Show ${m.title}`}
                  onChange={(e) => {
                    const show = e.currentTarget.checked;
                    update((s) => ({ ...s, hiddenModules: show ? s.hiddenModules.filter((x) => x !== m.id) : [...s.hiddenModules, m.id] }));
                  }}
                />
                {m.title}
              </label>
              <div class="row-actions">
                <button type="button" class="icon-btn" aria-label={`Move ${m.title} up`} disabled={i === 0} onClick={() => update((s) => ({ ...s, moduleOrder: moveModule(ordered.map((x) => x.id), m.id, -1) }))}><UpIcon /></button>
                <button type="button" class="icon-btn" aria-label={`Move ${m.title} down`} disabled={i === ordered.length - 1} onClick={() => update((s) => ({ ...s, moduleOrder: moveModule(ordered.map((x) => x.id), m.id, 1) }))}><DownIcon /></button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function MealNameSheet({ slotId, onClose }: { slotId?: string; onClose: () => void }) {
  const { state } = useStore();
  const slot = state.mealSlots.find((s) => s.id === slotId);
  const [name, setName] = useState(slot?.name ?? '');
  const [error, setError] = useState('');
  const save = () => {
    const clean = name.trim();
    if (!clean) { setError('Enter a meal name.'); return; }
    if (state.mealSlots.some((s) => s.id !== slotId && s.name.toLowerCase() === clean.toLowerCase())) { setError('You already have a meal with that name.'); return; }
    if (slot) {
      update((s) => ({ ...s, mealSlots: s.mealSlots.map((x) => (x.id === slot.id ? { ...x, name: clean } : x)) }));
    } else {
      const id = `meal-${Date.now().toString(36)}`;
      update((s) => ({ ...s, mealSlots: [...s.mealSlots, { id, name: clean }], plan: s.plan.map((d) => ({ ...d, [id]: [] })) }));
    }
    showToast(`Saved ${clean}`);
    onClose();
  };
  return (
    <Sheet title={slot ? 'Rename meal' : 'Add a meal'} onClose={onClose}>
      <Field label="Meal name" error={error}><TextInput value={name} onValue={(v) => { setName(v); setError(''); }} maxLength={40} placeholder="Pre-workout" /></Field>
      <button type="button" class="btn primary block" onClick={save}>Save</button>
    </Sheet>
  );
}

function MealsCard() {
  const { state } = useStore();
  const [naming, setNaming] = useState<string | 'new' | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const slots = state.mealSlots;
  const move = (i: number, dir: -1 | 1) => update((s) => {
    const next = [...s.mealSlots];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    return { ...s, mealSlots: next };
  });
  const target = slots.find((s) => s.id === removing);
  return (
    <Card title="Meals" action={<button type="button" class="btn" onClick={() => setNaming('new')}><PlusIcon /> Add</button>}>
      <div class="list">
        {slots.map((slot, i) => (
          <div class="list-row" key={slot.id}>
            <div><b>{slot.name}</b></div>
            <div class="row-actions">
              <button type="button" class="icon-btn" aria-label={`Rename ${slot.name}`} onClick={() => setNaming(slot.id)}><EditIcon /></button>
              <button type="button" class="icon-btn" aria-label={`Move ${slot.name} up`} disabled={i === 0} onClick={() => move(i, -1)}><UpIcon /></button>
              <button type="button" class="icon-btn" aria-label={`Move ${slot.name} down`} disabled={i === slots.length - 1} onClick={() => move(i, 1)}><DownIcon /></button>
              <button type="button" class="icon-btn danger" aria-label={`Remove ${slot.name}`} disabled={slots.length === 1} onClick={() => setRemoving(slot.id)}><TrashIcon /></button>
            </div>
          </div>
        ))}
      </div>
      {naming && <MealNameSheet slotId={naming === 'new' ? undefined : naming} onClose={() => setNaming(null)} />}
      {target && (
        <ConfirmSheet
          title={`Remove ${target.name}?`}
          message="This removes the meal and its planned foods from every day. You can undo it straight afterwards."
          confirmLabel="Remove meal"
          danger
          onConfirm={() => updateWithUndo((s) => ({
            ...s,
            mealSlots: s.mealSlots.filter((x) => x.id !== target.id),
            plan: s.plan.map((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== target.id))),
          }), `Removed ${target.name}`)}
          onClose={() => setRemoving(null)}
        />
      )}
    </Card>
  );
}

function AboutCard() {
  return (
    <Card title="About & sources">
      <p class="note">This is a planning aid, not medical advice or a food-intake log. Check with a clinician before dieting if you're pregnant or breastfeeding, have a health condition, or have a history of disordered eating.</p>
      <p class="note">Nutrition values are approximate USDA FoodData Central reference values; the protein shake is an illustrative label. Cooked-food macros use the listed cooked edible portion, and raw or dry weights are estimates for preparing those portions. Yield varies with moisture, fat loss, peeling and method, so adjust it per food for your own batch. Oils, sauces and cooking method can change nutrition. Reference calories may not equal 4×protein + 4×carbs + 9×fat because of fiber, rounding and analytical methods.</p>
      <ul class="progress-steps small">
        <li><a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener noreferrer">USDA FoodData Central</a></li>
        <li><a href="https://www.ars.usda.gov/ARSUserFiles/80400530/pdf/ah102.pdf" target="_blank" rel="noopener noreferrer">USDA food yield handbook</a></li>
        <li><a href="https://www.ars.usda.gov/ARSUserFiles/80400535/Data/retn/USDA_CookingYields_MeatPoultry02.pdf" target="_blank" rel="noopener noreferrer">USDA meat and poultry yield guidance</a></li>
        <li><a href="https://www.niddk.nih.gov/bwp" target="_blank" rel="noopener noreferrer">NIH Body Weight Planner</a></li>
      </ul>
    </Card>
  );
}

export function createSettingsModule(getModules: () => AppModule[]): AppModule {
  function SettingsScreen() {
    const [resetting, setResetting] = useState(false);
    return (
      <>
        <BackupCard />
        <ArrangeCard modules={getModules()} />
        <MealsCard />
        <AboutCard />
        <Card title="Start over">
          <p class="note">Erases your whole plan and profile from this browser. Save a backup first if you might want them back.</p>
          <button type="button" class="btn danger block" onClick={() => setResetting(true)}>Erase everything</button>
        </Card>
        {resetting && (
          <ConfirmSheet
            title="Erase everything?"
            message="Your profile, plans, workouts and your own foods will be deleted from this browser. This can't be undone without a backup."
            confirmLabel="Erase everything"
            danger
            onConfirm={() => {
              replaceState(defaultState());
              showToast('Everything erased');
            }}
            onClose={() => setResetting(false)}
          />
        )}
      </>
    );
  }
  return {
    id: 'settings',
    title: 'Settings & backup',
    navLabel: 'Settings',
    description: 'Back up or restore your plan, arrange the app and edit your meals.',
    icon: GearIcon,
    component: SettingsScreen,
  };
}
