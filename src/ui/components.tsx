import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { DAYS, type Notice, type Totals } from '../domain/types';
import { fmt, one } from '../domain/format';
import type { Macros } from '../domain/calc';
import { AlertIcon, CloseIcon, DownIcon, InfoIcon } from './icons';
import { setUi, todayIndex, useStore } from '../state/store';

export function Card({ title, action, children, class: cls = '' }: { title?: ComponentChildren; action?: ComponentChildren; children: ComponentChildren; class?: string }) {
  return (
    <section class={`card ${cls}`}>
      {(title || action) && (
        <div class="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Section({ title, summary, open, children }: { title: string; summary?: string; open?: boolean; children: ComponentChildren }) {
  return (
    <details class="section" open={open}>
      <summary>
        <span>
          <strong>{title}</strong>
          {summary && <span class="summary-sub">{summary}</span>}
        </span>
        <DownIcon />
      </summary>
      <div class="section-body">{children}</div>
    </details>
  );
}

export function Field({ label, hint, error, children, class: cls = '' }: { label: string; hint?: string; error?: string; children: ComponentChildren; class?: string }) {
  return (
    <label class={`field ${cls}`}>
      <span>{label}</span>
      {children}
      {hint && <small class="hint">{hint}</small>}
      {error && <small class="error" role="alert">{error}</small>}
    </label>
  );
}

interface InputProps {
  value: string;
  onValue: (v: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  disabled?: boolean;
}

export function NumberInput({ value, onValue, inputMode = 'decimal', ...rest }: InputProps & { inputMode?: 'decimal' | 'numeric' }) {
  return <input type="number" inputMode={inputMode} step="any" value={value} onInput={(e) => onValue(e.currentTarget.value)} {...rest} />;
}

export function TextInput({ value, onValue, type = 'text', ...rest }: InputProps & { type?: 'text' | 'search' }) {
  const onInput = (e: { currentTarget: HTMLInputElement }) => onValue(e.currentTarget.value);
  return type === 'search'
    ? <input type="search" value={value} onInput={onInput} {...rest} />
    : <input type="text" value={value} onInput={onInput} {...rest} />;
}

export function Select({ value, onValue, options, ...rest }: { value: string; onValue: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  return (
    <select value={value} onChange={(e) => onValue(e.currentTarget.value)} {...rest}>
      {options.map((o) => <option key={o.value} value={o.value} selected={o.value === value}>{o.label}</option>)}
    </select>
  );
}

export function Notices({ items }: { items: Notice[] }) {
  if (!items.length) return null;
  return (
    <div class="stack">
      {items.map((n) => (
        <div key={n.text} class={`notice ${n.level}`}>
          {n.level === 'warn' ? <AlertIcon /> : <InfoIcon />}
          <span>{n.text}</span>
        </div>
      ))}
    </div>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: ComponentChildren }) {
  return (
    <div class="tile">
      <span class="tile-label">{label}</span>
      <span class="tile-value">{value}</span>
      {sub && <span class="tile-sub">{sub}</span>}
    </div>
  );
}

/** One value against its limit. Going over changes the colour and always adds a text label. */
export function Meter({ label, actual, goal, unit }: { label: string; actual: number; goal: number; unit: string }) {
  const hasGoal = goal > 0;
  const over = hasGoal && actual > goal;
  const pct = hasGoal ? Math.min(100, (actual / goal) * 100) : 0;
  const value = unit === 'kcal' ? fmt(actual) : one(actual);
  const target = unit === 'kcal' ? fmt(goal) : one(goal);
  return (
    <div class="meter-row">
      <div class="row between small">
        <span><strong>{label}</strong></span>
        <span class="tabular">
          {value}{hasGoal ? ` of ${target}` : ''} {unit}
          {over && <span class="over-label"> · over by {unit === 'kcal' ? fmt(actual - goal) : one(actual - goal)}</span>}
        </span>
      </div>
      <div
        class={`meter ${over ? 'over' : ''}`}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={hasGoal ? goal : 1}
        aria-valuenow={hasGoal ? Math.min(actual, goal) : 0}
      >
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DayMeters({ totals, macros }: { totals: Totals; macros: Macros }) {
  return (
    <div class="stack">
      <Meter label="Calories" actual={totals.kcal} goal={macros.calories} unit="kcal" />
      <Meter label="Protein" actual={totals.p} goal={macros.proteinGrams} unit="g" />
      <Meter label="Carbs" actual={totals.c} goal={macros.carbGrams} unit="g" />
      <Meter label="Fat" actual={totals.f} goal={macros.fatGrams} unit="g" />
    </div>
  );
}

/** Thin bar showing how a day's calories split between macros; the legend carries names and figures. */
export function MacroBar({ macros }: { macros: Macros }) {
  const parts = [
    { name: 'Protein', pct: macros.proteinPct, grams: macros.proteinGrams, color: 'var(--protein)' },
    { name: 'Carbs', pct: macros.carb, grams: macros.carbGrams, color: 'var(--carbs)' },
    { name: 'Fat', pct: macros.fat, grams: macros.fatGrams, color: 'var(--fat)' },
  ];
  return (
    <div class="stack">
      <div class="macro-bar" role="img" aria-label={parts.map((p) => `${p.name} ${one(p.pct)}%`).join(', ')}>
        {parts.filter((p) => p.pct > 0).map((p) => <div key={p.name} style={{ width: `${p.pct}%`, background: p.color }} />)}
      </div>
      <div class="legend">
        {parts.map((p) => (
          <span key={p.name}><i style={{ background: p.color }} />{p.name} {one(p.grams)} g ({one(p.pct)}%)</span>
        ))}
      </div>
    </div>
  );
}

export function DayStrip({ sub }: { sub?: (day: number) => string }) {
  const { ui } = useStore();
  const today = todayIndex();
  return (
    <div class="day-strip" role="group" aria-label="Choose a day">
      {DAYS.map((d, i) => (
        <button
          key={d}
          type="button"
          class={i === today ? 'today' : ''}
          aria-pressed={ui.day === i}
          aria-label={`${d}${i === today ? ' (today)' : ''}`}
          onClick={() => setUi({ day: i })}
        >
          {d.slice(0, 3)}
          {sub && <small class="tabular">{sub(i)}</small>}
        </button>
      ))}
    </div>
  );
}

const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet on phones, centred dialog elsewhere. The body scrolls and the header stays
 * put, so the close button is always reachable. Height follows the visual viewport, so the
 * iOS keyboard shrinks the sheet rather than covering it.
 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    document.body.classList.add('sheet-open');
    panel.current?.focus();
    const vv = window.visualViewport;
    const fit = () => {
      if (!vv || !wrap.current) return;
      wrap.current.style.height = `${vv.height}px`;
      wrap.current.style.top = `${vv.offsetTop}px`;
    };
    fit();
    vv?.addEventListener('resize', fit);
    vv?.addEventListener('scroll', fit);
    return () => {
      vv?.removeEventListener('resize', fit);
      vv?.removeEventListener('scroll', fit);
      if (!document.querySelector('.sheet-wrap ~ .sheet-wrap')) document.body.classList.remove('sheet-open');
      previous?.focus?.();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div class="sheet-wrap" ref={wrap} onClick={(e) => { if (e.target === wrap.current) onClose(); }} onKeyDown={onKeyDown}>
      <div class="sheet" ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div class="sheet-head">
          <h2>{title}</h2>
          <button type="button" class="icon-btn" aria-label="Close" onClick={onClose}><CloseIcon /></button>
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmSheet({ title, message, confirmLabel, danger, onConfirm, onClose }: { title: string; message: ComponentChildren; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p>{message}</p>
      <div class="row">
        <button type="button" class={`btn grow ${danger ? 'danger' : 'primary'}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        <button type="button" class="btn subtle grow" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

export function Stepper({ value, onValue, step = 1, min = 0, max = 100, label }: { value: string; onValue: (v: string) => void; step?: number; min?: number; max?: number; label: string }) {
  const change = (delta: number) => {
    const current = Number(value) || 0;
    onValue(String(Math.min(max, Math.max(min, Math.round((current + delta) * 100) / 100))));
  };
  return (
    <div class="row" style={{ flexWrap: 'nowrap' }}>
      <button type="button" class="btn" aria-label={`Decrease ${label}`} onClick={() => change(-step)}>−</button>
      <input type="number" inputMode="decimal" step="any" min={min} max={max} aria-label={label} value={value} onInput={(e) => onValue(e.currentTarget.value)} class="center" />
      <button type="button" class="btn" aria-label={`Increase ${label}`} onClick={() => change(step)}>+</button>
    </div>
  );
}
