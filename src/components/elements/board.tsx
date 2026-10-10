"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Pencil, Plus, Search, X } from "lucide-react";
import { Sparkline } from "@/components/charts";
import { ChangeArrow } from "@/components/diagnostic/primitives";
import { CopyField } from "@/components/integrations/ui";
import { ButtonLink } from "@/components/page-header";
import { donateLink, elementGroups, elementSummary, installScript, isOverlay, kindOf, placeholder, type ElementGroup } from "@/lib/elements";
import type { DonationElement } from "@/lib/types";
import { cn, formatCount, formatDollars, formatDollarsCompact, formatRate, timeAgo } from "@/lib/utils";
import type { ElementLive, ElementStats } from "./data";
import { ElementPreview } from "./preview";
import { ElementMark, ElementStatusTag } from "./ui";

/*
 * Elements board: ink top bar, four numbers, the one table, and the
 * selected element in the right panel with its preview, its numbers and
 * the code to place it. Same grammar as Forms, Funnels and Donors.
 */

export interface BoardElement {
  element: Pick<DonationElement, "id" | "accountId" | "campaignId" | "type" | "name" | "status" | "updatedAt" | "config">;
  clientName: string;
  clientSlug: string;
  campaignTitle: string;
  stats: ElementStats;
  gifts: { id: string; donorId: string; name: string; amountCents: number; monthly: boolean; at: string }[];
}

const th = "whitespace-nowrap px-3 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6";
const td = "px-3 py-1.5 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6";
const inkSelect = "h-7 rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none";

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

