"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { CreditCard, ExternalLink, Send, SquareArrowOutUpRight } from "lucide-react";
import { Field, FormNotice, Input, Select, SubmitButton } from "@/components/form";
import type { ActionState } from "@/app/agency/contacts/actions";
import { invoiceDisplay, invoiceMoney, paymentMethodLabel } from "@/lib/field";
import type { Invoice, PaymentMethod } from "@/lib/types";
import { cn, formatDollarsExact, timeAgo } from "@/lib/utils";
import { CustomerSection } from "./job-panel";
import { dueLine } from "./status-lines";
import { LineItems } from "./line-items";
import type { CustomerRef, FieldClientRef } from "./model";
import { CloseButton, InvoiceTag, Ledger, LedgerRow, PanelButton, PanelLink, PanelSection } from "./ui";

/*
 * The invoice panel: what is owed and since when, the payments against it,
 * and taking the next payment (card through Stripe, or cash, check and bank
 * transfers recorded by hand).
 */

export interface InvoiceActions {
  send: (id: string) => Promise<void>;
  void: (id: string) => Promise<void>;
  recordPayment: (id: string, prev: ActionState, fd: FormData) => Promise<ActionState>;
}

export function MoneyLedger({ inv }: { inv: Invoice }) {
  const m = invoiceMoney(inv);
  return (
    <Ledger>
      <LedgerRow label="Total">
        <span className="num">{formatDollarsExact(m.total)}</span>
      </LedgerRow>
      <LedgerRow label="Paid">
        <span className="num">{m.paid ? formatDollarsExact(m.paid) : <span className="text-fg-3">–</span>}</span>
      </LedgerRow>
      <LedgerRow label="Balance due" strong>
        <span className="num">{formatDollarsExact(m.balance)}</span>
      </LedgerRow>
    </Ledger>
  );
}

