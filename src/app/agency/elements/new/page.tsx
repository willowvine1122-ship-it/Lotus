import { Suspense } from "react";
import { connection } from "next/server";
import { elementLive, type ElementLive } from "@/components/elements/data";
import { NewElement, type PickerClient } from "@/components/elements/new-element";
import { Shell } from "@/components/shell";
import { accountFundraising, fundraisingClients } from "@/lib/data/donors";
import { elementKinds } from "@/lib/elements";
import type { DonationElementType } from "@/lib/types";
import { createElementAction } from "../actions";

export const metadata = { title: "New element" };

async function Picker({ searchParams }: { searchParams: Promise<{ client?: string; type?: string }> }) {
  const { client, type } = await searchParams;
  await connection();
  const now = new Date();
  const lives: Record<string, ElementLive> = {};
  const clients: PickerClient[] = fundraisingClients(now)
    .map((c) => {
      const data = accountFundraising(now, c);
      const campaigns = [...data.campaigns].sort((a, b) => Number(a.status !== "live") - Number(b.status !== "live"));
      for (const cp of campaigns) {
        const l = elementLive(now, { accountId: c.account.id, campaignId: cp.id });
        if (l) lives[cp.id] = l;
      }
      return { id: c.account.id, name: c.account.name, slug: c.account.slug, campaigns: campaigns.map((cp) => ({ id: cp.id, title: cp.title, status: cp.status })) };
    })
    .filter((c) => c.campaigns.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const initialClientId = clients.find((c) => c.id === client || (c as PickerClient & { slug: string }).slug === client)?.id;
  const initialType = elementKinds.find((k) => k.type === type)?.type as DonationElementType | undefined;
  return <NewElement clients={clients} lives={lives} initialClientId={initialClientId} initialType={initialType} nowIso={now.toISOString()} action={createElementAction} />;
}

export default function NewElementPage({ searchParams }: { searchParams: Promise<{ client?: string; type?: string }> }) {
  return (
    <Shell current="/agency/elements">
      <Suspense fallback={<div className="h-24 bg-rail" />}>
        <Picker searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
