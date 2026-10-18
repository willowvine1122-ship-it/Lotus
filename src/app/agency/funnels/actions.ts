"use server";

import { withPublicWorkspace } from "@/lib/server/workspace";
import { withWorkspace } from "@/lib/server/workspace";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  addActivity,
  addStep,
  createContact,
  createFunnel,
  deleteFunnel,
  duplicateStep,
  endSplitTest,
  findFunnel,
  findOrder,
  listContacts,
  moveStep,
  recordOrder,
  recordStepConversion,
  recordSubmission,
  removeStep,
  saveStepBlocks,
  saveStepDoc,
  setSplit,
  startSplitTest,
  updateFunnel,
  updateStep,
} from "@/lib/data/store";
import type { BuilderElement, Funnel, FunnelBlock, FunnelStep, FunnelStepKind } from "@/lib/types";
import { donationReceived, formSubmitted } from "@/lib/data/automation-events";
import { allElements, parseDoc, stepKinds, themeOf } from "@/components/builder/model";

export type ActionState = { ok: boolean; errors?: Record<string, string>; message?: string } | null;

const newFunnelSchema = z.object({
  accountId: z.string().min(1, "Pick a client"),
  name: z.string().trim().min(2, "Give the funnel a name"),
  template: z.string().min(1, "Pick a template"),
});

export async function createFunnelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = newFunnelSchema.safeParse({ accountId: formData.get("accountId"), name: formData.get("name"), template: formData.get("template") });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
      return { ok: false, errors };
    }
    const f = createFunnel(new Date(), parsed.data);
    if (!f) return { ok: false, message: "That client does not exist." };
    revalidatePath("/agency/funnels");
    redirect(`/agency/funnels/${f.id}/builder/${f.steps[0]!.id}`);
  });
}

export async function saveStepAction(funnelId: string, stepId: string, name: string, blocksJson: string): Promise<ActionState> {
  return withWorkspace(async () => {
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
  });
}

export async function setFunnelStatusAction(funnelId: string, status: "draft" | "live"): Promise<void> {
  return withWorkspace(async () => {
    updateFunnel(new Date(), funnelId, { status });
    revalidatePath(`/agency/funnels/${funnelId}`);
    revalidatePath("/agency/funnels");
  });
}

