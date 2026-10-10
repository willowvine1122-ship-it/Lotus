import { dayDiff, estimateDisplay, formatDay, invoiceDisplay } from "@/lib/field";
import type { Estimate, Invoice } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import type { FieldClientRef } from "./model";

/* Status sentences shared by panels and full pages (server-safe). */

export function estimateStatusLine(e: Estimate, client: FieldClientRef, now: Date) {
  const d = estimateDisplay(e, client.today);
  const left = dayDiff(e.expiresOn, client.today);
  switch (d) {
    case "draft":
      return `Drafted ${timeAgo(e.createdAt, now)}. Not sent yet.`;
    case "sent":
      return `Sent ${timeAgo(e.sentAt ?? e.createdAt, now)} · ${left === 0 ? "expires today" : `expires in ${left} day${left === 1 ? "" : "s"}`}`;
    case "expired":
      return `Expired ${formatDay(e.expiresOn)} without an answer.`;
    case "approved":
    case "converted": {
      const opt = e.options.find((o) => o.id === e.approvedOptionId);
      return `Approved ${timeAgo(e.decidedAt ?? e.createdAt, now)}${e.options.length > 1 && opt ? ` · ${opt.name}` : ""}`;
    }
    case "declined":
      return `Declined ${timeAgo(e.decidedAt ?? e.createdAt, now)}.`;
  }
}

export function dueLine(inv: Invoice, today: string, now: Date) {
  const d = invoiceDisplay(inv, today);
  const late = dayDiff(today, inv.dueOn);
  if (d === "paid") {
    const last = inv.payments[inv.payments.length - 1];
    return last ? `Paid ${timeAgo(last.at, now)}` : "Paid";
  }
  if (d === "void") return "Voided. Nothing is owed.";
  if (d === "draft") return `Draft. Due ${formatDay(inv.dueOn)} once sent.`;
  if (d === "overdue") return `${late} day${late === 1 ? "" : "s"} late · was due ${formatDay(inv.dueOn)}`;
  const left = -late;
  return left === 0 ? "Due today" : `Due in ${left} day${left === 1 ? "" : "s"} · ${formatDay(inv.dueOn)}`;
}
