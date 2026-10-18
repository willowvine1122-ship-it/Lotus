import { stamp } from "@/lib/ids";
import type { Estimate, EstimateOption, Invoice, Job, JobStatus, LineItem, MarketingClient, Payment, PaymentMethod, Technician } from "@/lib/types";
import { addDays, jobStatusLabel, localDate, totals } from "@/lib/field";
import { taxRateFor, trades, type Counters } from "./trades";
import { defineModule } from "@/lib/server/workspace";
import { addActivity, findClient, findContact, listClients,} from "./store";

/*
 * Field service: technicians, jobs, estimates, invoices and payments, saved
 * per agency in the "field" module. Every customer-facing event is also
 * written to the contact's timeline through addActivity, so the CRM shows
 * the whole history. Estimates and invoices have public customer pages.
 */

interface FieldStore {
  technicians: Technician[];
  jobs: Job[];
  estimates: Estimate[];
  invoices: Invoice[];
  counters: Counters;
}

const fieldModule = defineModule<FieldStore>({
  key: "field",
  init: () => ({ technicians: [], jobs: [], estimates: [], invoices: [], counters: { job: 1001, estimate: 2001, invoice: 3001 } }),
  publicKeys: (s) => [...s.estimates.map((e) => `estimate:${e.id}`), ...s.invoices.map((i) => `invoice:${i.id}`)],
});

function field(_now: Date): FieldStore {
  return fieldModule.get();
}

const newId = () => `new-${stamp()}-${Math.floor(Math.random() * 1e6).toString(36)}`;

/* ------------------------------ Reads ------------------------------- */

/** Clients that run field service: marketing clients in a trade, or any marketing client with a crew. */
export function fieldClients(now: Date): MarketingClient[] {
  const s = field(now);
  return listClients(now).filter((c): c is MarketingClient => c.mode === "marketing" && (!!trades[c.industry] || s.technicians.some((t) => t.accountId === c.account.id)));
}

export function listTechnicians(now: Date, accountId?: string) {
  const all = field(now).technicians;
  return accountId ? all.filter((t) => t.accountId === accountId) : all;
}

export function listJobs(now: Date, accountId?: string) {
  const all = field(now).jobs;
  return accountId ? all.filter((j) => j.accountId === accountId) : all;
}

export function findJob(now: Date, id: string) {
  return field(now).jobs.find((j) => j.id === id || j.number === id);
}

export function listEstimates(now: Date, accountId?: string) {
  const all = field(now).estimates;
  return accountId ? all.filter((e) => e.accountId === accountId) : all;
}

export function findEstimate(now: Date, id: string) {
  return field(now).estimates.find((e) => e.id === id || e.number === id);
}

export function listInvoices(now: Date, accountId?: string) {
  const all = field(now).invoices;
  return accountId ? all.filter((i) => i.accountId === accountId) : all;
}

export function findInvoice(now: Date, id: string) {
  return field(now).invoices.find((i) => i.id === id || i.number === id);
}

export function clientTaxRate(now: Date, accountId: string) {
  const c = findClient(now, accountId);
  return c ? taxRateFor(c.location) : 0;
}

/* ------------------------------ Jobs -------------------------------- */

export interface NewJobInput {
  accountId: string;
  contactId: string;
  title: string;
  address: string;
  start?: string;
  durationMin: number;
  technicianIds: string[];
  lineItems: LineItem[];
  notes?: string;
  estimateId?: string;
}

function schedLine(job: Job, now: Date) {
  const techs = listTechnicians(now, job.accountId).filter((t) => job.technicianIds.includes(t.id));
  const who = techs.length ? ` with ${techs.map((t) => t.name).join(" and ")}` : "";
  return `${job.title}${who}`;
}

export function createJob(now: Date, input: NewJobInput, by: string): Job | undefined {
  const contact = findContact(now, input.contactId);
  if (!contact || contact.accountId !== input.accountId) return undefined;
  const s = field(now);
  const scheduled = !!input.start && input.technicianIds.length > 0;
  const job: Job = {
    id: newId(),
    number: `J-${s.counters.job++}`,
    accountId: input.accountId,
    contactId: input.contactId,
    title: input.title.trim(),
    address: input.address.trim(),
    status: scheduled ? "scheduled" : "unscheduled",
    technicianIds: input.technicianIds,
    start: input.start,
    durationMin: input.durationMin,
    lineItems: input.lineItems,
    notes: input.notes?.trim() || undefined,
    estimateId: input.estimateId,
    createdAt: now.toISOString(),
  };
  s.jobs.push(job);
  addActivity(now, job.contactId, { kind: "job", title: scheduled ? `Job ${job.number} scheduled` : `Job ${job.number} created`, body: schedLine(job, now), by });
  return job;
}

