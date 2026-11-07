import { fromKg, massUnit } from '../../domain/calc';
import { fmt, one } from '../../domain/format';
import { project } from '../../domain/projection';
import { getTargets, useStore } from '../../state/store';
import { Card, StatTile } from '../../ui/components';
import { TrendIcon } from '../../ui/icons';
import type { AppModule } from '../types';

const dateAfterWeeks = (weeks: number) =>
  new Date(Date.now() + weeks * 7 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function TimelineScreen() {
  const { state } = useStore();
  const t = getTargets();
  const units = state.fields.unitMode;
  const mass = massUnit(units);
  if (!t.valid) {
    return <Card title="Goal timeline"><p>Add your profile on the <a href="#/targets">Targets screen</a> to see a projection.</p></Card>;
  }
  const p = project(t);
  const weekly = fromKg(Math.abs(p.weeklyKg), units);
  const direction = p.weeklyKg < 0 ? 'loss' : p.weeklyKg > 0 ? 'gain' : 'change';
  const needsLonger = t.pace === 'goal' && p.earliestWeeks !== null && t.weeks < p.earliestWeeks;
  return (
    <>
      <Card title="Where this plan heads">
        <div class="tiles four">
          <StatTile label="Current weight" value={`${one(fromKg(t.kg, units))} ${mass}`} />
          <StatTile label="Goal weight" value={t.goalKg > 0 ? `${one(fromKg(t.goalKg, units))} ${mass}` : '—'} sub={t.goalKg > 0 ? undefined : 'not set'} />
          <StatTile label="Daily balance" value={`${p.dailyDelta > 0 ? '+' : p.dailyDelta < 0 ? '−' : ''}${fmt(Math.abs(p.dailyDelta))}`} sub="kcal vs maintenance" />
          <StatTile label={`Weekly ${direction}`} value={`${one(weekly)} ${mass}`} sub="estimated" />
        </div>
        {p.weeksToGoal !== null && <p>At this pace you'd reach your goal in about <b>{p.weeksToGoal} weeks</b>, around <b>{dateAfterWeeks(p.weeksToGoal)}</b>.</p>}
        {t.goalKg > 0 && p.weeksToGoal === null && <p class="note">This plan doesn't move toward your goal weight. Check the primary goal on the Targets screen.</p>}
        {needsLonger && <div class="notice info">Your {t.weeks}-week timeline would need about {fmt(t.requested)} kcal a day, but this app limits the deficit to {fmt(t.deficit)}. The earliest realistic timeline is about {p.earliestWeeks} weeks.</div>}
      </Card>
      <Card title="Week by week">
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">Week</th><th scope="col">Estimated weight ({mass})</th><th scope="col">Change ({mass})</th></tr></thead>
            <tbody>
              {p.rows.map((r) => {
                const change = fromKg(r.kg - t.kg, units);
                return (
                  <tr key={r.week}>
                    <td>{r.week === 0 ? 'Now' : r.week}</td>
                    <td>{one(fromKg(r.kg, units))}</td>
                    <td>{r.week === 0 ? '—' : `${change > 0 ? '+' : change < 0 ? '−' : ''}${one(Math.abs(change))}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p class="note">Simple energy-balance arithmetic. Real progress usually slows over time and varies week to week, so treat this as a rough guide and update your weight as it changes.</p>
      </Card>
    </>
  );
}

export const timelineModule: AppModule = {
  id: 'timeline',
  title: 'Goal timeline',
  navLabel: 'Timeline',
  description: 'Project your weight week by week and see how long your goal should take.',
  icon: TrendIcon,
  component: TimelineScreen,
};
