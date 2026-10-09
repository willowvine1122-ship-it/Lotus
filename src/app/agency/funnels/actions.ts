"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addActivity, addStep, createContact, createFunnel, deleteFunnel, findFunnel, listContacts, moveStep, recordSubmission, removeStep, saveStepBlocks, updateFunnel } from "@/lib/data/store";
import type { FunnelBlock } from "@/lib/types";
import { donationReceived, formSubmitted } from "@/lib/data/automation-events";

export type ActionState = { ok: boolean; errors?: Record<string, string>; message?: string } | null;

const newFunnelSchema = z.object({
  accountId: z.string().min(1, "Pick a client"),
  name: z.string().trim().min(2, "Give the funnel a name"),
  template: z.string().min(1, "Pick a template"),
});

export async function createFunnelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = newFunnelSchema.safeParse({ accountId: formData.get("accountId"), name: formData.get("name"), template: formData.get("template") });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const f = createFunnel(new Date(), parsed.data);
  if (!f) return { ok: false, message: "That client does not exist." };
  revalidatePath("/agency/funnels");
  redirect(`/agency/funnels/${f.id}`);
}

export async function saveStepAction(funnelId: string, stepId: string, name: string, blocksJson: string): Promise<ActionState> {
  let blocks: FunnelBlock[];
  try {
    blocks = JSON.parse(blocksJson) as FunnelBlock[];
    if (!Array.isArray(blocks)) throw new Error("not a list");
  } catch {
    return { ok: false, message: "Could not read the page." };
  }
  const s = saveStepBlocks(new Date(), funnelId, stepId, blocks, name);
  if (!s) return { ok: false, message: "Step not found." };
  revalidatePath(`/agency/funnels/${funnelId}`);
  revalidatePath("/agency/funnels");
  return { ok: true, message: "Saved" };
}

export async function setFunnelStatusAction(funnelId: string, status: "draft" | "live"): Promise<void> {
  updateFunnel(new Date(), funnelId, { status });
  revalidatePath(`/agency/funnels/${funnelId}`);
  revalidatePath("/agency/funnels");
}

export async function renameFunnelAction(funnelId: string, name: string, brandColor: string): Promise<ActionState> {
  if (name.trim().length < 2) return { ok: false, message: "Give the funnel a name." };
  if (!/^#[0-9a-fA-F]{6}$/.test(brandColor)) return { ok: false, message: "Brand colour must be a hex like #6d28d9." };
  updateFunnel(new Date(), funnelId, { name: name.trim(), brandColor });
  revalidatePath(`/agency/funnels/${funnelId}`);
  revalidatePath("/agency/funnels");
  return { ok: true, message: "Saved" };
}

export async function addStepAction(funnelId: string, name: string): Promise<void> {
  if (name.trim().length < 1) return;
  addStep(new Date(), funnelId, name);
  revalidatePath(`/agency/funnels/${funnelId}`);
}

export async function moveStepAction(funnelId: string, stepId: string, dir: -1 | 1): Promise<void> {
  moveStep(new Date(), funnelId, stepId, dir);
  revalidatePath(`/agency/funnels/${funnelId}`);
}

export async function removeStepAction(funnelId: string, stepId: string): Promise<void> {
  removeStep(new Date(), funnelId, stepId);
  revalidatePath(`/agency/funnels/${funnelId}`);
}

export async function deleteFunnelAction(funnelId: string): Promise<void> {
  deleteFunnel(new Date(), funnelId);
  revalidatePath("/agency/funnels");
  redirect("/agency/funnels");
}

/** Public: a visitor submitted a form block. Creates or updates a contact and moves to the next step. */
export async function submitFunnelAction(funnelId: string, stepId: string, formData: FormData): Promise<void> {
  const now = new Date();
  const f = findFunnel(now, funnelId);
  if (!f || f.status !== "live") return;
  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && v.trim()) values[k] = v.trim().slice(0, 500);
  const name = values.name ?? "";
  const [firstName, ...rest] = name.split(/\s+/);
  const email = values.email?.toLowerCase();
  const existing = listContacts(now, f.accountId).find((c) => (email && c.email?.toLowerCase() === email) || (values.phone && c.phone === values.phone));
  const contact =
    existing ??
    createContact(now, {
      accountId: f.accountId,
      firstName: firstName || "Website",
      lastName: rest.join(" ") || "visitor",
      email,
      phone: values.phone,
      city: values.address,
      tags: [f.name],
      source: f.template === "appeal" ? "donation-page" : "website",
      valueCents: values.amount ? Number(values.amount) * 100 : undefined,
    });
  if (contact) {
    addActivity(now, contact.id, {
      kind: values.amount ? "donation" : "form",
      title: values.amount ? `Pledged $${values.amount} on ${f.name}` : `Filled the ${f.name} form`,
      body: values.message,
      by: "System",
      amountCents: values.amount && existing ? Number(values.amount) * 100 : undefined,
    });
  }
  recordSubmission(now, f.id, stepId, values, contact?.id);
  if (contact) {
    formSubmitted(now, contact, f.name, !existing);
    if (values.amount) donationReceived(now, f.accountId, contact.id, Number(values.amount) * 100, f.name);
  }
  revalidatePath("/agency/contacts");
  revalidatePath("/agency/funnels");
  revalidatePath("/agency/automations");
  const i = f.steps.findIndex((s) => s.id === stepId);
  const next = f.steps[i + 1];
  redirect(next ? `/f/${f.slug}/${next.path}` : `/f/${f.slug}?sent=1`);
}
