"use server";

import { withPublicWorkspace } from "@/lib/server/workspace";
import { withWorkspace } from "@/lib/server/workspace";
import { stamp } from "@/lib/ids";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/app/agency/contacts/actions";
import { approvedTotal, depositFor } from "@/components/estimates/model";
import { deletePriceItem, deleteTemplate, estimateExtras, patchEstimateExtras, savePriceItem, saveTemplate } from "@/lib/data/estimate-kit";
import { approveEstimate, fieldClients, findEstimate } from "@/lib/data/field-store";
import { addActivity, findContact } from "@/lib/data/store";
import { estimateDisplay, localDate } from "@/lib/field";
import { flatten, parseLines } from "@/lib/field-forms";
import { parseOptionalLines } from "@/lib/estimate-forms";
import { chargeCard } from "@/lib/payments/stripe";
import type { LineItem } from "@/lib/types";
import { formatDollarsExact } from "@/lib/utils";

/* The estimate builder: price book, templates, and the customer's signature and deposit. */

function refresh(estimateId?: string) {
  revalidatePath("/agency/estimates");
  revalidatePath("/agency/estimates/library");
  if (estimateId) {
    revalidatePath(`/agency/estimates/${estimateId}`);
    revalidatePath(`/p/estimates/${estimateId}`);
  }
}

const isFieldClient = (id: string) => fieldClients(new Date()).some((c) => c.account.id === id);

/* ------------------------------ price book ----------------------------- */

const itemSchema = z.object({
  accountId: z.string().refine(isFieldClient, "Pick a client"),
  name: z.string().trim().min(1, "Name the item").max(120),
  description: z.string().trim().max(240).optional(),
  category: z.string().trim().min(1, "Pick a category").max(40),
  unitCents: z.number().int().min(0, "Prices can't be negative").max(100_000_000),
  unit: z.string().trim().max(20).optional(),
  kind: z.enum(["item", "addon"]),
});

export async function savePriceItemAction(id: string | null, input: unknown): Promise<ActionState> {
  return withWorkspace(async () => {
    const p = itemSchema.safeParse(input);
    if (!p.success) return { ok: false, errors: flatten(p.error), message: p.error.issues[0]?.message };
    savePriceItem(new Date(), id, { ...p.data, description: p.data.description || undefined, unit: p.data.unit || undefined });
    refresh();
    return { ok: true, message: id ? "Saved" : "Added to the price book" };
  });
}

export async function deletePriceItemAction(id: string): Promise<void> {
  return withWorkspace(async () => {
    deletePriceItem(new Date(), z.string().max(120).parse(id));
    refresh();
  });
}

/* ------------------------------ templates ------------------------------ */

const templateSchema = z.object({
  accountId: z.string().refine(isFieldClient, "Pick a client"),
  name: z.string().trim().min(2, "Name the template").max(80),
  title: z.string().trim().min(2, "Name the work").max(120),
  message: z.string().trim().max(1000).optional(),
  terms: z.string().trim().max(4000),
  depositPct: z.coerce.number().int().min(0).max(100),
  validDays: z.coerce.number().int().min(1).max(365),
});

export async function saveTemplateAction(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = templateSchema.safeParse({
      accountId: fd.get("accountId"),
      name: fd.get("name"),
      title: fd.get("title"),
      message: fd.get("message") ?? "",
      terms: fd.get("terms") ?? "",
      depositPct: fd.get("depositPct") ?? 0,
      validDays: fd.get("validDays") ?? 30,
    });
    const errors = parsed.success ? {} : flatten(parsed.error);
    const count = Math.min(3, Math.max(1, Number(fd.get("optionCount") ?? 1)));
    const options: { name: string; lineItems: LineItem[] }[] = [];
    for (let i = 0; i < count; i++) {
      const name = String(fd.get(`option${i}Name`) ?? "").trim() || (count === 1 ? "Estimate" : `Option ${i + 1}`);
      const lines = parseLines(fd.get(`option${i}Lines`));
      if (!lines.ok) errors[`option${i}`] = lines.error;
      else options.push({ name, lineItems: lines.items });
    }
    const addOns = parseOptionalLines(fd.get("addOns"));
    if (!addOns.ok) errors.addOns = addOns.error;
    if (!parsed.success || Object.keys(errors).length || !addOns.ok) return { ok: false, errors, message: "Check the highlighted fields." };
    const d = parsed.data;
    const t = saveTemplate(new Date(), id, {
      accountId: d.accountId,
      name: d.name,
      title: d.title,
      message: d.message || undefined,
      options,
      addOns: addOns.items.map((a, i) => ({ ...a, id: `ao${i}-${stamp()}` })),
      terms: d.terms,
      depositPct: d.depositPct,
      validDays: d.validDays,
    });
    refresh();
    redirect(`/agency/estimates/library?client=${t.accountId}&tab=templates`);
  });
}

