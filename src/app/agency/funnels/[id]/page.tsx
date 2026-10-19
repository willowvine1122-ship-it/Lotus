import { openWorkspace } from "@/lib/server/workspace";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { connection } from "next/server";
import { funnelClients } from "@/components/funnels/data";
import { FunnelOverview } from "@/components/funnels/overview";
import { Shell } from "@/components/shell";
import { findFunnel, listOrders } from "@/lib/data/store";
import {
  addStepAction,
  deleteFunnelAction,
  duplicateStepAction,
  endSplitTestAction,
  moveStepAction,
  removeStepAction,
  saveFunnelSettingsAction,
  setFunnelStatusAction,
  setSplitAction,
  startSplitTestAction,
  updateStepAction,
} from "../actions";

export const metadata = { title: "Funnel" };

async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  await openWorkspace();
  const now = new Date();
  const funnel = findFunnel(now, id);
  if (!funnel) notFound();
  const client = funnelClients(now).find((c) => c.id === funnel.accountId);
  if (!client) notFound();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  return (
    <FunnelOverview
      key={funnel.updatedAt}
      funnel={funnel}
      client={client}
      orders={listOrders(now, funnel.id)}
      nowIso={now.toISOString()}
      origin={origin}
      actions={{
        setStatus: setFunnelStatusAction,
        rename: saveFunnelSettingsAction,
        addStep: addStepAction,
        updateStep: updateStepAction,
        duplicateStep: duplicateStepAction,
        moveStep: moveStepAction,
        removeStep: removeStepAction,
        deleteFunnel: deleteFunnelAction,
        startSplit: startSplitTestAction,
        setSplit: setSplitAction,
        endSplit: endSplitTestAction,
      }}
    />
  );
}

export default function FunnelPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell current="/agency/funnels">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Overview params={params} />
      </Suspense>
    </Shell>
  );
}
