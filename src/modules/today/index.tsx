import { DAYS } from '../../domain/types';
import { dayItems, totalsFor } from '../../domain/plan';
import { exerciseKcal } from '../../domain/calc';
import { exerciseLookup } from '../../domain/exercises';
import { fmt, num } from '../../domain/format';
import { getFoodMap, getMacros, getTargets, setUi, todayIndex, useStore } from '../../state/store';
import { navigate } from '../../app/router';
import { Card, DayMeters, Notices } from '../../ui/components';
import { HomeIcon, RightIcon } from '../../ui/icons';
import { BackupNudge } from '../settings/backup';
import type { AppModule } from '../types';

function TodayScreen() {
  const { state } = useStore();
  const day = todayIndex();
  const targets = getTargets();
  const macros = getMacros(day);
  const foods = getFoodMap();
  const totals = totalsFor(dayItems(state.plan[day], state.mealSlots), foods);
  const exercises = exerciseLookup(state.customExercises);
  const entries = state.schedule[day];
  const remaining = macros.calories - totals.kcal;
  const warnings = targets.notices.filter((n) => n.level === 'warn');
  const openDay = (i: number) => { setUi({ day: i }); navigate('meals'); };

  return (
    <>
      <BackupNudge />
      {!targets.valid && (
        <Card title="Start here">
          <p>Add your age, sex, height and weight to get calorie and macro targets. Already have a backup file? Import it instead.</p>
          <div class="row">
            <a class="btn primary grow" href="#/targets">Set up my profile</a>
            <a class="btn grow" href="#/settings">Import a backup</a>
          </div>
        </Card>
      )}
      <Card title={DAYS[day]}>
        {targets.valid && (
          <div>
            <div class="hero-number lead">{fmt(Math.abs(remaining))}</div>
            <div class="muted small">kcal {remaining >= 0 ? 'left to plan' : 'over target'} of {fmt(macros.calories)}</div>
          </div>
        )}
        <DayMeters totals={totals} macros={macros} />
        <a class="btn block" href="#/meals" onClick={() => setUi({ day })}>Plan today's meals <RightIcon /></a>
      </Card>
      <Notices items={warnings} />
      <Card title="Today's meals">
        <div class="list">
          {state.mealSlots.map((slot) => {
            const items = state.plan[day][slot.id] ?? [];
            const t = totalsFor(items, foods);
            return (
              <button key={slot.id} type="button" class="list-row" onClick={() => openDay(day)}>
                <div>
                  <b>{slot.name}</b>
                  <div class="tiny">{items.length ? items.map((x) => foods.get(x.foodId)?.name).filter(Boolean).join(', ') : 'Nothing planned'}</div>
                </div>
                <span class="small nowrap tabular">{fmt(t.kcal)} kcal</span>
              </button>
            );
          })}
        </div>
      </Card>
      <Card title="Today's training" action={<a href="#/exercise" class="small">Edit</a>}>
        {entries.length === 0 && <p class="muted small">Rest day. Your calorie target still applies.</p>}
        {entries.map((e, i) => {
          const def = exercises.get(e.exerciseId);
          if (!def) return null;
          return (
            <div class="row between small" key={`${e.exerciseId}-${i}`}>
              <span>{def.name} · {def.level} · {e.minutes} min</span>
              {targets.valid && <span class="muted nowrap tabular">+{fmt(exerciseKcal(def.met, e.minutes, targets.kg, targets.pal, num(state.fields.credit) || 0.75))} kcal</span>}
            </div>
          );
        })}
      </Card>
      <Card title="This week">
        <div class="week-tiles">
          {DAYS.map((d, i) => {
            const planned = totalsFor(dayItems(state.plan[i], state.mealSlots), foods).kcal;
            return (
              <button key={d} type="button" class={`week-tile ${i === day ? 'current' : ''}`} onClick={() => openDay(i)} aria-label={`Open ${d}`}>
                <span class="small">{d.slice(0, 3)}</span>
                <b class="tabular">{targets.valid ? fmt(targets.target[i]) : '—'}</b>
                <small>target kcal</small>
                <small class="tabular">{fmt(planned)} planned</small>
              </button>
            );
          })}
        </div>
      </Card>
    </>
  );
}

export const todayModule: AppModule = {
  id: 'today',
  title: 'Today',
  navLabel: 'Today',
  description: "Today's targets, meals and training at a glance.",
  icon: HomeIcon,
  component: TodayScreen,
};
