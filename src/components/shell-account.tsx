import Link from "next/link";
import { LogOut } from "lucide-react";
import { connection } from "next/server";
import { signOutAction } from "@/app/account/actions";
import { getSession } from "@/lib/server/auth";

/* Foot of the rail: which agency you're in, who you are, and the way out. */
export async function ShellAccount() {
  await connection();
  const s = await getSession();
  if (!s?.agency) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-3">
      <Link href="/agency/settings?tab=profile" className="min-w-0 flex-1 rounded px-2 py-1 hover:bg-rail-2/60">
        <div className="truncate text-sm font-medium text-rail-fg">{s.agency.name}</div>
        <div className="truncate text-xs text-rail-fg-2">{s.user.name}</div>
      </Link>
      <form action={signOutAction}>
        <button type="submit" title="Sign out" aria-label="Sign out" className="grid size-8 place-items-center rounded text-rail-fg-2 hover:bg-rail-2/60 hover:text-rail-fg">
          <LogOut className="size-4" strokeWidth={1.75} />
        </button>
      </form>
    </div>
  );
}
