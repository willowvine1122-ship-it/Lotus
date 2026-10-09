import type { Appointment, AppointmentSource, AppointmentStatus, AppointmentType, Calendar, ClientRecord, ContactRef, MeetingLocation } from "@/lib/types";
import { addDays, busyFrom, dayIn, isSlotOpen, slotsFor, zonedTime } from "@/lib/calendars";
import { addActivity, listClients, slugify } from "./store";

/*
 * Demo calendars and bookings. Same arrangement as the client store: kept
 * in process memory on globalThis, seeded from the synthetic clients once
 * per day, mutated by the server actions, and replaced by the tables in
 * migration 0005 once Supabase is connected. Calendars and bookings made
 * in this process survive the daily reseed.
 */

interface CalendarStore {
  seededFor: string;
  calendars: Calendar[];
  appointments: Appointment[];
}

const g = globalThis as unknown as { __lotusCalendars?: CalendarStore };

type TypeSeed = [name: string, minutes: number, location: MeetingLocation, description: string];

const presets: Record<string, { name: string; owner: string; types: TypeSeed[]; hours: [number, number]; saturday?: [number, number]; office?: boolean }> = {
  "brightside-dental": { name: "New patient visits", owner: "Dr. Lena Ortiz", office: true, hours: [8 * 60, 17 * 60], saturday: [9 * 60, 13 * 60], types: [["Implant consultation", 45, "in_person", "Meet the doctor, a 3D scan and a written treatment plan with pricing."], ["New patient exam", 60, "in_person", "Exam, X-rays and a cleaning for new patients."]] },
  "summit-roofing": { name: "Roof inspections", owner: "Mike Alvarez", hours: [8 * 60, 17 * 60], saturday: [9 * 60, 12 * 60], types: [["Free roof inspection", 60, "in_person", "An inspector checks the roof for storm and hail damage and walks you through the photos."], ["Insurance claim review", 30, "phone", "We go through your claim paperwork and next steps."]] },
  "air-pro-hvac": { name: "Service and estimates", owner: "Dana Reyes", hours: [7 * 60, 18 * 60], types: [["In-home estimate", 60, "in_person", "A technician sizes your system and gives a written quote."], ["Tune-up visit", 90, "in_person", "Seasonal tune-up for one system."]] },
  "harbor-plumbing": { name: "Service calls", owner: "Tom Becker", hours: [7 * 60, 17 * 60], types: [["Service call", 60, "in_person", "A licensed plumber diagnoses the problem on site."]] },
  "northwind-solar": { name: "Solar consultations", owner: "Priya Nair", hours: [9 * 60, 18 * 60], types: [["Solar savings call", 30, "video", "We size a system from your bill and estimate rebates."], ["Site survey", 90, "in_person", "Roof measurements and a shade report."]] },
  "maple-lane-ortho": { name: "Consultations", owner: "Dr. Sam Hale", office: true, hours: [8 * 60 + 30, 16 * 60 + 30], types: [["Free consultation", 45, "in_person", "Exam, photos and a treatment plan for braces or aligners."]] },
  "keystone-garage": { name: "Estimates", owner: "Joe Kowalski", hours: [8 * 60, 16 * 60], types: [["Door replacement estimate", 45, "in_person", "Measurements and a written quote."]] },
  "clearwater-pools": { name: "Design consultations", owner: "Rachel Kim", hours: [9 * 60, 17 * 60], types: [["Pool design consultation", 90, "in_person", "A designer walks the yard and sketches options and budgets."]] },
  "evergreen-landscaping": { name: "Site visits", owner: "Owen Price", hours: [8 * 60, 16 * 60], types: [["Landscape site visit", 60, "in_person", "We walk the property and talk through ideas and budget."]] },
  "redwood-movers": { name: "Move estimates", owner: "Carla Diaz", hours: [8 * 60, 18 * 60], saturday: [9 * 60, 14 * 60], types: [["Video walkthrough estimate", 30, "video", "Show us the rooms on a call and get a fixed quote."], ["In-home estimate", 45, "in_person", "An estimator visits and quotes on the spot."]] },
  "lakeside-vet": { name: "Appointments", owner: "the Lakeside care team", office: true, hours: [8 * 60, 18 * 60], saturday: [9 * 60, 13 * 60], types: [["Wellness exam", 30, "in_person", "Annual exam and vaccines."], ["New pet visit", 45, "in_person", "First visit for a new puppy, kitten or rescue."]] },
  "ironclad-fencing": { name: "Fence estimates", owner: "Luis Moreno", hours: [8 * 60, 17 * 60], types: [["On-site fence estimate", 45, "in_person", "We measure the line and quote materials and install."]] },
  "hope-harbor": { name: "Donor conversations", owner: "Grace Holloway", office: true, hours: [10 * 60, 16 * 60], types: [["Major gift conversation", 30, "video", "A conversation with our development director about the winter shelter."], ["Shelter tour", 60, "in_person", "Visit the shelter and meet the team."]] },
  "clean-water": { name: "Partner calls", owner: "Amara Osei", hours: [9 * 60, 15 * 60], types: [["Matching gift call", 30, "video", "For companies and foundations matching gifts this season."]] },
};

