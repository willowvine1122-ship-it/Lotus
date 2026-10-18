import { openWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import { connection } from "next/server";
import { crmClients, teamDirectory } from "@/components/crm/data";
import { fullName } from "@/components/crm/model";
import type { ContactRef } from "@/components/opportunities/model";
import { OpportunitiesWorkspace } from "@/components/opportunities/workspace";
import { Shell } from "@/components/shell";
import { listOpportunities, listPipelines, lostReasonsFor } from "@/lib/data/opportunities";
import { listContacts } from "@/lib/data/store";
import {
  addOpportunityNoteAction,
  bulkOpportunityAction,
  deleteOpportunityAction,
  moveOpportunityAction,
  setOpportunityStatusAction,
  updateOpportunityAction,
} from "./actions";

export const metadata = { title: "Opportunities" };

type Params = { client?: string; pipeline?: string; view?: string; opp?: string };

async function Workspace({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  await connection();
  await openWorkspace();
  const now = new Date();
  const clients = crmClients(now);
  const client = clients.find((c) => c.slug === sp.client || c.id === sp.client) ?? clients[0];
  if (!client) return <p className="px-6 py-10 text-sm text-fg-3">Add a client first.</p>;
  const pipelines = listPipelines(now, client.id);
  const pipeline = pipelines.find((p) => p.id === sp.pipeline) ?? pipelines.find((p) => p.primary) ?? pipelines[0]!;
  const all = listOpportunities(now, { accountId: client.id });
  const contacts: Record<string, ContactRef> = {};
  for (const c of listContacts(now, client.id)) contacts[c.id] = { id: c.id, name: fullName(c), email: c.email, phone: c.phone, company: c.company, city: c.city };
  const view = sp.view === "list" || sp.view === "report" ? sp.view : "board";
  return (
    <OpportunitiesWorkspace
      key={`${client.id}-${pipeline.id}`}
      client={client}
      clients={clients}
      pipeline={structuredClone(pipeline)}
      pipelines={structuredClone(pipelines)}
      opportunities={structuredClone(all.filter((o) => o.pipelineId === pipeline.id))}
      allForClient={structuredClone(all)}
      contacts={contacts}
      team={teamDirectory()}
      reasons={lostReasonsFor(now, client.id)}
      nowIso={now.toISOString()}
      initialView={view}
      initialSelected={all.some((o) => o.id === sp.opp && o.pipelineId === pipeline.id) ? sp.opp : undefined}
      actions={{
        move: moveOpportunityAction,
        setStatus: setOpportunityStatusAction,
        update: updateOpportunityAction,
        addNote: addOpportunityNoteAction,
        remove: deleteOpportunityAction,
        bulk: bulkOpportunityAction,
      }}
    />
  );
}

export default function OpportunitiesPage({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <Shell current="/agency/opportunities">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Workspace searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
