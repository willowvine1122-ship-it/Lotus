import { Suspense } from "react";
import { connection } from "next/server";
import { WorkflowsBoard } from "@/components/automations/workflows-board";
import { automationClients, automationPipelines, workflowRows } from "@/components/automations/data";
import { Shell } from "@/components/shell";
import { duplicateWorkflowAction, quickStatusAction } from "./actions";

export const metadata = { title: "Automations" };

async function Board({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  const now = new Date();
  const clients = automationClients(now);
  const initial = clients.find((c) => c.id === client || c.slug === client)?.id;
  return (
    <WorkflowsBoard
      rows={workflowRows(now)}
      clients={clients}
      pipelines={automationPipelines(now, clients)}
      nowIso={now.toISOString()}
      initialClientId={initial}
      actions={{ setStatus: quickStatusAction, duplicate: duplicateWorkflowAction }}
    />
  );
}

export default function AutomationsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/automations">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
