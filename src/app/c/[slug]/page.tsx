import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ClientShell } from "@/components/portal/client-shell";
import { ClientReport } from "@/components/portal/client-report";
import { buildRow } from "@/components/diagnostic/model";
import { getClientRecord } from "@/lib/data/agency";

async function Portal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  const now = new Date();
  const client = await getClientRecord(now, slug);
  if (!client) notFound();
  const row = buildRow(client, 30, now);
  return (
    <ClientShell client={client}>
      <ClientReport row={row} nowIso={now.toISOString()} />
    </ClientShell>
  );
}

export default function ClientPortalPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-rail" />}>
      <Portal params={params} />
    </Suspense>
  );
}
