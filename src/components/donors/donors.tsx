"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronsUpDown, ExternalLink, Search } from "lucide-react";
import { BarList } from "@/components/charts";
import { Segmented, StatusDot, Tag } from "@/components/diagnostic/primitives";
import { ButtonLink, PageHeader } from "@/components/page-header";
import { countryTotals, donorStateHealth, type CampaignTotal, type DonorRow } from "@/lib/fundraising";
import type { Health } from "@/lib/types";
import { cn, formatCount, formatDollars, formatDollarsCompact, formatRate, timeAgo } from "@/lib/utils";
import { DonorPanel } from "./panel";

/*
 * Donor CRM. Same composition as the Daily Diagnostic: an ink top bar, four
 * numbers, then the one table, with the selected donor in a panel on the
 * right. Campaign totals and raised by country sit between the numbers and
 * the table because they answer "where is the money coming from" before
 * "who gave it".
 */

const PAGE = 50;

type Filter = "all" | "monthly" | "lapsed" | "new";
type SortKey = "health" | "name" | "client" | "country" | "lifetime" | "last" | "monthly" | "first";
interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

const healthOrder: Record<Health, number> = { red: 0, amber: 1, green: 2 };

function sortValue(r: DonorRow, key: SortKey): number | string {
  switch (key) {
    case "health":
      return healthOrder[donorStateHealth[r.state]] * 1e12 - r.lifetimeCents;
    case "name":
      return r.name.toLowerCase();
    case "client":
      return r.clientName.toLowerCase();
    case "country":
      return r.countryName.toLowerCase();
    case "lifetime":
      return r.lifetimeCents;
    case "last":
      return r.lastGiftAt ?? "";
    case "monthly":
      return r.plan && r.plan.status !== "canceled" ? r.plan.amountCents : -1;
    case "first":
      return r.firstGiftAt ?? "";
  }
}

interface Column {
  key: SortKey;
  label: string;
  align?: "right";
  className?: string;
  defaultDir?: "asc" | "desc";
}

function Kpi({ label, value, aside, tone }: { label: string; value: string; aside?: string; tone?: "red" | "amber" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded border border-line bg-surface px-4 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-3">
      <div className="min-w-0">
        <div className="whitespace-nowrap text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{label}</div>
        <div className="num mt-0.5 text-xl font-semibold leading-7">{value}</div>
      </div>
      {aside && <div className={cn("num whitespace-nowrap text-xs sm:ml-auto sm:text-right", tone === "red" ? "text-red" : tone === "amber" ? "text-amber" : "text-fg-3")}>{aside}</div>}
    </div>
  );
}

