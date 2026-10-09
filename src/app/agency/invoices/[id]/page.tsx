import { dueLine } from "@/components/field/status-lines";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { customerRefs, fieldClientRefs } from "@/components/field/data";
import { DocumentSheet } from "@/components/field/document";
import { InvoiceNextStep, MoneyLedger, PaymentForm, Payments } from "@/components/field/invoice-panel";
import { CustomerSection } from "@/components/field/job-panel";
import { InvoiceTag, PanelSection } from "@/components/field/ui";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { findInvoice, findJob } from "@/lib/data/field-store";
import { findClient } from "@/lib/data/store";
import { invoiceDisplay, invoiceMoney } from "@/lib/field";
import { cn } from "@/lib/utils";
import { recordPaymentAction, sendInvoiceAction, voidInvoiceAction } from "../actions";

async function InvoiceView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const now = new Date();
  const inv = findInvoice(now, id);
  if (!inv) notFound();
  const client = fieldClientRefs(now).find((c) => c.id === inv.accountId);
  const rec = findClient(now, inv.accountId);
  if (!client || !rec) notFound();
  const customer = customerRefs(now, [client.id])[inv.contactId];
  const job = inv.jobId ? findJob(now, inv.jobId) : undefined;
  const d = invoiceDisplay(inv, client.today);
  const actions = { send: sendInvoiceAction, void: voidInvoiceAction, recordPayment: recordPaymentAction };
  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {inv.title}
            <InvoiceTag status={d} />
          </span>
        }
        meta={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/agency/invoices" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Invoices
            </Link>
            <span aria-hidden>·</span>
            <span className="num">{inv.number}</span>
            <span aria-hidden>·</span>
            <Link href={`/agency/clients/${client.slug}`} className="hover:underline">
              {client.name}
            </Link>
            {job && (
              <>
                <span aria-hidden>·</span>
                <Link href={`/agency/jobs/${job.id}`} className="num hover:underline">
                  {job.number}
                </Link>
              </>
            )}
            <span aria-hidden>·</span>
            <span className={cn("num", d === "overdue" && "font-medium text-red-soft")}>{dueLine(inv, client.today, now)}</span>
          </span>
        }
      />
      <div className="grid gap-x-10 gap-y-8 px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="max-w-[760px]">
          <DocumentSheet
            kind="Invoice"
            number={inv.number}
            business={{ name: rec.account.name, location: rec.location }}
            billTo={{ name: customer?.name ?? "Customer", email: customer?.email, phone: customer?.phone }}
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
        <aside className="flex flex-col gap-6">
          <InvoiceNextStep inv={inv} today={client.today} actions={actions} />
          <MoneyLedger inv={inv} />
          {invoiceMoney(inv).balance > 0 && inv.status !== "void" && (
            <PanelSection title="Take a payment">
              <PaymentForm key={inv.payments.length} inv={inv} record={recordPaymentAction} />
            </PanelSection>
          )}
          <PanelSection title="Payments">
            <Payments inv={inv} now={now} />
          </PanelSection>
          <CustomerSection customer={customer} />
        </aside>
      </div>
    </>
  );
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell current="/agency/invoices">
      <Suspense fallback={<PageHeader title="Invoice" meta={<span>Loading…</span>} />}>
        <InvoiceView params={params} />
      </Suspense>
    </Shell>
  );
}
