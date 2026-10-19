import { openWorkspace } from "@/lib/server/workspace";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ReportBuilder } from "@/components/reports/report-builder";
import { getReportConfig, reportFor } from "@/components/reports/data";
import { Shell } from "@/components/shell";
import { getClientRecord } from "@/lib/data/agency";
import { saveReportConfigAction } from "../actions";

export const metadata = { title: "Edit report" };

async function Builder({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  await openWorkspace();
  const now = new Date();
  const client = await getClientRecord(now, slug);
  if (!client) notFound();
  const config = getReportConfig(now, client.account.id)!;
  const { row, reviews } = reportFor(now, client, config);
  return <ReportBuilder client={{ id: client.account.id, name: client.account.name, slug: client.account.slug, mode: client.mode }} row={row} reviews={reviews} config={config} nowIso={now.toISOString()} save={saveReportConfigAction} />;
}

export default function ReportBuilderPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Shell current="/agency/reports">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Builder params={params} />
      </Suspense>
    </Shell>
  );
}
