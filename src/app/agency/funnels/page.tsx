import { openWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { FunnelsBoard } from "@/components/funnels/funnels-board";
import { funnelClients, listFunnels, listSubmissions } from "@/components/funnels/data";
import { Shell } from "@/components/shell";
import { setFunnelStatusAction } from "./actions";

export const metadata = { title: "Funnels" };

async function Board({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  await openWorkspace();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  const now = new Date();
  const clients = funnelClients(now);
  const funnels = listFunnels(now);
  const submissions = funnels.flatMap((f) => listSubmissions(now, f.id));
  return (
    <FunnelsBoard
      funnels={funnels}
      submissions={submissions}
      clients={clients}
      nowIso={now.toISOString()}
      origin={origin}
      initialClientId={clients.find((c) => c.id === client || c.slug === client)?.id}
      actions={{ setStatus: setFunnelStatusAction }}
    />
  );
}

export default function FunnelsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/funnels">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
