/**
 * Applies her saved order to the available modules. A module added in a later version isn't in
 * the saved order yet, so it goes on the end instead of disappearing. Stale ids are ignored.
 */
export function arrangeModules<T extends { id: string }>(modules: T[], order: string[]): T[] {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const known = order.map((id) => byId.get(id)).filter((m): m is T => !!m);
  const seen = new Set(known.map((m) => m.id));
  return [...known, ...modules.filter((m) => !seen.has(m.id))];
}

export function moveModule(ids: string[], id: string, direction: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const TAB_BAR_SLOTS = 4;
