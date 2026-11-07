import { useState } from 'preact/hooks';
import { allExercises, exerciseLookup, makeCustomId } from '../../domain/exercises';
import { exerciseKcal } from '../../domain/calc';
import { clamp, fmt, num } from '../../domain/format';
import { DAYS, type ExerciseDef } from '../../domain/types';
import { getTargets, showToast, update, updateWithUndo, useStore } from '../../state/store';
import { Card, ConfirmSheet, DayStrip, Field, NumberInput, Select, Sheet, TextInput } from '../../ui/components';
import { DumbbellIcon, EditIcon, PlusIcon, TrashIcon } from '../../ui/icons';
import type { AppModule } from '../types';

const LEVELS = ['Light', 'Moderate', 'Brisk', 'Vigorous', 'Very vigorous'];

function ExerciseFormSheet({ exercise, onClose }: { exercise?: ExerciseDef; onClose: () => void }) {
  const [name, setName] = useState(exercise?.name ?? '');
  const [level, setLevel] = useState(exercise?.level ?? 'Moderate');
  const [met, setMet] = useState(exercise ? String(exercise.met) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter a name.';
    const m = Number(met);
    if (met.trim() === '' || !(m >= 1 && m <= 25)) e.met = 'Enter a MET value from 1 to 25.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const next: ExerciseDef = { id: exercise?.id ?? makeCustomId('customex'), name: name.trim(), level, met: m, custom: true };
    update((s) => ({ ...s, customExercises: exercise ? s.customExercises.map((x) => (x.id === exercise.id ? next : x)) : [...s.customExercises, next] }));
    showToast(exercise ? `Saved ${next.name}` : `Added ${next.name} to your exercises`);
    onClose();
  };
  return (
    <Sheet title={exercise ? 'Edit exercise' : 'Add your own exercise'} onClose={onClose}>
      <Field label="Exercise name" error={errors.name}><TextInput value={name} onValue={setName} maxLength={120} placeholder="Barre class" /></Field>
      <div class="form-grid">
        <Field label="Intensity"><Select value={level} onValue={setLevel} options={LEVELS.map((v) => ({ value: v, label: v }))} /></Field>
        <Field label="MET value" error={errors.met}><NumberInput value={met} onValue={setMet} min={1} max={25} /></Field>
      </div>
      <p class="note">MET measures effort: about 3 for easy movement, 5 to 7 for moderate work and 8 or more for hard work. It will appear in alphabetical order with everything else.</p>
      <button type="button" class="btn primary block" onClick={submit}>{exercise ? 'Save exercise' : 'Add exercise'}</button>
    </Sheet>
  );
}

