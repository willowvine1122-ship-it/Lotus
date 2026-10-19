import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { signOutAction } from "@/app/account/actions";
import { AuthFrame } from "@/components/account/auth-frame";
import { listClients } from "@/lib/data/store";
import { requireSession } from "@/lib/server/auth";
import { openAgencyWorkspace } from "@/lib/server/workspace";

export const metadata = { title: "Your dashboard" };

/* Where a client login lands: straight into their dashboard, or a pick list when they can see more than one account. */
async function Body() {
  await connection();
  const s = await requireSession();
  if (s.role !== "client") redirect("/agency");
  await openAgencyWorkspace(s.agency.id, s);
  const mine = listClients(new Date()).filter((c) => s.accountIds.includes(c.account.id));
  if (mine.length === 1) redirect(`/c/${mine[0]!.account.slug}`);
  return (
    <>
      {mine.length === 0 ? (
        <p className="text-sm text-fg-2">Your login isn&apos;t linked to an account yet. Ask {s.agency.name} to give you access.</p>
      ) : (
        <ul className="border-t border-line">
          {mine.map((c) => (
            <li key={c.account.id} className="border-b border-line">
              <Link href={`/c/${c.account.slug}`} className="flex h-12 items-center justify-between text-sm font-medium hover:text-brand">
                {c.account.name}
                <span aria-hidden className="text-fg-3">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <form action={signOutAction} className="mt-6">
        <button type="submit" className="text-sm text-fg-3 underline hover:text-fg">
          Sign out
        </button>
      </form>
    </>
  );
}

export default function PortalPage() {
  return (
    <AuthFrame title="Your dashboards">
      <Suspense fallback={<div className="h-24" />}>
        <Body />
      </Suspense>
    </AuthFrame>
  );
}
