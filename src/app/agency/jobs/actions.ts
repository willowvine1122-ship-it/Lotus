"use server";

import { actorName, withWorkspace } from "@/lib/server/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/app/agency/contacts/actions";
import { addTechnician, createJob, findJob, invoiceFromJob, recordPayment, scheduleJob, setJobStatus, updateJobDetails } from "@/lib/data/field-store";
import { creditDeposit } from "@/lib/data/estimate-kit";
import { flatten, parseLines, stamp } from "@/lib/field-forms";
import type { JobStatus } from "@/lib/types";
import { jobCompleted } from "@/lib/data/automation-events";

/* Jobs and dispatch. zod in, { ok, errors } out, like the CRM actions. */

function refresh(id?: string) {
  revalidatePath("/agency/jobs");
  revalidatePath("/agency/jobs/dispatch");
  revalidatePath("/agency/invoices");
  if (id) revalidatePath(`/agency/jobs/${id}`);
}

const jobSchema = z.object({
  accountId: z.string().min(1, "Pick a client"),
  contactId: z.string().min(1, "Pick a customer"),
  title: z.string().trim().min(2, "Name the job"),
  address: z.string().trim().min(4, "Where is the job?"),
  date: z.string().optional(),
  time: z.string().optional(),
  durationMin: z.coerce.number().int().min(15).max(24 * 60),
  notes: z.string().optional(),
});

export async function createJobAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = jobSchema.safeParse({
      accountId: fd.get("accountId"),
      contactId: fd.get("contactId"),
      title: fd.get("title"),
      address: fd.get("address"),
      date: fd.get("date") || undefined,
      time: fd.get("time") || undefined,
      durationMin: fd.get("durationMin") ?? 120,
      notes: fd.get("notes") ?? "",
    });
    const lines = parseLines(fd.get("lineItems"));
    const errors = parsed.success ? {} : flatten(parsed.error);
    if (!lines.ok) errors.lineItems = lines.error;
    const technicianIds = fd.getAll("technicianIds").map(String).filter(Boolean);
    if (parsed.success && parsed.data.date && !parsed.data.time) errors.time = "Pick a start time";
    if (parsed.success && parsed.data.date && parsed.data.time && technicianIds.length === 0) errors.technicianIds = "Pick who is going, or clear the date to leave it unscheduled";
    if (!parsed.success || !lines.ok || Object.keys(errors).length) return { ok: false, errors };
    const d = parsed.data;
    const job = createJob(
      new Date(),
      {
        accountId: d.accountId,
        contactId: d.contactId,
        title: d.title,
        address: d.address,
        start: d.date && d.time ? `${d.date}T${d.time}` : undefined,
        durationMin: d.durationMin,
        technicianIds,
        lineItems: lines.items,
        notes: d.notes,
      },
      actorName(),
    );
    if (!job) return { ok: false, message: "That customer does not belong to this client." };
    refresh();
    redirect(`/agency/jobs/${job.id}`);
  });
}

const scheduleSchema = z.object({ date: z.string().min(1, "Pick a date"), time: z.string().min(1, "Pick a time"), durationMin: z.coerce.number().int().min(15).max(24 * 60) });

export async function scheduleJobAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = scheduleSchema.safeParse({ date: fd.get("date"), time: fd.get("time"), durationMin: fd.get("durationMin") });
    const technicianIds = fd.getAll("technicianIds").map(String).filter(Boolean);
    const errors = parsed.success ? {} : flatten(parsed.error);
    if (technicianIds.length === 0) errors.technicianIds = "Pick at least one technician";
    if (!parsed.success || Object.keys(errors).length) return { ok: false, errors };
    const job = scheduleJob(new Date(), id, { start: `${parsed.data.date}T${parsed.data.time}`, durationMin: parsed.data.durationMin, technicianIds }, actorName());
    if (!job) return { ok: false, message: "Job not found." };
    refresh(id);
    return { ok: true, message: "Scheduled" };
  });
}

/** Drag and drop on the dispatch board: a new start and a technician. */
export async function moveJobAction(id: string, start: string, technicianId: string): Promise<void> {
  return withWorkspace(async () => {
    if (!stamp.safeParse(start).success) return;
    const job = findJob(new Date(), id);
    if (!job) return;
    // Dropping on a lane makes that technician the lead, replacing the old lead; crew mates stay on.
    const kept = job.technicianIds.includes(technicianId) ? job.technicianIds : job.technicianIds.slice(1);
    scheduleJob(new Date(), id, { start, technicianIds: [technicianId, ...kept.filter((t) => t !== technicianId)] }, actorName());
    refresh(id);
  });
}

export async function unscheduleJobAction(id: string): Promise<void> {
  return withWorkspace(async () => {
    scheduleJob(new Date(), id, { start: "", technicianIds: [] }, actorName());
    refresh(id);
  });
}

const statuses: JobStatus[] = ["unscheduled", "scheduled", "en_route", "in_progress", "completed", "canceled"];

export async function setJobStatusAction(id: string, status: JobStatus): Promise<void> {
  return withWorkspace(async () => {
    if (!statuses.includes(status)) return;
    const now = new Date();
    const was = findJob(now, id)?.status;
    const job = setJobStatus(now, id, status, actorName());
    if (job && was !== "completed" && job.status === "completed") {
      jobCompleted(now, job.accountId, job.contactId, job.number);
      revalidatePath("/agency/automations");
      revalidatePath("/agency/reputation");
    }
    refresh(id);
  });
}

export async function saveJobNotesAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const job = updateJobDetails(new Date(), id, { notes: String(fd.get("notes") ?? "") });
    if (!job) return { ok: false, message: "Job not found." };
    refresh(id);
    return { ok: true, message: "Saved" };
  });
}

export async function invoiceJobAction(id: string): Promise<void> {
  return withWorkspace(async () => {
    const now = new Date();
    const inv = invoiceFromJob(now, id, actorName());
    if (!inv) return;
    creditDeposit(now, inv.estimateId, inv.id, recordPayment, (ref) => inv.payments.some((p) => p.reference === ref));
    refresh(id);
    redirect(`/agency/invoices/${inv.id}`);
  });
}

const techSchema = z.object({ name: z.string().trim().min(2, "Enter a name"), role: z.string().trim().optional(), phone: z.string().trim().optional() });

export async function addTechnicianAction(accountId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = techSchema.safeParse({ name: fd.get("name"), role: fd.get("role") ?? "", phone: fd.get("phone") ?? "" });
    if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
    const t = addTechnician(new Date(), accountId, parsed.data.name, parsed.data.role ?? "", parsed.data.phone);
    if (!t) return { ok: false, message: "Field service is for marketing clients." };
    refresh();
    return { ok: true, message: `${t.name} added` };
  });
}
