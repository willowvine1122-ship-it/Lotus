import { Suspense } from "react";
import { connection } from "next/server";
import { ReputationBoard } from "@/components/reputation/reputation-board";
import { listContacts, listReviewRequests, listReviews, reputationClients, reputationSettingsFor } from "@/components/reputation/data";
import { Shell } from "@/components/shell";
import { replyToReviewAction, sendRequestAction, updateSettingsAction } from "./actions";

export const metadata = { title: "Reputation" };

type Params = Promise<{ client?: string; view?: string }>;

async function Board({ searchParams }: { searchParams: Params }) {
  const { client, view } = await searchParams;
  await connection();
  const now = new Date();
  const clients = reputationClients(now);
  const initial = clients.find((c) => c.id === client || c.slug === client)?.id;
  return (
    <ReputationBoard
      reviews={listReviews(now)}
      requests={listReviewRequests(now)}
      contacts={listContacts(now)}
      clients={clients}
      settings={reputationSettingsFor(now, clients)}
      nowIso={now.toISOString()}
      initialView={view === "requests" ? "requests" : "reviews"}
      initialClientId={initial}
      actions={{ reply: replyToReviewAction, sendRequest: sendRequestAction, updateSettings: updateSettingsAction }}
    />
  );
}

export default function ReputationPage({ searchParams }: { searchParams: Params }) {
  return (
    <Shell current="/agency/reputation">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
