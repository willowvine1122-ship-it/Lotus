import type { Appointment, AppointmentStatus, AppointmentType, Calendar, MeetingLocation } from "@/lib/types";

/*
 * Booking arithmetic shared by the agency screens and the public booking
 * page. All availability is defined in the calendar's own time zone; these
 * helpers turn a wall-clock day and minute into an instant and back without
 * a date library.
 */

export interface Busy {
  start: number; // epoch ms
  end: number;
}

const parts = (date: Date, timeZone: string) => {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") % 24, minute: get("minute"), second: get("second") };
};

/** Minutes the zone is ahead of UTC at that instant. */
function offsetMinutes(date: Date, timeZone: string) {
  const p = parts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** The instant of `minute` past midnight on `day` (YYYY-MM-DD) in `timeZone`. */
export function zonedTime(day: string, minute: number, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minute);
  const off = offsetMinutes(new Date(guess), timeZone);
  let t = guess - off * 60000;
  const off2 = offsetMinutes(new Date(t), timeZone);
  if (off2 !== off) t = guess - off2 * 60000;
  return new Date(t);
}

/** YYYY-MM-DD of an instant as seen in `timeZone`. */
export function dayIn(date: Date, timeZone: string) {
  const p = parts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function minuteIn(date: Date, timeZone: string) {
  const p = parts(date, timeZone);
  return p.hour * 60 + p.minute;
}

export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function weekdayOf(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function busyFrom(appointments: Appointment[], calendarId: string): Busy[] {
  return appointments
    .filter((a) => a.calendarId === calendarId && a.status !== "cancelled")
    .map((a) => ({ start: new Date(a.startsAt).getTime(), end: new Date(a.endsAt).getTime() }));
}

/** Open start times on one day for one appointment type. */
export function slotsFor(cal: Calendar, type: AppointmentType, busy: Busy[], day: string, now: Date): Date[] {
  const today = dayIn(now, cal.timeZone);
  const ahead = daysBetween(today, day);
  if (ahead < 0 || ahead > cal.maxDaysAhead) return [];
  if (cal.blockedDates.includes(day)) return [];
  const windows = cal.weekly[weekdayOf(day)] ?? [];
  const earliest = now.getTime() + cal.minNoticeHours * 3600000;
  const step = cal.slotStepMinutes || type.durationMinutes;
  const buffer = cal.bufferMinutes * 60000;
  const out: Date[] = [];
  for (const w of windows) {
    for (let m = w.start; m + type.durationMinutes <= w.end; m += step) {
      const start = zonedTime(day, m, cal.timeZone).getTime();
      const end = start + type.durationMinutes * 60000;
      if (start < earliest) continue;
      if (busy.some((b) => start < b.end + buffer && end + buffer > b.start)) continue;
      out.push(new Date(start));
    }
  }
  return out;
}

export function isSlotOpen(cal: Calendar, type: AppointmentType, busy: Busy[], start: Date, now: Date) {
  const day = dayIn(start, cal.timeZone);
  return slotsFor(cal, type, busy, day, now).some((s) => s.getTime() === start.getTime());
}

/* ------------------------------ labels ------------------------------ */

export const statusLabel: Record<AppointmentStatus, string> = {
  booked: "Unconfirmed",
  confirmed: "Confirmed",
  showed: "Showed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

export const locationLabel: Record<MeetingLocation, string> = {
  phone: "Phone call",
  video: "Video call",
  in_person: "In person",
};

export const weekdayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A booking in the past that nobody has marked as showed or no-show. */
export function needsOutcome(a: Appointment, now: Date) {
  return (a.status === "booked" || a.status === "confirmed") && new Date(a.endsAt).getTime() <= now.getTime();
}

export function formatMinute(m: number) {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min === 0 ? `${h12}${suffix}` : `${h12}:${String(min).padStart(2, "0")}${suffix}`;
}

export function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(date);
}

export function tzAbbr(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
}

export function tzLong(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" }).formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

export function formatDay(day: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** "Mon–Fri 9am–5pm" style summary of the weekly hours. */
export function hoursSummary(weekly: Calendar["weekly"]) {
  const key = (ws: Calendar["weekly"][number]) => ws.map((w) => `${w.start}-${w.end}`).join(",");
  const runs: { from: number; to: number; k: string }[] = [];
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    const k = key(weekly[d] ?? []);
    const last = runs[runs.length - 1];
    if (last && last.k === k) last.to = d;
    else runs.push({ from: d, to: d, k });
  }
  const parts = runs
    .filter((r) => r.k)
    .map((r) => {
      const days = r.from === r.to ? weekdayShort[r.from] : `${weekdayShort[r.from]}–${weekdayShort[r.to]}`;
      const ws = weekly[r.from].map((w) => `${formatMinute(w.start)}–${formatMinute(w.end)}`).join(", ");
      return `${days} ${ws}`;
    });
  return parts.length ? parts.join(" · ") : "No hours set";
}
