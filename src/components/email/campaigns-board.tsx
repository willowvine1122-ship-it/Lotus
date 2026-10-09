"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Copy, PenLine, Plus, Search, SquareArrowOutUpRight, Users, X } from "lucide-react";
import { ButtonLink } from "@/components/page-header";
import { Change, SectionTitle } from "@/components/diagnostic/primitives";
import { BarList, LineChart } from "@/components/charts";
import { cn, formatCount, timeAgo } from "@/lib/utils";
import type { CampaignStatus } from "@/lib/types";
import type { CampaignRow, EmailClientRef } from "./data";
import { prettyUrl, sumStats } from "./model";
import { EmailPreview, Kpi, LedgerRow, MergeText, StatusTag, Tile, rate, relativeWhen, tick, when } from "./ui";

/*
 * Campaigns board: the same grammar as the Daily Diagnostic and Contacts.
 * Top bar, four numbers for the last 30 days, one sortable table of every
 * campaign, and the selected campaign in the right panel.
 */

type Key = "name" | "client" | "status" | "when" | "opens" | "clicks" | "unsubs";
interface Sort { key: Key; dir: "asc" | "desc" }

const columns: { key: Key; label: string; className?: string; align?: "right"; defaultDir?: "asc" | "desc" }[] = [
  { key: "name", label: "Campaign", className: "min-w-[220px]" },
  { key: "client", label: "Client", className: "hidden 2xl:table-cell" },
  { key: "status", label: "Status" },
  { key: "when", label: "When and to", className: "hidden md:table-cell", defaultDir: "desc" },
  { key: "opens", label: "Opened", align: "right", className: "hidden sm:table-cell", defaultDir: "desc" },
  { key: "clicks", label: "Clicked", align: "right", className: "hidden sm:table-cell", defaultDir: "desc" },
  { key: "unsubs", label: "Unsubs", align: "right", className: "hidden 2xl:table-cell", defaultDir: "desc" },
];

const statusOrder: Record<CampaignStatus, number> = { scheduled: 0, draft: 1, sent: 2 };
const whenOf = (r: CampaignRow) => r.sentAt ?? r.scheduledFor ?? r.updatedAt;
const DAY = 86400000;
/** Flip an ISO date's sort order so later times sort lower. */
const invert = (iso: string) => String(9e15 - new Date(iso).getTime()).padStart(16, "0");

