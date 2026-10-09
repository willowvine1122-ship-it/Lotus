import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ClientShell, type PortalTab } from "@/components/portal/client-shell";
import { ClientReport } from "@/components/portal/client-report";
import { ClientReviews } from "@/components/portal/client-reviews";
import { ClientReportPage } from "@/components/portal/client-report-page";
import { buildRow } from "@/components/diagnostic/model";
import { getReportConfig, listReportSends, reportFor } from "@/components/reports/data";
import { getClientRecord } from "@/lib/data/agency";
import { listReviews } from "@/lib/data/store";

type Params = Promise<{ slug: string }>;
type Search = Promise<{ tab?: string }>;

async function Portal({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const { tab: raw } = await searchParams;
  await connection();
  const now = new Date();
  const client = await getClientRecord(now, slug);
  if (!client) notFound();
  const tab: PortalTab = raw === "reviews" || raw === "reports" ? raw : "results";
  const nowIso = now.toISOString();
  return (
    <ClientShell client={client} tab={tab}>
      {tab === "results" && <ClientReport row={buildRow(client, 30, now)} nowIso={nowIso} />}
      {tab === "reviews" && <ClientReviews reviews={listReviews(now, client.account.id)} nowIso={nowIso} />}
      {tab === "reports" && (() => {
        const config = getReportConfig(now, client.account.id)!;
        const { row, reviews } = reportFor(now, client, config);
        return <ClientReportPage row={row} config={config} reviews={reviews} sends={listReportSends(now, client.account.id)} nowIso={nowIso} />;
      })()}
    </ClientShell>
  );
}

export default function ClientPortalPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-rail" />}>
      <Portal params={params} searchParams={searchParams} />
    </Suspense>
  );
}
