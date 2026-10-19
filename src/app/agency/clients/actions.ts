"use server";

import { actorName, currentSession, withWorkspace } from "@/lib/server/workspace";
import { canManageTeam } from "@/lib/server/auth";
import { issueInvite } from "@/lib/server/invites";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addNote, addTask, createClient, findClient, inviteMember, removeMember, setTaskStatus, updateClient } from "@/lib/data/store";

/*
 * Server actions for the client (sub-account) pages. Inputs are validated
 * with zod; every action returns a flat { ok, errors } shape the forms read
 * with useActionState. There is no auth yet: the demo store is open.
 */

export type ActionState = { ok: boolean; errors?: Record<string, string>; message?: string; link?: string } | null;

const money = z
  .string()
  .transform((v) => Number(String(v).replace(/[^0-9.]/g, "")))
  .pipe(z.number().min(0, "Enter an amount"));

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

const clientSchema = z.object({
  name: z.string().trim().min(2, "Give the client a name"),
  mode: z.enum(["marketing", "fundraising"]),
  industry: z.string().trim().min(2, "What do they do?"),
  website: z.union([z.literal(""), z.string().trim().url("Enter a full URL, like https://example.com")]),
  location: z.string().trim().min(2, "City and state"),
  timeZone: z.string().trim().min(3),
  monthlyAmount: money,
  avgJobValue: z.string().optional(),
  tags: z.string().optional(),
  assignees: z.array(z.string()).min(1, "Pick at least one person on the team"),
  contactName: z.string().trim().optional(),
  contactEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
});

function flatten(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = clientSchema.safeParse({
      name: formData.get("name"),
      mode: formData.get("mode"),
      industry: formData.get("industry"),
      website: formData.get("website") ?? "",
      location: formData.get("location"),
      timeZone: formData.get("timeZone"),
      monthlyAmount: formData.get("monthlyAmount"),
      avgJobValue: formData.get("avgJobValue") ?? undefined,
      tags: formData.get("tags") ?? undefined,
      assignees: formData.getAll("assignees").map(String),
      contactName: formData.get("contactName") ?? "",
      contactEmail: formData.get("contactEmail") ?? "",
    });
    if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
    const d = parsed.data;
    if (d.contactName && !d.contactEmail) return { ok: false, errors: { contactEmail: "Add the email to send the invite" } };

    const record = createClient(new Date(), {
      name: d.name,
      mode: d.mode,
      industry: d.industry,
      website: d.website || undefined,
      location: d.location,
      timeZone: d.timeZone,
      monthlyAmountCents: Math.round(d.monthlyAmount * 100),
      avgJobValueCents: d.avgJobValue ? Math.round(Number(d.avgJobValue.replace(/[^0-9.]/g, "")) * 100) : undefined,
      tags: list(d.tags ?? ""),
      assignees: d.assignees,
      clientContact: d.contactName && d.contactEmail ? { name: d.contactName, email: d.contactEmail } : undefined,
    });
    const session = currentSession();
    if (d.contactName && d.contactEmail && session?.agency) {
      await issueInvite({ user: session.user, agency: session.agency }, { email: d.contactEmail, name: d.contactName, role: "client", accountIds: [record.account.id], clientName: record.account.name });
    }
    revalidatePath("/agency");
    revalidatePath("/agency/clients");
    revalidatePath("/agency/settings");
    redirect(`/agency/clients/${record.account.slug}`);
  });
}

const settingsSchema = clientSchema.omit({ mode: true, assignees: true, contactName: true, contactEmail: true }).extend({
  assignees: z.array(z.string()),
  status: z.enum(["onboarding", "active", "paused"]),
});

export async function updateClientAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = settingsSchema.safeParse({
      name: formData.get("name"),
      industry: formData.get("industry"),
      website: formData.get("website") ?? "",
      location: formData.get("location"),
      timeZone: formData.get("timeZone"),
      monthlyAmount: formData.get("monthlyAmount"),
      avgJobValue: formData.get("avgJobValue") ?? undefined,
      tags: formData.get("tags") ?? undefined,
      assignees: formData.getAll("assignees").map(String),
      status: formData.get("status"),
    });
    if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
    const d = parsed.data;
    const updated = updateClient(new Date(), id, {
      name: d.name,
      industry: d.industry,
      website: d.website,
      location: d.location,
      timeZone: d.timeZone,
      monthlyAmountCents: Math.round(d.monthlyAmount * 100),
      avgJobValueCents: d.avgJobValue ? Math.round(Number(d.avgJobValue.replace(/[^0-9.]/g, "")) * 100) : undefined,
      tags: list(d.tags ?? ""),
      assignees: d.assignees,
      status: d.status,
    });
    if (!updated) return { ok: false, message: "Client not found" };
    revalidatePath("/agency");
    revalidatePath("/agency/clients");
    revalidatePath(`/agency/clients/${updated.account.slug}`);
    return { ok: true, message: "Saved" };
  });
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Their name"),
  email: z.string().trim().email("Enter a valid email"),
});

export async function inviteMemberAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = inviteSchema.safeParse({ name: formData.get("name"), email: formData.get("email") });
    if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
    const client = findClient(new Date(), id);
    const session = currentSession();
    if (!client || !session?.agency) return { ok: false, message: "Client not found" };
    if (!canManageTeam(session.role)) return { ok: false, message: "Only the owner or an admin can give clients a login." };
    const m = inviteMember(new Date(), id, parsed.data.name, parsed.data.email);
    if (!m) return { ok: false, message: "Client not found" };
    const sent = await issueInvite({ user: session.user, agency: session.agency }, { email: m.email, name: m.name, role: "client", accountIds: [client.account.id], clientName: client.account.name });
    revalidatePath(`/agency/clients/${id}`);
    revalidatePath("/agency/settings");
    return { ok: true, message: sent.message, link: sent.link };
  });
}

export async function removeMemberAction(id: string, memberId: string) {
  return withWorkspace(async () => {
    removeMember(new Date(), id, memberId);
    revalidatePath(`/agency/clients/${id}`);
  });
}

export async function addNoteAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const body = String(formData.get("body") ?? "").trim();
    if (body.length < 2) return { ok: false, errors: { body: "Write the note first" } };
    addNote(new Date(), id, actorName(), body);
    revalidatePath("/agency");
    revalidatePath(`/agency/clients/${id}`);
    return { ok: true };
  });
}

export async function toggleTaskAction(id: string, taskId: string, done: boolean) {
  return withWorkspace(async () => {
    setTaskStatus(new Date(), id, taskId, done ? "done" : "todo");
    revalidatePath("/agency");
    revalidatePath(`/agency/clients/${id}`);
  });
}

export async function addTaskAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const title = String(formData.get("title") ?? "").trim();
    if (title.length < 2) return { ok: false, errors: { title: "Name the task" } };
    const assignee = String(formData.get("assignee") ?? "") || undefined;
    const dueOn = String(formData.get("dueOn") ?? "") || undefined;
    addTask(new Date(), id, title, assignee, dueOn);
    revalidatePath("/agency");
    revalidatePath(`/agency/clients/${id}`);
    return { ok: true };
  });
}