export function scheduleJob(now: Date, id: string, patch: { start?: string; durationMin?: number; technicianIds?: string[] }, by: string): Job | undefined {
  const job = findJob(now, id);
  if (!job || job.status === "completed" || job.status === "canceled") return job;
  if (patch.start !== undefined) job.start = patch.start || undefined;
  if (patch.durationMin !== undefined) job.durationMin = patch.durationMin;
  if (patch.technicianIds !== undefined) job.technicianIds = patch.technicianIds;
  const ready = !!job.start && job.technicianIds.length > 0;
  if (!ready) job.status = "unscheduled";
  else if (job.status === "unscheduled") job.status = "scheduled";
  addActivity(now, job.contactId, { kind: "job", title: ready ? `Job ${job.number} scheduled` : `Job ${job.number} unscheduled`, body: schedLine(job, now), by });
  return job;
}

export function setJobStatus(now: Date, id: string, status: JobStatus, by: string): Job | undefined {
  const job = findJob(now, id);
  if (!job || job.status === status) return job;
  job.status = status;
  if (status === "completed") job.completedAt = now.toISOString();
  if (status === "en_route" || status === "in_progress" || status === "completed" || status === "canceled") {
    addActivity(now, job.contactId, { kind: "job", title: `Job ${job.number}: ${jobStatusLabel[status].toLowerCase()}`, body: job.title, by });
  }
  return job;
}

export function updateJobDetails(now: Date, id: string, patch: { title?: string; address?: string; notes?: string; lineItems?: LineItem[] }) {
  const job = findJob(now, id);
  if (!job) return undefined;
  if (patch.title !== undefined) job.title = patch.title.trim();
  if (patch.address !== undefined) job.address = patch.address.trim();
  if (patch.notes !== undefined) job.notes = patch.notes.trim() || undefined;
  if (patch.lineItems !== undefined) job.lineItems = patch.lineItems;
  return job;
}

/* ---------------------------- Estimates ----------------------------- */

export interface NewEstimateInput {
  accountId: string;
  contactId: string;
  title: string;
  address: string;
  message?: string;
  options: EstimateOption[];
  validDays: number;
}

export function createEstimate(now: Date, input: NewEstimateInput, by: string): Estimate | undefined {
  const contact = findContact(now, input.contactId);
  const client = findClient(now, input.accountId);
  if (!contact || !client || contact.accountId !== input.accountId) return undefined;
  const s = field(now);
  const today = localDate(now, client.timeZone);
  const e: Estimate = {
    id: newId(),
    number: `E-${s.counters.estimate++}`,
    accountId: input.accountId,
    contactId: input.contactId,
    title: input.title.trim(),
    address: input.address.trim(),
    status: "draft",
    options: input.options,
    taxRateBps: taxRateFor(client.location),
    message: input.message?.trim() || undefined,
    createdAt: now.toISOString(),
    expiresOn: addDays(today, input.validDays),
  };
  s.estimates.push(e);
  addActivity(now, e.contactId, { kind: "estimate", title: `Estimate ${e.number} drafted`, body: e.title, by });
  return e;
}

export function sendEstimate(now: Date, id: string, by: string) {
  const e = findEstimate(now, id);
  if (!e || e.status === "approved" || e.status === "declined") return e;
  e.status = "sent";
  e.sentAt = now.toISOString();
  addActivity(now, e.contactId, { kind: "estimate", title: `Estimate ${e.number} sent`, body: e.title, by });
  return e;
}

export function approveEstimate(now: Date, id: string, optionId: string, by: string) {
  const e = findEstimate(now, id);
  const opt = e?.options.find((o) => o.id === optionId);
  if (!e || !opt || e.status === "approved") return e;
  e.status = "approved";
  e.approvedOptionId = opt.id;
  e.decidedAt = now.toISOString();
  addActivity(now, e.contactId, { kind: "estimate", title: `Estimate ${e.number} approved`, body: e.options.length > 1 ? `${opt.name} option` : undefined, by, amountCents: totals(opt.lineItems, e.taxRateBps).total });
  return e;
}

export function declineEstimate(now: Date, id: string, by: string, reason?: string) {
  const e = findEstimate(now, id);
  if (!e || e.status === "approved" || e.status === "declined") return e;
  e.status = "declined";
  e.decidedAt = now.toISOString();
  addActivity(now, e.contactId, { kind: "estimate", title: `Estimate ${e.number} declined`, body: reason, by });
  return e;
}

/** Turn an approved estimate into an unscheduled job carrying the chosen option's line items. */
export function convertEstimate(now: Date, id: string, by: string): Job | undefined {
  const e = findEstimate(now, id);
  if (!e || e.status !== "approved") return undefined;
  if (e.jobId) return findJob(now, e.jobId);
  const opt = e.options.find((o) => o.id === e.approvedOptionId) ?? e.options[0]!;
  const job = createJob(now, { accountId: e.accountId, contactId: e.contactId, title: e.title, address: e.address, durationMin: 240, technicianIds: [], lineItems: structuredClone(opt.lineItems), estimateId: e.id }, by);
  if (job) e.jobId = job.id;
  return job;
}

/* ----------------------------- Invoices ----------------------------- */

export interface NewInvoiceInput {
  accountId: string;
  contactId: string;
  title: string;
  lineItems: LineItem[];
  dueDays: number;
  memo?: string;
  jobId?: string;
  estimateId?: string;
}

