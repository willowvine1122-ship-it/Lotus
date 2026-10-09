import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { FunnelEditor } from "@/components/funnels/editor";
import { funnelClients } from "@/components/funnels/data";
import { Shell } from "@/components/shell";
import { findFunnel } from "@/lib/data/store";
import { addStepAction, deleteFunnelAction, moveStepAction, removeStepAction, renameFunnelAction, saveStepAction, setFunnelStatusAction } from "../actions";

export const metadata = { title: "Edit funnel" };

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const now = new Date();
  const funnel = findFunnel(now, id);
  if (!funnel) notFound();
  const client = funnelClients(now).find((c) => c.id === funnel.accountId);
  if (!client) notFound();
  return (
    <FunnelEditor
      key={funnel.updatedAt}
      funnel={funnel}
      client={client}
      nowIso={now.toISOString()}
      actions={{
        saveStep: saveStepAction,
        setStatus: setFunnelStatusAction,
        rename: renameFunnelAction,
        addStep: addStepAction,
        moveStep: moveStepAction,
        removeStep: removeStepAction,
        deleteFunnel: deleteFunnelAction,
      }}
    />
  );
}

export default function FunnelEditorPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell current="/agency/funnels">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Editor params={params} />
      </Suspense>
    </Shell>
  );
}
