import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { WorkflowBuilder } from "@/components/automations/builder";
import { automationClients, contactOptions, runRow, stepStats, tagOptions, teamNames } from "@/components/automations/data";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { findWorkflow, listRuns } from "@/lib/data/automations";
import { getPipeline } from "@/lib/data/store";
import { deleteWorkflowAction, duplicateWorkflowAction, saveWorkflowAction, setWorkflowStatusAction, testRunAction } from "../actions";

const DAY = 86400000;

async function Builder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const now = new Date();
  const workflow = findWorkflow(now, id);
  if (!workflow) notFound();
  const client = automationClients(now).find((c) => c.id === workflow.accountId);
  if (!client) notFound();
  const runs = listRuns(now, id);
  const since = new Date(now.getTime() - 30 * DAY).toISOString();
  const real = runs.filter((r) => !r.test);

  // How many contacts went down each lane of each if/else, last 30 days.
  const laneCounts: Record<string, { yes: number; no: number }> = {};
  for (const r of real) {
    if (r.startedAt < since) continue;
    for (const s of r.steps) {
      if (s.type !== "branch") continue;
      const c = (laneCounts[s.stepId] ??= { yes: 0, no: 0 });
      if (s.detail.startsWith("Yes")) c.yes++;
      else c.no++;
    }
  }

  return (
    <WorkflowBuilder
      workflow={structuredClone(workflow)}
      client={client}
      pipeline={getPipeline(now, client.id)}
      tags={tagOptions(now, client.id, workflow)}
      team={teamNames()}
      contacts={contactOptions(now, client.id)}
      stats={stepStats(now, runs)}
      laneCounts={laneCounts}
      started={real.filter((r) => r.startedAt >= since).length}
      runs={runs.length}
      testRuns={runs
        .filter((r) => r.test)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, 1)
        .map((r) => runRow(now, r))}
      nowIso={now.toISOString()}
      actions={{ save: saveWorkflowAction, setStatus: setWorkflowStatusAction, test: testRunAction, duplicate: duplicateWorkflowAction, remove: deleteWorkflowAction }}
    />
  );
}

export default function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell current="/agency/automations">
      <Suspense fallback={<PageHeader title="Workflow" meta={<span className="text-fg-3">Loading…</span>} />}>
        <Builder params={params} />
      </Suspense>
    </Shell>
  );
}
