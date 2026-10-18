import { openWorkspace } from "@/lib/server/workspace";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { crmClients } from "@/components/crm/data";
import { PipelineSettings } from "@/components/opportunities/pipeline-editor";
import { TopBar } from "@/components/field/ui";
import { Shell } from "@/components/shell";
import {
  listOpportunities,
  listPipelines,
  lostReasonsFor,
} from "@/lib/data/opportunities";
import {
  deletePipelineAction,
  saveLostReasonsAction,
  savePipelineAction,
} from "../actions";
import { ClientSwitch } from "./client-switch";

export const metadata = { title: "Pipelines" };

type Params = { client?: string; pipeline?: string };

async function Settings({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  await connection();
  await openWorkspace();
  const now = new Date();
  const clients = crmClients(now);
  const client =
    clients.find((c) => c.slug === sp.client || c.id === sp.client) ??
    clients[0];
  if (!client)
    return <p className="px-6 py-10 text-sm text-fg-3">Add a client first.</p>;
  const pipelines = listPipelines(now, client.id);
  const counts: Record<string, Record<string, number>> = {};
  for (const o of listOpportunities(now, { accountId: client.id })) {
    const m = (counts[o.pipelineId] ??= {});
    m[o.stageId] = (m[o.stageId] ?? 0) + 1;
  }
  return (
    <>
      <TopBar
        title="Pipelines"
        meta={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/agency/opportunities?client=${client.slug}`}
              className="inline-flex items-center gap-1 text-rail-fg hover:underline"
            >
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Opportunities
            </Link>
            <span aria-hidden>·</span>
            <span>Stages, probabilities and lost reasons</span>
          </span>
        }
      >
        <ClientSwitch clients={clients} value={client.id} />
      </TopBar>
      <PipelineSettings
        key={client.id}
        client={client}
        pipelines={structuredClone(pipelines)}
        counts={counts}
        selectedId={
          sp.pipeline === "new"
            ? "new"
            : (sp.pipeline ?? pipelines[0]?.id ?? "new")
        }
        reasons={lostReasonsFor(now, client.id)}
        actions={{
          save: savePipelineAction,
          remove: deletePipelineAction,
          saveReasons: saveLostReasonsAction,
        }}
      />
    </>
  );
}

export default function PipelinesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <Shell current="/agency/opportunities">
      <Suspense fallback={<div className="h-24 bg-rail" />}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
