import { Suspense } from "react";
import { connection } from "next/server";
import { crmActivities, crmClients, crmPipelines, listContacts, teamDirectory } from "@/components/crm/data";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { Shell } from "@/components/shell";
import { logActivityAction, moveStageAction, toggleDndAction } from "../actions";

export const metadata = { title: "Pipeline" };

async function Board({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client: param } = await searchParams;
  await connection();
  const now = new Date();
  const clients = crmClients(now);
  const client = clients.find((c) => c.slug === param || c.id === param) ?? clients[0];
  if (!client) return <p className="px-6 py-10 text-sm text-fg-3">Add a client first.</p>;
  const pipelines = crmPipelines(now, [client]);
  const contacts = listContacts(now, client.id);
  return (
    <PipelineBoard
      client={client}
      clients={clients}
      pipeline={pipelines[client.id]!}
      contacts={contacts}
      activities={crmActivities(now, contacts.map((c) => c.id))}
      team={teamDirectory}
      nowIso={now.toISOString()}
      actions={{ moveStage: moveStageAction, logActivity: logActivityAction, toggleDnd: toggleDndAction }}
    />
  );
}

export default function PipelinePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/contacts">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
