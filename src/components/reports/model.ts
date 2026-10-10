import type { ReportConfig, ReportSectionId } from "@/lib/types";

/* Shared helpers for the reporting screens. Plain module. */

export const sectionLabel: Record<ReportSectionId, string> = {
  summary: "Headline numbers",
  performance: "Performance over time",
  volume: "Daily volume",
  months: "Month by month",
  countries: "Raised by country",
  reviews: "Recent reviews",
  note: "Note from your account manager",
};

export const allSections: ReportSectionId[] = ["summary", "performance", "volume", "months", "countries", "reviews", "note"];

export const weekdayLabel = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function hourLabel(h: number) {
  const suffix = h >= 12 ? "pm" : "am";
  const n = h % 12 === 0 ? 12 : h % 12;
  return `${n} ${suffix}`;
}

export function scheduleLabel(cfg: ReportConfig) {
  return `${weekdayLabel[cfg.weekday]}s at ${hourLabel(cfg.hour)}`;
}

/** The next scheduled send after `now`. */
export function nextSend(cfg: ReportConfig, now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cfg.hour, 0, 0, 0);
  const ahead = (cfg.weekday - now.getDay() + 7) % 7;
  d.setDate(d.getDate() + ahead);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

export function rangeLabel(range: number) {
  return `Last ${range} days`;
}
