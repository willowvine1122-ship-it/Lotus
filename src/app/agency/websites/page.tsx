import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { WebsitesBoard } from "@/components/websites/board";
import { boardSite, websiteClients } from "@/components/websites/data";
import { Shell } from "@/components/shell";
import { listWebsites } from "@/lib/data/websites";

export const metadata = { title: "Websites" };

async function Board({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  const now = new Date();
  const clients = websiteClients(now);
  return <WebsitesBoard sites={listWebsites(now).map(boardSite)} clients={clients} origin={origin} nowIso={now.toISOString()} initialClientId={clients.find((c) => c.id === client || c.slug === client)?.id} />;
}

export default function WebsitesPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/websites">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
