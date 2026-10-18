import { openWorkspace } from "@/lib/server/workspace";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { RunsBoard, type RunView } from "@/components/automations/runs-board";
import { WorkflowHeader } from "@/components/automations/workflow-header";
import { automationClients, runRow } from "@/components/automations/data";
import { findStep, flatten, stepSummary, triggerLabel } from "@/components/automations/model";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { findWorkflow, listRuns } from "@/lib/data/automations";
import { getPipeline } from "@/lib/data/store";
import { formatCount } from "@/lib/utils";
import { stopRunAction } from "../../actions";

async function Runs({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
  const { id } = await params;
  const { run } = await searchParams;
  await connection();
  await openWorkspace();
  const now = new Date();
  const workflow = findWorkflow(now, id);
  if (!workflow) notFound();
  const client = automationClients(now).find((c) => c.id === workflow.accountId);
  if (!client) notFound();
  const pipeline = getPipeline(now, client.id);
  const runs = listRuns(now, id);
  const views: RunView[] = runs.map((r) => ({
    ...runRow(now, r),
    upcoming: r.status === "waiting"
      ? r.pending.flatMap((sid) => {
          const s = findStep(workflow.steps, sid);
          return s ? [{ type: s.type, summary: stepSummary(s, pipeline, client.mode) }] : [];
        })
      : [],
  }));
  const waiting = runs.filter((r) => r.status === "waiting" && !r.test).length;
  return (
    <div className="flex min-h-screen flex-col">
      <WorkflowHeader
        id={workflow.id}
        name={workflow.name}
        status={workflow.status}
        client={client}
        tab="runs"
        runs={runs.length}
        meta={
          <span className="num">
            {triggerLabel[workflow.trigger.type]} · {formatCount(runs.filter((r) => !r.test).length)} runs · {formatCount(waiting)} waiting now
          </span>
        }
      />
      <RunsBoard runs={views} totalSteps={flatten(workflow.steps).length} initialRunId={run} nowIso={now.toISOString()} stop={stopRunAction} />
    </div>
  );
}

export default function RunsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
  return (
    <Shell current="/agency/automations">
      <Suspense fallback={<PageHeader title="Runs" meta={<span className="text-fg-3">Loading…</span>} />}>
        <Runs params={params} searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
