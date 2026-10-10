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
import { estimateExtras, findTemplate } from "@/lib/data/estimate-kit";
import { approvedTotal, depositFor, depositLabel } from "@/components/estimates/model";
import { formatDollarsExact } from "@/lib/utils";
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
  const ex = estimateExtras(now, e.id);
  const template = ex.templateId ? findTemplate(now, ex.templateId) : undefined;
  const chosenOption = e.options.find((o) => o.id === e.approvedOptionId);
  const signedTotal = chosenOption ? approvedTotal(chosenOption, ex, e.taxRateBps).total : undefined;
  const dueDeposit = signedTotal !== undefined ? depositFor(signedTotal, ex.depositPct) : undefined;
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
          <PanelSection title="Customer sign-off" aside={<a href={`/p/estimates/${e.id}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-fg-2 hover:text-fg hover:underline">Customer link</a>}>
            <Ledger>
              {template && (
                <LedgerRow label="Template">
                  <Link href={`/agency/estimates/templates/${template.id}`} className="hover:underline">
                    {template.name}
                  </Link>
                </LedgerRow>
              )}
              <LedgerRow label="Opened">{date(ex.viewedAt)}</LedgerRow>
              <LedgerRow label="Deposit">
                {ex.deposit ? (
                  <span className="num">
                    {formatDollarsExact(ex.deposit.amountCents)} paid <span className="text-fg-3">· {ex.deposit.reference}</span>
                  </span>
                ) : dueDeposit ? (
                  <span className="num font-medium text-amber">{formatDollarsExact(dueDeposit)} not paid yet</span>
                ) : (
                  depositLabel(ex.depositPct)
                )}
              </LedgerRow>
              <LedgerRow label="Signed">{ex.signature ? `${ex.signature.name}, ${date(ex.signature.at)}` : "–"}</LedgerRow>
              {signedTotal !== undefined && (
                <LedgerRow label="Approved total" strong>
                  <span className="num">{formatDollarsExact(signedTotal)}</span>
                </LedgerRow>
              )}
            </Ledger>
            {ex.signature?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ex.signature.image} alt={`Signature of ${ex.signature.name}`} className="mt-3 h-16 w-auto rounded border border-line bg-surface px-2" />
            )}
            {ex.signature?.ip && <p className="num mt-1.5 text-2xs text-fg-3">Signed from {ex.signature.ip}</p>}
          </PanelSection>
          {ex.addOns.length > 0 && (
            <PanelSection title="Add-ons offered">
              <ul className="flex flex-col divide-y divide-line rounded border border-line text-sm">
                {ex.addOns.map((a) => {
                  const on = ex.chosenAddOnIds.includes(a.id);
                  return (
                    <li key={a.id} className="flex items-baseline justify-between gap-3 px-3 py-2">
                      <span className={on ? "font-medium" : "text-fg-2"}>
                        {a.name}
                        {on && <span className="ml-2 text-2xs font-medium text-green">Added</span>}
                      </span>
                      <span className="num shrink-0">{formatDollarsExact(a.unitCents * a.quantity)}</span>
                    </li>
                  );
                })}
              </ul>
            </PanelSection>
          )}
          {ex.terms && (
            <PanelSection title="Terms">
              <p className="max-h-[180px] overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-fg-2">{ex.terms}</p>
            </PanelSection>
          )}
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
