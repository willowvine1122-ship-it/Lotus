"use client";

import { Avatar } from "@/components/diagnostic/primitives";
import { personFor, sourceLabel } from "@/components/crm/model";
import type { Assignee, Opportunity, Pipeline } from "@/lib/types";
import { cn, formatCount, formatDollars, formatDollarsCompact, formatRate } from "@/lib/utils";
import { stageDurations, sumValue, weighted, winRate } from "./model";

/*
 * Pipeline report: how deals move through the stages, where they are lost,
 * which sources and owners win, and what is expected to close by month.
 * Tables on white with hairlines, bars in the one series colour.
 */

function Section({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {sub && <p className="text-xs text-fg-3">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Bar({ share }: { share: number }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-[2px] bg-surface-2">
      <span className="block h-full rounded-[2px] bg-chart-1" style={{ width: `${Math.max(share > 0 ? 2 : 0, Math.min(100, share * 100))}%` }} />
    </span>
  );
}

const th = "whitespace-nowrap px-3 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-0 last:pr-0";
const td = "px-3 py-2.5 first:pl-0 last:pr-0";

export function PipelineReport({ pipeline, opportunities, team, reasons, now }: { pipeline: Pipeline; opportunities: Opportunity[]; team: Assignee[]; reasons: string[]; now: Date }) {
  const open = pipeline.stages.filter((s) => !s.outcome);
  const won = pipeline.stages.find((s) => s.outcome === "won");

  // Funnel: an opportunity "reached" a stage if its history entered it or any later open stage, or it was won.
  const order = new Map(open.map((s, i) => [s.id, i]));
  const furthest = (o: Opportunity) => {
    if (o.status === "won") return open.length;
    let max = -1;
    for (const e of o.history) if (e.stageId && order.has(e.stageId)) max = Math.max(max, order.get(e.stageId)!);
    return max;
  };
  const reach = opportunities.map(furthest);
  const durations = opportunities.map((o) => stageDurations(o, now));
  const funnel = [...open, ...(won ? [won] : [])].map((s, i) => {
    const reached = reach.filter((r) => r >= i).length;
    const nowIn = opportunities.filter((o) => o.stageId === s.id && (s.outcome ? true : o.status === "open"));
    const spent = durations.map((d) => d.get(s.id)).filter((x): x is number => x !== undefined);
    return { stage: s, reached, nowIn, avgDays: spent.length ? spent.reduce((a, b) => a + b, 0) / spent.length : null };
  });
  const top = funnel[0]?.reached || 1;
  const maxNowValue = Math.max(1, ...funnel.map((f) => sumValue(f.nowIn)));

  // Lost reasons.
  const lost = opportunities.filter((o) => o.status === "lost");
  const byReason = [...new Set([...reasons, ...lost.map((o) => o.lostReason ?? "No reason given")])]
    .map((r) => ({ reason: r, count: lost.filter((o) => (o.lostReason ?? "No reason given") === r).length, value: sumValue(lost.filter((o) => (o.lostReason ?? "No reason given") === r)) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  // Sources.
  const sources = [...new Set(opportunities.map((o) => o.source))]
    .map((src) => {
      const os = opportunities.filter((o) => o.source === src);
      const w = os.filter((o) => o.status === "won");
      const l = os.filter((o) => o.status === "lost");
      return { src, total: os.length, won: w.length, lost: l.length, rate: w.length + l.length ? w.length / (w.length + l.length) : null, wonValue: sumValue(w) };
    })
    .sort((a, b) => b.wonValue - a.wonValue || b.total - a.total);

  // Owners.
  const owners = [...new Set(opportunities.map((o) => o.ownerName ?? ""))]
    .map((name) => {
      const os = opportunities.filter((o) => (o.ownerName ?? "") === name);
      const op = os.filter((o) => o.status === "open");
      const wr = winRate(os, now);
      return { name, open: op.length, openValue: sumValue(op), forecast: weighted(pipeline, op), won: sumValue(os.filter((o) => o.status === "won")), rate: wr.rate };
    })
    .sort((a, b) => b.openValue - a.openValue);

  // Expected close by month, next four months plus overdue.
  const openOs = opportunities.filter((o) => o.status === "open");
  const today = now.toISOString().slice(0, 10);
  const months = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const os = openOs.filter((o) => o.closeOn?.startsWith(key) && o.closeOn >= today);
    return { label: d.toLocaleDateString("en-US", { month: "long", year: i === 0 || d.getMonth() === 0 ? "numeric" : undefined }), count: os.length, value: sumValue(os), forecast: weighted(pipeline, os) };
  });
  const overdue = openOs.filter((o) => o.closeOn && o.closeOn < today);
  const undated = openOs.filter((o) => !o.closeOn);
  const maxMonth = Math.max(1, ...months.map((m) => m.value));

  if (opportunities.length === 0) {
    return <p className="mx-5 my-6 rounded border border-dashed border-line-strong px-4 py-10 text-center text-sm text-fg-3 md:mx-6">No opportunities in this pipeline yet, so there is nothing to report.</p>;
  }

  return (
    <div className="flex flex-col gap-8 px-5 pb-10 pt-6 md:px-6">
      <Section title="Stage conversion" sub={`${formatCount(opportunities.length)} opportunities, all time`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className={cn(th, "text-left")}>Stage</th>
                <th className={cn(th, "text-right")}>Reached</th>
                <th className={cn(th, "text-right")}>From previous</th>
                <th className={cn(th, "text-right")}>Avg days</th>
                <th className={cn(th, "text-right")}>In it now</th>
                <th className={cn(th, "w-[28%] text-left")}>Value in it now</th>
              </tr>
            </thead>
            <tbody>
              {funnel.map((f, i) => {
                const prev = funnel[i - 1];
                const conv = prev ? (prev.reached ? f.reached / prev.reached : null) : null;
                const v = sumValue(f.nowIn);
                return (
                  <tr key={f.stage.id} className="border-b border-line">
                    <td className={td}>
                      <span className="font-medium">{f.stage.name}</span>
                      <span className="num ml-2 text-xs text-fg-3">{f.stage.outcome ? "closed won" : `${f.stage.probability ?? 0}%`}</span>
                    </td>
                    <td className={cn(td, "num text-right")}>
                      {formatCount(f.reached)}
                      <span className="ml-1.5 text-xs text-fg-3">{formatRate(f.reached / top)}</span>
                    </td>
                    <td className={cn(td, "num text-right", conv === null && "text-fg-3")}>{conv === null ? "–" : formatRate(conv)}</td>
                    <td className={cn(td, "num text-right", f.avgDays === null && "text-fg-3")}>{f.avgDays === null || f.stage.outcome ? "–" : f.avgDays.toFixed(1)}</td>
                    <td className={cn(td, "num text-right")}>{formatCount(f.nowIn.length)}</td>
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <span className="flex-1">
                          <Bar share={v / maxNowValue} />
                        </span>
                        <span className="num w-16 shrink-0 text-right">{formatDollarsCompact(v)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-8 xl:grid-cols-2">
        <Section title="Expected to close" sub={`${formatDollarsCompact(weighted(pipeline, openOs))} weighted across open deals`}>
          <ul className="flex flex-col">
            {months.map((m) => (
              <li key={m.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-b border-line py-2.5">
                <span className="text-sm">{m.label}</span>
                <span className="num text-sm">
                  {formatDollarsCompact(m.value)}
                  <span className="ml-2 text-xs text-fg-3">{formatDollarsCompact(m.forecast)} weighted</span>
                </span>
                <span className="col-span-2">
                  <Bar share={m.value / maxMonth} />
                </span>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
              <span className={cn(overdue.length ? "font-medium text-amber" : "text-fg-3")}>{overdue.length ? `${formatCount(overdue.length)} past their close date` : "Nothing past its close date"}</span>
              <span className="num text-xs text-fg-3">{undated.length ? `${formatCount(undated.length)} without a date` : ""}</span>
            </li>
          </ul>
        </Section>

        <Section title="Why deals are lost" sub={`${formatCount(lost.length)} lost · ${formatDollarsCompact(sumValue(lost))}`}>
          {byReason.length === 0 ? (
            <p className="text-sm text-fg-3">Nothing lost yet.</p>
          ) : (
            <ul className="flex flex-col">
              {byReason.map((r) => (
                <li key={r.reason} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-b border-line py-2.5 last:border-b-0">
                  <span className="truncate text-sm">{r.reason}</span>
                  <span className="num text-sm">
                    {formatCount(r.count)}
                    <span className="ml-2 text-xs text-fg-3">{formatRate(r.count / lost.length)}</span>
                  </span>
                  <span className="col-span-2">
                    <Bar share={r.count / byReason[0]!.count} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <Section title="By source" sub="Win rate counts won against lost">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={cn(th, "text-left")}>Source</th>
                  <th className={cn(th, "text-right")}>Deals</th>
                  <th className={cn(th, "text-right")}>Won</th>
                  <th className={cn(th, "text-right")}>Win rate</th>
                  <th className={cn(th, "text-right")}>Won value</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.src} className="border-b border-line last:border-b-0">
                    <td className={cn(td, "whitespace-nowrap")}>{sourceLabel[s.src]}</td>
                    <td className={cn(td, "num text-right")}>{formatCount(s.total)}</td>
                    <td className={cn(td, "num text-right")}>{formatCount(s.won)}</td>
                    <td className={cn(td, "num text-right", s.rate === null && "text-fg-3")}>{formatRate(s.rate)}</td>
                    <td className={cn(td, "num text-right")}>{s.wonValue ? formatDollars(s.wonValue) : <span className="text-fg-3">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="By owner" sub="Win rate over the last 90 days">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={cn(th, "text-left")}>Owner</th>
                  <th className={cn(th, "text-right")}>Open</th>
                  <th className={cn(th, "text-right")}>Weighted</th>
                  <th className={cn(th, "text-right")}>Won value</th>
                  <th className={cn(th, "text-right")}>Win rate</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => {
                  const person = personFor(team, o.name || undefined);
                  return (
                    <tr key={o.name || "none"} className="border-b border-line last:border-b-0">
                      <td className={td}>
                        {person ? (
                          <span className="inline-flex items-center gap-2">
                            <Avatar person={person} size="xs" />
                            {person.name}
                          </span>
                        ) : (
                          <span className="text-fg-3">Unassigned</span>
                        )}
                      </td>
                      <td className={cn(td, "num text-right")}>
                        {formatCount(o.open)}
                        <span className="ml-1.5 text-xs text-fg-3">{formatDollarsCompact(o.openValue)}</span>
                      </td>
                      <td className={cn(td, "num text-right")}>{formatDollarsCompact(o.forecast)}</td>
                      <td className={cn(td, "num text-right")}>{o.won ? formatDollarsCompact(o.won) : <span className="text-fg-3">–</span>}</td>
                      <td className={cn(td, "num text-right", o.rate === null && "text-fg-3")}>{formatRate(o.rate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
      <p className="text-xs text-fg-3">Demo data. Days are counted from stage moves; closed deals stop the clock on their close date.</p>
    </div>
  );
}