export async function renameFunnelAction(funnelId: string, name: string, brandColor: string): Promise<ActionState> {
  return withWorkspace(async () => {
    if (name.trim().length < 2) return { ok: false, message: "Give the funnel a name." };
    if (!/^#[0-9a-fA-F]{6}$/.test(brandColor)) return { ok: false, message: "Brand colour must be a hex like #6d28d9." };
    updateFunnel(new Date(), funnelId, { name: name.trim(), brandColor });
    revalidatePath(`/agency/funnels/${funnelId}`);
    revalidatePath("/agency/funnels");
    return { ok: true, message: "Saved" };
  });
}

export async function addStepAction(funnelId: string, name: string, kind: FunnelStepKind = "custom"): Promise<string | null> {
  return withWorkspace(async () => {
    if (name.trim().length < 1) return null;
    const k = stepKinds.some((x) => x.kind === kind) ? kind : "custom";
    const s = addStep(new Date(), funnelId, name, k);
    revalidatePath(`/agency/funnels/${funnelId}`);
    return s?.id ?? null;
  });
}

export async function updateStepAction(funnelId: string, stepId: string, patch: { name?: string; path?: string; kind?: FunnelStepKind }): Promise<ActionState> {
  return withWorkspace(async () => {
    if (patch.name !== undefined && patch.name.trim().length < 1) return { ok: false, message: "Give the step a name." };
    if (patch.kind && !stepKinds.some((x) => x.kind === patch.kind)) return { ok: false, message: "Unknown step type." };
    const r = updateStep(new Date(), funnelId, stepId, { ...patch, name: patch.name?.trim() });
    if (r.error) return { ok: false, message: r.error };
    revalidatePath(`/agency/funnels/${funnelId}`);
    return { ok: true, message: "Saved" };
  });
}

export async function duplicateStepAction(funnelId: string, stepId: string): Promise<string | null> {
  return withWorkspace(async () => {
    const s = duplicateStep(new Date(), funnelId, stepId);
    revalidatePath(`/agency/funnels/${funnelId}`);
    return s?.id ?? null;
  });
}

export async function saveStepDocAction(funnelId: string, stepId: string, variant: "a" | "b", docJson: string, themeJson: string): Promise<ActionState> {
  return withWorkspace(async () => {
    const doc = parseDoc(docJson);
    if (!doc) return { ok: false, message: "Could not read the page. Nothing was saved." };
    let theme;
    try {
      const f = findFunnel(new Date(), funnelId);
      theme = themeOf(JSON.parse(themeJson), f?.brandColor ?? "#0f1221");
    } catch {
      return { ok: false, message: "Could not read the theme." };
    }
    const s = saveStepDoc(new Date(), funnelId, stepId, doc, variant, theme);
    if (!s) return { ok: false, message: "That step no longer exists." };
    revalidatePath(`/agency/funnels/${funnelId}`);
    revalidatePath("/agency/funnels");
    return { ok: true, message: "Saved" };
  });
}

export async function startSplitTestAction(funnelId: string, stepId: string): Promise<void> {
  return withWorkspace(async () => {
    startSplitTest(new Date(), funnelId, stepId);
    revalidatePath(`/agency/funnels/${funnelId}`);
  });
}

export async function setSplitAction(funnelId: string, stepId: string, split: number): Promise<void> {
  return withWorkspace(async () => {
    setSplit(new Date(), funnelId, stepId, split);
    revalidatePath(`/agency/funnels/${funnelId}`);
  });
}

export async function endSplitTestAction(funnelId: string, stepId: string, winner: "a" | "b"): Promise<void> {
  return withWorkspace(async () => {
    endSplitTest(new Date(), funnelId, stepId, winner);
    revalidatePath(`/agency/funnels/${funnelId}`);
  });
}

export async function moveStepAction(funnelId: string, stepId: string, dir: -1 | 1): Promise<void> {
  return withWorkspace(async () => {
    moveStep(new Date(), funnelId, stepId, dir);
    revalidatePath(`/agency/funnels/${funnelId}`);
  });
}

export async function removeStepAction(funnelId: string, stepId: string): Promise<void> {
  return withWorkspace(async () => {
    removeStep(new Date(), funnelId, stepId);
    revalidatePath(`/agency/funnels/${funnelId}`);
  });
}

export async function deleteFunnelAction(funnelId: string): Promise<void> {
  return withWorkspace(async () => {
    deleteFunnel(new Date(), funnelId);
    revalidatePath("/agency/funnels");
    redirect("/agency/funnels");
  });
}

/* ------------------------------ public side ------------------------------ */

function nextStepHref(f: Funnel, step: FunnelStep, skipDownsell = false) {
  const i = f.steps.findIndex((s) => s.id === step.id);
  let next = f.steps[i + 1];
  if (skipDownsell && next?.kind === "downsell") next = f.steps[i + 2];
  return next ? `/f/${f.slug}/${next.path}` : `/f/${f.slug}?sent=1`;
}

async function variantOf(stepId: string): Promise<"a" | "b"> {
  return (await cookies()).get(`lb_v_${stepId}`)?.value === "b" ? "b" : "a";
}

function findOrCreateContact(now: Date, f: Funnel, values: Record<string, string>, source: "website" | "donation-page") {
  const name = values.name ?? values.first_name ?? "";
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
      source,
      valueCents: values.amount ? Number(values.amount) * 100 : undefined,
    });
  return { contact, existing };
}

/** Public: a visitor submitted a form. Creates or updates a contact and moves to the next step. */
export async function submitFunnelAction(funnelId: string, stepId: string, formData: FormData): Promise<void> {
  await withPublicWorkspace(`funnel-id:${funnelId}`, async () => {
    const now = new Date();
    const f = findFunnel(now, funnelId);
    const step = f?.steps.find((s) => s.id === stepId);
    if (!f || !step || f.status !== "live") return;
    const values: Record<string, string> = {};
    for (const [k, v] of formData.entries()) if (typeof v === "string" && v.trim() && !k.startsWith("$")) values[k] = v.trim().slice(0, 500);
    const { contact, existing } = findOrCreateContact(now, f, values, f.template === "appeal" ? "donation-page" : "website");
    if (contact) {
      addActivity(now, contact.id, {
        kind: values.amount ? "donation" : "form",
        title: values.amount ? `Pledged $${values.amount} on ${f.name}` : `Filled the ${f.name} form (${step.name})`,
        body: values.message,
        by: "System",
        amountCents: values.amount && existing ? Number(values.amount) * 100 : undefined,
      });
    }
    recordSubmission(now, f.id, stepId, values, contact?.id);
    recordStepConversion(now, f.id, stepId, await variantOf(stepId));
    if (contact) {
      formSubmitted(now, contact, f.name, !existing);
      if (values.amount) donationReceived(now, f.accountId, contact.id, Number(values.amount) * 100, f.name);
    }
    revalidatePath("/agency/contacts");
    revalidatePath("/agency/funnels");
    revalidatePath("/agency/automations");
    redirect(nextStepHref(f, step));
  });
}

