import { openWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import { connection } from "next/server";
import { ReportsBoard } from "@/components/reports/reports-board";
import { listReportSends, reportClients } from "@/components/reports/data";
import { Shell } from "@/components/shell";
import { sendReportNowAction } from "./actions";

export const metadata = { title: "Reports" };

type Params = Promise<{ client?: string }>;

async function Board({ searchParams }: { searchParams: Params }) {
  const { client } = await searchParams;
  await connection();
  await openWorkspace();
  const now = new Date();
  const clients = reportClients(now);
  const initial = clients.find((c) => c.id === client || c.slug === client)?.id;
  return <ReportsBoard clients={clients} sends={listReportSends(now)} nowIso={now.toISOString()} initialClientId={initial} sendNow={sendReportNowAction} />;
}

export default function ReportsPage({ searchParams }: { searchParams: Params }) {
  return (
    <Shell current="/agency/reports">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
