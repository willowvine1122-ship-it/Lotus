import { stamp } from "@/lib/ids";
import type { Appointment, AppointmentStatus, AppointmentType, Calendar, ContactRef, MeetingLocation } from "@/lib/types";
import { busyFrom, isSlotOpen, zonedTime } from "@/lib/calendars";
import { defineModule } from "@/lib/server/workspace";
import { addActivity, createContact, listClients, listContacts, slugify } from "./store";

/*
 * Calendars and bookings, saved per agency in the "calendars" module. A
 * calendar's slug is its public booking page (/book/<slug>).
 */

interface CalendarStore {
  calendars: Calendar[];
  appointments: Appointment[];
}

const calendarsModule = defineModule<CalendarStore>({
  key: "calendars",
  init: () => ({ calendars: [], appointments: [] }),
  publicKeys: (s) => s.calendars.map((c) => `calendar:${c.slug}`),
});

function store(_now: Date): CalendarStore {
  return calendarsModule.get();
}

/* ------------------------------ reads ------------------------------- */

export function listCalendars(now: Date) {
  return store(now).calendars;
}

export function findCalendar(now: Date, idOrSlug: string) {
  return store(now).calendars.find((c) => c.id === idOrSlug || c.slug === idOrSlug);
}

export function listAppointments(now: Date) {
  return store(now).appointments;
}

export function findAppointment(now: Date, id: string) {
  return store(now).appointments.find((a) => a.id === id);
}

/* ------------------------------ writes ------------------------------ */

/** Monday to Friday between the given minutes of the day, optional Saturday hours. */
function weeklyFrom(hours: [number, number], saturday?: [number, number]): Calendar["weekly"] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => {
    if (d === 0) return [];
    if (d === 6) return saturday ? [{ start: saturday[0], end: saturday[1] }] : [];
    return [{ start: hours[0], end: hours[1] }];
  });
}

const uid = (prefix: string) => `${prefix}-${stamp()}${Math.floor(Math.random() * 1e4).toString(36)}`;

export interface NewCalendarInput {
  accountId: string;
  name: string;
  ownerName: string;
  timeZone: string;
  type: { name: string; durationMinutes: number; location: MeetingLocation; locationDetail?: string };
}

export function createCalendar(now: Date, input: NewCalendarInput): Calendar {
  const s = store(now);
  const client = listClients(now).find((c) => c.account.id === input.accountId);
  let slug = slugify(`${client?.account.slug ?? "client"} ${input.name}`) || "booking";
  while (s.calendars.some((c) => c.slug === slug)) slug = `${slug}-${s.calendars.length + 1}`;
  const id = uid("new-cal");
  const cal: Calendar = {
    id,
    accountId: input.accountId,
    name: input.name.trim(),
    slug,
    ownerName: input.ownerName.trim(),
    timeZone: input.timeZone,
    weekly: weeklyFrom([9 * 60, 17 * 60]),
    blockedDates: [],
    bufferMinutes: 15,
    minNoticeHours: 4,
    maxDaysAhead: 30,
    slotStepMinutes: 30,
    bookingEnabled: true,
    types: [{ id: `${id}-t1`, calendarId: id, name: input.type.name.trim(), durationMinutes: input.type.durationMinutes, location: input.type.location, locationDetail: input.type.locationDetail, active: true }],
    createdAt: now.toISOString(),
  };
  s.calendars.push(cal);
  return cal;
}

export interface CalendarPatch {
  name?: string;
  description?: string;
  ownerName?: string;
  timeZone?: string;
  weekly?: Calendar["weekly"];
  blockedDates?: string[];
  bufferMinutes?: number;
  minNoticeHours?: number;
  maxDaysAhead?: number;
  slotStepMinutes?: number;
  bookingEnabled?: boolean;
}

export function updateCalendar(now: Date, id: string, patch: CalendarPatch) {
  const cal = findCalendar(now, id);
  if (!cal) return undefined;
  Object.assign(cal, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
  return cal;
}

export function addAppointmentType(now: Date, calendarId: string, t: Omit<AppointmentType, "id" | "calendarId" | "active">) {
  const cal = findCalendar(now, calendarId);
  if (!cal) return undefined;
  const type: AppointmentType = { ...t, id: uid(`${cal.id}-t`), calendarId: cal.id, active: true };
  cal.types.push(type);
  return type;
}

export function setTypeActive(now: Date, calendarId: string, typeId: string, active: boolean) {
  const type = findCalendar(now, calendarId)?.types.find((t) => t.id === typeId);
  if (type) type.active = active;
}

export function setAppointmentStatus(now: Date, id: string, status: AppointmentStatus) {
  const a = findAppointment(now, id);
  if (a) a.status = status;
  return a;
}

export interface BookingInput {
  calendarSlug: string;
  typeId: string;
  startsAt: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

export type BookingResult = { ok: true; appointment: Appointment } | { ok: false; reason: "not_found" | "slot_taken" };

/**
 * Books a slot from the public page. Re-checks the slot against the live
 * calendar so two people cannot take the same time, and reuses the
 * contact when the email has booked with this client before.
 */
export function bookAppointment(now: Date, input: BookingInput): BookingResult {
  const s = store(now);
  const cal = findCalendar(now, input.calendarSlug);
  const type = cal?.types.find((t) => t.id === input.typeId && t.active);
  if (!cal || !type || !cal.bookingEnabled) return { ok: false, reason: "not_found" };
  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime()) || !isSlotOpen(cal, type, busyFrom(s.appointments, cal.id), start, now)) return { ok: false, reason: "slot_taken" };
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const phone = input.phone?.trim() || undefined;
  // Match the CRM contact by email, or add the lead to the CRM.
  const crm =
    listContacts(now, cal.accountId).find((c) => c.email?.toLowerCase() === email) ??
    createContact(now, {
      accountId: cal.accountId,
      firstName: name.split(/\s+/)[0],
      lastName: name.split(/\s+/).slice(1).join(" "),
      email,
      phone,
      tags: [],
      source: "website",
    });
  const contact: ContactRef = crm
    ? { id: crm.id, accountId: cal.accountId, name, email, phone: phone ?? crm.phone }
    : { id: uid("new-contact"), accountId: cal.accountId, name, email, phone };
  const appointment: Appointment = {
    id: uid("new-appt"),
    calendarId: cal.id,
    accountId: cal.accountId,
    typeId: type.id,
    contact,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + type.durationMinutes * 60000).toISOString(),
    status: "booked",
    source: "booking_page",
    notes: input.notes?.trim() || undefined,
    createdAt: now.toISOString(),
  };
  s.appointments.push(appointment);
  const when = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: cal.timeZone, timeZoneName: "short" }).format(start);
  addActivity(now, contact.id, { kind: "appointment", title: `Booked ${type.name}`, body: `${when} on ${cal.name}`, by: "Booking page" });
  return { ok: true, appointment };
}

export function dayStart(day: string, timeZone: string) {
  return zonedTime(day, 0, timeZone);
}
