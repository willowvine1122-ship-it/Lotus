import { useId } from "react";
import { cn } from "@/lib/utils";

/*
 * The Lotus mark: five petals opening from one point. The petals are drawn
 * back to front and outlined in the colour behind them, so the outline reads
 * as a gap; pass `on` for the surface the mark sits on.
 */

const BASE = 27.5;
const petal = (h: number, w: number) =>
  `M16 ${BASE - h} C ${16 + w} ${BASE - h * 0.68}, ${16 + w * 0.9} ${BASE - h * 0.22}, 16 ${BASE} C ${16 - w * 0.9} ${BASE - h * 0.22}, ${16 - w} ${BASE - h * 0.68}, 16 ${BASE - h} Z`;

export const LOTUS_PETALS = [
  { turn: -64, d: petal(13.5, 4.6), tone: "outer" },
  { turn: 64, d: petal(13.5, 4.6), tone: "outer" },
  { turn: -31, d: petal(18.5, 5.4), tone: "inner" },
  { turn: 31, d: petal(18.5, 5.4), tone: "inner" },
  { turn: 0, d: petal(23, 6.2), tone: "heart" },
] as const;

export const LOTUS_COLORS = { outer: "#6d3df2", inner: "#a855f7", heartTop: "#f5d0fe", heartBottom: "#8b5cf6" };

export function LotusMark({ on = "var(--rail)", className, title }: { on?: string; className?: string; title?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6 shrink-0", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={LOTUS_COLORS.heartTop} />
          <stop offset="1" stopColor={LOTUS_COLORS.heartBottom} />
        </linearGradient>
      </defs>
      {LOTUS_PETALS.map((p) => (
        <path
          key={p.turn}
          d={p.d}
          transform={`rotate(${p.turn} 16 ${BASE})`}
          fill={p.tone === "heart" ? `url(#${id})` : LOTUS_COLORS[p.tone]}
          stroke={on}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/** Mark and wordmark together, for the rail, sign-in and anywhere the brand is named. */
export function LotusLogo({ on, className, markClassName }: { on?: string; className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LotusMark on={on} className={markClassName} />
      <span className="text-[17px] font-semibold tracking-[-0.03em]">Lotus</span>
    </span>
  );
}
