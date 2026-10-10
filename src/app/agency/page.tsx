import { Suspense } from "react";
import { connection } from "next/server";
import { Diagnostic } from "@/components/diagnostic/diagnostic";
import { Shell } from "@/components/shell";
import { getClientRecords } from "@/lib/data/agency";

export const metadata = { title: "Daily Diagnostic" };

async function Board() {
  await connection();
  const now = new Date();
  const clients = await getClientRecords(now);
  return <Diagnostic clients={clients} nowIso={now.toISOString()} />;
}

export default function AgencyHome() {
  return (
    <Shell current="/agency">
      <Suspense
        fallback={
          <header className="bg-rail px-5 py-3 text-rail-fg md:px-6">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">Daily Diagnostic</h1>
            <p className="text-xs text-rail-fg-2">Loading clients…</p>
          </header>
        }
      >
        <Board />
      </Suspense>
    </Shell>
  );
}