const firstNames = ["James", "Maria", "Robert", "Linda", "Michael", "Patricia", "David", "Jennifer", "Chris", "Elizabeth", "Daniel", "Susan", "Kevin", "Karen", "Brian", "Nancy", "Jason", "Lisa", "Ryan", "Angela", "Eric", "Megan", "Tyler", "Rachel", "Aaron", "Hannah", "Marcus", "Olivia", "Nathan", "Sophia", "Jordan", "Emily"];
const lastNames = ["Johnson", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris", "Clark", "Lewis", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Green", "Baker", "Nguyen"];
const leadNotes = [
  "Hail hit the back slope last week, some shingles in the yard.",
  "Prefer a call 15 minutes before arriving.",
  "Gate code 4471. Dog is friendly.",
  "Comparing two quotes, want to decide this month.",
  "Saw the ad on Facebook. Is financing available?",
  "Second opinion, first company said full replacement.",
  "Please bring samples if possible.",
];

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function weeklyFrom(hours: [number, number], saturday?: [number, number]): Calendar["weekly"] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => {
    if (d === 0) return [];
    if (d === 6) return saturday ? [{ start: saturday[0], end: saturday[1] }] : [];
    return [{ start: hours[0], end: hours[1] }];
  });
}

function seed(now: Date): { calendars: Calendar[]; appointments: Appointment[] } {
  const clients = listClients(now);
  const calendars: Calendar[] = [];
  const appointments: Appointment[] = [];
  for (const c of clients) {
    const p = presets[c.account.slug];
    if (!p) continue;
    const id = `cal-${c.account.slug}`;
    const cal: Calendar = {
      id,
      accountId: c.account.id,
      name: p.name,
      slug: c.account.slug,
      description: undefined,
      ownerName: p.owner,
      timeZone: c.timeZone,
      weekly: weeklyFrom(p.hours, p.saturday),
      blockedDates: [],
      bufferMinutes: 15,
      minNoticeHours: 4,
      maxDaysAhead: 30,
      slotStepMinutes: 30,
      bookingEnabled: true,
      types: p.types.map(([name, minutes, location, description], i) => ({
        id: `${id}-t${i + 1}`,
        calendarId: id,
        name,
        durationMinutes: minutes,
        description,
        location,
        locationDetail: location === "in_person" ? (p.office ? `Our office in ${c.location}` : "At your home or business") : location === "video" ? "Google Meet link sent by email" : "We call the number you give",
        active: true,
      })),
      createdAt: new Date(now.getTime() - 60 * 86400000).toISOString(),
    };
    calendars.push(cal);
    appointments.push(...seedAppointments(cal, c, now));
  }
  return { calendars, appointments };
}

