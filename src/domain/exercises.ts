import type { ExerciseDef } from './types';
import { compareNames } from './format';

type Row = [string, string, string, number];

/** Ids are stored in saved plans and backups, so they must never depend on list position. */
const ROWS: Row[] = [
  ['badminton-moderate', 'Badminton', 'Moderate', 5.5],
  ['basketball-moderate', 'Basketball', 'Moderate', 6.5],
  ['boxing-moderate', 'Boxing', 'Moderate', 7.8],
  ['boxing-vigorous', 'Boxing', 'Vigorous', 12.3],
  ['cycling-light', 'Cycling outdoors', 'Light', 4],
  ['cycling-moderate', 'Cycling outdoors', 'Moderate', 8],
  ['cycling-vigorous', 'Cycling outdoors', 'Vigorous', 10],
  ['cycling-very-vigorous', 'Cycling outdoors', 'Very vigorous', 12],
  ['elliptical-moderate', 'Elliptical', 'Moderate', 5],
  ['elliptical-vigorous', 'Elliptical', 'Vigorous', 8],
  ['hiit-vigorous', 'HIIT', 'Vigorous', 11],
  ['hiking-moderate', 'Hiking', 'Moderate', 5.3],
  ['hiking-vigorous', 'Hiking', 'Vigorous', 7],
  ['kickboxing-moderate', 'Kickboxing', 'Moderate', 7.8],
  ['kickboxing-vigorous', 'Kickboxing', 'Vigorous', 12.3],
  ['muay-thai-moderate', 'Muay Thai', 'Moderate', 10.3],
  ['muay-thai-vigorous', 'Muay Thai', 'Vigorous', 12.3],
  ['pilates-light', 'Pilates', 'Light', 3],
  ['rowing-light', 'Rowing machine', 'Light', 3.5],
  ['rowing-moderate', 'Rowing machine', 'Moderate', 5],
  ['rowing-vigorous', 'Rowing machine', 'Vigorous', 8.5],
  ['running-moderate', 'Running', 'Moderate', 9.3],
  ['running-vigorous', 'Running', 'Vigorous', 11.8],
  ['stair-climber-moderate', 'Stair climber', 'Moderate', 6],
  ['stationary-cycling-moderate', 'Stationary cycling', 'Moderate', 6.8],
  ['swimming-moderate', 'Swimming laps', 'Moderate', 6],
  ['swimming-vigorous', 'Swimming laps', 'Vigorous', 9.8],
  ['tennis-moderate', 'Tennis', 'Moderate', 6],
  ['tennis-vigorous', 'Tennis', 'Vigorous', 8],
  ['walking-light', 'Walking', 'Light', 2.8],
  ['walking-moderate', 'Walking', 'Moderate', 3.8],
  ['walking-brisk', 'Walking', 'Brisk', 4.8],
  ['weights-light', 'Weight lifting', 'Light', 2.5],
  ['weights-moderate', 'Weight lifting', 'Moderate', 3.5],
  ['weights-vigorous', 'Weight lifting', 'Vigorous', 6],
  ['yoga-light', 'Yoga', 'Light', 2.5],
];

export const EXERCISES: ExerciseDef[] = ROWS.map(([id, name, level, met]) => ({ id, name, level, met }));

/**
 * v5/v6 stored exercises as `ex<position>` in the sorted list. This is that list frozen
 * forever, so old backups keep pointing at the workouts they meant.
 */
export const LEGACY_EXERCISE_IDS: readonly string[] = ROWS.map((r) => r[0]);

/** Built-in and custom exercises together: alphabetical, then easiest to hardest. */
export function allExercises(custom: ExerciseDef[]): ExerciseDef[] {
  return [...EXERCISES, ...custom].sort((a, b) => compareNames(a.name, b.name) || a.met - b.met);
}

export function exerciseLookup(custom: ExerciseDef[]): Map<string, ExerciseDef> {
  return new Map([...EXERCISES, ...custom].map((e) => [e.id, e]));
}

export function makeCustomId(prefix: 'custom' | 'customex' | 'recipe'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
