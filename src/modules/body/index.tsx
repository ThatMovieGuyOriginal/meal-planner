import { useState } from 'preact/hooks';
import { bmiCategory, ffmi, navyBodyFat, weightAtBodyFat } from '../../domain/body';
import { fromKg, lengthUnit, massUnit, toCm, toKg } from '../../domain/calc';
import { num, one } from '../../domain/format';
import type { Fields } from '../../domain/types';
import { getTargets, showToast, update, useStore } from '../../state/store';
import { Card, Field, NumberInput, StatTile } from '../../ui/components';
import { RulerIcon } from '../../ui/icons';
import type { AppModule } from '../types';

const setField = (key: keyof Fields, value: string) => update((s) => ({ ...s, fields: { ...s.fields, [key]: value } }));

function BodyScreen() {
  const { state } = useStore();
  const f = state.fields;
  const t = getTargets();
  const units = f.unitMode;
  const mass = massUnit(units);
  const len = lengthUnit(units);
  const [goalBf, setGoalBf] = useState(f.goalBf);

  const estimate = navyBodyFat(f.sex, t.cm, toCm(num(f.neck), units), toCm(num(f.waist), units), toCm(num(f.hip), units));
  const bf = num(f.bodyfat);
  const lean = t.hasBf ? t.lean : 0;
  const fatMass = t.hasBf ? t.kg - t.lean : 0;
  const goalWeight = weightAtBodyFat(lean, num(goalBf));

  return (
    <>
      <Card title="Body composition">
        {!t.valid && <p class="note">Add your profile on the <a href="#/targets">Targets screen</a> to fill these in.</p>}
        <div class="tiles four">
          <StatTile label="BMI" value={t.valid ? one(t.bmi) : '—'} sub={bmiCategory(t.bmi) || 'kg/m²'} />
          <StatTile label="Fat mass" value={t.hasBf ? one(fromKg(fatMass, units)) : '—'} sub={t.hasBf ? `${mass} at ${one(bf)}% body fat` : 'needs body fat %'} />
          <StatTile label="Fat-free mass" value={t.hasBf ? one(fromKg(lean, units)) : '—'} sub={t.hasBf ? mass : 'needs body fat %'} />
          <StatTile label="FFMI" value={t.hasBf ? one(ffmi(lean, t.cm)) : '—'} sub={t.hasBf ? 'fat-free mass index' : 'needs body fat %'} />
        </div>
        <p class="note">BMI and body-fat figures are screening estimates. They can't tell you about your health on their own.</p>
      </Card>
      <Card title="Estimate body fat from tape measurements">
        <p class="note">Uses the US Navy method with the sex and height in your profile. Measure the neck below the larynx, and the waist at the navel{f.sex === 'male' ? '' : ', and the hips at their widest'}.</p>
        <div class="form-grid dense">
          <Field label={`Neck (${len})`}><NumberInput value={f.neck} onValue={(v) => setField('neck', v)} min={1} /></Field>
          <Field label={`Waist (${len})`}><NumberInput value={f.waist} onValue={(v) => setField('waist', v)} min={1} /></Field>
          {f.sex !== 'male' && <Field label={`Hips (${len})`}><NumberInput value={f.hip} onValue={(v) => setField('hip', v)} min={1} /></Field>}
        </div>
        <div class="row between">
          <div>
            <div class="tile-label tiny">Estimated body fat</div>
            <div class="hero-number">{estimate > 0 ? `${one(estimate)}%` : '—'}</div>
          </div>
          <button
            type="button"
            class="btn"
            disabled={!(estimate > 0)}
            onClick={() => { setField('bodyfat', estimate.toFixed(1)); showToast(`Current body fat set to ${one(estimate)}%`); }}
          >
            Use as current body fat
          </button>
        </div>
      </Card>
      <Card title="Weight at a goal body fat">
        <p class="note">The weight that gives this body-fat percentage if you keep your current fat-free mass.</p>
        <Field label="Goal body fat (%)"><NumberInput value={goalBf} onValue={setGoalBf} min={1} max={65} /></Field>
        <div class="row between">
          <div>
            <div class="tile-label tiny">Goal weight</div>
            <div class="hero-number">{goalWeight > 0 ? `${one(fromKg(goalWeight, units))} ${mass}` : '—'}</div>
            {!t.hasBf && <div class="tiny">Needs your current body fat first.</div>}
          </div>
          <button
            type="button"
            class="btn"
            disabled={!(goalWeight > 0)}
            onClick={() => {
              const value = fromKg(goalWeight, units).toFixed(1);
              update((s) => ({ ...s, fields: { ...s.fields, goal: value, goalBf } }));
              showToast(`Goal weight set to ${value} ${mass}`);
            }}
          >
            Use as my goal
          </button>
        </div>
        {goalWeight > 0 && toKg(num(f.weight), units) > 0 && goalWeight / (t.cm / 100) ** 2 < 18.5 && (
          <div class="notice warn">That weight puts BMI below 18.5, so the app won't plan a deficit toward it.</div>
        )}
      </Card>
    </>
  );
}

export const bodyModule: AppModule = {
  id: 'body',
  title: 'Body calculators',
  navLabel: 'Body',
  description: 'BMI, fat-free mass, tape-measure body fat and goal weight.',
  icon: RulerIcon,
  component: BodyScreen,
};
