import { cn, formatPercent } from "@/lib/utils";
import type { Health } from "@/lib/types";

export const healthLabel: Record<Health, string> = {
  red: "Needs action",
  amber: "Watch",
  green: "On track",
};

const chip: Record<Health, string> = {
  red: "bg-red-soft text-red",
  amber: "bg-amber-soft text-amber",
  green: "bg-green-soft text-green",
};

/** Timetable-style status: a small solid block with the word beside it. */
export function StatusChip({ health, compact }: { health: Health; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-[4px] px-2 text-xs font-medium whitespace-nowrap",
        chip[health],
      )}
    >
      <span aria-hidden className="size-1.5 rounded-[1px] bg-current" />
      {compact ? null : healthLabel[health]}
      {compact && <span className="sr-only">{healthLabel[health]}</span>}
    </span>
  );
}

/** Signed percentage, coloured by direction. `goodWhenUp` flips for cost metrics. */
export function Delta({ value, goodWhenUp = true }: { value: number; goodWhenUp?: boolean }) {
  const good = goodWhenUp ? value >= 0 : value <= 0;
  const flat = Math.abs(value) < 0.005;
  return (
    <span
      className={cn(
        "num text-xs font-medium",
        flat ? "text-fg-3" : good ? "text-green" : "text-red",
      )}
    >
      {flat ? "±0%" : formatPercent(value)}
    </span>
  );
}

/** Seven small bars, last one emphasised. Real data, not decoration. */
export function TrendStrip({ values, health }: { values: number[]; health: Health }) {
  const max = Math.max(...values, 1);
  const color = { red: "bg-red", amber: "bg-amber", green: "bg-green" }[health];
  return (
    <span className="inline-flex h-5 items-end gap-[3px]" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className={cn(
            "w-[5px] rounded-[1px]",
            i === values.length - 1 ? color : "bg-line-strong",
          )}
          style={{ height: `${Math.max(2, Math.round((v / max) * 20))}px` }}
        />
      ))}
    </span>
  );
}
