"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addActivity, createContact, deleteContact, findContact, moveContactStage, updateContact } from "@/lib/data/store";
import type { ActivityKind } from "@/lib/types";

/* Server actions for the CRM. Same shape as the client actions: zod in, { ok, errors } out. */

export type ActionState = { ok: boolean; errors?: Record<string, string>; message?: string } | null;

const actor = "Afza"; // until auth lands, every write is attributed to the signed-in demo user

const money = z
  .string()
  .optional()
  .transform((v) => (v ? Number(String(v).replace(/[^0-9.]/g, "")) : 0))
  .pipe(z.number().min(0, "Enter an amount"));

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

const contactSchema = z.object({
  accountId: z.string().min(1, "Pick a client"),
  firstName: z.string().trim().min(1, "First name"),
  lastName: z.string().trim().min(1, "Last name"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  phone: z.string().trim().optional(),
  company: z.string().trim().optional(),
  city: z.string().trim().optional(),
  source: z.enum(["meta", "google", "website", "referral", "donation-page", "import", "manual"]),
  stageId: z.string().optional(),
  ownerName: z.string().optional(),
  value: money,
});

function flatten(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function readContact(formData: FormData) {
  return contactSchema.safeParse({
    accountId: formData.get("accountId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    company: formData.get("company") ?? "",
    city: formData.get("city") ?? "",
    source: formData.get("source") ?? "manual",
    stageId: formData.get("stageId") ?? undefined,
    ownerName: formData.get("ownerName") ?? undefined,
    value: formData.get("value") ?? undefined,
  });
}

export async function createContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = readContact(formData);
  if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
  const d = parsed.data;
  const c = createContact(new Date(), {
    accountId: d.accountId,
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email || undefined,
    phone: d.phone || undefined,
    company: d.company || undefined,
    city: d.city || undefined,
    tags: list(formData.get("tags")),
    source: d.source,
    stageId: d.stageId || undefined,
    ownerName: d.ownerName || undefined,
    valueCents: Math.round(d.value * 100),
  });
  if (!c) return { ok: false, message: "That client does not exist." };
  revalidatePath("/agency/contacts");
  redirect(`/agency/contacts/${c.id}`);
}

export async function updateContactAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = readContact(formData);
  if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
  const d = parsed.data;
  const now = new Date();
  const c = updateContact(now, id, {
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email || undefined,
    phone: d.phone || undefined,
    company: d.company || undefined,
    city: d.city || undefined,
    tags: list(formData.get("tags")),
    source: d.source,
    ownerName: d.ownerName || undefined,
    valueCents: Math.round(d.value * 100),
  });
  if (!c) return { ok: false, message: "Contact not found." };
  if (d.stageId) moveContactStage(now, id, d.stageId, actor);
  revalidatePath("/agency/contacts");
  revalidatePath(`/agency/contacts/${id}`);
  return { ok: true, message: "Saved" };
}

export async function moveStageAction(id: string, stageId: string): Promise<void> {
  moveContactStage(new Date(), id, stageId, actor);
  revalidatePath("/agency/contacts");
  revalidatePath(`/agency/contacts/${id}`);
}

const kindTitle: Record<string, string> = { note: "Note", call: "Call logged", sms: "Text sent", email: "Email sent" };

export async function logActivityAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = String(formData.get("kind") ?? "note");
  const body = String(formData.get("body") ?? "").trim();
  if (!(kind in kindTitle)) return { ok: false, errors: { kind: "Pick a type" } };
  if (body.length < 2) return { ok: false, errors: { body: "Write what happened" } };
  const a = addActivity(new Date(), id, { kind: kind as ActivityKind, title: kindTitle[kind]!, body, by: actor });
  if (!a) return { ok: false, message: "Contact not found." };
  revalidatePath("/agency/contacts");
  revalidatePath(`/agency/contacts/${id}`);
  return { ok: true };
}

export async function toggleDndAction(id: string, channel: "email" | "sms" | "call"): Promise<void> {
  const now = new Date();
  const c = findContact(now, id);
  if (!c) return;
  updateContact(now, id, { doNotContact: { ...c.doNotContact, [channel]: !c.doNotContact[channel] } });
  revalidatePath("/agency/contacts");
  revalidatePath(`/agency/contacts/${id}`);
}

export async function deleteContactAction(id: string): Promise<void> {
  deleteContact(new Date(), id);
  revalidatePath("/agency/contacts");
  redirect("/agency/contacts");
}
