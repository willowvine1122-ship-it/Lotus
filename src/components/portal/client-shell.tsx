import Link from "next/link";
import type { ClientRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * The client's own view. Same ink frame as the agency app so the two read as
 * one product, but the rail carries the client's name, not Lotus navigation.
 * Three tabs: Results, Reviews, Reports.
 */

export type PortalTab = "results" | "reviews" | "reports";
const tabs: { key: PortalTab; label: string }[] = [
  { key: "results", label: "Results" },
  { key: "reviews", label: "Reviews" },
  { key: "reports", label: "Reports" },
];

export function ClientShell({ client, tab = "results", children }: { client: ClientRecord; tab?: PortalTab; children: React.ReactNode }) {
  const base = `/c/${client.account.slug}`;
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="bg-rail text-rail-fg">
        <div className="flex items-center justify-between gap-4 px-5 pt-3 md:px-8">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="grid size-7 place-items-center rounded-[5px] bg-brand text-[13px] font-semibold text-white">
              {client.account.name.slice(0, 1)}
            </span>
            <span className="text-base font-semibold tracking-tight">{client.account.name}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-rail-fg-2">
            <span className="hidden sm:inline">Powered by Lotus</span>
            <Link href="/login" className="rounded border border-rail-line bg-rail-2 px-2.5 py-1 text-rail-fg hover:bg-rail-line">
              Sign in
            </Link>
          </div>
        </div>
        <nav aria-label="Sections" className="mt-2 flex gap-1 overflow-x-auto px-5 md:px-8">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === "results" ? base : `${base}?tab=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn("flex h-9 items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors duration-150", tab === t.key ? "border-surface text-rail-fg" : "border-transparent text-rail-fg-2 hover:text-rail-fg")}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <p className="px-5 py-4 text-xs text-fg-3 md:px-8">Demo data. Numbers are synthetic until live feeds are connected.</p>
    </div>
  );
}
