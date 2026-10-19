"use server";

import { actorName, withWorkspace } from "@/lib/server/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/app/agency/contacts/actions";
import { approveEstimate, convertEstimate, createEstimate, declineEstimate, findEstimate, invoiceFromEstimate, recordPayment, sendEstimate } from "@/lib/data/field-store";
import { carryAddOns, creditDeposit, findTemplate, setEstimateExtras } from "@/lib/data/estimate-kit";
import { parseOptionalLines } from "@/lib/estimate-forms";
import { findContact } from "@/lib/data/store";
import { flatten, parseLines } from "@/lib/field-forms";
import type { EstimateOption } from "@/lib/types";

/* Estimates: draft, send, approve or decline, then convert to a job or invoice. */

function refresh(id?: string) {
  revalidatePath("/agency/estimates");
  revalidatePath("/agency/jobs");
  if (id) {
    revalidatePath(`/agency/estimates/${id}`);
    revalidatePath(`/p/estimates/${id}`);
  }
}

const estimateSchema = z.object({
  accountId: z.string().min(1, "Pick a client"),
  contactId: z.string().min(1, "Pick a customer"),
  title: z.string().trim().min(2, "Name the work"),
  address: z.string().trim().min(4, "Where is the work?"),
  message: z.string().optional(),
  validDays: z.coerce.number().int().min(1).max(365),
  intent: z.enum(["draft", "send"]),
  terms: z.string().trim().max(4000).optional(),
  depositPct: z.coerce.number().int().min(0).max(100),
  templateId: z.string().max(120).optional(),
});

export async function createEstimateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = estimateSchema.safeParse({
      accountId: fd.get("accountId"),
      contactId: fd.get("contactId"),
      title: fd.get("title"),
      address: fd.get("address"),
      message: fd.get("message") ?? "",
      validDays: fd.get("validDays") ?? 30,
      intent: fd.get("intent") ?? "draft",
      terms: fd.get("terms") ?? "",
      depositPct: fd.get("depositPct") ?? 0,
      templateId: fd.get("templateId") || undefined,
    });
    const errors = parsed.success ? {} : flatten(parsed.error);
    const count = Math.min(3, Math.max(1, Number(fd.get("optionCount") ?? 1)));
    const options: EstimateOption[] = [];
    const names = new Set<string>();
    for (let i = 0; i < count; i++) {
      const name = String(fd.get(`option${i}Name`) ?? "").trim() || (count === 1 ? "Estimate" : `Option ${i + 1}`);
      const lines = parseLines(fd.get(`option${i}Lines`));
      if (!lines.ok) errors[`option${i}`] = lines.error;
      else options.push({ id: `opt${i + 1}`, name, lineItems: lines.items });
      if (names.has(name.toLowerCase())) errors[`option${i}`] = "Give each option its own name";
      names.add(name.toLowerCase());
    }
    const addOns = parseOptionalLines(fd.get("addOns"));
    if (!addOns.ok) errors.addOns = addOns.error;
    if (!parsed.success || Object.keys(errors).length || !addOns.ok) return { ok: false, errors };
    const d = parsed.data;
    const now = new Date();
    const e = createEstimate(now, { accountId: d.accountId, contactId: d.contactId, title: d.title, address: d.address, message: d.message, options, validDays: d.validDays }, actorName());
    if (!e) return { ok: false, message: "That customer does not belong to this client." };
    const template = d.templateId ? findTemplate(now, d.templateId) : undefined;
    setEstimateExtras(now, {
      estimateId: e.id,
      templateId: template?.accountId === d.accountId ? template.id : undefined,
      addOns: addOns.items.map((a, i) => ({ ...a, id: `${e.id}-ao${i}` })),
      chosenAddOnIds: [],
      terms: d.terms || undefined,
      depositPct: d.depositPct,
    });
    if (d.intent === "send") sendEstimate(now, e.id, actorName());
    refresh(e.id);
    redirect(`/agency/estimates/${e.id}`);
  });
}

export async function sendEstimateAction(id: string): Promise<void> {
  return withWorkspace(async () => {
    sendEstimate(new Date(), id, actorName());
    refresh(id);
  });
}

export async function approveEstimateAction(id: string, optionId: string): Promise<void> {
  return withWorkspace(async () => {
    approveEstimate(new Date(), id, optionId, actorName());
    refresh(id);
  });
}

export async function declineEstimateAction(id: string): Promise<void> {
  return withWorkspace(async () => {
    declineEstimate(new Date(), id, actorName());
    refresh(id);
  });
}

export async function convertEstimateAction(id: string): Promise<void> {
  return withWorkspace(async () => {
    const now = new Date();
    const job = convertEstimate(now, id, actorName());
    if (!job) return;
    carryAddOns(now, id, job);
    refresh(id);
    redirect(`/agency/jobs/${job.id}`);
  });
}

export async function invoiceEstimateAction(id: string): Promise<void> {
  return withWorkspace(async () => {
    const now = new Date();
    const viaJob = !!findEstimate(now, id)?.jobId;
    const inv = invoiceFromEstimate(now, id, actorName());
    if (!inv) return;
    // Straight from the estimate, the invoice starts from the option alone: add the ticked add-ons (idempotent).
    if (!viaJob && inv.status === "draft") carryAddOns(now, id, inv);
    creditDeposit(now, id, inv.id, recordPayment, (ref) => inv.payments.some((p) => p.reference === ref));
    refresh(id);
    revalidatePath("/agency/invoices");
    redirect(`/agency/invoices/${inv.id}`);
  });
}

/** The customer's own answer from their link. */
export async function customerApproveAction(id: string, optionId: string): Promise<ActionState> {
  return withWorkspace(async () => {
    const now = new Date();
    const e = findEstimate(now, id);
    if (!e || e.status !== "sent") return { ok: false, message: "This estimate is no longer open." };
    const c = findContact(now, e.contactId);
    approveEstimate(now, id, optionId, c ? `${c.firstName} ${c.lastName}` : "Customer");
    refresh(id);
    return { ok: true, message: "Approved" };
  });
}
