export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export const num = (s: string | number | undefined | null): number => {
  if (s === '' || s === undefined || s === null) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export const fmt = (x: number) => (Number.isFinite(x) ? Math.round(x).toLocaleString('en-US') : '—');
export const one = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
/** Weights and servings: at most one decimal, except quarter servings which keep two. */
export const gw = (v: number) => (Math.round(v * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
export const servingsText = (v: number) => (Math.round(v * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const gEstimate = (v: number) => Math.round(v).toLocaleString('en-US');

/** Case-insensitive, number-aware alphabetical order used for every list in the app. */
export const compareNames = (a: string, b: string) =>
  a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true });
