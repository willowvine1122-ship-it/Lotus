import { Suspense } from "react";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { Board } from "@/components/board";
import { ButtonLink, PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { getClientOverviews } from "@/lib/data/agency";

export const metadata = { title: "Daily Diagnostic" };

const order = { red: 0, amber: 1, green: 2 } as const;

async function Diagnostic() {
  await connection();
  const now = new Date();
  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const overviews = (await getClientOverviews())
    .slice()
    .sort((a, b) => (a.diagnostic ? order[a.diagnostic.health] : 3) - (b.diagnostic ? order[b.diagnostic.health] : 3));
  const red = overviews.filter((o) => o.diagnostic?.health === "red").length;
  const amber = overviews.filter((o) => o.diagnostic?.health === "amber").length;

  return (
    <>
      <PageHeader
        title="Daily Diagnostic"
        meta={
          <span className="flex flex-wrap gap-x-3">
            <span>{date}, yesterday&apos;s numbers</span>
            <span aria-hidden>·</span>
            <span className="num">{overviews.length} clients</span>
            <span aria-hidden>·</span>
            <span className={red ? "font-medium text-red" : ""}>
              <span className="num">{red}</span> need{red === 1 ? "s" : ""} action
            </span>
            <span aria-hidden>·</span>
            <span className={amber ? "font-medium text-amber" : ""}>
              <span className="num">{amber}</span> to watch
            </span>
          </span>
        }
        actions={
          <ButtonLink href="/agency/clients/new">
            <Plus className="size-4" strokeWidth={2} />
            Add client
          </ButtonLink>
        }
      />
      <Board rows={overviews} />
    </>
  );
}

export default function AgencyHome() {
  return (
    <Shell current="/agency">
      <Suspense
        fallback={
          <PageHeader title="Daily Diagnostic" meta={<span className="text-fg-3">Loading clients…</span>} />
        }
      >
        <Diagnostic />
      </Suspense>
    </Shell>
  );
}