export async function deleteTemplateAction(id: string, accountId: string): Promise<void> {
  return withWorkspace(async () => {
    deleteTemplate(new Date(), z.string().max(120).parse(id));
    refresh();
    redirect(`/agency/estimates/library?client=${accountId}&tab=templates`);
  });
}

/* ------------------------- the customer's link ------------------------- */

const signSchema = z.object({
  optionId: z.string().min(1).max(40),
  addOnIds: z.array(z.string().max(80)).max(20),
  name: z.string().trim().min(2, "Type your full name to sign").max(80),
  // A drawn signature is a small PNG; anything bigger isn't one.
  image: z
    .string()
    .max(200_000, "That signature is too large. Clear it and sign again.")
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Draw your signature again.")
    .optional(),
  agree: z.literal(true, { error: "Tick the box to accept the terms" }),
});

export type SignResult = ActionState & { depositCents?: number };

/** The customer picks an option and add-ons, accepts the terms and signs. */
export async function customerSignAction(id: string, input: unknown): Promise<SignResult> {
  const res = await withPublicWorkspace(`estimate:${id}`, async () => {
    const now = new Date();
    const e = findEstimate(now, id);
    const client = e ? fieldClients(now).find((c) => c.account.id === e.accountId) : undefined;
    if (!e || !client || estimateDisplay(e, localDate(now, client.timeZone)) !== "sent") return { ok: false, message: "This estimate is no longer open. Call us and we'll sort it out." };
    const p = signSchema.safeParse(input);
    if (!p.success) return { ok: false, errors: flatten(p.error), message: p.error.issues[0]?.message };
    const option = e.options.find((o) => o.id === p.data.optionId);
    if (!option) return { ok: false, message: "Pick one of the options." };
    const ex = estimateExtras(now, id);
    const chosen = p.data.addOnIds.filter((a) => ex.addOns.some((x) => x.id === a));
    const h = await headers();
    patchEstimateExtras(now, id, {
      chosenAddOnIds: chosen,
      signature: { name: p.data.name, image: p.data.image, at: now.toISOString(), ip: (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || undefined, userAgent: h.get("user-agent")?.slice(0, 200) ?? undefined },
    });
    approveEstimate(now, id, option.id, p.data.name);
    const total = approvedTotal(option, { ...ex, chosenAddOnIds: chosen }, e.taxRateBps).total;
    const added = ex.addOns.filter((a) => chosen.includes(a.id));
    addActivity(now, e.contactId, {
      kind: "estimate",
      title: `Estimate ${e.number} signed`,
      body: `Signed by ${p.data.name}${added.length ? ` with ${added.map((a) => a.name).join(", ")}` : ""}. Total ${formatDollarsExact(total)}.`,
      by: p.data.name,
    });
    refresh(id);
    return { ok: true, message: "Signed", depositCents: depositFor(total, ex.depositPct) };
  });
  return res ?? { ok: false, message: "This estimate is no longer open. Call us and we'll sort it out." };
}

/** The deposit, charged through the Stripe stub and credited to the final invoice. */
export async function customerPayDepositAction(id: string): Promise<ActionState> {
  const res = await withPublicWorkspace(`estimate:${id}`, async () => {
    const now = new Date();
    const e = findEstimate(now, id);
    if (!e || e.status !== "approved") return { ok: false, message: "Approve the estimate first." };
    const ex = estimateExtras(now, id);
    if (ex.deposit) return { ok: true, message: "Deposit already paid" };
    const option = e.options.find((o) => o.id === e.approvedOptionId) ?? e.options[0]!;
    const amount = depositFor(approvedTotal(option, ex, e.taxRateBps).total, ex.depositPct);
    if (amount <= 0) return { ok: false, message: "No deposit is due." };
    const charge = await chargeCard({ amountCents: amount, description: `Deposit on ${e.number} ${e.title}`, customerRef: e.contactId });
    if (!charge.ok) return { ok: false, message: charge.error };
    patchEstimateExtras(now, id, { deposit: { amountCents: amount, reference: charge.reference, at: now.toISOString() } });
    const c = findContact(now, e.contactId);
    addActivity(now, e.contactId, { kind: "payment", title: `Deposit on ${e.number}`, body: `Card · ${charge.reference}`, by: c ? `${c.firstName} ${c.lastName}` : "Customer", amountCents: amount });
    refresh(id);
    return { ok: true, message: "Deposit paid" };
  });
  return res ?? { ok: false, message: "This estimate is no longer open." };
}
