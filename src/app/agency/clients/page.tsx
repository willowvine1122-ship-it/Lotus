import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { HealthBadge } from "@/components/health-badge";
import { getClientOverviews } from "@/lib/data/agency";

export const metadata = { title: "Clients" };

async function ClientList() {
  await connection();
  const overviews = await getClientOverviews();
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {overviews.map(({ account, diagnostic, openTasks }) => (
        <li key={account.id}>
          <Link
            href={`/agency/clients/${account.slug}`}
            className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2"
          >
            <div>
              <div className="font-medium">{account.name}</div>
              <div className="text-xs text-muted">
                {account.mode === "marketing" ? "Digital marketing" : "Digital fundraising"} · {openTasks} open tasks
              </div>
            </div>
            {diagnostic && <HealthBadge health={diagnostic.health} />}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ClientsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="mt-1 text-sm text-muted">Each client is its own sub-account with its own branding and mode.</p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <ClientList />
      </Suspense>
    </div>
  );
}
