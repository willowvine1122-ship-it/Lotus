"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Check, ExternalLink, MapPin, Receipt, Send, SquareArrowOutUpRight, Wrench } from "lucide-react";
import { estimateDisplay, optionTotal } from "@/lib/field";
import type { Estimate } from "@/lib/types";
import { cn, formatDollarsExact } from "@/lib/utils";
import { CustomerSection } from "./job-panel";
import { estimateStatusLine } from "./status-lines";
import { LineItems } from "./line-items";
import type { CustomerRef, FieldClientRef } from "./model";
import { CloseButton, EstimateTag, PanelButton, PanelLink, PanelSection, StatusTag } from "./ui";

/*
 * The estimate panel: the options side by side in reading order, what the
 * customer chose, and the one next step (send, record the answer, turn it
 * into a job or an invoice).
 */

export interface EstimateActions {
  send: (id: string) => Promise<void>;
  approve: (id: string, optionId: string) => Promise<void>;
  decline: (id: string) => Promise<void>;
  convert: (id: string) => Promise<void>;
  invoice: (id: string) => Promise<void>;
}

export function EstimateNextStep({ e, client, actions, jobNumber }: { e: Estimate; client: FieldClientRef; actions: EstimateActions; jobNumber?: string }) {
  const [pending, start] = useTransition();
  const d = estimateDisplay(e, client.today);
  if (d === "draft") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PanelButton tone="ink" disabled={pending} onClick={() => start(() => actions.send(e.id))}>
            <Send className="size-3.5" strokeWidth={1.75} /> Send to customer
          </PanelButton>
          <PanelLink href={`/p/estimates/${e.id}`}>
            <ExternalLink className="size-3.5" strokeWidth={1.75} /> Customer view
          </PanelLink>
        </div>
        <p className="text-xs text-fg-3">The customer gets a link to pick an option and approve. Email delivery switches on with the Inbox.</p>
      </div>
    );
  }
  if (d === "sent" || d === "expired") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <PanelLink href={`/p/estimates/${e.id}`}>
          <ExternalLink className="size-3.5" strokeWidth={1.75} /> Customer view
        </PanelLink>
        <PanelButton disabled={pending} onClick={() => start(() => actions.send(e.id))}>
          <Send className="size-3.5" strokeWidth={1.75} /> {d === "expired" ? "Send again" : "Resend"}
        </PanelButton>
        <button type="button" disabled={pending} onClick={() => start(() => actions.decline(e.id))} className="ml-auto text-xs text-fg-3 hover:text-fg disabled:opacity-50">
          Mark declined
        </button>
      </div>
    );
  }
  if (d === "approved") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <PanelButton tone="ink" disabled={pending} onClick={() => start(() => actions.convert(e.id))}>
          <Wrench className="size-3.5" strokeWidth={1.75} /> Create job
        </PanelButton>
        <PanelButton disabled={pending} onClick={() => start(() => actions.invoice(e.id))}>
          <Receipt className="size-3.5" strokeWidth={1.75} /> Invoice now
        </PanelButton>
      </div>
    );
  }
  if (d === "converted" && e.jobId) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <PanelLink href={`/agency/jobs/${e.jobId}`}>
          <Wrench className="size-3.5" strokeWidth={1.75} /> Open {jobNumber ?? "job"}
        </PanelLink>
      </div>
    );
  }
  return null;
}

export function EstimateOptions({ e, client, actions }: { e: Estimate; client: FieldClientRef; actions?: EstimateActions }) {
  const [pending, start] = useTransition();
  const d = estimateDisplay(e, client.today);
  const canApprove = actions && (d === "sent" || d === "expired" || d === "draft");
  return (
    <ol className="flex flex-col gap-3">
      {e.options.map((o) => {
        const chosen = e.approvedOptionId === o.id;
        const passed = e.approvedOptionId && !chosen;
        return (
          <li key={o.id} className={cn("flex flex-col gap-2", passed && "opacity-60")}>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">{o.name}</h4>
              {chosen && <StatusTag tone="green">Chosen</StatusTag>}
              <span className="num ml-auto text-sm font-semibold">{formatDollarsExact(optionTotal(o, e.taxRateBps))}</span>
            </div>
            <LineItems
              items={o.lineItems}
              taxRateBps={e.taxRateBps}
              compact
              extra={
                canApprove ? (
                  <div className="border-t border-line px-3.5 py-2">
                    <button type="button" disabled={pending} onClick={() => start(() => actions!.approve(e.id, o.id))} className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-2 hover:text-fg disabled:opacity-50">
                      <Check className="size-3.5" strokeWidth={2} />
                      {e.options.length > 1 ? `Mark ${o.name} approved` : "Mark approved"}
                    </button>
                  </div>
                ) : null
              }
            />
          </li>
        );
      })}
    </ol>
  );
}

export function EstimatePanel({ e, client, customer, jobNumber, actions, now, onClose }: { e: Estimate; client: FieldClientRef; customer?: CustomerRef; jobNumber?: string; actions: EstimateActions; now: Date; onClose?: () => void }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-line bg-surface px-5 pb-4 pt-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="num text-xs text-fg-3">{e.number}</span>
              <EstimateTag status={estimateDisplay(e, client.today)} />
            </div>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold leading-6 tracking-tight">
              <span className="truncate">{e.title}</span>
              <Link href={`/agency/estimates/${e.id}`} aria-label="Open estimate" className="text-fg-3 hover:text-fg">
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
            </p>
          </div>
          {onClose && <CloseButton onClose={onClose} />}
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-fg-2">
          <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
          {e.address}
        </p>
        <p className="num text-xs text-fg-3">{estimateStatusLine(e, client, now)}</p>
      </header>
      <div className="flex flex-col gap-6 px-5 py-5">
        <EstimateNextStep e={e} client={client} actions={actions} jobNumber={jobNumber} />
        <PanelSection title={e.options.length > 1 ? `${e.options.length} options` : "Price"}>
          <EstimateOptions e={e} client={client} actions={actions} />
        </PanelSection>
        {e.message && (
          <PanelSection title="Message to the customer">
            <p className="rounded border border-line bg-surface-2/40 px-3.5 py-2.5 text-sm leading-relaxed text-fg-2">{e.message}</p>
          </PanelSection>
        )}
        <CustomerSection customer={customer} />
      </div>
    </div>
  );
}
