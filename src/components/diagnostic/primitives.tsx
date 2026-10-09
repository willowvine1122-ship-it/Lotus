"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Assignee, Health } from "@/lib/types";
import { pacingTone } from "@/lib/diagnostic";
import { cn, formatDollarsCompact, formatPercent } from "@/lib/utils";

export const healthDot: Record<Health, string> = { red: "bg-red", amber: "bg-amber", green: "bg-green" };
export const healthText: Record<Health, string> = { red: "text-red", amber: "text-amber", green: "text-green" };

export function StatusDot({ health, className }: { health: Health; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", healthDot[health], className)} />;
}

/** Signed change as a compact tag. `goodWhenUp=false` for cost metrics. */
export function Change({ value, goodWhenUp = true, className }: { value: number | null; goodWhenUp?: boolean; className?: string }) {
  if (value === null) return null;
  const flat = Math.abs(value) < 0.005;
  const good = goodWhenUp ? value > 0 : value < 0;
  return (
    <span className={cn("num text-xs font-medium", flat ? "text-fg-3" : good ? "text-green" : "text-red", className)}>
      {flat ? "0%" : formatPercent(value)}
    </span>
  );
}

/** Arrow plus percent, used in the trend tiles. */
export function ChangeArrow({ value, goodWhenUp = true }: { value: number | null; goodWhenUp?: boolean }) {
  if (value === null) return <span className="text-xs text-fg-3">–</span>;
  const flat = Math.abs(value) < 0.005;
  const good = goodWhenUp ? value > 0 : value < 0;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("num inline-flex items-center gap-0.5 text-xs font-medium", flat ? "text-fg-3" : good ? "text-green" : "text-red")}>
      {!flat && <Icon className="size-3" strokeWidth={2.25} />}
      {flat ? "0%" : `${Math.abs(Math.round(value * 100))}%`}
    </span>
  );
}

/**
 * Month-to-date pacing. The centre tick is "on pace"; the dot sits at the
 * actual pace on a 0 to 200% track, coloured by how far off it is.
 */
export function PacingGauge({ pct, budgetCents, kind = "budget" }: { pct: number; budgetCents: number; kind?: "budget" | "goal" }) {
  const tone = pacingTone(pct, kind);
  const pos = Math.min(1, Math.max(0, pct / 2)) * 100;
  return (
    <div className="flex w-[120px] flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className={cn("num text-sm font-medium", healthText[tone])}>{Math.round(pct * 100)}%</span>
        <span className="num text-2xs text-fg-3">{formatDollarsCompact(budgetCents)}</span>
      </div>
      <div className="relative h-2" aria-hidden>
        <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-line-strong" />
        <span className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-fg-3" />
        <span
          className={cn("absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface", healthDot[tone])}
          style={{ left: `${pos}%` }}
        />
      </div>
    </div>
  );
}

const avatarTone: Record<Assignee["tone"], string> = {
  violet: "bg-brand text-white",
  orange: "bg-chart-2 text-white",
  teal: "bg-chart-1 text-white",
  ink: "bg-rail text-rail-fg",
};

export function Avatar({ person, size = "sm" }: { person: Assignee; size?: "sm" | "md" }) {
  return (
    <span
      title={person.name}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold ring-2 ring-surface",
        size === "sm" ? "size-6 text-2xs" : "size-8 text-xs",
        avatarTone[person.tone],
      )}
    >
      {person.initials}
      <span className="sr-only">{person.name}</span>
    </span>
  );
}

export function AvatarStack({ people }: { people: Assignee[] }) {
  return (
    <span className="flex -space-x-1.5">
      {people.map((p) => (
        <Avatar key={p.name} person={p} />
      ))}
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  tone = "ink",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  tone?: "ink" | "paper";
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex h-7 items-center rounded p-0.5", tone === "ink" ? "bg-rail-2" : "bg-surface-2")}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-6 rounded-[4px] px-2.5 text-xs font-medium transition-colors duration-150",
              tone === "ink"
                ? active
                  ? "bg-surface text-fg"
                  : "text-rail-fg-2 hover:text-rail-fg"
                : active
                  ? "bg-rail text-rail-fg"
                  : "text-fg-2 hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Tag({ children, tone = "amber" }: { children: React.ReactNode; tone?: "amber" | "brand" | "neutral" }) {
  const cls = { amber: "bg-amber-soft text-amber", brand: "bg-brand-soft text-brand", neutral: "bg-surface-2 text-fg-2" }[tone];
  return <span className={cn("inline-flex h-5 items-center rounded-[4px] px-1.5 text-2xs font-medium whitespace-nowrap", cls)}>{children}</span>;
}

export function SectionTitle({ children, sub, aside }: { children: React.ReactNode; sub?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold">{children}</h3>
        {sub && <p className="text-xs text-fg-3">{sub}</p>}
      </div>
      {aside}
    </div>
  );
}
