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
