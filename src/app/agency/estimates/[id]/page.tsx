import { estimateStatusLine } from "@/components/field/status-lines";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft, MapPin } from "lucide-react";
import { ActivityTimeline } from "@/components/crm/contact-panel";
import { SectionTitle } from "@/components/diagnostic/primitives";
import { customerRefs, fieldClientRefs } from "@/components/field/data";
import { EstimateNextStep, EstimateOptions } from "@/components/field/estimate-panel";
import { CustomerSection } from "@/components/field/job-panel";
import { EstimateTag, Ledger, LedgerRow, PanelSection } from "@/components/field/ui";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { findEstimate, findJob } from "@/lib/data/field-store";
import { listActivities } from "@/lib/data/store";
import { estimateDisplay, formatDay, formatTaxRate } from "@/lib/field";
import { approveEstimateAction, convertEstimateAction, declineEstimateAction, invoiceEstimateAction, sendEstimateAction } from "../actions";

async function EstimateView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const now = new Date();
  const e = findEstimate(now, id);
  if (!e) notFound();
  const client = fieldClientRefs(now).find((c) => c.id === e.accountId);
  if (!client) notFound();
  const customer = customerRefs(now, [client.id])[e.contactId];
  const job = e.jobId ? findJob(now, e.jobId) : undefined;
  const actions = { send: sendEstimateAction, approve: approveEstimateAction, decline: declineEstimateAction, convert: convertEstimateAction, invoice: invoiceEstimateAction };
  const activities = customer ? listActivities(now, customer.id).filter((a) => a.kind !== "stage") : [];
  const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "–");
  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {e.title}
            <EstimateTag status={estimateDisplay(e, client.today)} />
          </span>
        }
        meta={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/agency/estimates" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Estimates
            </Link>
            <span aria-hidden>·</span>
            <span className="num">{e.number}</span>
            <span aria-hidden>·</span>
            <Link href={`/agency/clients/${client.slug}`} className="hover:underline">
              {client.name}
            </Link>
            {customer && (
              <>
                <span aria-hidden>·</span>
                <Link href={`/agency/contacts/${customer.id}`} className="hover:underline">
                  {customer.name}
                </Link>
              </>
            )}
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" strokeWidth={1.75} />
              {e.address}
            </span>
          </span>
        }
      />
      <div className="grid gap-x-10 gap-y-8 px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex max-w-[720px] flex-col gap-8">
          <div className="flex flex-col gap-2">
            <p className="num text-sm text-fg-2">{estimateStatusLine(e, client, now)}</p>
            <EstimateNextStep e={e} client={client} actions={actions} jobNumber={job?.number} />
          </div>
          {e.message && <p className="max-w-[72ch] border-l border-line-strong pl-4 text-sm leading-relaxed text-fg-2">{e.message}</p>}
          <section className="flex flex-col gap-3">
            <SectionTitle sub={e.options.length > 1 ? "The customer picks one. Totals include tax." : "Total includes tax."}>{e.options.length > 1 ? `${e.options.length} options` : "Price"}</SectionTitle>
            <EstimateOptions e={e} client={client} actions={actions} />
          </section>
          <section className="flex flex-col gap-3">
            <SectionTitle sub={customer ? `Everything with ${customer.name}, newest first.` : undefined}>Customer timeline</SectionTitle>
            <ActivityTimeline activities={activities.slice(0, 20)} now={now} />
          </section>
        </div>
        <aside className="flex flex-col gap-6">
          <PanelSection title="Dates">
            <Ledger>
              <LedgerRow label="Created">{date(e.createdAt)}</LedgerRow>
              <LedgerRow label="Sent">{date(e.sentAt)}</LedgerRow>
              <LedgerRow label="Valid until">{formatDay(e.expiresOn, { month: "short", day: "numeric", year: "numeric" })}</LedgerRow>
              <LedgerRow label={e.status === "declined" ? "Declined" : "Approved"}>{date(e.decidedAt)}</LedgerRow>
              <LedgerRow label="Tax rate">
                <span className="num">{formatTaxRate(e.taxRateBps)}</span>
              </LedgerRow>
            </Ledger>
          </PanelSection>
          {job && (
            <PanelSection title="Job">
              <Ledger>
                <LedgerRow label="Job">
                  <Link href={`/agency/jobs/${job.id}`} className="num hover:underline">
                    {job.number} · {job.title}
                  </Link>
                </LedgerRow>
              </Ledger>
            </PanelSection>
          )}
          <CustomerSection customer={customer} />
        </aside>
      </div>
    </>
  );
}

export default function EstimatePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell current="/agency/estimates">
      <Suspense fallback={<PageHeader title="Estimate" meta={<span>Loading…</span>} />}>
        <EstimateView params={params} />
      </Suspense>
    </Shell>
  );
}
