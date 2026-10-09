import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { ButtonLink, PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { StatusChip } from "@/components/status";
import { getClientOverviews } from "@/lib/data/agency";

export const metadata = { title: "Clients" };

async function ClientList() {
  await connection();
  const overviews = await getClientOverviews();
  return (
    <>
      <PageHeader
        title="Clients"
        meta={<span className="num">{overviews.length} sub-accounts</span>}
        actions={
          <ButtonLink href="/agency/clients/new">
            <Plus className="size-4" strokeWidth={2} />
            Add client
          </ButtonLink>
        }
      />
      <div className="bg-surface">
        <div className="hidden grid-cols-[minmax(200px,1.5fr)_140px_120px_80px] gap-x-4 border-b border-line px-5 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 md:grid md:px-8">
          <span>Client</span>
          <span>Mode</span>
          <span>Status</span>
          <span className="text-right">Tasks</span>
        </div>
        <ol>
          {overviews.map(({ account, diagnostic, openTasks }) => (
            <li key={account.id} className="border-b border-line">
              <Link
                href={`/agency/clients/${account.slug}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors duration-150 hover:bg-surface-2/70 md:grid-cols-[minmax(200px,1.5fr)_140px_120px_80px] md:px-8"
              >
                <span className="text-base font-medium">{account.name}</span>
                <span className="order-3 text-xs text-fg-3 md:order-none md:text-sm md:text-fg-2">
                  {account.mode === "marketing" ? "Digital marketing" : "Digital fundraising"}
                </span>
                <span className="justify-self-end md:justify-self-start">
                  {diagnostic ? <StatusChip health={diagnostic.health} /> : <span className="text-xs text-fg-3">No data</span>}
                </span>
                <span className="num hidden text-right text-sm md:block">{openTasks}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
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