export function createInvoice(now: Date, input: NewInvoiceInput, by: string): Invoice | undefined {
  const contact = findContact(now, input.contactId);
  const client = findClient(now, input.accountId);
  if (!contact || !client || contact.accountId !== input.accountId) return undefined;
  const s = field(now);
  const today = localDate(now, client.timeZone);
  const inv: Invoice = {
    id: newId(),
    number: `INV-${s.counters.invoice++}`,
    accountId: input.accountId,
    contactId: input.contactId,
    jobId: input.jobId,
    estimateId: input.estimateId,
    title: input.title.trim(),
    lineItems: input.lineItems,
    taxRateBps: taxRateFor(client.location),
    status: "draft",
    issuedOn: today,
    dueOn: addDays(today, input.dueDays),
    payments: [],
    memo: input.memo?.trim() || undefined,
    createdAt: now.toISOString(),
  };
  s.invoices.push(inv);
  if (input.jobId) {
    const job = findJob(now, input.jobId);
    if (job) job.invoiceId = inv.id;
  }
  addActivity(now, inv.contactId, { kind: "invoice", title: `Invoice ${inv.number} drafted`, body: inv.title, by, amountCents: totals(inv.lineItems, inv.taxRateBps).total });
  return inv;
}

/** One invoice per job: returns the existing one when there is. */
export function invoiceFromJob(now: Date, jobId: string, by: string): Invoice | undefined {
  const job = findJob(now, jobId);
  if (!job) return undefined;
  if (job.invoiceId) return findInvoice(now, job.invoiceId);
  return createInvoice(now, { accountId: job.accountId, contactId: job.contactId, title: job.title, lineItems: structuredClone(job.lineItems), dueDays: 15, jobId: job.id, estimateId: job.estimateId }, by);
}

export function invoiceFromEstimate(now: Date, estimateId: string, by: string): Invoice | undefined {
  const e = findEstimate(now, estimateId);
  if (!e) return undefined;
  if (e.jobId) {
    const job = findJob(now, e.jobId);
    if (job) return invoiceFromJob(now, job.id, by);
  }
  const existing = field(now).invoices.find((i) => i.estimateId === e.id && i.status !== "void");
  if (existing) return existing;
  const opt = e.options.find((o) => o.id === e.approvedOptionId) ?? e.options[0]!;
  return createInvoice(now, { accountId: e.accountId, contactId: e.contactId, title: e.title, lineItems: structuredClone(opt.lineItems), dueDays: 15, estimateId: e.id }, by);
}

export function sendInvoice(now: Date, id: string, by: string) {
  const inv = findInvoice(now, id);
  if (!inv || inv.status !== "draft") return inv;
  inv.status = "sent";
  inv.sentAt = now.toISOString();
  addActivity(now, inv.contactId, { kind: "invoice", title: `Invoice ${inv.number} sent`, body: inv.title, by, amountCents: totals(inv.lineItems, inv.taxRateBps).total });
  return inv;
}

export function recordPayment(now: Date, id: string, amountCents: number, method: PaymentMethod, reference: string | undefined, by: string): Payment | undefined {
  const inv = findInvoice(now, id);
  if (!inv || inv.status === "void" || amountCents <= 0) return undefined;
  const p: Payment = { id: `${inv.id}-p${inv.payments.length + 1}-${stamp()}`, invoiceId: inv.id, amountCents, method, at: now.toISOString(), reference };
  inv.payments.push(p);
  if (inv.status === "draft") {
    inv.status = "sent";
    inv.sentAt = now.toISOString();
  }
  const { total } = totals(inv.lineItems, inv.taxRateBps);
  const paid = inv.payments.reduce((a, x) => a + x.amountCents, 0);
  if (paid >= total) inv.status = "paid";
  addActivity(now, inv.contactId, { kind: "payment", title: `Payment on ${inv.number}`, body: reference ? `${method === "card" ? "Card" : method === "ach" ? "Bank transfer" : method === "check" ? "Check" : "Cash"} · ${reference}` : undefined, by, amountCents });
  return p;
}

export function voidInvoice(now: Date, id: string, by: string) {
  const inv = findInvoice(now, id);
  if (!inv || inv.status === "void" || inv.payments.length > 0) return inv;
  inv.status = "void";
  const job = inv.jobId ? findJob(now, inv.jobId) : undefined;
  if (job?.invoiceId === inv.id) job.invoiceId = undefined;
  addActivity(now, inv.contactId, { kind: "invoice", title: `Invoice ${inv.number} voided`, by });
  return inv;
}

export function addTechnician(now: Date, accountId: string, name: string, role: string, phone?: string): Technician | undefined {
  const client = findClient(now, accountId);
  if (!client || client.mode !== "marketing") return undefined;
  const s = field(now);
  const count = s.technicians.filter((t) => t.accountId === accountId).length;
  const t: Technician = {
    id: newId(),
    accountId,
    name: name.trim(),
    initials: name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join(""),
    tone: (["teal", "orange", "violet", "ink"] as const)[count % 4],
    role: role.trim() || "Technician",
    phone: phone?.trim() || undefined,
  };
  s.technicians.push(t);
  return t;
}
