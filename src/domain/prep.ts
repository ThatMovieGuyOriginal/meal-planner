import { foodWeight } from './foods';
import { gEstimate, gw, servingsText } from './format';
import type { Food, YieldOverride } from './types';

export interface PrepInfo {
  hasMass: boolean;
  primary: string;
  lines: string[];
  text: string;
  /** True when lines[0] is the figure to weigh out before cooking. */
  leadsWithRaw: boolean;
}

export function prepInfo(food: Food, servings: number, overrides: Record<string, YieldOverride> = {}): PrepInfo {
  const w = foodWeight(food, overrides);
  if (!(w.g && w.g > 0)) {
    const text = `${servingsText(servings)} × ${food.serving}`;
    return { hasMass: false, primary: text, lines: [], text, leadsWithRaw: false };
  }
  const qty = w.g * servings;
  const unit = w.unit ?? 'g';
  const measured = w.stage === 'cooked' ? 'Cooked edible portion' : w.stage === 'dry' ? 'Dry amount to measure' : w.label ?? 'Total serving amount';
  const primary = `${measured}: ${gw(qty)} ${unit}`;
  const lines: string[] = [];
  if (w.stage === 'cooked' && unit === 'g' && w.yield && w.yield > 0) {
    const cookedWhole = w.edibleYield && w.edibleYield > 0 ? qty / w.edibleYield : qty;
    const raw = cookedWhole / w.yield;
    if (w.edibleYield && w.edibleYield < 1) {
      lines.push(`Weigh before baking: ≈${gEstimate(raw)} g ${w.rawLabel ?? 'raw whole'} (estimated)`);
      lines.push(`After baking: ≈${gEstimate(cookedWhole)} g whole → ${gw(qty)} g edible after removing skin`);
      if (w.alternativeRaw) lines.push(`Alternative: ≈${gEstimate(qty / w.yield)} g ${w.alternativeRaw}`);
    } else {
      lines.push(`Measure before cooking: ≈${gEstimate(raw)} g ${w.rawLabel ?? 'raw'} (estimated)`);
    }
  }
  return { hasMass: true, primary, lines, text: [primary, ...lines].join('; '), leadsWithRaw: lines.length > 0 };
}

/** What to buy for a number of servings: the raw or dry weight when known, else the amount eaten. */
export function shoppingAmount(food: Food, servings: number, overrides: Record<string, YieldOverride> = {}): string {
  const w = foodWeight(food, overrides);
  const count = `${servingsText(servings)} × ${food.serving}`;
  if (!(w.g && w.g > 0)) return count;
  const qty = w.g * servings;
  const unit = w.unit ?? 'g';
  if (w.stage === 'cooked' && unit === 'g' && w.yield && w.yield > 0) {
    const cookedWhole = w.edibleYield && w.edibleYield > 0 ? qty / w.edibleYield : qty;
    return `≈${gEstimate(cookedWhole / w.yield)} g ${w.rawLabel ?? 'raw'} (${count})`;
  }
  if (w.stage === 'cooked') return `${gw(qty)} ${unit} cooked (${count})`;
  return `${gw(qty)} ${unit} (${count})`;
}