function seedAppointments(cal: Calendar, client: ClientRecord, now: Date): Appointment[] {
  const r = rng(cal.id);
  const out: Appointment[] = [];
  const today = dayIn(now, cal.timeZone);
  const perDay = client.mode === "fundraising" ? 0.8 : client.account.slug === "lakeside-vet" || client.account.slug === "brightside-dental" ? 4 : 2.4;
  const showRate = client.mode === "marketing" ? (client as Extract<ClientRecord, { mode: "marketing" }>).days.length ? 0.78 : 0.8 : 0.85;
  const domain = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com"];
  // Seed with a fixed "now" far in the past so min-notice rules do not block history.
  const past = new Date(now.getTime() - 40 * 86400000);
  for (let off = -21; off <= 13; off++) {
    const day = addDays(today, off);
    const n = Math.round(perDay * (0.5 + r()));
    for (let i = 0; i < n; i++) {
      const type = cal.types[r() < 0.7 ? 0 : cal.types.length - 1];
      const busy = busyFrom(out, cal.id);
      const slots = slotsFor({ ...cal, maxDaysAhead: 90, minNoticeHours: 0 }, type, busy, day, past);
      if (slots.length === 0) break;
      const start = slots[Math.floor(r() * slots.length)];
      const end = new Date(start.getTime() + type.durationMinutes * 60000);
      const first = firstNames[Math.floor(r() * firstNames.length)];
      const last = lastNames[Math.floor(r() * lastNames.length)];
      const isPast = end.getTime() <= now.getTime();
      let status: AppointmentStatus;
      const roll = r();
      if (isPast) {
        const hoursAgo = (now.getTime() - end.getTime()) / 3600000;
        if (hoursAgo < 30 && roll < 0.45) status = roll < 0.2 ? "booked" : "confirmed";
        else if (roll < 0.06) status = "cancelled";
        else status = r() < showRate ? "showed" : "no_show";
      } else {
        status = roll < 0.05 ? "cancelled" : roll < 0.62 ? "confirmed" : "booked";
      }
      const sourceRoll = r();
      const source: AppointmentSource = sourceRoll < 0.68 ? "booking_page" : sourceRoll < 0.88 ? "ads" : "manual";
      const leadDays = 1 + Math.floor(r() * 9);
      const created = new Date(Math.min(start.getTime() - leadDays * 86400000 + Math.floor(r() * 36000000), now.getTime() - 3600000 * (1 + r() * 30)));
      const contactId = `${cal.id}-c${out.length + 1}`;
      const contact: ContactRef = {
        id: contactId,
        accountId: cal.accountId,
        name: `${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@${domain[Math.floor(r() * domain.length)]}`,
        phone: `(${200 + Math.floor(r() * 700)}) ${String(200 + Math.floor(r() * 700))}-${String(1000 + Math.floor(r() * 8999))}`,
      };
      out.push({
        id: `${cal.id}-a${out.length + 1}`,
        calendarId: cal.id,
        accountId: cal.accountId,
        typeId: type.id,
        contact,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        status,
        source,
        notes: r() < 0.3 ? leadNotes[Math.floor(r() * leadNotes.length)] : undefined,
        createdAt: created.toISOString(),
      });
    }
  }
  return out;
}

function store(now: Date): CalendarStore {
  const key = now.toISOString().slice(0, 10);
  if (!g.__lotusCalendars || g.__lotusCalendars.seededFor !== key) {
    const fresh = seed(now);
    const keptCals = g.__lotusCalendars?.calendars.filter((c) => c.id.startsWith("new-")) ?? [];
    const keptAppts = g.__lotusCalendars?.appointments.filter((a) => a.id.startsWith("new-")) ?? [];
    g.__lotusCalendars = { seededFor: key, calendars: [...fresh.calendars, ...keptCals], appointments: [...fresh.appointments, ...keptAppts] };
  }
  return g.__lotusCalendars;
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

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

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
  const prior = s.appointments.find((a) => a.accountId === cal.accountId && a.contact.email.toLowerCase() === email)?.contact;
  const contact: ContactRef = prior
    ? { ...prior, name: input.name.trim(), phone: input.phone?.trim() || prior.phone }
    : { id: uid("new-contact"), accountId: cal.accountId, name: input.name.trim(), email, phone: input.phone?.trim() || undefined };
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