export function PaymentForm({ inv, record }: { inv: Invoice; record: InvoiceActions["recordPayment"] }) {
  const [state, formAction] = useActionState(record.bind(null, inv.id), null);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const { balance } = invoiceMoney(inv);
  const e = state?.errors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-3 rounded border border-line bg-surface p-3.5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" htmlFor={`amt-${inv.id}`} error={e.amount}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-fg-3">$</span>
            <Input id={`amt-${inv.id}`} name="amount" inputMode="decimal" defaultValue={(balance / 100).toFixed(2)} className="num h-8 pl-6 text-xs" aria-invalid={!!e.amount} />
          </div>
        </Field>
        <Field label="Method" htmlFor={`method-${inv.id}`}>
          <Select id={`method-${inv.id}`} name="method" value={method} onChange={(ev) => setMethod(ev.target.value as PaymentMethod)} className="h-8 text-xs">
            {(Object.keys(paymentMethodLabel) as PaymentMethod[]).map((k) => (
              <option key={k} value={k}>
                {paymentMethodLabel[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {method !== "card" && (
        <Field label={method === "check" ? "Check number" : "Reference"} htmlFor={`ref-${inv.id}`} hint="Optional">
          <Input id={`ref-${inv.id}`} name="reference" placeholder={method === "check" ? "1042" : method === "ach" ? "Bank reference" : "Who took it"} className="h-8 text-xs" />
        </Field>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="secondary" pendingLabel={method === "card" ? "Charging…" : "Saving…"} className="h-8 px-3 text-xs">
          {method === "card" ? (
            <>
              <CreditCard className="size-3.5" strokeWidth={1.75} /> Charge card
            </>
          ) : (
            "Record payment"
          )}
        </SubmitButton>
        <FormNotice state={state} />
      </div>
      {method === "card" && <p className="text-2xs leading-relaxed text-fg-3">Charges the card on file through Stripe. Demo mode: the charge succeeds without moving money.</p>}
    </form>
  );
}

export function InvoiceNextStep({ inv, today, actions }: { inv: Invoice; today: string; actions: InvoiceActions }) {
  const [pending, start] = useTransition();
  const d = invoiceDisplay(inv, today);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {d === "draft" && (
        <PanelButton tone="ink" disabled={pending} onClick={() => start(() => actions.send(inv.id))}>
          <Send className="size-3.5" strokeWidth={1.75} /> Send invoice
        </PanelButton>
      )}
      {d === "overdue" && (
        <PanelButton disabled={pending} onClick={() => start(() => actions.send(inv.id))}>
          <Send className="size-3.5" strokeWidth={1.75} /> Send a reminder
        </PanelButton>
      )}
      {d !== "void" && (
        <PanelLink href={`/p/invoices/${inv.id}`}>
          <ExternalLink className="size-3.5" strokeWidth={1.75} /> Customer view
        </PanelLink>
      )}
      {inv.status !== "void" && inv.payments.length === 0 && (
        <button type="button" disabled={pending} onClick={() => start(() => actions.void(inv.id))} className="ml-auto text-xs text-fg-3 hover:text-red disabled:opacity-50">
          Void
        </button>
      )}
    </div>
  );
}

export function Payments({ inv, now }: { inv: Invoice; now: Date }) {
  if (inv.payments.length === 0) return <p className="rounded border border-dashed border-line-strong px-3.5 py-3 text-center text-xs text-fg-3">No payments yet.</p>;
  return (
    <ul className="rounded border border-line">
      {inv.payments.map((p) => (
        <li key={p.id} className="flex items-baseline justify-between gap-3 border-b border-line px-3.5 py-2 last:border-b-0">
          <div className="min-w-0">
            <span className="block text-sm">{paymentMethodLabel[p.method]}</span>
            <span className="num block truncate text-2xs text-fg-3">
              {timeAgo(p.at, now)}
              {p.reference ? ` · ${p.reference}` : ""}
            </span>
          </div>
          <span className="num text-sm font-medium text-green">{formatDollarsExact(p.amountCents)}</span>
        </li>
      ))}
    </ul>
  );
}

export function InvoicePanel({ inv, client, customer, jobNumber, actions, now, onClose }: { inv: Invoice; client: FieldClientRef; customer?: CustomerRef; jobNumber?: string; actions: InvoiceActions; now: Date; onClose?: () => void }) {
  const d = invoiceDisplay(inv, client.today);
  const { balance } = invoiceMoney(inv);
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-line bg-surface px-5 pb-4 pt-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="num text-xs text-fg-3">{inv.number}</span>
              <InvoiceTag status={d} />
            </div>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold leading-6 tracking-tight">
              <span className="truncate">{inv.title}</span>
              <Link href={`/agency/invoices/${inv.id}`} aria-label="Open invoice" className="text-fg-3 hover:text-fg">
                <SquareArrowOutUpRight className="size-4" strokeWidth={1.75} />
              </Link>
            </h2>
            <p className="truncate text-xs text-fg-3">
              {customer ? (
                <Link href={`/agency/contacts/${customer.id}`} className="font-medium text-fg-2 hover:underline">
                  {customer.name}
                </Link>
              ) : (
                "Unknown customer"
              )}
              {" · "}
              {client.name}
              {jobNumber && inv.jobId && (
                <>
                  {" · "}
                  <Link href={`/agency/jobs/${inv.jobId}`} className="num hover:underline">
                    {jobNumber}
                  </Link>
                </>
              )}
            </p>
          </div>
          {onClose && <CloseButton onClose={onClose} />}
        </div>
        <p className={cn("num text-xs", d === "overdue" ? "font-medium text-red" : "text-fg-3")}>{dueLine(inv, client.today, now)}</p>
      </header>
      <div className="flex flex-col gap-6 px-5 py-5">
        <InvoiceNextStep inv={inv} today={client.today} actions={actions} />
        <MoneyLedger inv={inv} />
        {balance > 0 && inv.status !== "void" && (
          <PanelSection title="Take a payment">
            <PaymentForm key={`${inv.id}-${inv.payments.length}`} inv={inv} record={actions.recordPayment} />
          </PanelSection>
        )}
        <PanelSection title="Payments">
          <Payments inv={inv} now={now} />
        </PanelSection>
        <PanelSection title="Items">
          <LineItems items={inv.lineItems} taxRateBps={inv.taxRateBps} compact />
        </PanelSection>
        <CustomerSection customer={customer} />
      </div>
    </div>
  );
}
