import { openWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import { connection } from "next/server";
import { EstimatesBoard } from "@/components/field/estimates-board";
import { customerRefs, fieldClientRefs, resolveClient } from "@/components/field/data";
import { Shell } from "@/components/shell";
import { listEstimates, listJobs } from "@/lib/data/field-store";
import { approveEstimateAction, convertEstimateAction, declineEstimateAction, invoiceEstimateAction, sendEstimateAction } from "./actions";

export const metadata = { title: "Estimates" };

async function Board({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  await openWorkspace();
  const now = new Date();
  const clients = fieldClientRefs(now);
  return (
    <EstimatesBoard
      estimates={listEstimates(now)}
      clients={clients}
      customers={customerRefs(now, clients.map((c) => c.id))}
      jobNumbers={Object.fromEntries(listJobs(now).filter((j) => j.estimateId).map((j) => [j.id, j.number]))}
      initialClientId={resolveClient(clients, client)?.id}
      nowIso={now.toISOString()}
      actions={{ send: sendEstimateAction, approve: approveEstimateAction, decline: declineEstimateAction, convert: convertEstimateAction, invoice: invoiceEstimateAction }}
    />
  );
}

export default function EstimatesPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/estimates">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
