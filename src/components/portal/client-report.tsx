"use client";

import { FundraisingPanel, MarketingPanel } from "@/components/diagnostic/panel";
import type { Row } from "@/components/diagnostic/model";
import { Avatar } from "@/components/diagnostic/primitives";

/*
 * What the client sees: the same numbers the agency works from, laid out as a
 * report. No internal notes, no tasks, no diagnosis text written for the team.
 */
export function ClientReport({ row, nowIso }: { row: Row; nowIso: string }) {
  const now = new Date(nowIso);
  const c = row.client;
  const range = "Last 30 days";
  return (
    <div className="mx-auto max-w-[960px] px-5 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your results</h1>
          <p className="mt-1 text-sm text-fg-3">
            {range} · updated {now.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · prepared by your Lotus team
          </p>
        </div>
      </div>

      <section className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-6">
          {row.mode === "marketing" ? <MarketingPanel row={row} now={now} /> : <FundraisingPanel row={row} now={now} />}
        </div>
        <aside className="flex h-fit flex-col gap-3 rounded border border-line bg-surface-2/50 p-4 text-sm">
          <h2 className="text-sm font-semibold">Your team</h2>
          <ul className="flex flex-col gap-2">
            {c.assignees.map((a) => (
              <li key={a.name} className="flex items-center gap-2">
                <Avatar person={a} />
                {a.name}
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-fg-3">Questions about these numbers? Reply to your weekly report email and your account manager will answer.</p>
        </aside>
      </section>
    </div>
  );
}