function elementIn(step: FunnelStep, variant: "a" | "b", id: string): BuilderElement | undefined {
  const doc = variant === "b" && step.variant ? step.variant.doc : step.doc;
  return doc ? allElements(doc).find((e) => e.id === id) : undefined;
}

const ORDER_COOKIE = (funnelId: string) => `lb_order_${funnelId}`;

/**
 * Public: the order form. Payments run in test mode until Stripe is connected,
 * so the order is recorded as paid in test mode and the buyer moves on.
 */
export async function submitOrderAction(funnelId: string, stepId: string, formData: FormData): Promise<void> {
  await withPublicWorkspace(`funnel-id:${funnelId}`, async () => {
    const now = new Date();
    const f = findFunnel(now, funnelId);
    const step = f?.steps.find((s) => s.id === stepId);
    if (!f || !step || f.status !== "live") return;
    const v = await variantOf(stepId);
    const el = elementIn(step, v, String(formData.get("elementId") ?? "")) ?? elementIn(step, v === "a" ? "b" : "a", String(formData.get("elementId") ?? ""));
    if (!el || el.type !== "order") return;
    const name = String(formData.get("name") ?? "").trim().slice(0, 120);
    const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect(`/f/${f.slug}/${step.path}?error=details#form`);
    const phone = String(formData.get("phone") ?? "").trim().slice(0, 40) || undefined;
    const product = el.products.find((p) => p.id === formData.get("product")) ?? el.products[0];
    if (!product) return;
    const items: { name: string; priceCents: number; kind: "main" | "bump" | "upsell" }[] = [{ name: product.name, priceCents: product.priceCents, kind: "main" }];
    if (el.bump && formData.get("bump") === el.bump.product.id) items.push({ name: el.bump.product.name, priceCents: el.bump.product.priceCents, kind: "bump" });
    const total = items.reduce((a, i) => a + i.priceCents, 0);
    const { contact } = findOrCreateContact(now, f, { name, email, ...(phone ? { phone } : {}) }, "website");
    const order = recordOrder(now, { funnelId: f.id, stepId, contactId: contact?.id, name, email, items, totalCents: total });
    if (contact) addActivity(now, contact.id, { kind: "payment", title: `Bought ${items.map((i) => i.name).join(" + ")} on ${f.name}`, body: "Test mode until Stripe is connected; no card was charged.", by: "System", amountCents: total });
    recordStepConversion(now, f.id, stepId, v, total);
    (await cookies()).set(ORDER_COOKIE(f.id), order.id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 6 });
    revalidatePath("/agency/funnels");
    revalidatePath("/agency/contacts");
    redirect(nextStepHref(f, step));
  });
}

/** Public: a one-click upsell. "Yes" adds to the order from this visit; either answer moves on. */
export async function submitUpsellAction(funnelId: string, stepId: string, formData: FormData): Promise<void> {
  await withPublicWorkspace(`funnel-id:${funnelId}`, async () => {
    const now = new Date();
    const f = findFunnel(now, funnelId);
    const step = f?.steps.find((s) => s.id === stepId);
    if (!f || !step || f.status !== "live") return;
    const take = formData.get("take") === "yes";
    if (take) {
      const v = await variantOf(stepId);
      const el = elementIn(step, v, String(formData.get("elementId") ?? "")) ?? elementIn(step, v === "a" ? "b" : "a", String(formData.get("elementId") ?? ""));
      const order = findOrder(now, (await cookies()).get(ORDER_COOKIE(f.id))?.value ?? "");
      if (el?.type === "upsell" && order) {
        order.items.push({ name: el.product.name, priceCents: el.product.priceCents, kind: "upsell" });
        order.totalCents += el.product.priceCents;
        if (order.contactId) addActivity(now, order.contactId, { kind: "payment", title: `Added ${el.product.name} on ${f.name}`, body: "One-click upsell, test mode.", by: "System", amountCents: el.product.priceCents });
        recordStepConversion(now, f.id, stepId, v, el.product.priceCents);
      } else if (el?.type === "upsell") {
        // No order from this visit (they landed here directly): send them back to buy first.
        const orderStep = f.steps.find((s) => s.kind === "order");
        if (orderStep) redirect(`/f/${f.slug}/${orderStep.path}`);
      }
      revalidatePath("/agency/funnels");
    }
    redirect(nextStepHref(f, step, take));
  });
}
