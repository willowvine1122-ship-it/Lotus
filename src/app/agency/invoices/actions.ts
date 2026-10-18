"use server";

import { withPublicWorkspace } from "@/lib/server/workspace";
import { withWorkspace } from "@/lib/server/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/app/agency/contacts/actions";
import { createInvoice, findInvoice, recordPayment, sendInvoice, voidInvoice } from "@/lib/data/field-store";
import { actor, flatten, money, parseLines } from "@/lib/field-forms";
import { invoiceMoney } from "@/lib/field";
import { chargeCard } from "@/lib/payments/stripe";

/* Invoices and payments. Card charges go through the Stripe stub. */

function refresh(id?: string) {
  revalidatePath("/agency/invoices");
  revalidatePath("/agency/jobs");
  if (id) {
    revalidatePath(`/agency/invoices/${id}`);
    revalidatePath(`/p/invoices/${id}`);
  }
}

const invoiceSchema = z.object({
  accountId: z.string().min(1, "Pick a client"),
  contactId: z.string().min(1, "Pick a customer"),
  title: z.string().trim().min(2, "Say what it is for"),
  dueDays: z.coerce.number().int().min(0).max(120),
  memo: z.string().optional(),
  intent: z.enum(["draft", "send"]),
});

export async function createInvoiceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = invoiceSchema.safeParse({
      accountId: fd.get("accountId"),
      contactId: fd.get("contactId"),
      title: fd.get("title"),
      dueDays: fd.get("dueDays") ?? 15,
      memo: fd.get("memo") ?? "",
      intent: fd.get("intent") ?? "draft",
    });
    const lines = parseLines(fd.get("lineItems"));
    const errors = parsed.success ? {} : flatten(parsed.error);
    if (!lines.ok) errors.lineItems = lines.error;
    if (!parsed.success || !lines.ok) return { ok: false, errors };
    const d = parsed.data;
    const now = new Date();
    const inv = createInvoice(now, { accountId: d.accountId, contactId: d.contactId, title: d.title, lineItems: lines.items, dueDays: d.dueDays, memo: d.memo }, actor);
    if (!inv) return { ok: false, message: "That customer does not belong to this client." };
    if (d.intent === "send") sendInvoice(now, inv.id, actor);
    refresh(inv.id);
    redirect(`/agency/invoices/${inv.id}`);
  });
}

export async function sendInvoiceAction(id: string): Promise<void> {
  return withWorkspace(async () => {
    sendInvoice(new Date(), id, actor);
    refresh(id);
  });
}

export async function voidInvoiceAction(id: string): Promise<void> {
  return withWorkspace(async () => {
    voidInvoice(new Date(), id, actor);
    refresh(id);
  });
}

const paymentSchema = z.object({
  amount: money,
  method: z.enum(["card", "ach", "cash", "check"]),
  reference: z.string().trim().max(60).optional(),
});

export async function recordPaymentAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = paymentSchema.safeParse({ amount: fd.get("amount") ?? "", method: fd.get("method"), reference: fd.get("reference") ?? "" });
    if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
    const now = new Date();
    const inv = findInvoice(now, id);
    if (!inv) return { ok: false, message: "Invoice not found." };
    const { balance } = invoiceMoney(inv);
    const cents = Math.round(parsed.data.amount * 100);
    if (cents > balance) return { ok: false, errors: { amount: `That is more than the ${(balance / 100).toFixed(2)} still due` } };
    let reference = parsed.data.reference || undefined;
    if (parsed.data.method === "card") {
      const charge = await chargeCard({ amountCents: cents, description: `${inv.number} ${inv.title}`, customerRef: inv.contactId });
      if (!charge.ok) return { ok: false, message: charge.error };
      reference = charge.reference;
    }
    recordPayment(now, id, cents, parsed.data.method, reference, actor);
    refresh(id);
    return { ok: true, message: cents === balance ? "Paid in full" : "Payment recorded" };
  });
}

/** Customer pays the balance on their own link. Same Stripe stub, attributed to the customer. */
export async function payInvoiceAction(id: string): Promise<ActionState> {
  const res = await withPublicWorkspace(`invoice:${id}`, async () => {
    const now = new Date();
    const inv = findInvoice(now, id);
    if (!inv || inv.status === "void" || inv.status === "draft") return { ok: false, message: "This invoice cannot be paid online." };
    const { balance } = invoiceMoney(inv);
    if (balance === 0) return { ok: true, message: "Already paid" };
    const charge = await chargeCard({ amountCents: balance, description: `${inv.number} ${inv.title}`, customerRef: inv.contactId });
    if (!charge.ok) return { ok: false, message: charge.error };
    recordPayment(now, id, balance, "card", charge.reference, "Customer");
    refresh(id);
    return { ok: true, message: "Paid" };
  });
  return res ?? { ok: false, message: "This invoice cannot be paid online." };
}