export function Donors({
  rows,
  campaigns,
  campaignTitles,
  clients,
  nowIso,
}: {
  rows: DonorRow[];
  campaigns: CampaignTotal[];
  campaignTitles: Record<string, string>;
  clients: { id: string; name: string; slug: string }[];
  nowIso: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [clientId, setClientId] = useState<string>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "health", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const scoped = useMemo(() => (clientId === "all" ? rows : rows.filter((r) => r.accountId === clientId)), [rows, clientId]);
  const scopedCampaigns = useMemo(
    () => (clientId === "all" ? campaigns : campaigns.filter((c) => c.accountId === clientId)).slice().sort((a, b) => b.raisedCents - a.raisedCents),
    [campaigns, clientId],
  );

  const counts = useMemo(
    () => ({
      all: scoped.length,
      monthly: scoped.filter((r) => r.plan && (r.plan.status === "active" || r.plan.status === "past_due")).length,
      lapsed: scoped.filter((r) => r.state === "lapsed").length,
      new: scoped.filter((r) => r.state === "new").length,
      failed: scoped.filter((r) => r.state === "past_due").length,
    }),
    [scoped],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = scoped.filter((r) => {
      if (filter === "monthly" && !(r.plan && (r.plan.status === "active" || r.plan.status === "past_due"))) return false;
      if (filter === "lapsed" && r.state !== "lapsed") return false;
      if (filter === "new" && r.state !== "new") return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.countryName.toLowerCase().includes(q) || (r.city ?? "").toLowerCase().includes(q);
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      const p = av < bv ? -1 : av > bv ? 1 : 0;
      return p !== 0 ? p * dir : a.name.localeCompare(b.name);
    });
  }, [scoped, filter, query, sort]);

  const selected = visible.find((r) => r.id === selectedId) ?? visible[0] ?? null;
  const single = clientId !== "all";
  const singleClient = clients.find((c) => c.id === clientId);

  // The four numbers, for the chosen client or all of them.
  const raised12 = scoped.reduce((a, r) => a + r.last12Cents, 0);
  const activeDonors = scoped.filter((r) => r.state !== "lapsed").length;
  const live = scoped.filter((r) => r.plan?.status === "active");
  const mrr = live.reduce((a, r) => a + (r.plan?.amountCents ?? 0), 0);
  const lapsedValue = scoped.filter((r) => r.state === "lapsed").reduce((a, r) => a + r.lastGiftCents, 0);
  const countriesList = useMemo(() => countryTotals(scoped), [scoped]);

  const columns: Column[] = [
    { key: "name", label: "Donor", className: "min-w-[220px]" },
    ...(single ? [] : [{ key: "client" as const, label: "Client", className: "hidden xl:table-cell" }]),
    { key: "country", label: "Country", className: "hidden md:table-cell" },
    { key: "lifetime", label: "Lifetime", align: "right", defaultDir: "desc" },
    { key: "last", label: "Last gift", align: "right", className: "hidden sm:table-cell", defaultDir: "desc" },
    { key: "monthly", label: "Monthly", align: "right", className: "hidden md:table-cell", defaultDir: "desc" },
    { key: "first", label: "Since", align: "right", className: "hidden 2xl:table-cell" },
  ];

  const meta = (
    <span className="num">
      {formatCount(scoped.length)} donors{single ? "" : ` across ${clients.length} clients`}
      {counts.failed > 0 && <span className="text-[#ff8a95]"> · {counts.failed} failed payment{counts.failed === 1 ? "" : "s"}</span>}
      {counts.lapsed > 0 && <span className="text-[#ffc46b]"> · {counts.lapsed} lapsed</span>}
    </span>
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          className="items-center pb-3 pt-3 md:flex-nowrap md:px-6"
          title={<span className="text-lg leading-6">Donors</span>}
          meta={meta}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative w-full sm:w-[220px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2" strokeWidth={1.75} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setLimit(PAGE);
                  }}
                  placeholder="Search name, email, country"
                  className="h-8 w-full rounded border border-rail-line bg-rail-2 pl-8 pr-3 text-sm text-rail-fg placeholder:text-rail-fg-2/80 focus:border-rail-fg-2 focus:outline-none"
                />
              </label>
              <select
                aria-label="Client"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setSelectedId(null);
                  setLimit(PAGE);
                }}
                className="h-8 w-full rounded border sm:w-auto sm:max-w-[200px] border-rail-line bg-rail-2 px-2 text-sm font-medium text-rail-fg focus:outline-none"
              >
                <option value="all">All fundraising clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {singleClient && (
                <ButtonLink href={`/donate/${singleClient.slug}`} className="shrink-0">
                  <ExternalLink className="size-4" strokeWidth={2} />
                  Donation page
                </ButtonLink>
              )}
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6 xl:grid-cols-4">
          <Kpi label="Raised, 12 months" value={formatDollarsCompact(raised12)} aside={`${formatCount(scoped.filter((r) => r.last12Cents > 0).length)} donors gave`} />
          <Kpi label="Active donors" value={formatCount(activeDonors)} aside={`${formatCount(counts.new)} new in 30 days`} />
          <Kpi
            label="Monthly giving"
            value={formatDollarsCompact(mrr)}
            aside={counts.failed > 0 ? `${counts.failed} failed · ${live.length} active` : `${formatCount(live.length)} active plans`}
            tone={counts.failed > 0 ? "red" : undefined}
          />
          <Kpi
            label="Lapsed donors"
            value={formatCount(counts.lapsed)}
            aside={counts.lapsed ? `${formatDollarsCompact(lapsedValue)} last gifts` : "None"}
            tone={counts.lapsed ? "amber" : undefined}
          />
        </div>

        <div className="grid gap-x-8 gap-y-6 border-t border-line bg-surface px-5 py-5 md:px-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(240px,1fr)]">
          <CampaignTable campaigns={scopedCampaigns} showClient={!single} />
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold">Raised by country</h2>
              <span className="text-xs text-fg-3">Last 12 months</span>
            </div>
            {countriesList.length ? (
              <BarList
                items={countriesList.slice(0, 7).map((c) => ({ key: c.code, label: `${c.name} · ${c.donors} donor${c.donors === 1 ? "" : "s"}`, value: c.raisedCents }))}
                color="var(--chart-1)"
                format={formatDollarsCompact}
              />
            ) : (
              <p className="rounded border border-dashed border-line-strong px-3.5 py-4 text-center text-xs text-fg-3">No gifts in the last 12 months yet.</p>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-5 pb-3 pt-5 md:px-6">
          <h2 className="text-sm font-semibold">
            Donors <span className="num font-normal text-fg-3">{formatCount(visible.length)}</span>
          </h2>
          <Segmented
            tone="paper"
            label="Show donors"
            value={filter}
            onChange={(f) => {
              setFilter(f);
              setSelectedId(null);
              setLimit(PAGE);
            }}
            options={[
              { value: "all", label: `All ${counts.all}` },
              { value: "monthly", label: `Monthly ${counts.monthly}` },
              { value: "lapsed", label: `Lapsed ${counts.lapsed}` },
              { value: "new", label: `New ${counts.new}` },
            ]}
          />
        </div>

        <div className="flex-1 overflow-x-auto border-b border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-[1] bg-surface">
              <tr className="border-y border-line">
                {columns.map((c) => {
                  const active = sort.key === c.key;
                  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={cn("whitespace-nowrap px-3 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6", c.className, c.align === "right" ? "text-right" : "text-left")}
                    >
                      <button
                        type="button"
                        onClick={() => setSort(active ? { key: c.key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: c.defaultDir ?? "asc" })}
                        className={cn("inline-flex items-center gap-1 rounded hover:text-fg", active && "text-fg", c.align === "right" && "flex-row-reverse")}
                      >
                        {c.label}
                        <Icon className={cn("size-3", !active && "opacity-60")} strokeWidth={2} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, limit).map((r) => {
                const isSel = selected?.id === r.id;
                const plan = r.plan && r.plan.status !== "canceled" ? r.plan : null;
                return (
                  <tr
                    key={r.id}
                    onClick={() => {
                      setSelectedId(r.id);
                      setPanelOpen(true);
                    }}
                    aria-selected={isSel}
                    className={cn(
                      "h-[52px] cursor-pointer border-b border-line transition-colors duration-100 hover:bg-surface-2/60",
                      isSel && "bg-surface-2 shadow-[inset_2px_0_0_var(--rail)] hover:bg-surface-2",
                    )}
                  >
                    <td className="px-3 py-2 pl-5 md:pl-6">
                      <div className="flex items-center gap-2.5">
                        <StatusDot health={donorStateHealth[r.state]} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(r.id);
                                setPanelOpen(true);
                              }}
                              className="truncate text-left font-medium hover:underline"
                            >
                              {r.name}
                            </button>
                            {r.state === "past_due" && <Tag tone="neutral">Payment failed</Tag>}
                            {r.state === "lapsed" && <Tag>Lapsed</Tag>}
                            {r.state === "new" && <Tag tone="neutral">New</Tag>}
                            {r.major && <Tag tone="neutral">Major</Tag>}
                          </div>
                          <div className="truncate text-2xs text-fg-3">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    {!single && <td className="hidden max-w-[180px] truncate px-3 py-2 text-fg-2 xl:table-cell">{r.clientName}</td>}
                    <td className="hidden px-3 py-2 md:table-cell">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="num w-6 text-2xs font-medium text-fg-3">{r.countryCode}</span>
                        <span className="text-fg-2">{r.countryName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="num font-medium">{formatDollars(r.lifetimeCents)}</div>
                      <div className="num text-2xs text-fg-3">
                        {r.giftCount} gift{r.giftCount === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 text-right sm:table-cell">
                      <div className="num">{r.lastGiftAt ? formatDollars(r.lastGiftCents) : "–"}</div>
                      <div className={cn("num whitespace-nowrap text-2xs", r.state === "lapsed" ? "text-amber" : "text-fg-3")}>{r.lastGiftAt ? timeAgo(r.lastGiftAt, now) : "Never"}</div>
                    </td>
                    <td className="hidden px-3 py-2 text-right md:table-cell">
                      {plan ? (
                        <>
                          <div className="num font-medium">
                            {formatDollars(plan.amountCents)}
                            <span className="font-normal text-fg-3">/mo</span>
                          </div>
                          <div className={cn("whitespace-nowrap text-2xs", plan.status === "past_due" ? "text-red" : "text-fg-3")}>{plan.status === "past_due" ? "Card declined" : plan.status === "paused" ? "Paused" : "Active"}</div>
                        </>
                      ) : (
                        <span className="text-fg-3">–</span>
                      )}
                    </td>
                    <td className="num hidden whitespace-nowrap px-3 py-2 pr-5 text-right text-fg-2 md:pr-6 2xl:table-cell">
                      {r.firstGiftAt ? new Date(r.firstGiftAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "–"}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-10 text-center text-sm text-fg-3">
                    {scoped.length === 0 ? "No donors yet. Gifts made on the donation page appear here." : "No donors match."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {visible.length > limit && (
            <div className="flex items-center justify-center gap-3 border-t border-line px-5 py-3 text-sm">
              <span className="num text-fg-3">
                Showing {limit} of {formatCount(visible.length)}
              </span>
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="h-8 rounded border border-line-strong bg-surface px-3 font-medium transition-colors duration-150 hover:bg-surface-2">
                Show {Math.min(PAGE, visible.length - limit)} more
              </button>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <>
          <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block 2xl:w-[400px]">
            <DonorPanel row={selected} now={now} campaignTitles={campaignTitles} showClient={!single} />
          </aside>
          {panelOpen && (
            <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label={selected.name}>
              <button type="button" aria-label="Close donor" onClick={() => setPanelOpen(false)} className="flex-1 bg-rail/40" />
              <aside className="h-full w-[min(100%,400px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                <DonorPanel row={selected} now={now} campaignTitles={campaignTitles} showClient={!single} onClose={() => setPanelOpen(false)} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CampaignTable({ campaigns, showClient }: { campaigns: CampaignTotal[]; showClient: boolean }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Campaigns</h2>
        <span className="text-xs text-fg-3">All time</span>
      </div>
      {campaigns.length === 0 ? (
        <p className="rounded border border-dashed border-line-strong px-3.5 py-4 text-center text-xs text-fg-3">No campaigns yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-2xs uppercase tracking-[0.06em] text-fg-3">
                <th scope="col" className="py-1.5 pr-3 text-left font-medium">Campaign</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">Raised</th>
                <th scope="col" className="hidden px-3 py-1.5 text-left font-medium sm:table-cell">Goal</th>
                <th scope="col" className="hidden px-3 py-1.5 text-right font-medium md:table-cell">Donors</th>
                <th scope="col" className="hidden px-3 py-1.5 text-right font-medium md:table-cell">Monthly</th>
                <th scope="col" className="w-8 py-1.5 pl-2">
                  <span className="sr-only">Open donation page</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const pct = c.goalCents ? c.raisedCents / c.goalCents : 0;
                return (
                  <tr key={c.id} className="group border-b border-line last:border-b-0">
                    <td className="max-w-[280px] py-2 pr-3">
                      <div className="truncate font-medium">{c.title}</div>
                      {showClient && <div className="truncate text-2xs text-fg-3">{c.clientName}</div>}
                    </td>
                    <td className="num px-3 py-2 text-right font-medium">{formatDollarsCompact(c.raisedCents)}</td>
                    <td className="hidden px-3 py-2 sm:table-cell">
                      <div className="flex w-[132px] items-center gap-2">
                        <span className="block h-1.5 flex-1 rounded-[2px] bg-surface-2" aria-hidden>
                          <span className="block h-full rounded-[2px] bg-chart-1" style={{ width: `${Math.min(100, pct * 100)}%` }} />
                        </span>
                        <span className="num w-9 text-right text-xs text-fg-2">{formatRate(pct)}</span>
                      </div>
                      <div className="num text-2xs text-fg-3">of {formatDollarsCompact(c.goalCents)}</div>
                    </td>
                    <td className="num hidden px-3 py-2 text-right text-fg-2 md:table-cell">{formatCount(c.donors)}</td>
                    <td className="num hidden px-3 py-2 text-right text-fg-2 md:table-cell">
                      {c.monthlyCents ? (
                        <>
                          {formatDollarsCompact(c.monthlyCents)}
                          <span className="text-fg-3">/mo</span>
                        </>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <a
                        href={`/donate/${c.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Open donation page"
                        className="inline-grid size-7 place-items-center rounded text-fg-3 transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
                      >
                        <ArrowUpRight className="size-4" strokeWidth={1.75} />
                        <span className="sr-only">Open the {c.title} donation page</span>
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
