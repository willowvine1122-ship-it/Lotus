"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/app/agency/contacts/actions";
import { approveEstimate, convertEstimate, createEstimate, declineEstimate, findEstimate, invoiceFromEstimate, sendEstimate } from "@/lib/data/field-store";
import { findContact } from "@/lib/data/store";
import { actor, flatten, parseLines } from "@/lib/field-forms";
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
});

export async function createEstimateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = estimateSchema.safeParse({
    accountId: fd.get("accountId"),
    contactId: fd.get("contactId"),
    title: fd.get("title"),
    address: fd.get("address"),
    message: fd.get("message") ?? "",
    validDays: fd.get("validDays") ?? 30,
    intent: fd.get("intent") ?? "draft",
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
  if (!parsed.success || Object.keys(errors).length) return { ok: false, errors };
  const d = parsed.data;
  const now = new Date();
  const e = createEstimate(now, { accountId: d.accountId, contactId: d.contactId, title: d.title, address: d.address, message: d.message, options, validDays: d.validDays }, actor);
  if (!e) return { ok: false, message: "That customer does not belong to this client." };
  if (d.intent === "send") sendEstimate(now, e.id, actor);
  refresh(e.id);
  redirect(`/agency/estimates/${e.id}`);
}

export async function sendEstimateAction(id: string): Promise<void> {
  sendEstimate(new Date(), id, actor);
  refresh(id);
}

export async function approveEstimateAction(id: string, optionId: string): Promise<void> {
  approveEstimate(new Date(), id, optionId, actor);
  refresh(id);
}

export async function declineEstimateAction(id: string): Promise<void> {
  declineEstimate(new Date(), id, actor);
  refresh(id);
}

export async function convertEstimateAction(id: string): Promise<void> {
  const job = convertEstimate(new Date(), id, actor);
  if (!job) return;
  refresh(id);
  redirect(`/agency/jobs/${job.id}`);
}

export async function invoiceEstimateAction(id: string): Promise<void> {
  const inv = invoiceFromEstimate(new Date(), id, actor);
  if (!inv) return;
  refresh(id);
  revalidatePath("/agency/invoices");
  redirect(`/agency/invoices/${inv.id}`);
}

/** The customer's own answer from their link. */
export async function customerApproveAction(id: string, optionId: string): Promise<ActionState> {
  const now = new Date();
  const e = findEstimate(now, id);
  if (!e || e.status !== "sent") return { ok: false, message: "This estimate is no longer open." };
  const c = findContact(now, e.contactId);
  approveEstimate(now, id, optionId, c ? `${c.firstName} ${c.lastName}` : "Customer");
  refresh(id);
  return { ok: true, message: "Approved" };
}
