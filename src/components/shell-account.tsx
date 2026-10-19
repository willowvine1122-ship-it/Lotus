import Link from "next/link";
import { LogOut } from "lucide-react";
import { connection } from "next/server";
import { signOutAction } from "@/app/account/actions";
import { getSession } from "@/lib/server/auth";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/* Foot of the rail: which agency you're in, who you are, and the way out. */
export async function ShellAccount() {
  await connection();
  const s = await getSession();
  if (!s?.agency) return null;
  return (
    <div className="flex items-center gap-1 px-3 py-3">
      <Link href="/agency/settings?tab=profile" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-white/[0.05]">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-[linear-gradient(140deg,#a78bfa,#6d3df2)] text-xs font-semibold text-white">
          {initials(s.user.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-rail-fg">{s.user.name}</span>
          <span className="block truncate text-xs text-rail-fg-2">{s.agency.name}</span>
        </span>
      </Link>
      <form action={signOutAction}>
        <button type="submit" title="Sign out" aria-label="Sign out" className="grid size-8 place-items-center rounded text-rail-fg-2 hover:bg-rail-2/60 hover:text-rail-fg">
          <LogOut className="size-4" strokeWidth={1.75} />
        </button>
      </form>
    </div>
  );
}
