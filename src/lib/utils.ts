import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value * 100)}%`;
}

/** Change of the last value versus the mean of the values before it. */
export function trendDelta(series: number[]) {
  if (series.length < 2) return 0;
  const last = series[series.length - 1];
  const prior = series.slice(0, -1);
  const mean = prior.reduce((a, b) => a + b, 0) / prior.length;
  if (mean === 0) return last === 0 ? 0 : 1;
  return (last - mean) / mean;
}

/** Whole dollars, no cents: $1,155. */
export function formatDollars(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

/** Dollars and cents: $17.24. */
export function formatDollarsExact(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

/** Compact money for KPI tiles: $339.6K, $1.2M. */
export function formatDollarsCompact(cents: number) {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(v) >= 10_000) return `$${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return formatDollars(cents);
}

export function formatCount(n: number) {
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatRate(value: number | null, digits = 0) {
  return value === null ? "–" : `${(value * 100).toFixed(digits)}%`;
}

export function formatMultiple(value: number | null) {
  return value === null ? "–" : `${value.toFixed(1)}x`;
}

export function timeAgo(iso: string, now: Date) {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
