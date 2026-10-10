import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { ElementsBoard, type BoardElement } from "@/components/elements/board";
import { elementLive, elementStats, type ElementLive } from "@/components/elements/data";
import { Shell } from "@/components/shell";
import { campaignFor, clientForAccount, elementGifts, listElements } from "@/lib/data/elements";
import { fundraisingClients } from "@/lib/data/donors";

export const metadata = { title: "Elements" };

async function Board({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  const now = new Date();
  const clients = fundraisingClients(now)
    .map((c) => ({ id: c.account.id, name: c.account.name, slug: c.account.slug }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const lives: Record<string, ElementLive> = {};
  const items: BoardElement[] = [];
  for (const e of listElements(now)) {
    const found = campaignFor(now, e);
    const owner = clientForAccount(now, e.accountId);
    if (!found || !owner) continue;
    lives[found.campaign.id] ??= elementLive(now, e)!;
    items.push({
      element: { id: e.id, accountId: e.accountId, campaignId: found.campaign.id, type: e.type, name: e.name, status: e.status, updatedAt: e.updatedAt, config: e.config },
      clientName: owner.account.name,
      clientSlug: owner.account.slug,
      campaignTitle: found.campaign.title,
      stats: elementStats(now, e.id),
      gifts: elementGifts(now, e.id, 5),
    });
  }
  return <ElementsBoard items={items} lives={lives} clients={clients} origin={origin} nowIso={now.toISOString()} initialClientId={clients.find((c) => c.id === client || c.slug === client)?.id} />;
}

export default function ElementsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/elements">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
