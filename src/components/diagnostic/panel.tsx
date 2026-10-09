"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, ExternalLink, Info, MapPin, Plus, X } from "lucide-react";
import { BarList, ColumnChart, LineChart, compactNumber } from "@/components/charts";
import { lastN, pacingTone, summarizeFundraising, summarizeMarketing, type Period } from "@/lib/diagnostic";
import type { ClientRecord, DiagnosticNote, FundraisingClient, FundraisingDay, MarketingClient, MarketingDay } from "@/lib/types";
import { cn, formatCount, formatDollars, formatDollarsCompact, formatDollarsExact, formatMultiple, formatRate, timeAgo } from "@/lib/utils";
import { fundraisingSeries, fundraisingTrendPairs, marketingCostSeries, periods, trendPairs, type FundraisingRow, type MarketingRow, type Row, type TrendPair } from "./model";
import { AvatarStack, ChangeArrow, SectionTitle, Segmented, StatusDot, Tag, healthText } from "./primitives";

/*
 * The client panel. Fixed to the right of the board, it reads top to
 * bottom: who, the four numbers, money, the curves, the trends, the
 * month table, then the team's notes.
 */

const chartRanges = [
  { value: "7", label: "7D" },
  { value: "14", label: "14D" },
  { value: "30", label: "30D" },
  { value: "60", label: "2Mo" },
  { value: "90", label: "3Mo" },
] as const;
type ChartRange = (typeof chartRanges)[number]["value"];

function Tile({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded border border-line bg-surface-2/50 px-3.5 py-3", className)}>
      <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold">{value}</div>
      {sub && <div className="num text-xs text-fg-2">{sub}</div>}
    </div>
  );
}

function LedgerRow({ label, children, tone, className }: { label: React.ReactNode; children: React.ReactNode; tone?: "green"; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded border px-3.5 py-2.5",
        tone === "green" ? "border-green/25 bg-green-soft/50" : "border-line bg-surface-2/50",
        className,
      )}
    >
      <span className={cn("text-2xs font-medium uppercase tracking-[0.06em]", tone === "green" ? "text-green" : "text-fg-3")}>{label}</span>
      <span className="num flex items-baseline gap-2 text-sm">{children}</span>
    </div>
  );
}

