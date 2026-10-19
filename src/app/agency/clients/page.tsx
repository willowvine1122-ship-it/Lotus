import { openWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import { connection } from "next/server";
import { ClientsTable } from "@/components/clients/clients-table";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { getClientRecords } from "@/lib/data/agency";

export const metadata = { title: "Clients" };

async function ClientList() {
  await connection();
  await openWorkspace();
  const now = new Date();
  const clients = await getClientRecords(now);
  const marketing = clients.filter((c) => c.mode === "marketing").length;
  const onboarding = clients.filter((c) => c.status === "onboarding").length;
  const meta = `${clients.length} sub-accounts · ${marketing} marketing · ${clients.length - marketing} fundraising${onboarding > 0 ? ` · ${onboarding} onboarding` : ""}`;
  return <ClientsTable clients={clients} nowIso={now.toISOString()} meta={meta} />;
}

export default function ClientsPage() {
  return (
    <Shell current="/agency/clients">
      <Suspense fallback={<PageHeader title="Clients" meta={<span className="text-fg-3">Loading…</span>} />}>
        <ClientList />
      </Suspense>
    </Shell>
  );
}
