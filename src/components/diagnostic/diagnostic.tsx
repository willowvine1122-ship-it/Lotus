"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { ButtonLink } from "@/components/page-header";
import type { RangeDays } from "@/lib/diagnostic";
import type { AccountMode, ClientRecord } from "@/lib/types";
import { cn, formatCount, formatDollars, formatDollarsCompact, formatDollarsExact, formatMultiple, formatRate } from "@/lib/utils";
import { buildRow, type Row } from "./model";
import { ClientPanel } from "./panel";
import { Segmented } from "./primitives";
import { DiagnosticTable, sortValue, type Sort } from "./table";

/*
 * Daily Diagnostic: top bar, KPI strip, the board, and the client panel.
 * State lives here: mode, search, range, sort, selection.
 */

const ranges: { value: RangeDays; label: string }[] = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

function Kpi({ label, value, aside, tone }: { label: string; value: string; aside?: string; tone?: "red" | "amber" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded border border-line bg-surface px-4 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-3">
      <div className="min-w-0">
        <div className="whitespace-nowrap text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{label}</div>
        <div className="num mt-0.5 text-xl font-semibold leading-7">{value}</div>
      </div>
      {aside && <div className={cn("num whitespace-nowrap text-xs sm:ml-auto sm:text-right", tone === "red" ? "font-medium text-red" : tone === "amber" ? "font-medium text-amber" : "text-fg-3")}>{aside}</div>}
    </div>
  );
}

function KpiStrip({ rows, mode }: { rows: Row[]; mode: AccountMode }) {
  const flagged = rows.filter((r) => r.client.health === "red").length;
  const watch = rows.filter((r) => r.client.health === "amber").length;
  const attention = flagged ? `${flagged} need${flagged === 1 ? "s" : ""} action` : watch ? `${watch} to watch` : "All on track";
  const tone = flagged ? "red" : watch ? "amber" : undefined;

  if (mode === "marketing") {
    const m = rows.filter((r): r is Extract<Row, { mode: "marketing" }> => r.mode === "marketing");
    const spend = m.reduce((a, r) => a + r.cur.spendCents, 0);
    const leads = m.reduce((a, r) => a + r.cur.leads, 0);
    const apts = m.reduce((a, r) => a + r.cur.appointments, 0);
    const revenue = m.reduce((a, r) => a + r.cur.estRevenueCents, 0);
    return (
      <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6 xl:grid-cols-4">
        <Kpi label="Active clients" value={String(m.length)} aside={attention} tone={tone} />
        <Kpi label="Leads" value={formatCount(leads)} aside={`Avg cost ${leads ? formatDollars(spend / leads) : "–"}`} />
        <Kpi label="Appointments" value={formatCount(apts)} aside={`Avg cost ${apts ? formatDollars(spend / apts) : "–"}`} />
        <Kpi label="Spend" value={formatDollarsCompact(spend)} aside={`Est ROI ${formatMultiple(spend ? revenue / spend : null)}`} />
      </div>
    );
  }
  const f = rows.filter((r): r is Extract<Row, { mode: "fundraising" }> => r.mode === "fundraising");
  const raised = f.reduce((a, r) => a + r.cur.raisedCents, 0);
  const gifts = f.reduce((a, r) => a + r.cur.donations, 0);
  const donors = f.reduce((a, r) => a + r.cur.newDonors, 0);
  const goal = f.reduce((a, r) => a + r.pacing.budgetCents, 0);
  const mtd = f.reduce((a, r) => a + r.pacing.spentCents, 0);
  return (
    <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6 xl:grid-cols-4">
      <Kpi label="Active clients" value={String(f.length)} aside={attention} tone={tone} />
      <Kpi label="Raised" value={formatDollarsCompact(raised)} aside={`${formatCount(gifts)} gifts`} />
      <Kpi label="Avg gift" value={gifts ? formatDollarsExact(raised / gifts) : "–"} aside={`${formatCount(donors)} new donors`} />
      <Kpi label="Month to date" value={formatDollarsCompact(mtd)} aside={`${formatRate(goal ? mtd / goal : null)} of ${formatDollarsCompact(goal)} goal`} />
    </div>
  );
}

export function Diagnostic({ clients, nowIso }: { clients: ClientRecord[]; nowIso: string }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [mode, setMode] = useState<AccountMode>("marketing");
  const [range, setRange] = useState<RangeDays>(30);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "health", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = clients
      .filter((c) => c.mode === mode)
      .filter((c) => !q || c.account.name.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q)) || c.location.toLowerCase().includes(q) || c.assignees.some((a) => a.name.toLowerCase().includes(q)))
      .map((c) => buildRow(c, range, now));
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      const primary = av < bv ? -1 : av > bv ? 1 : 0;
      if (primary !== 0) return primary * dir;
      const h = sortValue(a, "health") as number;
      const hb = sortValue(b, "health") as number;
      if (h !== hb) return h - hb;
      return a.client.account.name.localeCompare(b.client.account.name);
    });
  }, [clients, mode, query, range, sort, now]);

  const selected = rows.find((r) => r.client.account.id === selectedId) ?? rows[0] ?? null;

  const switchMode = (m: AccountMode) => {
    setMode(m);
    setSelectedId(null);
    setSort({ key: "health", dir: "asc" });
  };

  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:px-6">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">Daily Diagnostic</h1>
            <p className="text-xs text-rail-fg-2">{date}, through yesterday</p>
          </div>
          <label className="relative order-last w-full md:order-none md:ml-2 md:w-auto md:flex-1 md:max-w-[380px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2" strokeWidth={1.75} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients, tags, cities, people"
              className="h-8 w-full rounded border border-rail-line bg-rail-2 pl-8 pr-3 text-sm text-rail-fg placeholder:text-rail-fg-2/80 focus:border-rail-fg-2 focus:outline-none"
            />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Segmented
              label="Client mode"
              value={mode}
              onChange={switchMode}
              options={[
                { value: "marketing", label: "Marketing" },
                { value: "fundraising", label: "Fundraising" },
              ]}
            />
            <select
              aria-label="Date range"
              value={range}
              onChange={(e) => setRange(Number(e.target.value) as RangeDays)}
              className="h-7 rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none"
            >
              {ranges.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <ButtonLink href="/agency/clients/new" className="h-7 whitespace-nowrap px-2.5 text-xs">
              <Plus className="size-3.5" strokeWidth={2.25} />
              <span className="hidden sm:inline">Add client</span>
              <span className="sr-only sm:hidden">Add client</span>
            </ButtonLink>
          </div>
        </header>

        <KpiStrip rows={rows} mode={mode} />

        <div className="border-y border-line">
          <DiagnosticTable
            rows={rows}
            mode={mode}
            sort={sort}
            onSort={setSort}
            selectedId={selected?.client.account.id ?? null}
            onSelect={(id) => {
              setSelectedId(id);
              setPanelOpen(true);
            }}
          />
        </div>
      </div>

      {selected && (
        <>
          <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[384px] 2xl:w-[420px]">
            <ClientPanel row={selected} now={now} />
          </aside>
          {panelOpen && (
            <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label={selected.client.account.name}>
              <button type="button" aria-label="Close panel" onClick={() => setPanelOpen(false)} className="flex-1 bg-rail/40" />
              <aside className="h-full w-[min(100%,400px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                <ClientPanel row={selected} now={now} onClose={() => setPanelOpen(false)} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
