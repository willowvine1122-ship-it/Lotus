"use client";

import { useMemo } from "react";
import { BarList, ColumnChart, LineChart, compactNumber } from "@/components/charts";
import { fundraisingSeries, marketingCostSeries, type Row } from "@/components/diagnostic/model";
import { ChangeArrow, SectionTitle, Tag } from "@/components/diagnostic/primitives";
import { Stars } from "@/components/reputation/review-panel";
import { byMonth, lastN, summarizeFundraising, summarizeMarketing } from "@/lib/diagnostic";
import type { ReportConfig, ReportSectionId, Review } from "@/lib/types";
import { cn, formatCount, formatDollars, formatDollarsCompact, formatMultiple, formatRate } from "@/lib/utils";
import { sectionLabel } from "./model";

/*
 * The report itself: the sections a client's config turns on, in order,
 * rendered from the same Row the agency works from. Used three times with
 * the same markup: the builder preview, the client portal, and (later) the
 * weekly email.
 */

function Tile({ label, value, change, goodWhenUp = true, sub }: { label: string; value: string; change?: number | null; goodWhenUp?: boolean; sub?: string }) {
  return (
    <div className="rounded border border-line bg-surface px-4 py-3">
      <div className="truncate whitespace-nowrap text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="num text-xl font-semibold leading-7">{value}</span>
        {change !== undefined && <ChangeArrow value={change} goodWhenUp={goodWhenUp} />}
      </div>
      {sub && <div className="num text-xs text-fg-3">{sub}</div>}
    </div>
  );
}

function Summary({ row }: { row: Row }) {
  if (row.mode === "marketing") {
    const { cur } = row;
    return (
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Tile label="Leads" value={formatCount(cur.leads)} change={row.leadsChange} sub={`${formatDollars(cur.leadCostCents ?? 0)} each`} />
        <Tile label="Appointments" value={formatCount(cur.appointments)} sub={`${formatRate(cur.bookRate)} of leads booked`} />
        <Tile label="Per appointment" value={cur.aptCostCents === null ? "–" : formatDollars(cur.aptCostCents)} change={row.aptCostChange} goodWhenUp={false} sub={`${formatDollarsCompact(cur.spendCents)} spent`} />
        <Tile label="Est. revenue" value={formatDollarsCompact(cur.estRevenueCents)} sub={`${formatMultiple(cur.roi)} return on spend`} />
      </div>
    );
  }
  const { cur } = row;
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Tile label="Raised" value={formatDollarsCompact(cur.raisedCents)} change={row.raisedChange} sub={`${formatDollarsCompact(cur.raisedPerDayCents)} a day`} />
      <Tile label="Gifts" value={formatCount(cur.donations)} change={row.donationsChange} sub={`${formatDollars(cur.avgGiftCents ?? 0)} average`} />
      <Tile label="New donors" value={formatCount(cur.newDonors)} />
      <Tile label="New monthly" value={formatCount(cur.newRecurring)} sub={`${formatRate(cur.recurringShare)} of gifts`} />
    </div>
  );
}

function Performance({ row, range }: { row: Row; range: number }) {
  const series = row.mode === "marketing" ? marketingCostSeries(row.client.days, range) : fundraisingSeries(row.client.days, range);
  const labels = series.labels;
  const fmt = (v: number) => `$${compactNumber(v / 100)}`;
  // Marketing: both costs share a scale. Fundraising: raised per day and average gift do not, so they get a chart each.
  const charts =
    row.mode === "marketing"
      ? [[{ key: "lead", label: "Cost per lead", color: "var(--chart-2)", values: series.a }, { key: "apt", label: "Cost per appointment", color: "var(--chart-1)", values: series.b }]]
      : [[{ key: "raised", label: "Raised per day", color: "var(--chart-1)", values: series.a }], [{ key: "gift", label: "Average gift", color: "var(--chart-2)", values: series.b }]];
  return (
    <>
      <div className={cn("grid gap-6", charts.length > 1 && "md:grid-cols-2")}>
        {charts.map((c) => (
          <div key={c[0]!.key} className="min-w-0">
            {charts.length > 1 && <div className="mb-1 text-xs font-medium text-fg-2">{c[0]!.label}</div>}
            <LineChart labels={labels} series={c} format={fmt} height={charts.length > 1 ? 170 : 200} />
          </div>
        ))}
      </div>
      <p className="text-xs text-fg-3">Seven-day rolling averages, so a quiet weekend does not swing the line.</p>
    </>
  );
}

function Volume({ row, range }: { row: Row; range: number }) {
  if (row.mode === "marketing") {
    const days = lastN(row.client.days, range);
    return <ColumnChart labels={days.map((d) => d.day)} values={days.map((d) => d.leads)} color="var(--chart-2)" label="Leads per day" format={(v) => formatCount(v)} height={160} />;
  }
  const days = lastN(row.client.days, range);
  return <ColumnChart labels={days.map((d) => d.day)} values={days.map((d) => d.raisedCents)} color="var(--chart-1)" label="Raised per day" format={formatDollarsCompact} height={160} />;
}