export function CampaignsBoard({ rows, clients, nowIso, initialClientId, actions }: { rows: CampaignRow[]; clients: EmailClientRef[]; nowIso: string; initialClientId?: string; actions: { duplicate: (id: string) => Promise<void> } }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [clientId, setClientId] = useState(initialClientId ?? "all");
  const [status, setStatus] = useState<"all" | CampaignStatus>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "when", dir: "desc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const inClient = useMemo(() => rows.filter((r) => clientId === "all" || r.accountId === clientId), [rows, clientId]);

  // Each client's average open and click rate, so a row can say whether it beat its own norm.
  const norms = useMemo(() => {
    const m = new Map<string, { open: number | null; click: number | null }>();
    for (const c of clients) {
      const s = sumStats(rows.filter((r) => r.accountId === c.id && r.stats).map((r) => r.stats!));
      m.set(c.id, { open: s.openRate, click: s.clickRate });
    }
    return m;
  }, [rows, clients]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dir = sort.dir === "asc" ? 1 : -1;
    const v = (r: CampaignRow): string | number => {
      switch (sort.key) {
        case "name": return r.name.toLowerCase();
        case "client": return clientById.get(r.accountId)?.name ?? "";
        case "status": return statusOrder[r.status];
        // Upcoming sends lead, soonest first, like a departure board; then the rest by date.
        case "when": return r.status === "scheduled" ? `~${invert(r.scheduledFor!)}` : whenOf(r);
        case "opens": return r.stats?.openRate ?? -1;
        case "clicks": return r.stats?.clickRate ?? -1;
        case "unsubs": return r.stats?.unsubscribed ?? -1;
      }
    };
    return inClient
      .filter((r) => status === "all" || r.status === status)
      .filter((r) => !q || [r.name, r.subject, r.audienceName, clientById.get(r.accountId)?.name ?? ""].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => {
        const av = v(a);
        const bv = v(b);
        const p = av < bv ? -1 : av > bv ? 1 : 0;
        return p !== 0 ? p * dir : whenOf(b).localeCompare(whenOf(a));
      });
  }, [inClient, status, query, sort, clientById]);

  const selected = visible.find((r) => r.id === selectedId) ?? visible[0] ?? null;

  // KPIs: sent in the last 30 days against the 30 before, following the client filter.
  const windowed = (from: number, to: number) => inClient.filter((r) => r.sentAt && now.getTime() - new Date(r.sentAt).getTime() >= from * DAY && now.getTime() - new Date(r.sentAt).getTime() < to * DAY);
  const last = windowed(0, 30);
  const prior = windowed(30, 60);
  const s = sumStats(last.map((r) => r.stats!));
  const p = sumStats(prior.map((r) => r.stats!));
  const delta = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : (a - b) / b);
  const scheduled = inClient.filter((r) => r.status === "scheduled").length;
  const drafts = inClient.filter((r) => r.status === "draft").length;
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const clientSlug = clientId === "all" ? "" : clientById.get(clientId)?.slug ?? "";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:flex-nowrap md:px-6">
          <div className="min-w-0 md:shrink-0">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">Email</h1>
            <p className="num text-xs text-rail-fg-2 md:whitespace-nowrap">
              {date} · {formatCount(inClient.length)} campaigns
              {scheduled > 0 && ` · ${scheduled} scheduled`}
              <span className="hidden 2xl:inline">{drafts > 0 && ` · ${drafts} drafts`}</span>
            </p>
          </div>
          <label className="relative order-last w-full md:order-none md:ml-2 md:w-auto md:min-w-[120px] md:max-w-[260px] md:flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2" strokeWidth={1.75} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search campaigns"
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
              className="h-7 max-w-[130px] rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none"
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
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as typeof status);
                setSelectedId(null);
              }}
              className="h-7 rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none"
            >
              <option value="all">Any status</option>
              <option value="sent">Sent</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Drafts</option>
            </select>
            <Link
              href={clientSlug ? `/agency/email/audiences?client=${clientSlug}` : "/agency/email/audiences"}
              className="inline-flex h-7 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium text-rail-fg hover:bg-rail-line"
            >
              <Users className="size-3.5" strokeWidth={1.75} />
              <span className="hidden 2xl:inline">Audiences</span>
              <span className="sr-only 2xl:hidden">Audiences</span>
            </Link>
            <ButtonLink href={clientSlug ? `/agency/email/new?client=${clientSlug}` : "/agency/email/new"} className="h-7 whitespace-nowrap px-2.5 text-xs">
              <Plus className="size-3.5" strokeWidth={2.25} />
              <span className="hidden 2xl:inline">New campaign</span>
              <span className="sr-only 2xl:hidden">New campaign</span>
            </ButtonLink>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6 xl:grid-cols-4">
          <Kpi label="Emails sent, 30 days" value={formatCount(s.sent)} aside={`${last.length} ${last.length === 1 ? "campaign" : "campaigns"}`} />
          <Kpi label="Open rate" value={rate(s.openRate)} aside={<RateAside value={delta(s.openRate, p.openRate)} />} />
          <Kpi label="Click rate" value={rate(s.clickRate)} aside={s.clickToOpen === null ? undefined : `${rate(s.clickToOpen, 0)} of opens`} />
          <Kpi label="Unsubscribed" value={formatCount(s.unsubscribed)} aside={s.unsubRate === null ? undefined : `${rate(s.unsubRate)} of delivered`} asideTone={s.unsubRate !== null && s.unsubRate > 0.01 ? "amber" : undefined} />
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
                      className={cn("whitespace-nowrap px-3 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6", c.className, c.align === "right" ? "text-right" : "text-left")}
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
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const isSelected = selected?.id === r.id;
                const norm = norms.get(r.accountId);
                return (
                  <tr
                    key={r.id}
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedId(r.id);
                      setPanelOpen(true);
                    }}
                    className={cn("h-[52px] cursor-pointer border-b border-line transition-colors duration-100", isSelected ? "bg-brand-soft/40 shadow-[inset_2px_0_0_var(--brand)]" : "hover:bg-surface-2/60")}
                  >
                    <td className="max-w-[360px] px-3 py-1.5 pl-5 md:pl-6">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-fg-3">
                        <span className="text-fg-2 2xl:hidden">{clientById.get(r.accountId)?.name} · </span>
                        <MergeText text={r.subject} />
                      </span>
                    </td>
                    <td className="hidden max-w-[180px] truncate px-3 py-1.5 text-fg-2 2xl:table-cell">{clientById.get(r.accountId)?.name}</td>
                    <td className="px-3 py-1.5">
                      <StatusTag status={r.status} />
                    </td>
                    <td className="hidden max-w-[200px] px-3 py-1.5 md:table-cell">
                      <span className="num block whitespace-nowrap text-fg-2">
                        {r.status === "sent" && r.sentAt ? when(r.sentAt) : r.status === "scheduled" && r.scheduledFor ? relativeWhen(r.scheduledFor, now) : <span className="text-fg-3">Edited {timeAgo(r.updatedAt, now)}</span>}
                      </span>
                      <span className="block truncate text-xs text-fg-3">
                        <span className="num">{formatCount(r.recipients)}</span> · {r.audienceName}
                      </span>
                    </td>
                    <td className="hidden px-3 py-1.5 text-right sm:table-cell">
                      <Figure value={r.stats?.openRate ?? null} count={r.stats?.opened} norm={norm?.open ?? null} base={r.stats?.delivered ?? 0} />
                    </td>
                    <td className="hidden px-3 py-1.5 text-right sm:table-cell">
                      <Figure value={r.stats?.clickRate ?? null} count={r.stats?.clicked} norm={norm?.click ?? null} base={r.stats?.delivered ?? 0} />
                    </td>
                    <td className="num hidden px-3 py-1.5 pr-6 text-right 2xl:table-cell">{r.stats ? r.stats.unsubscribed || <span className="text-fg-3">0</span> : <span className="text-fg-3">–</span>}</td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-fg-3">
                    {inClient.length === 0 ? (
                      <>
                        No campaigns yet.{" "}
                        <Link href={clientSlug ? `/agency/email/new?client=${clientSlug}` : "/agency/email/new"} className="font-medium text-fg underline-offset-2 hover:underline">
                          Write the first one
                        </Link>
                      </>
                    ) : (
                      "No campaigns match."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <>
          <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[400px] 2xl:w-[440px]">
            <CampaignPanel row={selected} client={clientById.get(selected.accountId)!} now={now} duplicate={actions.duplicate} />
          </aside>
          {panelOpen && (
            <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label={selected.name}>
              <button type="button" aria-label="Close panel" onClick={() => setPanelOpen(false)} className="flex-1 bg-rail/40" />
              <aside className="h-full w-[min(100%,420px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                <CampaignPanel row={selected} client={clientById.get(selected.accountId)!} now={now} duplicate={actions.duplicate} onClose={() => setPanelOpen(false)} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RateAside({ value }: { value: number | null }) {
  if (value === null) return <span>vs prior 30 days</span>;
  return (
    <span className="inline-flex items-baseline gap-1">
      <Change value={value} /> vs prior 30 days
    </span>
  );
}

/** A rate with its count beneath, and how it compares with the client's own average. */
function Figure({ value, count, norm, base }: { value: number | null; count?: number; norm: number | null; base: number }) {
  if (value === null) return <span className="text-fg-3">–</span>;
  // Small sends swing wildly; only compare once there is enough to compare.
  const vs = norm && base >= 15 ? (value - norm) / norm : null;
  return (
    <>
      <span className="flex items-baseline justify-end gap-1.5">
        {vs !== null && Math.abs(vs) >= 0.1 && <Change value={vs} className="text-2xs" />}
        <span className="num font-medium">{rate(value)}</span>
      </span>
      <span className="num block text-2xs text-fg-3">{formatCount(count ?? 0)}</span>
    </>
  );
}

export function CampaignPanel({ row, client, now, duplicate, onClose }: { row: CampaignRow; client: EmailClientRef; now: Date; duplicate: (id: string) => Promise<void>; onClose?: () => void }) {
  const sent = row.status === "sent" && row.stats;
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-2.5 border-b border-line bg-surface px-5 pb-4 pt-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 tracking-tight">
              <span className="truncate">{row.name}</span>
              <Link href={`/agency/email/${row.id}`} aria-label={sent ? "Open report" : "Open editor"} className="text-fg-3 hover:text-fg">
                <SquareArrowOutUpRight className="size-4" strokeWidth={1.75} />
              </Link>
            </h2>
            <p className="truncate text-xs text-fg-3">
              <Link href={`/agency/clients/${client.slug}`} className="hover:underline">
                {client.name}
              </Link>
              {" · "}
              {row.audienceName}
            </p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
              <X className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag status={row.status} />
          <span className="num text-xs text-fg-2">
            {row.status === "sent" && row.sentAt ? `Sent ${when(row.sentAt)}` : row.status === "scheduled" && row.scheduledFor ? `Goes out ${relativeWhen(row.scheduledFor, now)}` : `Edited ${timeAgo(row.updatedAt, now)}`}
          </span>
          <span className="ml-auto flex items-center gap-1">
            {!sent && (
              <Link href={`/agency/email/${row.id}`} className="inline-flex h-7 items-center gap-1.5 rounded border border-line-strong px-2 text-xs font-medium text-fg hover:bg-surface-2">
                <PenLine className="size-3.5" strokeWidth={1.75} />
                Edit
              </Link>
            )}
            <form action={duplicate.bind(null, row.id)}>
              <button type="submit" className="inline-flex h-7 items-center gap-1.5 rounded border border-line-strong px-2 text-xs font-medium text-fg hover:bg-surface-2">
                <Copy className="size-3.5" strokeWidth={1.75} />
                Duplicate
              </button>
            </form>
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-6 px-5 py-5">
        {sent ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Tile label="Delivered" value={formatCount(row.stats!.delivered)} sub={row.stats!.bounced ? `${row.stats!.bounced} bounced` : "No bounces"} />
              <Tile label="Opened" value={rate(row.stats!.openRate)} sub={`${formatCount(row.stats!.opened)} people`} />
              <Tile label="Clicked" value={rate(row.stats!.clickRate)} sub={`${rate(row.stats!.clickToOpen, 0)} of opens`} />
              <Tile label="Unsubscribed" value={formatCount(row.stats!.unsubscribed)} sub={rate(row.stats!.unsubRate)} />
            </div>
            {row.engagement && (
              <section className="flex flex-col gap-3">
                <SectionTitle sub="First seven days after sending">Engagement</SectionTitle>
                <LineChart
                  labels={row.engagement.labels}
                  series={[
                    { key: "opens", label: "Opens", color: "var(--chart-1)", values: row.engagement.opens },
                    { key: "clicks", label: "Clicks", color: "var(--chart-2)", values: row.engagement.clicks },
                  ]}
                  format={tick}
                  height={170}
                />
              </section>
            )}
            <section className="flex flex-col gap-3">
              <SectionTitle sub="Clicks per link">Links</SectionTitle>
              {row.links.length ? (
                <BarList items={row.links.map((l) => ({ key: l.url, label: prettyUrl(l.url), value: l.clicks }))} color="var(--chart-1)" format={(v) => formatCount(v)} />
              ) : (
                <p className="text-xs text-fg-3">No clicks yet.</p>
              )}
            </section>
          </>
        ) : (
          <section className="flex flex-col gap-2">
            <SectionTitle>Ready to send</SectionTitle>
            <div className="rounded border border-line bg-surface-2/40 px-3.5">
              <LedgerRow label="Audience">{row.audienceName}</LedgerRow>
              <LedgerRow label="Will receive it">
                <span className="num">{formatCount(row.recipients)}</span>
              </LedgerRow>
              <LedgerRow label="From">{row.fromName}</LedgerRow>
              <LedgerRow label="Subject">
                <MergeText text={row.subject} empty="Missing" />
              </LedgerRow>
            </div>
          </section>
        )}
        <section className="flex flex-col gap-3">
          <SectionTitle sub="As it lands in an inbox">Email</SectionTitle>
          <EmailPreview {...row} clientName={client.name} location={client.location} firstName="Dana" lastName="River" mobile />
        </section>
      </div>
    </div>
  );
}
