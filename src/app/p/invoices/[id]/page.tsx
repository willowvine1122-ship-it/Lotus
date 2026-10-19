import { openPublicWorkspace } from "@/lib/server/workspace";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { CustomerShell, PayInvoice } from "@/components/field/customer-views";
import { DocumentSheet } from "@/components/field/document";
import { findInvoice, findJob } from "@/lib/data/field-store";
import { findClient, findContact } from "@/lib/data/store";
import { formatDay, invoiceDisplay, invoiceMoney, localDate } from "@/lib/field";
import { formatDollarsExact } from "@/lib/utils";
import { payInvoiceAction } from "@/app/agency/invoices/actions";

export const metadata = { title: "Your invoice" };

async function View({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  if (!(await openPublicWorkspace(`invoice:${id}`))) notFound();
  const now = new Date();
  const inv = findInvoice(now, id);
  const client = inv ? findClient(now, inv.accountId) : undefined;
  if (!inv || !client || inv.status === "draft") notFound();
  const contact = findContact(now, inv.contactId);
  const job = inv.jobId ? findJob(now, inv.jobId) : undefined;
  const m = invoiceMoney(inv);
  const d = invoiceDisplay(inv, localDate(now, client.timeZone));
  return (
    <CustomerShell business={client.account.name}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="num text-xs text-fg-3">Invoice {inv.number}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{inv.title}</h1>
            <p className="mt-1 text-sm text-fg-2">
              {d === "void" ? "This invoice was cancelled. Nothing is owed." : d === "paid" ? "Paid in full. Thank you." : d === "overdue" ? `Was due ${formatDay(inv.dueOn, { month: "long", day: "numeric" })}.` : `Due ${formatDay(inv.dueOn, { month: "long", day: "numeric" })}.`}
            </p>
          </div>
          {d !== "void" && (
            <div className="text-right">
              <p className="text-xs text-fg-3">Balance due</p>
              <p className="num text-2xl font-semibold tracking-tight">{formatDollarsExact(m.balance)}</p>
            </div>
          )}
        </div>
        {d !== "void" && <PayInvoice id={inv.id} balanceCents={m.balance} pay={payInvoiceAction} />}
        <DocumentSheet
          kind="Invoice"
          number={inv.number}
          business={{ name: client.account.name, location: client.location }}
          billTo={{ name: contact ? `${contact.firstName} ${contact.lastName}` : "Customer", email: contact?.email }}
          address={job?.address}
          dates={[
            { label: "Issued", day: inv.issuedOn },
            { label: "Due", day: inv.dueOn },
          ]}
          items={inv.lineItems}
          taxRateBps={inv.taxRateBps}
          memo={inv.memo}
        />
      </div>
    </CustomerShell>
  );
}

export default function CustomerInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <View params={params} />
    </Suspense>
  );
}
