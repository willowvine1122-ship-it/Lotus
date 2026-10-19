import { openWorkspace } from "@/lib/server/workspace";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft, MapPin } from "lucide-react";
import { ActivityTimeline } from "@/components/crm/contact-panel";
import { customerRefs, fieldClientRefs, jobLinks } from "@/components/field/data";
import { CancelJob, CustomerSection, JobLinksSection, JobNotesForm, JobSchedule, NextStep } from "@/components/field/job-panel";
import { LineItems } from "@/components/field/line-items";
import { JobTag, PanelSection } from "@/components/field/ui";
import { SectionTitle } from "@/components/diagnostic/primitives";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { findJob, listTechnicians } from "@/lib/data/field-store";
import { listActivities } from "@/lib/data/store";
import { formatDollarsExact } from "@/lib/utils";
import { jobValue } from "@/lib/field";
import { invoiceJobAction, saveJobNotesAction, scheduleJobAction, setJobStatusAction, unscheduleJobAction } from "../actions";

async function JobView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  await openWorkspace();
  const now = new Date();
  const job = findJob(now, id);
  if (!job) notFound();
  const client = fieldClientRefs(now).find((c) => c.id === job.accountId);
  if (!client) notFound();
  const customer = customerRefs(now, [client.id])[job.contactId];
  const links = jobLinks(now, [job], [client])[job.id] ?? {};
  const crew = listTechnicians(now, client.id);
  const actions = { schedule: scheduleJobAction, setStatus: setJobStatusAction, invoice: invoiceJobAction, unschedule: unscheduleJobAction };
  const activities = customer ? listActivities(now, customer.id) : [];
  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {job.title}
            <JobTag status={job.status} />
          </span>
        }
        meta={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/agency/jobs" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Jobs
            </Link>
            <span aria-hidden>·</span>
            <span className="num">{job.number}</span>
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
              {job.address}
            </span>
          </span>
        }
      />
      <div className="grid gap-x-10 gap-y-8 px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex max-w-[720px] flex-col gap-8">
          <NextStep job={job} links={links} actions={actions} />
          <section className="flex flex-col gap-3">
            <SectionTitle aside={<span className="num text-xs text-fg-3">{formatDollarsExact(jobValue(job))} before tax</span>}>Work</SectionTitle>
            <div className="rounded border border-line bg-surface px-4 py-2">
              <LineItems items={job.lineItems} taxRateBps={client.taxRateBps} />
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <SectionTitle sub="The crew sees these on the job.">Notes for the crew</SectionTitle>
            <JobNotesForm job={job} save={saveJobNotesAction} />
          </section>
          <section className="flex flex-col gap-3">
            <SectionTitle sub={customer ? `Everything with ${customer.name}, newest first.` : undefined}>Customer timeline</SectionTitle>
            <ActivityTimeline activities={activities.slice(0, 20)} now={now} />
          </section>
        </div>
        <aside className="flex flex-col gap-6">
          <JobSchedule job={job} client={client} crew={crew} actions={actions} />
          <JobLinksSection job={job} links={links} />
          <CustomerSection customer={customer} />
          {!links.estimate && !links.invoice && job.status !== "completed" && (
            <PanelSection title="Paperwork">
              <p className="text-xs text-fg-3">Invoice this job once it is marked complete.</p>
            </PanelSection>
          )}
          <CancelJob job={job} actions={actions} />
        </aside>
      </div>
    </>
  );
}

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell current="/agency/jobs">
      <Suspense fallback={<PageHeader title="Job" meta={<span>Loading…</span>} />}>
        <JobView params={params} />
      </Suspense>
    </Shell>
  );
}
