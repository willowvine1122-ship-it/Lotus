import { Suspense } from "react";
import { connection } from "next/server";
import { CampaignsBoard } from "@/components/email/campaigns-board";
import { campaignRows, emailClients } from "@/components/email/data";
import { Shell } from "@/components/shell";
import { duplicateCampaignAction } from "./actions";

export const metadata = { title: "Email" };

async function Board({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  const now = new Date();
  const clients = emailClients(now);
  const initial = clients.find((c) => c.id === client || c.slug === client)?.id;
  return <CampaignsBoard rows={campaignRows(now)} clients={clients} nowIso={now.toISOString()} initialClientId={initial} actions={{ duplicate: duplicateCampaignAction }} />;
}

export default function EmailPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/email">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
