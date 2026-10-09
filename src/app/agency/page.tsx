import { Suspense } from "react";
import { connection } from "next/server";
import { DiagnosticCard } from "@/components/diagnostic-card";
import { getClientOverviews } from "@/lib/data/agency";

export const metadata = { title: "Daily Diagnostic" };

async function Board() {
  await connection();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const overviews = await getClientOverviews();
  const needsAction = overviews.filter((o) => o.diagnostic?.health === "red").length;
  const watch = overviews.filter((o) => o.diagnostic?.health === "amber").length;

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3 text-sm text-muted">
        <span>{today}</span>
        <span>·</span>
        <span>{overviews.length} clients</span>
        <span>·</span>
        <span className={needsAction ? "text-red" : ""}>{needsAction} need action</span>
        <span>·</span>
        <span className={watch ? "text-amber" : ""}>{watch} to watch</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {overviews
          .slice()
          .sort((a, b) => rank(a) - rank(b))
          .map((o) => (
            <DiagnosticCard key={o.account.id} overview={o} />
          ))}
      </div>
    </>
  );
}

const order = { red: 0, amber: 1, green: 2 } as const;
function rank(o: Awaited<ReturnType<typeof getClientOverviews>>[number]) {
  return o.diagnostic ? order[o.diagnostic.health] : 3;
}

export default function AgencyHome() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Daily Diagnostic</h1>
        <p className="mt-1 text-sm text-muted">Every client, yesterday&apos;s numbers, what needs attention.</p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">Loading clients…</p>}>
        <Board />
      </Suspense>
    </div>
  );
}
