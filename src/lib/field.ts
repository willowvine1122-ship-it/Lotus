import type { Estimate, EstimateOption, Invoice, Job, JobStatus, LineItem, PaymentMethod } from "@/lib/types";

/*
 * Field service maths and labels. Framework-free so server pages, server
 * actions and client components all compute totals the same way.
 */

export function lineTotal(li: Pick<LineItem, "quantity" | "unitCents">) {
  return Math.round(li.quantity * li.unitCents);
}

export function subtotal(items: LineItem[]) {
  return items.reduce((a, li) => a + lineTotal(li), 0);
}

export function totals(items: LineItem[], taxRateBps: number) {
  const sub = subtotal(items);
  const tax = Math.round((sub * taxRateBps) / 10000);
  return { subtotal: sub, tax, total: sub + tax };
}

export function formatTaxRate(bps: number) {
  const fixed = (bps / 100).toFixed(2).replace(/\.?0+$/, "");
  return `${fixed || "0"}%`;
}

/* ------------------------------- Jobs ------------------------------- */

export const jobStatusLabel: Record<JobStatus, string> = {
  unscheduled: "Unscheduled",
  scheduled: "Scheduled",
  en_route: "On the way",
  in_progress: "In progress",
  completed: "Completed",
  canceled: "Canceled",
};

/** The order a dispatcher reads them in: what is happening now first. */
export const jobStatusOrder: JobStatus[] = ["in_progress", "en_route", "scheduled", "unscheduled", "completed", "canceled"];

export function jobValue(job: Job) {
  return subtotal(job.lineItems);
}

export function isOpenJob(job: Job) {
  return job.status !== "completed" && job.status !== "canceled";
}

/* ---------------------------- Estimates ----------------------------- */

export function optionTotal(o: EstimateOption, taxRateBps: number) {
  return totals(o.lineItems, taxRateBps).total;
}

/** The figure an estimate is worth: the approved option, else the highest one on the table. */
export function estimateValue(e: Estimate) {
  const approved = e.options.find((o) => o.id === e.approvedOptionId);
  if (approved) return optionTotal(approved, e.taxRateBps);
  return Math.max(0, ...e.options.map((o) => optionTotal(o, e.taxRateBps)));
}

export function estimateRange(e: Estimate) {
  const vals = e.options.map((o) => optionTotal(o, e.taxRateBps));
  return { low: Math.min(...vals), high: Math.max(...vals) };
}

export type EstimateDisplay = "draft" | "sent" | "approved" | "declined" | "converted" | "expired";

export const estimateLabel: Record<EstimateDisplay, string> = {
  draft: "Draft",
  sent: "Sent",
  approved: "Approved",
  declined: "Declined",
  converted: "Job created",
  expired: "Expired",
};

export function estimateDisplay(e: Estimate, today: string): EstimateDisplay {
  if (e.status === "approved") return e.jobId ? "converted" : "approved";
  if (e.status === "sent" && e.expiresOn < today) return "expired";
  return e.status;
}

/* ----------------------------- Invoices ----------------------------- */

export type InvoiceDisplay = "draft" | "sent" | "partial" | "overdue" | "paid" | "void";

export const invoiceLabel: Record<InvoiceDisplay, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partly paid",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
};

export function invoiceMoney(inv: Invoice) {
  const t = totals(inv.lineItems, inv.taxRateBps);
  const paid = inv.payments.reduce((a, p) => a + p.amountCents, 0);
  return { ...t, paid, balance: Math.max(0, t.total - paid) };
}

export function invoiceDisplay(inv: Invoice, today: string): InvoiceDisplay {
  if (inv.status === "void" || inv.status === "draft" || inv.status === "paid") return inv.status;
  const { paid, balance } = invoiceMoney(inv);
  if (balance === 0) return "paid";
  if (inv.dueOn < today) return "overdue";
  return paid > 0 ? "partial" : "sent";
}

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  card: "Card",
  ach: "Bank transfer",
  cash: "Cash",
  check: "Check",
};

/* ------------------------------ Time -------------------------------- */

/** Today's date in a time zone, "YYYY-MM-DD". */
export function localDate(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Wall-clock "YYYY-MM-DDTHH:mm" for now in a time zone. */
export function localStamp(now: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Add days to a "YYYY-MM-DD" date without touching time zones. */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayDiff(a: string, b: string) {
  return Math.round((new Date(`${a}T12:00:00Z`).getTime() - new Date(`${b}T12:00:00Z`).getTime()) / 86400000);
}

export function minutesOf(stamp: string) {
  const [h, m] = stamp.slice(11, 16).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function stampAt(day: string, minutes: number) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${day}T${h}:${m}`;
}

export function formatClock(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

export function formatDay(day: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

/** "Today 9am–11am", "Tue, Oct 14 · 1:30pm", relative to the client's today. */
export function formatWhen(start: string | undefined, durationMin: number, today: string) {
  if (!start) return "Not scheduled";
  const day = start.slice(0, 10);
  const from = minutesOf(start);
  const diff = dayDiff(day, today);
  const label = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : formatDay(day);
  return `${label} · ${formatClock(from)}–${formatClock(from + durationMin)}`;
}

export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}
