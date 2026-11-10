import { useEffect, useReducer } from 'preact/hooks';
import { computeMacros, computeTargets, type Macros, type Targets } from '../domain/calc';
import { allFoodsWithRecipes, foodLookupWithRecipes } from '../domain/recipes';
import type { AppState, Food } from '../domain/types';
import { convertLegacy, parseBackup, sanitizeState } from './backup';
import { defaultState } from './defaults';

export const STORAGE_KEY = 'bcmeal.v7';
const LEGACY_STORAGE_KEY = 'bcmeal.v5';

export const todayIndex = () => (new Date().getDay() + 6) % 7;

export interface Toast { id: number; message: string; undo?: () => void; }

export interface UiState {
  /** The day being viewed. Always opens on today rather than wherever she left off. */
  day: number;
  mealId: string | null;
  saveFailed: boolean;
  loadError: string | null;
  persisted: boolean | null;
  toast: Toast | null;
  /** A newer version has taken over in the background and is waiting for a reload. */
  updateReady: boolean;
}

function load(): { state: AppState; error: string | null } {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const converted = convertLegacy(JSON.parse(legacy), []);
        if (converted) return { state: sanitizeState(converted, []), error: null };
      }
      return { state: defaultState(), error: null };
    }
    const parsed = parseBackup(stored);
    if (parsed.ok) return { state: parsed.state, error: null };
  } catch {
    // Falls through: unreadable storage is handled the same as unreadable data.
  }
  if (stored) {
    try { localStorage.setItem(`${STORAGE_KEY}.unreadable`, stored); } catch { /* best effort */ }
    return { state: defaultState(), error: "Your saved plan couldn't be read. Import your latest backup from Settings." };
  }
  return { state: defaultState(), error: null };
}

const initial = load();
let state: AppState = initial.state;
let ui: UiState = { day: todayIndex(), mealId: null, saveFailed: false, loadError: initial.error, persisted: null, toast: null, updateReady: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveNow(): void {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema: state.schema, state }));
    if (ui.saveFailed) { ui = { ...ui, saveFailed: false }; emit(); }
  } catch {
    if (!ui.saveFailed) { ui = { ...ui, saveFailed: true }; emit(); }
  }
}

const scheduleSave = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 150);
};

let persistRequested = false;
/** Asks the browser to protect her data. Safari decides for itself and may still say no. */
export function requestPersistence(): void {
  if (persistRequested || !navigator.storage?.persist) return;
  persistRequested = true;
  navigator.storage.persist().then((granted) => setUi({ persisted: granted })).catch(() => undefined);
}

export function getState(): AppState { return state; }
export function getUi(): UiState { return ui; }

export function update(fn: (s: AppState) => AppState): void {
  const next = fn(state);
  if (next === state) return;
  state = { ...next, lastChangedAt: Date.now() };
  scheduleSave();
  requestPersistence();
  emit();
}

/** Swaps in a whole state (import, undo, reset) and saves straight away. */
export function replaceState(next: AppState): void {
  state = next;
  saveNow();
  emit();
}

/** Marks the current state as backed up without counting as a change. */
export function markBackedUp(): void {
  state = { ...state, lastBackupAt: Date.now() };
  saveNow();
  emit();
}

export function setUi(patch: Partial<UiState>): void {
  ui = { ...ui, ...patch };
  emit();
}

let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function showToast(message: string, undo?: () => void): void {
  if (toastTimer) clearTimeout(toastTimer);
  const id = ++toastId;
  setUi({ toast: { id, message, undo } });
  toastTimer = setTimeout(() => { if (ui.toast?.id === id) setUi({ toast: null }); }, undo ? 6000 : 3000);
}

/** Runs a change and offers Undo, restoring the exact state from before it. */
export function updateWithUndo(fn: (s: AppState) => AppState, message: string): void {
  const before = state;
  update(fn);
  showToast(message, () => { replaceState(before); showToast('Undone'); });
}

export function useStore(): { state: AppState; ui: UiState } {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const listener = () => force(0);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return { state, ui };
}

let targetsMemo: { source: AppState; value: Targets } | null = null;
export function getTargets(): Targets {
  if (targetsMemo?.source !== state) targetsMemo = { source: state, value: computeTargets(state) };
  return targetsMemo.value;
}
export function getMacros(day: number): Macros { return computeMacros(getTargets(), day, state.fat); }

let foodsMemo: { foods: Food[]; recipes: AppState['recipes']; map: Map<string, Food>; list: Food[] } | null = null;
function foodsFor(s: AppState) {
  if (foodsMemo?.foods !== s.customFoods || foodsMemo.recipes !== s.recipes) {
    const map = foodLookupWithRecipes(s.customFoods, s.recipes);
    foodsMemo = { foods: s.customFoods, recipes: s.recipes, map, list: allFoodsWithRecipes(s.customFoods, map, s.recipes) };
  }
  return foodsMemo;
}
/** Every food by id, including one food per recipe. */
export function getFoodMap(): Map<string, Food> { return foodsFor(state).map; }
/** Every food alphabetically, recipes included. */
export function getAllFoods(): Food[] { return foodsFor(state).list; }

if (typeof window !== 'undefined') {
  // Never lose the last edit when Safari backgrounds or closes the tab.
  window.addEventListener('pagehide', saveNow);
  // iOS keeps tabs alive for days, so coming back on a new day should show that day.
  let lastSeenDay = todayIndex();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { saveNow(); return; }
    const now = todayIndex();
    if (now !== lastSeenDay) { lastSeenDay = now; setUi({ day: now }); }
  });
  // Another open tab saved: use its version rather than overwriting it later.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    const parsed = parseBackup(e.newValue);
    if (parsed.ok) { state = parsed.state; emit(); }
  });
}
