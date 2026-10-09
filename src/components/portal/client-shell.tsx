import Link from "next/link";
import type { ClientRecord } from "@/lib/types";

/*
 * The client's own view. Same ink frame as the agency app so the two read as
 * one product, but the rail carries the client's name, not Lotus navigation:
 * there is nothing to navigate to yet, only their results.
 */
export function ClientShell({ client, children }: { client: ClientRecord; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="flex items-center justify-between gap-4 bg-rail px-5 py-3 text-rail-fg md:px-8">
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
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
