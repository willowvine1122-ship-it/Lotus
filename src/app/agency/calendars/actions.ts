"use server";

import { withWorkspace } from "@/lib/server/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addAppointmentType, createCalendar, findCalendar, setAppointmentStatus, setTypeActive, updateCalendar } from "@/lib/data/calendars";
import { listClients } from "@/lib/data/store";
import { appointmentOutcome } from "@/lib/data/automation-events";
import { findAppointment } from "@/lib/data/calendars";
import type { ActionState } from "@/app/agency/clients/actions";

/*
 * Server actions for calendars. Same contract as the client actions: zod
 * validation, a flat { ok, errors } result for useActionState, no auth yet.
 */

function flatten(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

const location = z.enum(["phone", "video", "in_person"]);
const duration = z.coerce.number().int().min(10, "At least 10 minutes").max(480, "Eight hours at most");

const newCalendarSchema = z.object({
  accountId: z.string().min(1, "Pick the client"),
  name: z.string().trim().min(2, "Name the calendar"),
  ownerName: z.string().trim().min(2, "Who takes these appointments?"),
  typeName: z.string().trim().min(2, "Name the appointment"),
  duration,
  location,
  locationDetail: z.string().trim().optional(),
});

export async function createCalendarAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = newCalendarSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
    const d = parsed.data;
    const now = new Date();
    const client = listClients(now).find((c) => c.account.id === d.accountId);
    if (!client) return { ok: false, errors: { accountId: "That client no longer exists" } };
    const cal = createCalendar(now, {
      accountId: client.account.id,
      name: d.name,
      ownerName: d.ownerName,
      timeZone: client.timeZone,
      type: { name: d.typeName, durationMinutes: d.duration, location: d.location, locationDetail: d.locationDetail || undefined },
    });
    revalidatePath("/agency/calendars");
    redirect(`/agency/calendars/${cal.id}`);
  });
}

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const toMinutes = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));

const settingsSchema = z.object({
  name: z.string().trim().min(2, "Name the calendar"),
  ownerName: z.string().trim().min(2, "Who takes these appointments?"),
  description: z.string().trim().max(400, "Keep it under 400 characters").optional(),
  minNoticeHours: z.coerce.number().int().min(0).max(336),
  maxDaysAhead: z.coerce.number().int().min(1, "At least one day").max(365),
  bufferMinutes: z.coerce.number().int().min(0).max(240),
  slotStepMinutes: z.coerce.number().int().refine((v) => [15, 20, 30, 45, 60].includes(v)),
  bookingEnabled: z.boolean(),
  blockedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export async function updateCalendarAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = settingsSchema.safeParse({
      name: formData.get("name"),
      ownerName: formData.get("ownerName"),
      description: formData.get("description") ?? undefined,
      minNoticeHours: formData.get("minNoticeHours"),
      maxDaysAhead: formData.get("maxDaysAhead"),
      bufferMinutes: formData.get("bufferMinutes"),
      slotStepMinutes: formData.get("slotStepMinutes"),
      bookingEnabled: formData.get("bookingEnabled") === "on",
      blockedDates: formData.getAll("blockedDates").map(String).filter(Boolean),
    });
    if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };

    const weekly: { start: number; end: number }[][] = [];
    for (let d = 0; d < 7; d++) {
      if (formData.get(`day${d}`) !== "on") {
        weekly.push([]);
        continue;
      }
      const start = hhmm.safeParse(formData.get(`day${d}Start`));
      const end = hhmm.safeParse(formData.get(`day${d}End`));
      if (!start.success || !end.success) return { ok: false, errors: { weekly: "Pick a start and end time for each open day" } };
      const s = toMinutes(start.data);
      const e = toMinutes(end.data);
      if (e <= s) return { ok: false, errors: { weekly: "Each open day has to end after it starts" } };
      weekly.push([{ start: s, end: e }]);
    }
    if (weekly.every((w) => w.length === 0) && parsed.data.bookingEnabled) {
      return { ok: false, errors: { weekly: "Open at least one day, or turn the booking page off" } };
    }

    const cal = updateCalendar(new Date(), id, { ...parsed.data, description: parsed.data.description || undefined, weekly, blockedDates: [...new Set(parsed.data.blockedDates)].sort() });
    if (!cal) return { ok: false, message: "Calendar not found" };
    revalidatePath("/agency/calendars");
    revalidatePath(`/agency/calendars/${id}`);
    revalidatePath(`/book/${cal.slug}`);
    return { ok: true, message: "Saved" };
  });
}

const typeSchema = z.object({
  name: z.string().trim().min(2, "Name the appointment"),
  duration,
  location,
  locationDetail: z.string().trim().optional(),
  description: z.string().trim().max(300, "Keep it under 300 characters").optional(),
});

export async function addTypeAction(calendarId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = typeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
    const d = parsed.data;
    const now = new Date();
    const t = addAppointmentType(now, calendarId, {
      name: d.name,
      durationMinutes: d.duration,
      location: d.location,
      locationDetail: d.locationDetail || undefined,
      description: d.description || undefined,
    });
    if (!t) return { ok: false, message: "Calendar not found" };
    revalidatePath(`/agency/calendars/${calendarId}`);
    revalidatePath(`/book/${findCalendar(now, calendarId)?.slug}`);
    return { ok: true, message: `${t.name} added` };
  });
}

export async function toggleTypeAction(calendarId: string, typeId: string, active: boolean) {
  return withWorkspace(async () => {
    const now = new Date();
    setTypeActive(now, calendarId, typeId, active);
    revalidatePath(`/agency/calendars/${calendarId}`);
    revalidatePath(`/book/${findCalendar(now, calendarId)?.slug}`);
  });
}

const statusSchema = z.enum(["booked", "confirmed", "showed", "no_show", "cancelled"]);

export async function setStatusAction(appointmentId: string, status: string) {
  return withWorkspace(async () => {
    const parsed = statusSchema.safeParse(status);
    if (!parsed.success) return;
    const now = new Date();
    const before = findAppointment(now, appointmentId)?.status;
    const a = setAppointmentStatus(now, appointmentId, parsed.data);
    if (a && before !== a.status && (a.status === "showed" || a.status === "no_show")) {
      const typeName = findCalendar(now, a.calendarId)?.types.find((t) => t.id === a.typeId)?.name ?? "an appointment";
      appointmentOutcome(now, a.accountId, a.contact.id, a.status, typeName);
      revalidatePath("/agency/automations");
      revalidatePath("/agency/reputation");
    }
    revalidatePath("/agency/calendars");
  });
}
