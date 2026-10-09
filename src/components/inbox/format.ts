"use client";

import { useSyncExternalStore } from "react";

/*
 * Times render in the viewer's zone. The server renders in UTC, then the
 * client switches to its own zone after hydration, so the two never disagree.
 */

const noop = () => () => {};

export function useTimeZone() {
  return useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
}

function dayKey(d: Date, timeZone: string) {
  return d.toLocaleDateString("en-CA", { timeZone });
}

/** List time: "2:14 PM" today, "Yesterday", weekday within a week, else "Oct 3". */
export function listTime(iso: string, now: Date, timeZone: string) {
  const d = new Date(iso);
  const days = Math.round((Date.parse(dayKey(now, timeZone)) - Date.parse(dayKey(d, timeZone))) / 86_400_000);
  if (days <= 0) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "short", timeZone });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
}

export function clockTime(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
}

/** Date divider label: "Today", "Yesterday", "Mon, Oct 5". */
export function dayLabel(iso: string, now: Date, timeZone: string) {
  const d = new Date(iso);
  const days = Math.round((Date.parse(dayKey(now, timeZone)) - Date.parse(dayKey(d, timeZone))) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone });
}

export function sameDay(a: string, b: string, timeZone: string) {
  return dayKey(new Date(a), timeZone) === dayKey(new Date(b), timeZone);
}

export function contactName(c: { firstName: string; lastName: string }) {
  return `${c.firstName} ${c.lastName}`.trim();
}

export function contactInitials(c: { firstName: string; lastName: string }) {
  return `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase();
}
