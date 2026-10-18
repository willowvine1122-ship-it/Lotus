import { openWorkspace } from "@/lib/server/workspace";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { crmClients, teamDirectory } from "@/components/crm/data";
import { fullName } from "@/components/crm/model";
import { NewOpportunityForm } from "@/components/opportunities/new-form";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { listPipelines } from "@/lib/data/opportunities";
import { listContacts } from "@/lib/data/store";
import { createOpportunityAction } from "../actions";

export const metadata = { title: "Add opportunity" };

type Params = { client?: string; pipeline?: string; contact?: string };

async function Form({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  await connection();
  await openWorkspace();
  const now = new Date();
  const clients = crmClients(now);
  const contactParam = sp.contact ? listContacts(now).find((c) => c.id === sp.contact) : undefined;
  const client = clients.find((c) => c.slug === sp.client || c.id === sp.client || c.id === contactParam?.accountId) ?? clients[0];
  if (!client) return <p className="px-6 py-10 text-sm text-fg-3">Add a client first.</p>;
  const pipelines = listPipelines(now, client.id);
  const contacts = listContacts(now, client.id)
    .map((c) => ({ id: c.id, name: fullName(c), detail: c.company ?? c.email ?? c.phone ?? "", source: c.source, ownerName: c.ownerName, valueCents: c.valueCents }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 bg-surface">
        <NewOpportunityForm
          key={client.id}
          action={createOpportunityAction}
          client={client}
          clients={clients}
          pipelines={structuredClone(pipelines)}
          contacts={contacts}
          team={teamDirectory()}
          initialPipelineId={pipelines.some((p) => p.id === sp.pipeline) ? sp.pipeline : undefined}
          initialContactId={contactParam?.accountId === client.id ? contactParam.id : undefined}
        />
      </div>
      <aside className="border-t border-line px-5 py-6 text-sm leading-relaxed text-fg-2 lg:border-l lg:border-t-0 lg:px-6">
        <h2 className="text-sm font-semibold text-fg">What happens next</h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-4">
          <li>The card lands in the stage you pick and its value joins the forecast.</li>
          <li>Workflows that start on &ldquo;Opportunity created&rdquo; run for the contact.</li>
          <li>In the primary pipeline, the contact&apos;s stage moves with it.</li>
        </ol>
      </aside>
    </div>
  );
}

export default function NewOpportunityPage({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <Shell current="/agency/opportunities">
      <PageHeader
        title="Add opportunity"
        meta={
          <Link href="/agency/opportunities" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Opportunities
          </Link>
        }
      />
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
