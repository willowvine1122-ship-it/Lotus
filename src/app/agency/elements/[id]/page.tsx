import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ElementBuilder } from "@/components/elements/builder";
import { elementLive, type ElementLive } from "@/components/elements/data";
import { Shell } from "@/components/shell";
import { accountFundraising } from "@/lib/data/donors";
import { clientForAccount, findElement } from "@/lib/data/elements";
import { deleteElementAction, duplicateElementAction, saveElementAction, setElementStatusAction } from "../actions";

export const metadata = { title: "Element" };

const actions = { save: saveElementAction, setStatus: setElementStatusAction, duplicate: duplicateElementAction, remove: deleteElementAction };

async function Builder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  const now = new Date();
  const e = findElement(now, id);
  if (!e) notFound();
  const client = clientForAccount(now, e.accountId);
  if (!client) notFound();
  const campaigns = accountFundraising(now, client).campaigns;
  const lives: Record<string, ElementLive> = {};
  for (const cp of campaigns) {
    const l = elementLive(now, { accountId: e.accountId, campaignId: cp.id });
    if (l) lives[cp.id] = l;
  }
  if (!Object.keys(lives).length) notFound();
  return (
    <ElementBuilder
      key={e.id}
      initial={structuredClone(e)}
      client={{ id: client.account.id, name: client.account.name, slug: client.account.slug }}
      campaigns={campaigns.map((c) => ({ id: c.id, title: c.title, status: c.status }))}
      lives={lives}
      origin={origin}
      nowIso={now.toISOString()}
      actions={actions}
    />
  );
}

export default function ElementPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell current="/agency/elements">
      <Suspense fallback={<div className="h-24 bg-rail" />}>
        <Builder params={params} />
      </Suspense>
    </Shell>
  );
}