function RangeChips({ value, onChange }: { value: ChartRange; onChange: (v: ChartRange) => void }) {
  return (
    <div role="radiogroup" aria-label="Chart range" className="flex gap-1">
      {chartRanges.map((r) => (
        <button
          key={r.value}
          type="button"
          role="radio"
          aria-checked={value === r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            "num h-6 rounded-[4px] border px-2 text-2xs font-medium transition-colors duration-150",
            value === r.value ? "border-rail bg-rail text-rail-fg" : "border-line bg-surface text-fg-2 hover:border-line-strong",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function TrendTile({ title, pairs, format, goodWhenUp }: { title: string; pairs: TrendPair[]; format: (c: number) => string; goodWhenUp: boolean }) {
  return (
    <div className="rounded border border-line bg-surface-2/50 px-3.5 py-3">
      <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{title}</div>
      <dl className="mt-2 flex flex-col gap-1.5">
        {pairs.map((p) => {
          const ch = p.before && p.after !== null ? (p.after - p.before) / p.before : null;
          return (
            <div key={p.label} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 text-xs">
              <dt className="num font-medium text-fg-2">{p.label}</dt>
              <dd className="num flex items-center gap-1.5 text-fg">
                <span className="text-fg-3">{p.before === null ? "–" : format(p.before)}</span>
                <ArrowRight className="size-3 shrink-0 text-fg-3" strokeWidth={2} />
                <span className="font-medium">{p.after === null ? "–" : format(p.after)}</span>
              </dd>
              <dd className="justify-self-end">
                <ChangeArrow value={ch} goodWhenUp={goodWhenUp} />
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function MetricsTable<T extends { day: string }>({
  days,
  rows,
}: {
  days: T[];
  rows: { label: string; value: (p: Period<T>) => React.ReactNode }[];
}) {
  const [by, setBy] = useState<"month" | "week">("month");
  const cols = periods(days, by);
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle
        aside={
          <Segmented
            tone="paper"
            label="Group metrics by"
            value={by}
            onChange={setBy}
            options={[
              { value: "month", label: "By month" },
              { value: "week", label: "By week" },
            ]}
          />
        }
      >
        Performance metrics
      </SectionTitle>
      {cols.length === 0 ? (
        <p className="rounded border border-dashed border-line-strong px-3.5 py-4 text-center text-xs text-fg-3">No history yet. The first numbers land after the first full day.</p>
      ) : (
      <div className="overflow-x-auto rounded border border-line">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-surface-2/70 text-2xs uppercase tracking-[0.06em] text-fg-3">
              <th scope="col" className="px-3 py-2 text-left font-medium">
                {by === "month" ? "Month" : "Week"}
              </th>
              {cols.map((c) => (
                <th key={c.key} scope="col" className="num px-3 py-2 text-right font-medium whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <th scope="row" className="px-3 py-1.5 text-left font-medium text-fg">
                  {r.label}
                </th>
                {cols.map((c) => (
                  <td key={c.key} className="num px-3 py-1.5 text-right text-fg-2">
                    {r.value(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}

export function NotesFeed({ notes, now }: { notes: DiagnosticNote[]; now: Date }) {
  const groups = new Map<string, DiagnosticNote[]>();
  for (const n of notes) {
    const key = n.createdAt.slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  const tone = (name: string) => (name === "Afza" ? "bg-brand text-white" : name === "Mahad" ? "bg-chart-2 text-white" : "bg-[#0f8f8a] text-white");
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle sub="Internal only. Read in the client meeting.">Notes</SectionTitle>
      {notes.length === 0 ? (
        <p className="rounded border border-dashed border-line-strong px-3.5 py-4 text-center text-xs text-fg-3">No notes yet for this client.</p>
      ) : (
        [...groups.entries()].map(([day, ns]) => (
          <div key={day} className="flex flex-col gap-3">
            <div className="flex items-center gap-3 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
              <span className="h-px flex-1 bg-line" />
              {new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              <span className="h-px flex-1 bg-line" />
            </div>
            {ns.map((n) => (
              <article key={n.id} className="rounded border border-line bg-surface-2/40 p-3.5">
                <header className="flex items-center gap-2.5">
                  <span className={cn("grid size-7 place-items-center rounded-full text-xs font-semibold", tone(n.authorName))}>{n.authorName[0]}</span>
                  <span className="text-sm font-medium">{n.authorName}</span>
                  <time dateTime={n.createdAt} className="ml-auto text-2xs text-fg-3">
                    {timeAgo(n.createdAt, now)}
                  </time>
                </header>
                <p className="mt-2 text-sm leading-relaxed text-fg-2">{n.body}</p>
              </article>
            ))}
          </div>
        ))
      )}
    </section>
  );
}

export function PanelHeader({ client, now, onClose }: { client: ClientRecord; now: Date; onClose?: () => void }) {
  const localTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: client.timeZone, timeZoneName: "short" }).format(now);
  const active = Math.round((now.getTime() - new Date(`${client.startedOn}T12:00:00`).getTime()) / 86400000);
  return (
    <header className="sticky top-0 z-[1] flex flex-col gap-2.5 border-b border-line bg-surface px-5 pb-3.5 pt-4">
      <div className="flex items-center gap-2.5">
        <StatusDot health={client.health} />
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{client.account.name}</h2>
        <Link
          href={`/agency/clients/${client.account.slug}`}
          className="grid size-7 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg"
          title="Open client"
        >
          <ExternalLink className="size-4" strokeWidth={1.75} />
          <span className="sr-only">Open client</span>
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg lg:hidden">
            <X className="size-4" strokeWidth={2} />
            <span className="sr-only">Close</span>
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {client.tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
        <button type="button" className="inline-flex h-5 items-center gap-1 rounded-[4px] border border-dashed border-line-strong px-1.5 text-2xs text-fg-3 hover:text-fg">
          <Plus className="size-3" strokeWidth={2} />
          {client.tags.length === 0 && "Add tag"}
          {client.tags.length > 0 && <span className="sr-only">Add tag</span>}
        </button>
      </div>
      <div className="flex items-center gap-3 whitespace-nowrap text-xs text-fg-2">
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin className="size-3.5 shrink-0 text-fg-3" strokeWidth={1.75} />
          <span className="truncate">{client.location}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5 text-fg-3" strokeWidth={1.75} />
          <span className="num">{localTime}</span>
        </span>
        <span className="num text-fg-3" title={`Client for ${active} days`}>{active}d</span>
        <span className="ml-auto">
          <AvatarStack people={client.assignees} />
        </span>
      </div>
    </header>
  );
}

export function Diagnosis({ client }: { client: ClientRecord }) {
  if (client.alerts.length === 0 && !client.summary) return null;
  return (
    <div className={cn("rounded border px-3.5 py-3 text-sm", client.health === "red" ? "border-red/25 bg-red-soft/50" : client.health === "amber" ? "border-amber/25 bg-amber-soft/50" : "border-line bg-surface-2/50")}>
      {client.alerts.length > 0 && <p className={cn("font-medium", healthText[client.health])}>{client.alerts.join(" · ")}</p>}
      {client.summary && <p className="mt-1 leading-relaxed text-fg-2">{client.summary}</p>}
    </div>
  );
}

/* ---------------------------- marketing ---------------------------- */

export function MarketingPanel({ row, now }: { row: MarketingRow; now: Date }) {
  const c = row.client;
  const [perf, setPerf] = useState<"both" | "leads" | "apts">("both");
  const [perfRange, setPerfRange] = useState<ChartRange>("14");
  const [vol, setVol] = useState<"leads" | "apts">("leads");
  const series = marketingCostSeries(c.days, Number(perfRange));
  const volumeDays = lastN(c.days, Number(perfRange));
  const trends = trendPairs(c.days, c.avgJobValueCents);
  const { cur, pacing } = row;

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Tile label="Leads" value={formatCount(cur.leads)} />
        <Tile label="Lead cost" value={cur.leadCostCents === null ? "–" : formatDollarsExact(cur.leadCostCents)} />
        <Tile label="Appointments" value={formatCount(cur.appointments)} sub={cur.bookRate === null ? undefined : `${formatRate(cur.bookRate, 1)} book rate`} />
        <Tile label="Apt cost" value={cur.aptCostCents === null ? "–" : formatDollarsExact(cur.aptCostCents)} />
      </div>
      <div className="flex flex-col gap-2">
        <LedgerRow label="Spend">
          <span className="font-medium">{formatDollars(cur.spendCents)}</span>
        </LedgerRow>
        <LedgerRow
          label={
            <>
              Pacing <span className={cn("ml-1 normal-case tracking-normal", c.days.length === 0 ? "text-fg-3" : healthText[pacingTone(pacing.pct)])}>{Math.round(pacing.pct * 100)}%</span>
            </>
          }
        >
          <span className="flex flex-col items-end">
            <span>
              <span className="font-medium">{formatDollars(pacing.spentCents)}</span>
              <span className="text-fg-3"> / {formatDollars(pacing.budgetCents)}</span>
            </span>
            <span className="text-xs text-fg-3">Est. {formatDollars(pacing.projectedCents)} by month end</span>
          </span>
        </LedgerRow>
        <LedgerRow
          tone="green"
          label={
            <span className="inline-flex items-center gap-1">
              Est. revenue &amp; ROI
              <Info className="size-3" strokeWidth={2} aria-label={`Closed jobs times the client's average job value of ${formatDollars(c.avgJobValueCents)}`} />
            </span>
          }
        >
          <span className="font-medium">{formatDollars(cur.estRevenueCents)}</span>
          <span className="font-semibold text-green">{formatMultiple(cur.roi)}</span>
        </LedgerRow>
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle
          sub="Rolling 7-day average"
          aside={
            <Segmented
              tone="paper"
              label="Series"
              value={perf}
              onChange={setPerf}
              options={[
                { value: "both", label: "Both" },
                { value: "leads", label: "Leads" },
                { value: "apts", label: "Apts" },
              ]}
            />
          }
        >
          Performance
        </SectionTitle>
        <div className="flex justify-end">
          <RangeChips value={perfRange} onChange={setPerfRange} />
        </div>
        <LineChart
          labels={series.labels}
          format={(v) => `$${compactNumber(v / 100)}`}
          series={[
            ...(perf !== "apts" ? [{ key: "lead", label: "Lead cost", color: "var(--chart-2)", values: series.a }] : []),
            ...(perf !== "leads" ? [{ key: "apt", label: "Apt cost", color: "var(--chart-1)", values: series.b }] : []),
          ]}
        />
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle
          aside={
            <Segmented
              tone="paper"
              label="Volume series"
              value={vol}
              onChange={setVol}
              options={[
                { value: "leads", label: "Leads" },
                { value: "apts", label: "Apts" },
              ]}
            />
          }
        >
          Lead &amp; apt volume
        </SectionTitle>
        <ColumnChart
          labels={volumeDays.map((d) => d.day)}
          values={volumeDays.map((d) => (vol === "leads" ? d.leads : d.appointments))}
          label={vol === "leads" ? "Leads" : "Booked apts"}
          color={vol === "leads" ? "var(--chart-2)" : "var(--chart-1)"}
        />
      </section>

      <YearOverYear now={now} />

      <section className="flex flex-col gap-3">
        <SectionTitle>Trends</SectionTitle>
        <div className="grid gap-2.5">
          <TrendTile title="Lead cost" pairs={trends.leadCost} format={formatDollars} goodWhenUp={false} />
          <TrendTile title="Apt cost" pairs={trends.aptCost} format={formatDollars} goodWhenUp={false} />
        </div>
      </section>

      <MetricsTable<MarketingDay>
        days={c.days}
        rows={[
          { label: "Leads", value: (p) => formatCount(summarizeMarketing(p.days, c.avgJobValueCents).leads) },
          { label: "Lead cost", value: (p) => money(summarizeMarketing(p.days, c.avgJobValueCents).leadCostCents) },
          { label: "Booked apts", value: (p) => formatCount(summarizeMarketing(p.days, c.avgJobValueCents).appointments) },
          { label: "Apt cost", value: (p) => money(summarizeMarketing(p.days, c.avgJobValueCents).aptCostCents) },
          { label: "Book rate", value: (p) => formatRate(summarizeMarketing(p.days, c.avgJobValueCents).bookRate, 1) },
          { label: "Ad spend", value: (p) => formatDollars(summarizeMarketing(p.days, c.avgJobValueCents).spendCents) },
        ]}
      />
    </>
  );
}

const money = (c: number | null) => (c === null ? "–" : formatDollars(c));

function YearOverYear({ now }: { now: Date }) {
  const end = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const start = new Date(now.getTime() - 30 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle sub={`${start} – ${end} vs the same days last year`}>Year over year</SectionTitle>
      <p className="rounded border border-dashed border-line-strong px-3.5 py-4 text-center text-xs text-fg-3">
        Not enough history yet for a year over year comparison.
      </p>
    </section>
  );
}

/* --------------------------- fundraising --------------------------- */

export function FundraisingPanel({ row, now }: { row: FundraisingRow; now: Date }) {
  const c = row.client;
  // Raised per day and average gift are two orders of magnitude apart, so one series at a time.
  const [perf, setPerf] = useState<"raised" | "gift">("raised");
  const [perfRange, setPerfRange] = useState<ChartRange>("14");
  const [vol, setVol] = useState<"donations" | "donors">("donations");
  const series = fundraisingSeries(c.days, Number(perfRange));
  const volumeDays = lastN(c.days, Number(perfRange));
  const trends = fundraisingTrendPairs(c.days);
  const { cur, pacing } = row;
  const countries = [...c.countries].sort((a, b) => b.raisedCents - a.raisedCents);

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Tile label="Raised" value={formatDollarsCompact(cur.raisedCents)} />
        <Tile label="Avg gift" value={cur.avgGiftCents === null ? "–" : formatDollarsExact(cur.avgGiftCents)} />
        <Tile label="Donations" value={formatCount(cur.donations)} sub={`${formatCount(cur.newDonors)} new donors`} />
        <Tile label="New monthly" value={formatCount(cur.newRecurring)} sub={`${formatRate(cur.recurringShare, 1)} of gifts`} />
      </div>
      <div className="flex flex-col gap-2">
        <LedgerRow
          label={
            <>
              Goal pacing <span className={cn("ml-1 normal-case tracking-normal", c.days.length === 0 ? "text-fg-3" : healthText[pacingTone(pacing.pct, "goal")])}>{Math.round(pacing.pct * 100)}%</span>
            </>
          }
        >
          <span className="flex flex-col items-end">
            <span>
              <span className="font-medium">{formatDollars(pacing.spentCents)}</span>
              <span className="text-fg-3"> / {formatDollars(pacing.budgetCents)}</span>
            </span>
            <span className="text-xs text-fg-3">Est. {formatDollars(pacing.projectedCents)} by month end</span>
          </span>
        </LedgerRow>
        <LedgerRow tone="green" label="Raised per day">
          <span className="font-medium">{formatDollars(cur.raisedPerDayCents)}</span>
        </LedgerRow>
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle
          sub="Rolling 7-day average"
          aside={
            <Segmented
              tone="paper"
              label="Series"
              value={perf}
              onChange={setPerf}
              options={[
                { value: "raised", label: "Raised" },
                { value: "gift", label: "Avg gift" },
              ]}
            />
          }
        >
          Performance
        </SectionTitle>
        <div className="flex justify-end">
          <RangeChips value={perfRange} onChange={setPerfRange} />
        </div>
        <LineChart
          labels={series.labels}
          format={(v) => `$${compactNumber(v / 100)}`}
          series={
            perf === "raised"
              ? [{ key: "raised", label: "Raised / day", color: "var(--chart-1)", values: series.a }]
              : [{ key: "gift", label: "Avg gift", color: "var(--chart-2)", values: series.b }]
          }
        />
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle sub="Last 30 days">Raised by country</SectionTitle>
        <BarList items={countries.map((k) => ({ key: k.code, label: k.name, value: k.raisedCents }))} color="var(--chart-1)" format={formatDollarsCompact} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle
          aside={
            <Segmented
              tone="paper"
              label="Volume series"
              value={vol}
              onChange={setVol}
              options={[
                { value: "donations", label: "Gifts" },
                { value: "donors", label: "New donors" },
              ]}
            />
          }
        >
          Volume
        </SectionTitle>
        <ColumnChart
          labels={volumeDays.map((d) => d.day)}
          values={volumeDays.map((d) => (vol === "donations" ? d.donations : d.newDonors))}
          label={vol === "donations" ? "Gifts" : "New donors"}
          color="var(--chart-1)"
        />
      </section>

      <YearOverYear now={now} />

      <section className="flex flex-col gap-3">
        <SectionTitle>Trends</SectionTitle>
        <div className="grid gap-2.5">
          <TrendTile title="Raised" pairs={trends.raised} format={formatDollarsCompact} goodWhenUp />
          <TrendTile title="Avg gift" pairs={trends.gift} format={formatDollars} goodWhenUp />
        </div>
      </section>

      <MetricsTable<FundraisingDay>
        days={c.days}
        rows={[
          { label: "Raised", value: (p) => formatDollars(summarizeFundraising(p.days).raisedCents) },
          { label: "Gifts", value: (p) => formatCount(summarizeFundraising(p.days).donations) },
          { label: "Avg gift", value: (p) => money(summarizeFundraising(p.days).avgGiftCents) },
          { label: "New donors", value: (p) => formatCount(summarizeFundraising(p.days).newDonors) },
          { label: "New monthly", value: (p) => formatCount(summarizeFundraising(p.days).newRecurring) },
        ]}
      />
    </>
  );
}

/* ------------------------------- panel ------------------------------ */

export function ClientPanel({ row, now, onClose }: { row: Row; now: Date; onClose?: () => void }) {
  return (
    <div className="flex flex-col">
      <PanelHeader client={row.client} now={now} onClose={onClose} />
      <div className="flex flex-col gap-6 px-5 py-4">
        <Diagnosis client={row.client} />
        {row.mode === "marketing" ? <MarketingPanel key={row.client.account.id} row={row} now={now} /> : <FundraisingPanel key={row.client.account.id} row={row} now={now} />}
        <NotesFeed notes={row.client.notes} now={now} />
      </div>
    </div>
  );
}

export type { FundraisingClient, MarketingClient };
