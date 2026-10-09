import { invoiceDisplay, invoiceMoney, localDate, localStamp } from "@/lib/field";
import { trades } from "@/lib/data/demo-field";
import { clientTaxRate, fieldClients, findEstimate, findInvoice, listInvoices, listTechnicians } from "@/lib/data/field-store";
import { findClient, listContacts } from "@/lib/data/store";
import type { Crew, CustomerRef, FieldClientRef } from "./model";
import type { BookItem } from "./line-items-editor";
import type { Job } from "@/lib/types";
import type { JobLinks } from "./job-panel";
import type { JobsSummary } from "./jobs-board";

/* Server-side loaders shared by the field service pages. */

export function fieldClientRefs(now: Date): FieldClientRef[] {
  return fieldClients(now)
    .map((c) => ({
      id: c.account.id,
      name: c.account.name,
      slug: c.account.slug,
      industry: c.industry,
      timeZone: c.timeZone,
      today: localDate(now, c.timeZone),
      nowStamp: localStamp(now, c.timeZone),
      taxRateBps: clientTaxRate(now, c.account.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function customerRefs(now: Date, accountIds: string[]): Record<string, CustomerRef> {
  const out: Record<string, CustomerRef> = {};
  for (const id of accountIds) {
    for (const c of listContacts(now, id)) {
      out[c.id] = { id: c.id, accountId: c.accountId, name: `${c.firstName} ${c.lastName}`.trim(), email: c.email, phone: c.phone, city: c.city };
    }
  }
  return out;
}

export function crewMap(now: Date): Crew {
  return Object.fromEntries(listTechnicians(now).map((t) => [t.id, t]));
}

export function priceBooks(now: Date, clients: FieldClientRef[]): Record<string, BookItem[]> {
  const out: Record<string, BookItem[]> = {};
  for (const c of clients) {
    const rec = findClient(now, c.id);
    const book = rec ? trades[rec.industry]?.book : undefined;
    out[c.id] = (book ?? []).map(([name, dollars]) => ({ name, unitCents: Math.round(dollars * 100) }));
  }
  return out;
}

export function resolveClient(clients: FieldClientRef[], key?: string) {
  return key ? clients.find((c) => c.id === key || c.slug === key) : undefined;
}

export function jobLinks(now: Date, jobs: Job[], clients: FieldClientRef[]): Record<string, JobLinks> {
  const todayOf = new Map(clients.map((c) => [c.id, c.today]));
  const out: Record<string, JobLinks> = {};
  for (const j of jobs) {
    const links: JobLinks = {};
    const e = j.estimateId ? findEstimate(now, j.estimateId) : undefined;
    if (e) links.estimate = { id: e.id, number: e.number };
    const inv = j.invoiceId ? findInvoice(now, j.invoiceId) : undefined;
    if (inv) links.invoice = { id: inv.id, number: inv.number, status: invoiceDisplay(inv, todayOf.get(j.accountId) ?? ""), balanceCents: invoiceMoney(inv).balance };
    if (links.estimate || links.invoice) out[j.id] = links;
  }
  return out;
}

export function receivables(now: Date, clients: FieldClientRef[]): Record<string, JobsSummary> {
  const out: Record<string, JobsSummary> = {};
  for (const c of clients) {
    let unpaidCents = 0;
    let overdueCount = 0;
    for (const inv of listInvoices(now, c.id)) {
      const d = invoiceDisplay(inv, c.today);
      if (d === "sent" || d === "partial" || d === "overdue") unpaidCents += invoiceMoney(inv).balance;
      if (d === "overdue") overdueCount++;
    }
    out[c.id] = { unpaidCents, overdueCount };
  }
  return out;
}