export function ElementsBoard({ items, lives, clients, origin, nowIso, initialClientId }: { items: BoardElement[]; lives: Record<string, ElementLive>; clients: { id: string; name: string; slug: string }[]; origin: string; nowIso: string; initialClientId?: string }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [clientId, setClientId] = useState(initialClientId ?? "all");
  const [group, setGroup] = useState<"all" | ElementGroup>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const inClient = items.filter((i) => clientId === "all" || i.element.accountId === clientId);
  const q = query.trim().toLowerCase();
  const rows = inClient
    .filter((i) => group === "all" || kindOf(i.element.type).group === group)
    .filter((i) => !q || [i.element.name, i.clientName, i.campaignTitle, kindOf(i.element.type).label].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => Number(a.element.status !== "live") - Number(b.element.status !== "live") || b.stats.last30.raisedCents - a.stats.last30.raisedCents || b.stats.last30.views - a.stats.last30.views);
  const selected = rows.find((i) => i.element.id === selectedId) ?? rows[0] ?? null;

  const sum = (k: "raisedCents" | "gifts" | "opens" | "views", w: "last30" | "last7" | "prev7") => inClient.reduce((a, i) => a + i.stats[w][k], 0);
  const raised30 = sum("raisedCents", "last30");
  const gifts30 = sum("gifts", "last30");
  const opens30 = sum("opens", "last30");
  const views30 = sum("views", "last30");
  const raised7 = sum("raisedCents", "last7");
  const raisedPrev7 = sum("raisedCents", "prev7");
  const live = inClient.filter((i) => i.element.status === "live").length;
  const clientName = clientId === "all" ? undefined : clients.find((c) => c.id === clientId)?.name;
  const newHref = `/agency/elements/new${clientId !== "all" ? `?client=${clientId}` : ""}`;

  const select = (id: string) => {
    setSelectedId(id);
    setPanelOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:flex-nowrap md:px-6">
          <div className="min-w-0 md:shrink-0">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">Elements</h1>
            <p className="num text-xs text-rail-fg-2 md:whitespace-nowrap">
              {clientName ?? "All clients"} · {formatCount(inClient.length)} elements · {formatCount(live)} live
            </p>
          </div>
          <label className="relative order-last w-full md:order-none md:ml-2 md:w-auto md:min-w-[160px] md:max-w-[280px] md:flex-1">
            <span className="sr-only">Search elements</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2" strokeWidth={1.75} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search elements" className="h-8 w-full rounded border border-rail-line bg-rail-2 pl-8 pr-3 text-sm text-rail-fg placeholder:text-rail-fg-2/80 focus:border-rail-fg-2 focus:outline-none" />
          </label>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <select aria-label="Kind" value={group} onChange={(e) => setGroup(e.target.value as typeof group)} className={cn(inkSelect, "hidden sm:block")}>
              <option value="all">Every kind</option>
              {elementGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <select
              aria-label="Client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setSelectedId(null);
              }}
              className={cn(inkSelect, "max-w-[160px]")}
            >
              <option value="all">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ButtonLink href={newHref} className="h-7 whitespace-nowrap px-2.5 text-xs">
              <Plus className="size-3.5" strokeWidth={2.25} />
              <span className="hidden sm:inline">New element</span>
              <span className="sr-only sm:hidden">New element</span>
            </ButtonLink>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6 xl:grid-cols-4">
          <Kpi
            label="Raised · 30 days"
            value={formatDollarsCompact(raised30)}
            aside={
              <span className="inline-flex items-center gap-1">
                <ChangeArrow value={raisedPrev7 ? (raised7 - raisedPrev7) / raisedPrev7 : null} />
                7 days
              </span>
            }
          />
          <Kpi label="Gifts · 30 days" value={formatCount(gifts30)} aside={gifts30 ? `${formatDollars(Math.round(raised30 / gifts30))} avg` : undefined} />
          <Kpi label="Checkout opens" value={formatCount(opens30)} aside={`${formatRate(views30 ? opens30 / views30 : null, 1)} of views`} />
          <Kpi label="Conversion" value={formatRate(opens30 ? gifts30 / opens30 : null)} aside="gifts per open" />
        </div>

        <div className="overflow-x-auto border-y border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={th}>Element</th>
                <th scope="col" className={cn(th, "hidden md:table-cell")}>Client</th>
                <th scope="col" className={cn(th, "hidden sm:table-cell")}>Status</th>
                <th scope="col" className={cn(th, "hidden text-right 2xl:table-cell")}>Views</th>
                <th scope="col" className={cn(th, "hidden text-right xl:table-cell")}>Opens</th>
                <th scope="col" className={cn(th, "hidden text-right lg:table-cell")}>Gifts</th>
                <th scope="col" className={cn(th, "text-right")}>Raised · 30d</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((it) => {
                const { element: e, stats } = it;
                const on = selected?.element.id === e.id;
                const display = stats.last30.opens === 0 && stats.last30.gifts === 0;
                return (
                  <tr
                    key={e.id}
                    aria-selected={on}
                    tabIndex={0}
                    onClick={() => select(e.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        select(e.id);
                      }
                    }}
                    className={cn("h-[52px] cursor-pointer border-b border-line transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand", on ? "bg-brand-soft/40 shadow-[inset_2px_0_0_var(--brand)]" : "hover:bg-surface-2/60")}
                  >
                    <td className={td}>
                      <span className="flex items-center gap-2.5">
                        <ElementMark type={e.type} accent={e.config.accent} />
                        <span className="min-w-0">
                          <span className="block max-w-[26ch] truncate font-medium">{e.name}</span>
                          <span className="block max-w-[26ch] truncate text-xs text-fg-3">
                            {kindOf(e.type).label} · {elementSummary(e)}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={cn(td, "hidden md:table-cell")}>
                      <span className="block max-w-[20ch] truncate text-fg-2">{it.clientName}</span>
                      <span className="block max-w-[20ch] truncate text-xs text-fg-3">{it.campaignTitle}</span>
                    </td>
                    <td className={cn(td, "hidden sm:table-cell")}>
                      <ElementStatusTag status={e.status} />
                    </td>
                    <td className={cn(td, "num hidden text-right text-fg-2 2xl:table-cell")}>{formatCount(stats.last30.views)}</td>
                    <td className={cn(td, "num hidden text-right xl:table-cell")}>
                      {display ? (
                        <span className="text-xs text-fg-3">Display only</span>
                      ) : (
                        <>
                          <span className="text-fg-2">{formatCount(stats.last30.opens)}</span>
                          <span className="block text-xs text-fg-3">{formatRate(stats.last30.openRate, 1)}</span>
                        </>
                      )}
                    </td>
                    <td className={cn(td, "num hidden text-right text-fg-2 lg:table-cell")}>{stats.last30.gifts ? formatCount(stats.last30.gifts) : <span className="text-fg-3">–</span>}</td>
                    <td className={cn(td, "text-right")}>
                      <span className="inline-flex items-center justify-end gap-3">
                        <span className="hidden 2xl:block">{stats.last30.raisedCents > 0 && <Sparkline values={stats.days.slice(-14).map((d) => d.raisedCents)} color="var(--chart-1)" width={56} height={18} />}</span>
                        <span className="num min-w-[7ch] font-medium">{stats.last30.raisedCents ? formatDollars(stats.last30.raisedCents) : <span className="font-normal text-fg-3">–</span>}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-fg-3">
                    {inClient.length === 0 ? (
                      <>
                        No elements yet.{" "}
                        <Link href={newHref} className="font-medium text-fg underline-offset-2 hover:underline">
                          Make the first one
                        </Link>
                      </>
                    ) : (
                      "Nothing matches."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && lives[selected.element.campaignId] && (
        <>
          <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[384px] 2xl:w-[420px]">
            <ElementPanel item={selected} live={lives[selected.element.campaignId]!} origin={origin} now={now} nowIso={nowIso} />
          </aside>
          {panelOpen && (
            <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label={selected.element.name}>
              <button type="button" aria-label="Close panel" onClick={() => setPanelOpen(false)} className="flex-1 bg-rail/40" />
              <aside className="h-full w-[min(100%,420px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                <ElementPanel item={selected} live={lives[selected.element.campaignId]!} origin={origin} now={now} nowIso={nowIso} onClose={() => setPanelOpen(false)} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const button = "inline-flex h-7 items-center gap-1.5 rounded border border-line-strong bg-surface px-2.5 text-xs font-medium text-fg transition-colors duration-150 hover:bg-surface-2";
const inkButton = "inline-flex h-7 items-center gap-1.5 rounded border border-rail bg-rail px-2.5 text-xs font-medium text-rail-fg transition-colors duration-150 hover:bg-rail-2";

function ElementPanel({ item, live, origin, now, nowIso, onClose }: { item: BoardElement; live: ElementLive; origin: string; now: Date; nowIso: string; onClose?: () => void }) {
  const { element: e, stats } = item;
  const overlay = isOverlay(e.type);
  const t = stats.last30;
  const funnel = [
    { label: "Views", value: t.views },
    { label: "Checkout opened", value: t.opens },
    { label: "Gave", value: t.gifts },
  ];
  const top = Math.max(1, t.views);
  return (
    <div>
      <div className="sticky top-0 z-[1] border-b border-line bg-surface px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <ElementMark type={e.type} accent={e.config.accent} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold leading-6 tracking-tight">{e.name}</h2>
            <p className="mt-0.5 truncate text-xs text-fg-3">
              {item.clientName} · {item.campaignTitle}
            </p>
          </div>
          {onClose && (
            <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
              <X className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <ElementStatusTag status={e.status} />
          <span className="text-xs text-fg-3">
            {kindOf(e.type).label} · edited {timeAgo(e.updatedAt, now)}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/agency/elements/${e.id}`} className={inkButton}>
            <Pencil className="size-3.5" strokeWidth={2} />
            Edit element
          </Link>
          <a href={`/e/${e.id}`} target="_blank" rel="noreferrer" className={button}>
            <ArrowUpRight className="size-3.5" strokeWidth={2} />
            Open alone
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-5 py-5">
        <section aria-label="Preview">
          <ElementPreview type={e.type} config={e.config} live={live} nowIso={nowIso} compact />
        </section>

        <section>
          <h3 className="text-sm font-semibold">Last 30 days</h3>
          <div className="mt-2 grid grid-cols-3 divide-x divide-line rounded border border-line">
            {[
              { label: "Raised", value: formatDollars(t.raisedCents) },
              { label: "Gifts", value: formatCount(t.gifts) },
              { label: "Avg gift", value: t.gifts ? formatDollars(Math.round(t.raisedCents / t.gifts)) : "–" },
            ].map((x) => (
              <div key={x.label} className="px-3 py-2.5">
                <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{x.label}</div>
                <div className="num mt-0.5 text-base font-semibold">{x.value}</div>
              </div>
            ))}
          </div>
          {t.raisedCents > 0 && (
            <div className="mt-3 flex items-end justify-between gap-3">
              <Sparkline values={stats.days.map((d) => d.raisedCents)} color="var(--chart-1)" width={260} height={36} />
              <span className="num shrink-0 text-xs text-fg-3">raised per day</span>
            </div>
          )}
          {t.opens > 0 && (
            <ol className="mt-4 flex flex-col gap-2">
              {funnel.map((f, i) => (
                <li key={f.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-fg-2">{f.label}</span>
                  <span className="num text-fg">
                    {formatCount(f.value)}
                    {i > 0 && <span className="ml-1.5 text-fg-3">{formatRate(funnel[i - 1].value ? f.value / funnel[i - 1].value : null, 1)}</span>}
                  </span>
                  <span className="col-span-2 block h-1.5 rounded-[2px] bg-surface-2" aria-hidden>
                    <span className="block h-full rounded-[2px] bg-[var(--chart-1)]" style={{ width: `${Math.max(f.value ? 1.5 : 0, (f.value / top) * 100)}%` }} />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold">Place it</h3>
          {overlay ? (
            <p className="mt-1 text-xs leading-relaxed text-fg-3">No code needed. It shows on every page that loads the Lotus script, by the rules set in the builder.</p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-fg-3">Paste where it should appear. The site loads the Lotus script once.</p>
          )}
          <div className="mt-2 flex flex-col gap-2">
            {!overlay && <CopyField value={placeholder(e.id)} label="Placeholder" />}
            <CopyField value={installScript(origin, e.accountId)} label="Install script" />
            <CopyField value={donateLink(e.id)} label="Donate link" />
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">Gifts through this element</h3>
            <Link href={`/agency/donors?client=${item.clientSlug}`} className="inline-flex items-center gap-1 text-xs font-medium text-fg-2 hover:text-fg">
              Donors
              <ArrowUpRight className="size-3.5" strokeWidth={2} />
            </Link>
          </div>
          {item.gifts.length === 0 ? (
            <p className="mt-2 text-xs text-fg-3">{t.opens === 0 ? "A display element: it builds trust, the gift happens elsewhere." : "No gifts in the last 30 days."}</p>
          ) : (
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {item.gifts.map((g) => (
                <li key={g.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{g.name}</span>
                  <span className="num text-sm">
                    {formatDollars(g.amountCents)}
                    {g.monthly && <span className="text-fg-3">/mo</span>}
                  </span>
                  <span className="num w-[76px] shrink-0 text-right text-xs text-fg-3">{timeAgo(g.at, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
