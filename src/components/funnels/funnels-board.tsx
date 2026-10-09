"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Plus, Search } from "lucide-react";
import { Sparkline } from "@/components/charts";
import { ButtonLink } from "@/components/page-header";
import { ChangeArrow, Tag } from "@/components/diagnostic/primitives";
import type { Funnel, FunnelSubmission } from "@/lib/types";
import { cn, formatCount, formatRate, timeAgo } from "@/lib/utils";
import { FunnelPanel, type FunnelActions } from "./funnel-panel";
import { publicPath, windowStats, type ClientRef } from "./model";

/*
 * Funnels board: top bar, KPI strip, the table, and the funnel panel. The
 * same grammar as Contacts so the tool reads as one thing.
 */

type Key = "name" | "client" | "status" | "visitors" | "leads" | "rate" | "updated";
interface Sort { key: Key; dir: "asc" | "desc" }

const columns: { key: Key; label: string; className?: string; align?: "right"; defaultDir?: "asc" | "desc" }[] = [
  { key: "name", label: "Funnel", className: "min-w-[180px]" },
  { key: "client", label: "Client", className: "hidden md:table-cell" },
  { key: "status", label: "Status", className: "hidden sm:table-cell" },
  { key: "visitors", label: "Visitors 7d", align: "right", className: "hidden sm:table-cell", defaultDir: "desc" },
  { key: "leads", label: "Leads 7d", align: "right", defaultDir: "desc" },
  { key: "rate", label: "Conv.", align: "right", className: "hidden md:table-cell", defaultDir: "desc" },
  { key: "updated", label: "Updated", className: "hidden 2xl:table-cell", defaultDir: "desc" },
];

function Kpi({ label, value, aside }: { label: string; value: string; aside?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded border border-line bg-surface px-4 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-3">
      <div className="min-w-0">
        <div className="whitespace-nowrap text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{label}</div>
        <div className="num mt-0.5 text-xl font-semibold leading-7">{value}</div>
      </div>
      {aside && <div className="num whitespace-nowrap text-xs text-fg-3 sm:ml-auto sm:text-right">{aside}</div>}
    </div>
  );
}

