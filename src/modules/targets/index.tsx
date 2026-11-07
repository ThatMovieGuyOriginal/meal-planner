import { useState } from 'preact/hooks';
import { convertUnits, fatFromCarb, fromKg, massUnit } from '../../domain/calc';
import { fmt, one } from '../../domain/format';
import { DAYS, type Fields, type UnitMode } from '../../domain/types';
import { getMacros, getTargets, setUi, update, useStore } from '../../state/store';
import { Card, Field, MacroBar, Notices, NumberInput, Section, Select, StatTile } from '../../ui/components';
import { TargetIcon } from '../../ui/icons';
import type { AppModule } from '../types';

const setField = (key: keyof Fields, value: string) => update((s) => ({ ...s, fields: { ...s.fields, [key]: value } }));

const FOCUS_LABEL = { cut: 'Fat loss', recomp: 'Recomposition', gain: 'Gain muscle' };

function profileSummary(f: Fields): string {
  const height = f.unitMode === 'us' ? `${f.feet || 0}'${f.inches || 0}"` : `${f.height} cm`;
  return `${f.age} y · ${height} · ${f.weight} ${massUnit(f.unitMode)} · ${FOCUS_LABEL[f.focus]}`;
}

function ProfileForm() {
  const { state } = useStore();
  const f = state.fields;
  const unit = massUnit(f.unitMode);
  return (
    <>
      <div class="form-grid dense">
        <Field label="Age (years)"><NumberInput value={f.age} onValue={(v) => setField('age', v)} min={18} max={120} inputMode="numeric" /></Field>
        <Field label="Sex for BMR equation">
          <Select value={f.sex} onValue={(v) => setField('sex', v)} options={[{ value: '', label: 'Select' }, { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]} />
        </Field>
        <Field label="Units">
          <Select value={f.unitMode} onValue={(v) => update((s) => ({ ...s, fields: convertUnits(s.fields, v as UnitMode) }))} options={[{ value: 'us', label: 'US (ft/in, lb)' }, { value: 'metric', label: 'Metric (cm, kg)' }]} />
        </Field>
        {f.unitMode === 'us' ? (
          <>
            <Field label="Height (feet)"><NumberInput value={f.feet} onValue={(v) => setField('feet', v)} min={3} max={8} inputMode="numeric" /></Field>
            <Field label="Height (inches)"><NumberInput value={f.inches} onValue={(v) => setField('inches', v)} min={0} max={11} /></Field>
          </>
        ) : (
          <Field label="Height (cm)"><NumberInput value={f.height} onValue={(v) => setField('height', v)} min={110} max={250} /></Field>
        )}
        <Field label={`Current weight (${unit})`}><NumberInput value={f.weight} onValue={(v) => setField('weight', v)} min={1} /></Field>
        <Field label="Normal day, excluding workouts">
          <Select value={f.pal} onValue={(v) => setField('pal', v)} options={[{ value: '1.4', label: 'Sedentary (1.40)' }, { value: '1.55', label: 'Lightly active (1.55)' }, { value: '1.7', label: 'Moderately active (1.70)' }, { value: '1.9', label: 'Very active (1.90)' }]} />
        </Field>
        <Field label="Primary goal">
          <Select value={f.focus} onValue={(v) => setField('focus', v)} options={[{ value: 'cut', label: 'Fat loss / keep muscle' }, { value: 'recomp', label: 'Recomposition' }, { value: 'gain', label: 'Gain muscle' }]} />
        </Field>
      </div>
      <div class="label">Goals and body fat (optional)</div>
      <div class="form-grid dense">
        <Field label={`Goal weight (${unit})`}><NumberInput value={f.goal} onValue={(v) => setField('goal', v)} min={1} placeholder="Optional" /></Field>
        <Field label="Timeline (weeks)"><NumberInput value={f.weeks} onValue={(v) => setField('weeks', v)} min={1} max={520} inputMode="numeric" /></Field>
        <Field label="Current body fat (%)"><NumberInput value={f.bodyfat} onValue={(v) => setField('bodyfat', v)} min={1} max={75} placeholder="Optional" /></Field>
        <Field label="Goal body fat (%)"><NumberInput value={f.goalBf} onValue={(v) => setField('goalBf', v)} min={1} max={65} placeholder="Optional" /></Field>
      </div>
      <p class="note">Don't know your body fat? The Body calculators screen can estimate it from a few tape measurements.</p>
      <details>
        <summary class="small" style={{ cursor: 'pointer', fontWeight: 600, minHeight: '32px' }}>Advanced: use results from the NIH Body Weight Planner</summary>
        <div class="stack" style={{ marginTop: '8px' }}>
          <label class="toggle-row"><input type="checkbox" checked={state.nihEnabled} onChange={(e) => { const on = e.currentTarget.checked; update((s) => ({ ...s, nihEnabled: on })); }} /> Use the NIH results below for weekly intake</label>
          <div class="form-grid">
            <Field label="NIH maintenance (kcal/day)"><NumberInput value={f.nihMaint} onValue={(v) => setField('nihMaint', v)} min={0} /></Field>
            <Field label="NIH goal (kcal/day)"><NumberInput value={f.nihGoal} onValue={(v) => setField('nihGoal', v)} min={0} /></Field>
          </div>
          <p class="note">Run <a href="https://www.niddk.nih.gov/bwp" target="_blank" rel="noopener noreferrer">the official NIH planner</a> with the same profile. Its daily goal sets your weekly average, and this app splits that across days by planned exercise. That split is this app's own model, and each day is held at or above the app's minimum calories.</p>
        </div>
      </details>
    </>
  );
}

function MacroControls() {
  const { state, ui } = useStore();
  const m = getMacros(ui.day);
  const t = getTargets();
  const suggested = state.fields.focus === 'cut' ? '2.2' : state.fields.focus === 'recomp' ? '2.0' : '1.8';
  return (
    <Card title={`Macros for ${DAYS[ui.day]}`}>
      <div class="field">
        <div class="row between"><label class="label" for="protein">Protein</label><strong class="small tabular">{state.protein.toFixed(1)} g/kg{t.valid ? ` · ${one(m.proteinGrams)} g` : ''}</strong></div>
        <input id="protein" type="range" min={1.6} max={2.2} step={0.1} value={state.protein} onInput={(e) => { const v = Number(e.currentTarget.value); update((s) => ({ ...s, protein: v })); }} />
        <small class="hint">Suggested starting point for your goal: {suggested} g/kg.</small>
      </div>
      {!m.feasible && <p class="note">{t.valid ? "This calorie target can't fit the protein amount plus minimum fat. Lower the protein slider or review your target." : 'Add your profile to calculate macro grams.'}</p>}
      <div class="field">
        <div class="row between"><label class="label" for="fat">Fat (% of calories)</label><strong class="small tabular">{m.feasible ? `${one(m.fat)}% · ${one(m.fatGrams)} g` : '—'}</strong></div>
        <input id="fat" type="range" min={m.fatMin} max={m.fatMax || 40} step={0.5} value={m.feasible ? m.fat : state.fat} disabled={!m.feasible} onInput={(e) => { const v = Number(e.currentTarget.value); update((s) => ({ ...s, fat: v })); }} />
      </div>
      <div class="field">
        <div class="row between"><label class="label" for="carb">Carbs (% of calories)</label><strong class="small tabular">{m.feasible ? `${one(m.carb)}% · ${one(m.carbGrams)} g` : '—'}</strong></div>
        <input id="carb" type="range" min={m.carbMin} max={m.carbMax} step={0.5} value={m.carb} disabled={!m.feasible} onInput={(e) => { const v = fatFromCarb(m, Number(e.currentTarget.value)); update((s) => ({ ...s, fat: v })); }} />
      </div>
      {m.feasible && <MacroBar macros={m} />}
      <p class="note">Carbs and fat trade off against each other. Protein grams only change with the protein slider or your weight.</p>
    </Card>
  );
}

function TargetsScreen() {
  const { state, ui } = useStore();
  const t = getTargets();
  const [startOpen] = useState(!t.valid);
  const units = state.fields.unitMode;
  const avg = t.target.reduce((a, b) => a + b, 0) / 7;
  const shownDeficit = t.usingNih ? t.nihMaint - avg : t.deficit;
  return (
    <>
      <Section title="Your profile" summary={t.valid ? profileSummary(state.fields) : 'Needed for your targets'} open={startOpen}>
        <ProfileForm />
      </Section>
      <Notices items={t.notices} />
      <Card title="Daily targets">
        <div class="week-tiles">
          {DAYS.map((d, i) => (
            <button key={d} type="button" class={`week-tile ${ui.day === i ? 'current' : ''}`} onClick={() => setUi({ day: i })} aria-pressed={ui.day === i}>
              <span class="small">{d.slice(0, 3)}</span>
              <b class="tabular">{t.valid ? fmt(t.target[i]) : '—'}</b>
              <small>kcal</small>
              <small class="tabular">{t.valid ? `+${fmt(t.workout[i])} exercise` : ''}</small>
            </button>
          ))}
        </div>
        <p class="note">
          {t.valid
            ? `Weekly budget ${fmt(t.target.reduce((a, b) => a + b, 0))} kcal, averaging ${fmt(avg)} a day. Rest days still have a complete target.`
            : 'Enter age, sex, height and current weight to calculate your targets.'}
        </p>
      </Card>
      <Card title="Your numbers">
        <div class="tiles four">
          <StatTile label="Estimated BMR" value={t.valid ? fmt(t.bmr) : '—'} sub="kcal/day at rest" />
          <StatTile label="Baseline maintenance" value={t.valid ? fmt(t.baseMaintenance) : '—'} sub="kcal/day without workouts" />
          <StatTile label={t.surplus > 0 ? 'Planned surplus' : 'Planned deficit'} value={t.valid ? fmt(t.surplus > 0 ? t.surplus : shownDeficit) : '—'} sub={t.pace === 'default' ? 'kcal/day, default pace' : 'kcal/day'} />
          <StatTile label="Fat-free mass change" value={t.valid && t.hasBf && t.hasGoalBf && t.goalKg ? `${t.goalFfm >= t.lean ? '+' : '−'}${one(Math.abs(fromKg(t.goalFfm - t.lean, units)))}` : '—'} sub={`${massUnit(units)} implied by your goal`} />
        </div>
        <p class="note">Body-fat figures estimate fat and fat-free mass. They don't measure muscle directly.</p>
      </Card>
      <MacroControls />
    </>
  );
}

export const targetsModule: AppModule = {
  id: 'targets',
  title: 'Profile & targets',
  navLabel: 'Targets',
  description: 'Your profile, goals, daily calories and macros.',
  icon: TargetIcon,
  component: TargetsScreen,
};
