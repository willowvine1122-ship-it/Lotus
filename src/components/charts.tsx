"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/*
 * Inline SVG charts for the client panel. Marks follow the dataviz rules:
 * 2px lines, >= 8px markers with a surface ring, columns capped at 24px
 * with a 2px surface gap, hairline gridlines, text in text tokens only,
 * a legend for two series, and a hover tooltip on everything plotted.
 */

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export interface Series {
  key: string;
  label: string;
  color: string; // css color
  values: (number | null)[];
}

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

export function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function compactNumber(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${Math.round(v)}`;
}

/* ------------------------------ tooltip ----------------------------- */

function Tooltip({
  x,
  width,
  top,
  children,
}: {
  x: number;
  width: number;
  top: number;
  children: React.ReactNode;
}) {
  const flip = x > width * 0.6;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 rounded border border-line bg-surface px-2.5 py-2 text-xs shadow-2"
      style={{ top, left: flip ? undefined : x + 12, right: flip ? width - x + 12 : undefined }}
    >
      {children}
    </div>
  );
}

/* ----------------------------- line chart --------------------------- */

function EmptyChart({ height, label }: { height: number; label: string }) {
  return (
    <div style={{ height }} className="grid place-items-center rounded border border-dashed border-line-strong text-xs text-fg-3">
      {label}
    </div>
  );
}

export function LineChart({
  labels,
  series,
  format,
  height = 190,
  className,
}: {
  labels: string[];
  series: Series[];
  format: (v: number) => string;
  height?: number;
  className?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();

  const pad = { top: 10, right: 10, bottom: 24, left: 44 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const max = Math.max(...all, 1);
  const ticks = niceTicks(max);
  const yMax = ticks[ticks.length - 1];
  const n = labels.length;
  const x = (i: number) => pad.left + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const y = (v: number) => pad.top + innerH - (v / yMax) * innerH;

  const path = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };

  const xTickCount = width < 360 ? 4 : 6;
  const xTicks = Array.from({ length: Math.min(n, xTickCount) }, (_, k) =>
    Math.round((k / Math.max(1, Math.min(n, xTickCount) - 1)) * (n - 1)),
  );

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - pad.left;
    const i = Math.round((px / Math.max(1, innerW)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  if (n === 0) return <EmptyChart height={height} label="No data yet" />;

  return (
    <div ref={ref} className={cn("relative", className)}>
      {series.length > 1 && (
        <ul className="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-fg-2">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-labelledby={`${id}-title`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          className="block touch-none select-none"
        >
          <title id={`${id}-title`}>
            {series.map((s) => s.label).join(" and ")} over {n} days
          </title>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} dy="0.35em" textAnchor="end" className="num fill-fg-3 text-[10px]">
                {format(t)}
              </text>
            </g>
          ))}
          {xTicks.map((i) => (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-fg-3 text-[10px]">
              {shortDate(labels[i])}
            </text>
          ))}
          {series.map((s) => (
            <path key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} className="stroke-line-strong" strokeWidth={1} />
              {series.map((s) => {
                const v = s.values[hover];
                if (v === null) return null;
                return <circle key={s.key} cx={x(hover)} cy={y(v)} r={4} fill={s.color} className="stroke-surface" strokeWidth={2} />;
              })}
            </g>
          )}
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={x(hover)} width={width} top={pad.top + (series.length > 1 ? 26 : 0)}>
          <div className="mb-1 font-medium text-fg">{shortDate(labels[hover])}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4 text-fg-2">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="num text-fg">{s.values[hover] === null ? "–" : format(s.values[hover] as number)}</span>
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  );
}

/* ---------------------------- column chart -------------------------- */

export function ColumnChart({
  labels,
  values,
  color,
  label,
  format = (v) => String(v),
  height = 150,
  className,
}: {
  labels: string[];
  values: number[];
  color: string;
  label: string;
  format?: (v: number) => string;
  height?: number;
  className?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const pad = { top: 8, right: 10, bottom: 24, left: 32 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const n = values.length;
  const max = Math.max(...values, 1);
  const ticks = niceTicks(max, 3);
  const yMax = ticks[ticks.length - 1];
  const slot = n > 0 ? innerW / n : 0;
  const bar = Math.min(24, Math.max(2, slot - 2));
  const x = (i: number) => pad.left + i * slot + (slot - bar) / 2;
  const y = (v: number) => pad.top + innerH - (v / yMax) * innerH;
  const xTickCount = width < 360 ? 4 : 6;
  const xTicks = Array.from({ length: Math.min(n, xTickCount) }, (_, k) =>
    Math.round((k / Math.max(1, Math.min(n, xTickCount) - 1)) * (n - 1)),
  );
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - pad.left;
    setHover(Math.min(n - 1, Math.max(0, Math.floor(px / Math.max(1, slot)))));
  };

  if (n === 0) return <EmptyChart height={height} label="No data yet" />;

  return (
    <div ref={ref} className={cn("relative", className)}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-labelledby={`${id}-title`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          className="block touch-none select-none"
        >
          <title id={`${id}-title`}>{label} per day over {n} days</title>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} dy="0.35em" textAnchor="end" className="num fill-fg-3 text-[10px]">
                {format(t)}
              </text>
            </g>
          ))}
          {values.map((v, i) => {
            const top = y(v);
            const h = pad.top + innerH - top;
            const r = Math.min(4, bar / 2, h);
            const d =
              h <= 0
                ? ""
                : `M${x(i)},${pad.top + innerH} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${bar - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z`;
            return <path key={i} d={d} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />;
          })}
          {xTicks.map((i) => (
            <text key={i} x={x(i) + bar / 2} y={height - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-fg-3 text-[10px]">
              {shortDate(labels[i])}
            </text>
          ))}
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={x(hover) + bar / 2} width={width} top={pad.top}>
          <div className="mb-0.5 font-medium text-fg">{shortDate(labels[hover])}</div>
          <div className="flex items-center justify-between gap-4 text-fg-2">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-[2px]" style={{ background: color }} />
              {label}
            </span>
            <span className="num text-fg">{format(values[hover])}</span>
          </div>
        </Tooltip>
      )}
    </div>
  );
}

/* ------------------------------ sparkline --------------------------- */

export function Sparkline({
  values,
  color,
  width = 72,
  height = 20,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const n = values.length;
  const pts = values.map((v, i) => {
    const px = n > 1 ? (i / (n - 1)) * (width - 2) + 1 : width / 2;
    const py = height - 2 - ((v - min) / Math.max(1, max - min)) * (height - 4);
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} aria-hidden className="block shrink-0">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {n > 0 && (
        <circle cx={pts[n - 1].split(",")[0]} cy={pts[n - 1].split(",")[1]} r={2.5} fill={color} className="stroke-surface" strokeWidth={1.5} />
      )}
    </svg>
  );
}

/* --------------------------- horizontal bars ------------------------ */

export function BarList({
  items,
  color,
  format,
}: {
  items: { key: string; label: string; value: number }[];
  color: string;
  format: (v: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const total = items.reduce((a, i) => a + i.value, 0);
  return (
    <ol className="flex flex-col gap-2">
      {items.map((it) => (
        <li key={it.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs">
          <span className="truncate text-fg-2">{it.label}</span>
          <span className="num text-fg">
            {format(it.value)}
            <span className="ml-1.5 text-fg-3">{total ? Math.round((it.value / total) * 100) : 0}%</span>
          </span>
          <span className="col-span-2 block h-1.5 rounded-[2px] bg-surface-2" aria-hidden>
            <span className="block h-full rounded-[2px]" style={{ width: `${(it.value / max) * 100}%`, background: color }} />
          </span>
        </li>
      ))}
    </ol>
  );
}
