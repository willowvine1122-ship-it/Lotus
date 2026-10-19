import { openWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import { connection } from "next/server";
import { AudiencesBoard } from "@/components/email/audiences-board";
import { audienceRows, contactsLite, emailClients, pipelinesFor } from "@/components/email/data";
import { Shell } from "@/components/shell";
import { deleteAudienceAction, saveAudienceAction } from "../actions";

export const metadata = { title: "Audiences" };

async function Board({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  await openWorkspace();
  const now = new Date();
  const clients = emailClients(now);
  const initial = clients.find((c) => c.id === client || c.slug === client)?.id;
  return (
    <AudiencesBoard
      rows={audienceRows(now)}
      clients={clients}
      contacts={contactsLite(now)}
      pipelines={pipelinesFor(now, clients)}
      nowIso={now.toISOString()}
      initialClientId={initial}
      actions={{ save: saveAudienceAction, remove: deleteAudienceAction }}
    />
  );
}

export default function AudiencesPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/email">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