function ExerciseScreen() {
  const { state, ui } = useStore();
  const day = ui.day;
  const t = getTargets();
  const credit = num(state.fields.credit) || 0.75;
  const list = allExercises(state.customExercises);
  const lookup = exerciseLookup(state.customExercises);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [minutes, setMinutes] = useState('60');
  const [formFor, setFormFor] = useState<ExerciseDef | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ExerciseDef | null>(null);
  const q = query.trim().toLowerCase();
  const filtered = list.filter((x) => `${x.name} ${x.level}`.toLowerCase().includes(q));
  const chosen = filtered.some((x) => x.id === selected) ? selected : filtered[0]?.id ?? '';
  const entries = state.schedule[day];
  const minutesNum = Number(minutes);
  const minutesOk = minutesNum >= 1 && minutesNum <= 360;
  const custom = [...state.customExercises].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  const setSchedule = (next: typeof entries) => update((s) => ({ ...s, schedule: s.schedule.map((d, i) => (i === day ? next : d)) }));

  return (
    <>
      <DayStrip sub={(i) => (state.schedule[i].length ? `${state.schedule[i].length}×` : '')} />
      <Card title={`${DAYS[day]}'s training`}>
        {entries.length === 0 && <p class="muted small">No workouts scheduled. It's a rest day and still has a full calorie target.</p>}
        <div>
          {entries.map((entry, i) => {
            const def = lookup.get(entry.exerciseId);
            if (!def) return null;
            return (
              <div class="exercise-line" key={`${entry.exerciseId}-${i}`}>
                <div>
                  <div class="small"><b>{def.name}</b> · {def.level}</div>
                  <div class="tiny tabular">{t.valid ? `+${fmt(exerciseKcal(def.met, entry.minutes, t.kg, t.pal, credit))} kcal` : `${def.met} MET`}</div>
                </div>
                <label class="field">
                  <span class="tiny">Minutes</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={360}
                    value={entry.minutes}
                    aria-label={`${def.name} minutes`}
                    onChange={(e) => { const v = clamp(Number(e.currentTarget.value) || 1, 1, 360); setSchedule(entries.map((x, j) => (j === i ? { ...x, minutes: v } : x))); }}
                  />
                </label>
                <button type="button" class="icon-btn danger" aria-label={`Remove ${def.name}`} onClick={() => updateWithUndo((s) => ({ ...s, schedule: s.schedule.map((d, k) => (k === day ? d.filter((_, j) => j !== i) : d)) }), `Removed ${def.name}`)}><TrashIcon /></button>
              </div>
            );
          })}
        </div>
        {t.valid && entries.length > 0 && <p class="small">Total exercise allowance: <b class="tabular">+{fmt(t.workout[day])} kcal</b></p>}
      </Card>
      <Card title="Add a workout">
        <Field label="Search exercises"><TextInput type="search" value={query} onValue={setQuery} placeholder="Walk, run, yoga…" /></Field>
        <Field label="Exercise">
          <Select value={chosen} onValue={setSelected} disabled={!filtered.length} options={filtered.length ? filtered.map((x) => ({ value: x.id, label: `${x.name} — ${x.level} (${x.met} MET)` })) : [{ value: '', label: 'No exercises match' }]} />
        </Field>
        <Field label="Minutes" error={minutes && !minutesOk ? 'Enter 1 to 360 minutes.' : undefined}><NumberInput value={minutes} onValue={setMinutes} min={1} max={360} inputMode="numeric" /></Field>
        <button
          type="button"
          class="btn primary block"
          disabled={!chosen || !minutesOk}
          onClick={() => {
            const def = lookup.get(chosen);
            updateWithUndo((s) => ({ ...s, schedule: s.schedule.map((d, i) => (i === day ? [...d, { exerciseId: chosen, minutes: minutesNum }] : d)) }), `Added ${def?.name ?? 'workout'} to ${DAYS[day].slice(0, 3)}`);
          }}
        >
          <PlusIcon /> Add to {DAYS[day].slice(0, 3)}
        </button>
      </Card>
      <Card title="Exercise calorie credit">
        <Field label="How much of the estimated burn to count">
          <Select value={state.fields.credit} onValue={(v) => update((s) => ({ ...s, fields: { ...s.fields, credit: v } }))} options={[{ value: '0.5', label: '50% (conservative)' }, { value: '0.75', label: '75% (default)' }, { value: '1', label: '100%' }]} />
        </Field>
        <p class="note">Workout calories are estimated above the activity already in your normal-day setting. They're estimates, not measurements.</p>
      </Card>
      <Card title="Your own exercises" action={<button type="button" class="btn" onClick={() => setFormFor('new')}><PlusIcon /> Add</button>}>
        {custom.length === 0 && <p class="muted small">Add anything missing from the list. It slots in alphabetically with the rest.</p>}
        <div class="list">
          {custom.map((x) => (
            <div class="list-row" key={x.id}>
              <div><b>{x.name}</b><div class="tiny">{x.level} · {x.met} MET</div></div>
              <div class="row-actions">
                <button type="button" class="icon-btn" aria-label={`Edit ${x.name}`} onClick={() => setFormFor(x)}><EditIcon /></button>
                <button type="button" class="icon-btn danger" aria-label={`Delete ${x.name}`} onClick={() => setDeleting(x)}><TrashIcon /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      {formFor && <ExerciseFormSheet exercise={formFor === 'new' ? undefined : formFor} onClose={() => setFormFor(null)} />}
      {deleting && (
        <ConfirmSheet
          title={`Delete ${deleting.name}?`}
          message={(() => {
            const uses = state.schedule.reduce((n, d) => n + d.filter((e) => e.exerciseId === deleting.id).length, 0);
            return uses ? `It's scheduled ${uses} time${uses === 1 ? '' : 's'} this week and will be removed from those days. You can undo this straight afterwards.` : 'You can undo this straight afterwards.';
          })()}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            const id = deleting.id;
            updateWithUndo((s) => ({ ...s, customExercises: s.customExercises.filter((x) => x.id !== id), schedule: s.schedule.map((d) => d.filter((e) => e.exerciseId !== id)) }), `Deleted ${deleting.name}`);
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

export const exerciseModule: AppModule = {
  id: 'exercise',
  title: 'Exercise',
  navLabel: 'Exercise',
  description: 'Schedule workouts for the week and add your own exercises.',
  icon: DumbbellIcon,
  component: ExerciseScreen,
};
