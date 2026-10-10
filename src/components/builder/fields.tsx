"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Inspector controls. Small and dense like the rest of Lotus: 12px labels,
 * 30px controls, hairlines. Every control commits on change; the editor
 * coalesces typing into one undo step.
 */

export const ctl = "h-[30px] w-full min-w-0 rounded border border-line-strong bg-surface px-2 text-[13px] text-fg placeholder:text-fg-3/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export function Row({ label, hint, children, inline }: { label: string; hint?: string; children: React.ReactNode; inline?: boolean }) {
  const id = useId();
  return (
    <div className={cn("flex gap-1.5", inline ? "items-center justify-between" : "flex-col")}>
      <label htmlFor={id} className="text-xs font-medium text-fg-2">
        {label}
      </label>
      <div id={id} className={inline ? "shrink-0" : ""}>
        {children}
      </div>
      {hint && <p className="text-[11px] leading-4 text-fg-3">{hint}</p>}
    </div>
  );
}

export function Group({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line px-4 py-4 last:border-b-0">
      <div className="flex items-center justify-between">
        <h3 className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Text({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  return <input aria-label={label} className={ctl} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Area({ value, onChange, rows = 3, label, mono }: { value: string; onChange: (v: string) => void; rows?: number; label?: string; mono?: boolean }) {
  return <textarea aria-label={label} className={cn(ctl, "h-auto py-1.5 leading-5", mono && "font-mono text-xs")} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />;
}

/** A number with a unit; empty means "use the default". */
export function Num({ value, onChange, min = 0, max = 400, step = 4, unit = "px", placeholder, label }: { value: number | undefined; onChange: (v: number | undefined) => void; min?: number; max?: number; step?: number; unit?: string; placeholder?: string; label?: string }) {
  return (
    <div className="relative">
      <input
        aria-label={label}
        type="number"
        inputMode="numeric"
        className={cn(ctl, "num pr-7")}
        value={value ?? ""}
        placeholder={placeholder ?? "Auto"}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") return onChange(undefined);
          const n = Number(v);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      {unit && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-fg-3">{unit}</span>}
    </div>
  );
}

export function Seg<T extends string | number>({ value, onChange, options, label }: { value: T | undefined; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; title?: string }[]; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-[30px] rounded border border-line-strong bg-surface-2/60 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn("flex min-w-0 flex-1 items-center justify-center rounded-[4px] px-1.5 text-xs font-medium transition-colors duration-100", value === o.value ? "bg-surface text-fg shadow-[0_1px_2px_rgba(15,18,33,0.1)]" : "text-fg-3 hover:text-fg")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span className="flex flex-col">
        <span className="text-xs font-medium text-fg-2">{label}</span>
        {hint && <span className="text-[11px] leading-4 text-fg-3">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-[18px] w-8 rounded-full bg-line-strong transition-colors peer-checked:bg-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand" />
        <span className="absolute left-0.5 top-0.5 size-[14px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-[14px]" />
      </span>
    </label>
  );
}

const hexOk = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

/** Theme swatches first (they follow the theme), then any hex. */
export function Color({ value, onChange, swatches, label, allowClear = true }: { value: string | undefined; onChange: (v: string | undefined) => void; swatches: { value: string; label: string; show: string }[]; label?: string; allowClear?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const hex = value && hexOk(value) ? value : "";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {swatches.map((s) => (
          <button
            key={s.value}
            type="button"
            title={s.label}
            aria-label={`${label ?? "Colour"}: ${s.label}`}
            aria-pressed={value === s.value}
            onClick={() => onChange(s.value)}
            className={cn("size-6 rounded-full border border-line-strong ring-offset-1 ring-offset-surface transition-shadow", value === s.value && "ring-2 ring-brand")}
            style={{ background: s.show }}
          />
        ))}
        <label className={cn("relative size-6 cursor-pointer overflow-hidden rounded-full border border-line-strong", hex && !swatches.some((s) => s.value === value) && "ring-2 ring-brand ring-offset-1 ring-offset-surface")} title="Pick a colour" style={{ background: hex || "conic-gradient(#f43f5e,#f59e0b,#22c55e,#06b6d4,#6366f1,#d946ef,#f43f5e)" }}>
          <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={hex || "#000000"} onChange={(e) => onChange(e.target.value)} aria-label={`${label ?? "Colour"}: custom`} />
        </label>
        {allowClear && value && (
          <button type="button" onClick={() => onChange(undefined)} className="ml-auto text-[11px] text-fg-3 hover:text-fg">
            Reset
          </button>
        )}
      </div>
      <input
        aria-label={`${label ?? "Colour"} hex`}
        className={cn(ctl, "num h-7 text-xs")}
        value={draft ?? (value && value.startsWith("#") ? value : "")}
        placeholder={value?.startsWith("var(") ? swatches.find((s) => s.value === value)?.label ?? "Theme colour" : "#hex"}
        onChange={(e) => {
          setDraft(e.target.value);
          if (hexOk(e.target.value)) onChange(e.target.value);
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}

/** An editable list of short strings (bullets, features, logo names). */
export function StringList({ items, onChange, addLabel, placeholder }: { items: string[]; onChange: (v: string[]) => void; addLabel: string; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <div key={i} className="group flex items-center gap-1">
          <input className={ctl} value={it} placeholder={placeholder} aria-label={`Item ${i + 1}`} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <MiniButtons index={i} count={items.length} onMove={(d) => onChange(move(items, i, d))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <AddButton onClick={() => onChange([...items, ""])}>{addLabel}</AddButton>
    </div>
  );
}

export function move<T>(xs: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= xs.length) return xs;
  const next = [...xs];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export function MiniButtons({ index, count, onMove, onRemove }: { index: number; count: number; onMove: (d: -1 | 1) => void; onRemove: () => void }) {
  const b = "grid size-6 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="flex shrink-0">
      <button type="button" className={b} aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
        <ArrowUp className="size-3.5" strokeWidth={1.75} />
      </button>
      <button type="button" className={b} aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
        <ArrowDown className="size-3.5" strokeWidth={1.75} />
      </button>
      <button type="button" className={cn(b, "hover:text-red")} aria-label="Remove" onClick={onRemove}>
        <X className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex h-[30px] items-center justify-center gap-1.5 rounded border border-dashed border-line-strong text-xs font-medium text-fg-2 transition-colors hover:border-fg-3 hover:bg-surface-2/60 hover:text-fg">
      <Plus className="size-3.5" strokeWidth={2} />
      {children}
    </button>
  );
}

export function Pick<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label?: string }) {
  return (
    <select aria-label={label} className={cn(ctl, "pr-6")} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Dollars typed, cents stored. */
export function Money({ cents, onChange, label }: { cents: number; onChange: (c: number) => void; label?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-fg-3">$</span>
      <input
        aria-label={label}
        inputMode="decimal"
        className={cn(ctl, "num pl-5")}
        value={draft ?? (cents / 100).toFixed(cents % 100 ? 2 : 0)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value.replace(/[^0-9.]/g, ""));
          if (Number.isFinite(n)) onChange(Math.round(n * 100));
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}
