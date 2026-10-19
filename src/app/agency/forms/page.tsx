import { openWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { FormsBoard, type BoardForm } from "@/components/forms/board";
import { formClients, formStats } from "@/components/forms/data";
import { Shell } from "@/components/shell";
import { listForms } from "@/lib/data/forms";

export const metadata = { title: "Forms" };

async function Board({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  await openWorkspace();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  const now = new Date();
  const clients = formClients(now);
  const forms: BoardForm[] = listForms(now).map((f) => ({
    form: { id: f.id, accountId: f.accountId, name: f.name, slug: f.slug, status: f.status, scoring: f.scoring, updatedAt: f.updatedAt, questionCount: f.questions.filter((q) => q.type !== "statement").length },
    stats: formStats(now, f),
  }));
  return <FormsBoard forms={forms} clients={clients} origin={origin} nowIso={now.toISOString()} initialClientId={clients.find((c) => c.id === client || c.slug === client)?.id} />;
}

export default function FormsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/forms">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