export function FunnelsBoard({
  funnels,
  submissions,
  clients,
  nowIso,
  origin,
  initialClientId,
  actions,
}: {
  funnels: Funnel[];
  submissions: FunnelSubmission[];
  clients: ClientRef[];
  nowIso: string;
  origin: string;
  initialClientId?: string;
  actions: FunnelActions;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [clientId, setClientId] = useState(initialClientId ?? "all");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "live" | "draft">("all");
  const [sort, setSort] = useState<Sort>({ key: "leads", dir: "desc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const inClient = useMemo(() => funnels.filter((f) => clientId === "all" || f.accountId === clientId), [funnels, clientId]);
  const stats = useMemo(() => new Map(funnels.map((f) => [f.id, windowStats(f.days, 7)])), [funnels]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dir = sort.dir === "asc" ? 1 : -1;
    const v = (f: Funnel): string | number => {
      const s = stats.get(f.id)!;
      switch (sort.key) {
        case "name": return f.name.toLowerCase();
        case "client": return clientById.get(f.accountId)?.name ?? "";
        case "status": return f.status === "live" ? 0 : 1;
        case "visitors": return s.visitors;
        case "leads": return s.leads;
        case "rate": return s.rate ?? -1;
        case "updated": return f.updatedAt;
      }
    };
    return inClient
      .filter((f) => scope === "all" || f.status === scope)
      .filter((f) => !q || [f.name, f.slug, clientById.get(f.accountId)?.name ?? ""].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => {
        const av = v(a);
        const bv = v(b);
        const p = av < bv ? -1 : av > bv ? 1 : 0;
        return p !== 0 ? p * dir : a.name.localeCompare(b.name);
      });
  }, [inClient, query, scope, sort, stats, clientById]);

  const selected = rows.find((f) => f.id === selectedId) ?? rows[0] ?? null;
  const selectedSubs = useMemo(() => (selected ? submissions.filter((s) => s.funnelId === selected.id) : []), [submissions, selected]);

  // KPIs follow the client filter, not the search.
  const live = inClient.filter((f) => f.status === "live");
  const week = inClient.map((f) => stats.get(f.id)!);
  const visitors = week.reduce((a, s) => a + s.visitors, 0);
  const leads = week.reduce((a, s) => a + s.leads, 0);
  const prevVisitors = inClient.reduce((a, f) => a + f.days.slice(-14, -7).reduce((x, d) => x + d.visitors, 0), 0);
  const prevLeads = inClient.reduce((a, f) => a + f.days.slice(-14, -7).reduce((x, d) => x + d.leads, 0), 0);
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:flex-nowrap md:px-6">
          <div className="min-w-0 md:shrink-0">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">Funnels</h1>
            <p className="num text-xs text-rail-fg-2 md:whitespace-nowrap">
              {date} · {formatCount(inClient.length)} funnels · {formatCount(live.length)} live
            </p>
          </div>
          <label className="relative order-last w-full md:order-none md:ml-2 md:w-auto md:min-w-[180px] md:flex-1 md:max-w-[280px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2" strokeWidth={1.75} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search funnels"
              className="h-8 w-full rounded border border-rail-line bg-rail-2 pl-8 pr-3 text-sm text-rail-fg placeholder:text-rail-fg-2/80 focus:border-rail-fg-2 focus:outline-none"
            />
          </label>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <select
              aria-label="Client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setSelectedId(null);
              }}
              className="h-7 max-w-[150px] rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none"
            >
              <option value="all">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Status"
              value={scope}
              onChange={(e) => setScope(e.target.value as "all" | "live" | "draft")}
              className="h-7 rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none"
            >
              <option value="all">All</option>
              <option value="live">Live</option>
              <option value="draft">Drafts</option>
            </select>
            <ButtonLink href={clientId === "all" ? "/agency/funnels/new" : `/agency/funnels/new?client=${clientId}`} className="h-7 whitespace-nowrap px-2.5 text-xs">
              <Plus className="size-3.5" strokeWidth={2.25} />
              <span className="hidden xl:inline">New funnel</span>
              <span className="sr-only xl:hidden">New funnel</span>
            </ButtonLink>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6 xl:grid-cols-4">
          <Kpi label="Live funnels" value={formatCount(live.length)} aside={`${formatCount(inClient.length - live.length)} drafts`} />
          <Kpi label="Visitors this week" value={formatCount(visitors)} aside={<ChangeArrow value={prevVisitors ? (visitors - prevVisitors) / prevVisitors : null} />} />
          <Kpi label="Leads this week" value={formatCount(leads)} aside={<ChangeArrow value={prevLeads ? (leads - prevLeads) / prevLeads : null} />} />
          <Kpi label="Conversion" value={formatRate(visitors ? leads / visitors : null, 1)} aside="visitors to leads" />
        </div>

        <div className="overflow-x-auto border-y border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                {columns.map((c) => {
                  const active = sort.key === c.key;
                  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={cn("whitespace-nowrap px-3 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 md:first:pl-6", c.className, c.align === "right" ? "text-right" : "text-left")}
                    >
                      <button
                        type="button"
                        onClick={() => setSort(active ? { key: c.key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: c.defaultDir ?? "asc" })}
                        className={cn("inline-flex items-center gap-1 hover:text-fg", active && "text-fg", c.align === "right" && "flex-row-reverse")}
                      >
                        {c.label}
                        <Icon className={cn("size-3", !active && "opacity-60")} strokeWidth={2} />
                      </button>
                    </th>
                  );
                })}
                <th scope="col" className="hidden whitespace-nowrap px-3 py-2 pr-5 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 md:table-cell md:pr-6">
                  14 days
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const client = clientById.get(f.accountId);
                const s = stats.get(f.id)!;
                const isSelected = selected?.id === f.id;
                return (
                  <tr
                    key={f.id}
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedId(f.id);
                      setPanelOpen(true);
                    }}
                    className={cn("h-[52px] cursor-pointer border-b border-line transition-colors duration-100", isSelected ? "bg-brand-soft/40" : "hover:bg-surface-2/60")}
                  >
                    <td className="px-3 py-1.5 pl-5 md:pl-6">
                      <span className="block truncate font-medium">{f.name}</span>
                      <span className="num block truncate text-xs text-fg-3">{publicPath(f)}</span>
                    </td>
                    <td className="hidden max-w-[180px] truncate whitespace-nowrap px-3 py-1.5 text-fg-2 md:table-cell">{client?.name}</td>
                    <td className="hidden px-3 py-1.5 sm:table-cell">
                      <Tag tone="neutral">{f.status === "live" ? "Live" : "Draft"}</Tag>
                    </td>
                    <td className="num hidden px-3 py-1.5 text-right sm:table-cell">{f.status === "live" ? formatCount(s.visitors) : <span className="text-fg-3">–</span>}</td>
                    <td className="num px-3 py-1.5 text-right">{f.status === "live" ? formatCount(s.leads) : <span className="text-fg-3">–</span>}</td>
                    <td className="num hidden px-3 py-1.5 text-right md:table-cell">{s.rate === null ? <span className="text-fg-3">–</span> : formatRate(s.rate, 1)}</td>
                    <td className="hidden whitespace-nowrap px-3 py-1.5 text-fg-2 2xl:table-cell">{timeAgo(f.updatedAt, now)}</td>
                    <td className="hidden px-3 py-1.5 pr-5 md:table-cell md:pr-6">
                      {f.days.length > 1 ? <Sparkline values={f.days.slice(-14).map((d) => d.leads)} color="var(--chart-2)" /> : <span className="text-xs text-fg-3">–</span>}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-5 py-10 text-center text-sm text-fg-3">
                    No funnels match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <>
          <aside className="sticky top-0 hidden h-screen w-[340px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[380px] 2xl:w-[420px]">
            <FunnelPanel funnel={selected} client={clientById.get(selected.accountId)!} submissions={selectedSubs} now={now} origin={origin} actions={actions} />
          </aside>
          {panelOpen && (
            <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label={selected.name}>
              <button type="button" aria-label="Close panel" onClick={() => setPanelOpen(false)} className="flex-1 bg-rail/40" />
              <aside className="h-full w-[min(100%,400px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                <FunnelPanel funnel={selected} client={clientById.get(selected.accountId)!} submissions={selectedSubs} now={now} origin={origin} actions={actions} onClose={() => setPanelOpen(false)} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