function Months({ row }: { row: Row }) {
  const months = row.mode === "marketing" ? byMonth(row.client.days, 3).map((m) => ({ key: m.key, label: m.label, s: summarizeMarketing(m.days, row.client.avgJobValueCents) })) : byMonth(row.client.days, 3).map((m) => ({ key: m.key, label: m.label, s: summarizeFundraising(m.days) }));
  const th = "whitespace-nowrap px-3 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-4 last:pr-4";
  const td = "num whitespace-nowrap px-3 py-2 first:pl-4 last:pr-4";
  return (
    <div className="overflow-x-auto rounded border border-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>Month</th>
            {row.mode === "marketing" ? (
              <>
                <th className={cn(th, "text-right")}>Spend</th>
                <th className={cn(th, "text-right")}>Leads</th>
                <th className={cn(th, "text-right")}>Appointments</th>
                <th className={cn(th, "text-right")}>Per appointment</th>
                <th className={cn(th, "text-right")}>Closed</th>
              </>
            ) : (
              <>
                <th className={cn(th, "text-right")}>Raised</th>
                <th className={cn(th, "text-right")}>Gifts</th>
                <th className={cn(th, "text-right")}>Average gift</th>
                <th className={cn(th, "text-right")}>New donors</th>
                <th className={cn(th, "text-right")}>New monthly</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            if ("spendCents" in m.s) {
              const s = m.s;
              return (
                <tr key={m.key} className="border-b border-line last:border-0">
                  <td className={cn(td, "font-medium")}>{m.label}</td>
                  <td className={cn(td, "text-right")}>{formatDollarsCompact(s.spendCents)}</td>
                  <td className={cn(td, "text-right")}>{formatCount(s.leads)}</td>
                  <td className={cn(td, "text-right")}>{formatCount(s.appointments)}</td>
                  <td className={cn(td, "text-right")}>{s.aptCostCents === null ? "–" : formatDollars(s.aptCostCents)}</td>
                  <td className={cn(td, "text-right")}>{formatCount(s.closed)}</td>
                </tr>
              );
            }
            const s = m.s;
            return (
              <tr key={m.key} className="border-b border-line last:border-0">
                <td className={cn(td, "font-medium")}>{m.label}</td>
                <td className={cn(td, "text-right")}>{formatDollarsCompact(s.raisedCents)}</td>
                <td className={cn(td, "text-right")}>{formatCount(s.donations)}</td>
                <td className={cn(td, "text-right")}>{s.avgGiftCents === null ? "–" : formatDollars(s.avgGiftCents)}</td>
                <td className={cn(td, "text-right")}>{formatCount(s.newDonors)}</td>
                <td className={cn(td, "text-right")}>{formatCount(s.newRecurring)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Countries({ row }: { row: Row }) {
  if (row.mode !== "fundraising") return <p className="text-xs text-fg-3">Only fundraising clients report by country.</p>;
  const countries = [...row.client.countries].sort((a, b) => b.raisedCents - a.raisedCents).slice(0, 6);
  return <BarList items={countries.map((k) => ({ key: k.code, label: k.name, value: k.raisedCents }))} color="var(--chart-1)" format={formatDollarsCompact} />;
}

function Reviews({ reviews, now }: { reviews: Review[]; now: Date }) {
  const recent = reviews.filter((r) => (now.getTime() - new Date(r.at).getTime()) / 86400000 < 30);
  const avg = recent.length ? recent.reduce((a, r) => a + r.rating, 0) / recent.length : null;
  const shown = recent.filter((r) => r.rating >= 4).slice(0, 3);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="num text-xl font-semibold">{avg === null ? "–" : avg.toFixed(1)}</span>
        {avg !== null && <Stars rating={avg} size="md" />}
        <span className="num text-xs text-fg-3">{formatCount(recent.length)} reviews in 30 days</span>
      </div>
      {shown.length > 0 && (
        <ul className="grid gap-2.5 md:grid-cols-3">
          {shown.map((r) => (
            <li key={r.id} className="flex flex-col gap-1.5 rounded border border-line bg-surface px-3.5 py-3">
              <span className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-fg">{r.author}</span>
                <Stars rating={r.rating} />
              </span>
              <p className="text-xs leading-relaxed text-fg-2">“{r.body}”</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReportBody({ row, config, reviews, now, className }: { row: Row; config: Pick<ReportConfig, "range" | "sections" | "note">; reviews: Review[]; now: Date; className?: string }) {
  const sections = useMemo(() => config.sections.filter((s) => (s === "countries" ? row.mode === "fundraising" : s === "note" ? !!config.note?.trim() : true)), [config.sections, config.note, row.mode]);
  const sub = (s: ReportSectionId) =>
    s === "summary" ? `Last ${config.range} days, against the ${config.range} before` : s === "performance" || s === "volume" ? `Last ${config.range} days` : s === "months" ? "Calendar months" : s === "countries" ? "Last 30 days" : s === "reviews" ? "Google and Facebook" : undefined;
  return (
    <div className={cn("flex flex-col gap-7", className)}>
      {sections.map((s) => (
        <section key={s} className="flex flex-col gap-3">
          {s === "note" ? (
            <div className="rounded border border-line bg-surface-2/50 px-4 py-3.5">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                {sectionLabel.note}
                <Tag tone="neutral">{row.client.assignees[0]?.name ?? "Your team"}</Tag>
              </div>
              <p className="text-sm leading-relaxed text-fg-2">{config.note}</p>
            </div>
          ) : (
            <>
              <SectionTitle sub={sub(s)}>{sectionLabel[s]}</SectionTitle>
              {s === "summary" && <Summary row={row} />}
              {s === "performance" && <Performance row={row} range={config.range} />}
              {s === "volume" && <Volume row={row} range={config.range} />}
              {s === "months" && <Months row={row} />}
              {s === "countries" && <Countries row={row} />}
              {s === "reviews" && <Reviews reviews={reviews} now={now} />}
            </>
          )}
        </section>
      ))}
      {sections.length === 0 && <div className="grid h-24 place-items-center rounded border border-dashed border-line-strong text-sm text-fg-3">Turn on at least one section.</div>}
    </div>
  );
}
