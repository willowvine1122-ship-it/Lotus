"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Pencil, Search, X } from "lucide-react";
import { FormNotice, SubmitButton } from "@/components/form";
import { SectionTitle, Tag } from "@/components/diagnostic/primitives";
import type { ActionState } from "@/app/agency/reports/actions";
import type { ReportSend } from "@/lib/types";
import { cn, formatCount, timeAgo } from "@/lib/utils";
import { useDetailPanel } from "@/lib/use-detail-panel";
import type { ReportClient } from "./data";
import { nextSend, rangeLabel, scheduleLabel, sectionLabel } from "./model";

/*
 * Reports board: every client's weekly report on one screen. Who gets it,
 * when, what went last. The panel sends now and links to the builder.
 */

type Key = "name" | "schedule" | "recipients" | "last" | "next" | "status";
interface Sort { key: Key; dir: "asc" | "desc" }
const columns: { key: Key; label: string; className?: string; defaultDir?: "asc" | "desc" }[] = [
  { key: "name", label: "Client", className: "min-w-[200px]" },
  { key: "schedule", label: "Schedule", className: "hidden md:table-cell" },
  { key: "recipients", label: "Recipients", className: "hidden 2xl:table-cell" },
  { key: "last", label: "Last sent", className: "hidden sm:table-cell", defaultDir: "desc" },
  { key: "next", label: "Next", className: "hidden md:table-cell" },
  { key: "status", label: "Status" },
];

function Kpi({ label, value, aside, attention }: { label: string; value: string; aside?: string; attention?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col rounded border border-line bg-surface px-4 py-3">
      <div className="whitespace-nowrap text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{label}</div>
      <div className="num mt-0.5 text-xl font-semibold leading-7">{value}</div>
      <div className={cn("num mt-1 truncate text-xs", attention ? "font-medium text-amber" : "text-fg-3")}>{aside ?? "\u00a0"}</div>
    </div>
  );
}

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

function SendNow({ client, sendNow }: { client: ReportClient; sendNow: (accountId: string) => Promise<ActionState> }) {
  const [state, action] = useActionState(async () => sendNow(client.id), null);
  return (
    <form action={action} className="flex items-center gap-3">
      <SubmitButton pendingLabel="Sending…">Send now</SubmitButton>
      <FormNotice state={state} />
    </form>
  );
}

function Panel({ client, sends, now, sendNow, onClose }: { client: ReportClient; sends: ReportSend[]; now: Date; sendNow: (accountId: string) => Promise<ActionState>; onClose?: () => void }) {
  const cfg = client.config;
  const next = nextSend(cfg, now);
  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 flex items-start gap-2 border-b border-line bg-surface px-5 pb-4 pt-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-6 tracking-tight">{client.name}</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-3">
            <span>{cfg.enabled ? scheduleLabel(cfg) : "Schedule off"}</span>
            <span>·</span>
            <span>{rangeLabel(cfg.range)}</span>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close panel" title="Close (Esc)" className="grid size-7 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
            <X className="size-4" strokeWidth={2} />
          </button>
        )}
      </header>
      <div className="flex flex-col gap-6 px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <SendNow key={client.id} client={client} sendNow={sendNow} />
          <Link href={`/agency/reports/${client.slug}`} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded border border-line bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2">
            <Pencil className="size-3.5" strokeWidth={2} />
            Edit report
          </Link>
        </div>
        <section className="flex flex-col gap-2">
          <SectionTitle sub={cfg.enabled ? `Next goes ${fmtDate(next)}` : "Turn the schedule on in the builder"}>Recipients</SectionTitle>
          {cfg.recipients.length ? (
            <ul className="flex flex-col divide-y divide-line rounded border border-line bg-surface">
              {cfg.recipients.map((r) => (
                <li key={r} className="num truncate px-3.5 py-2 text-sm">
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-3">Nobody yet.</p>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <SectionTitle>Sections</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {cfg.sections.map((s) => (
              <Tag key={s} tone="neutral">
                {sectionLabel[s]}
              </Tag>
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <SectionTitle sub="Scheduled and sent by hand">History</SectionTitle>
          {sends.length ? (
            <ol className="flex flex-col divide-y divide-line rounded border border-line bg-surface">
              {sends.slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm">
                  <span>
                    <span className="block">{fmtDate(new Date(s.at))}</span>
                    <span className="block text-xs text-fg-3">
                      {s.kind === "manual" ? "Sent by hand" : "Scheduled"} · {formatCount(s.recipients.length)} {s.recipients.length === 1 ? "person" : "people"}
                    </span>
                  </span>
                  <span className="num shrink-0 text-xs text-fg-3">{timeAgo(s.at, now)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-fg-3">Nothing sent yet.</p>
          )}
        </section>
        <p className="text-xs leading-relaxed text-fg-3">Each send goes out through the email module, one message per recipient; in demo mode it is recorded as delivered without leaving the machine. The client can always open theirs at /c/{client.slug}.</p>
      </div>
    </div>
  );
}

export function ReportsBoard({ clients, sends, nowIso, initialClientId, sendNow }: { clients: ReportClient[]; sends: ReportSend[]; nowIso: string; initialClientId?: string; sendNow: (accountId: string) => Promise<ActionState> }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "next", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(initialClientId ?? null);
  const panel = useDetailPanel();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dir = sort.dir === "asc" ? 1 : -1;
    const v = (c: ReportClient): string | number => {
      switch (sort.key) {
        case "name": return c.name.toLowerCase();
        case "schedule": return c.config.weekday * 24 + c.config.hour;
        case "recipients": return c.config.recipients.length;
        case "last": return c.lastSend?.at ?? "";
        case "next": return c.config.enabled ? nextSend(c.config, now).getTime() : Number.MAX_SAFE_INTEGER;
        case "status": return c.config.enabled ? 1 : 0;
      }
    };
    return clients
      .filter((c) => !q || [c.name, ...c.config.recipients].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => {
        const av = v(a);
        const bv = v(b);
        const p = av < bv ? -1 : av > bv ? 1 : 0;
        return p !== 0 ? p * dir : a.name.localeCompare(b.name);
      });
  }, [clients, query, sort, now]);

  const selected = rows.find((c) => c.id === selectedId) ?? rows[0] ?? null;
  const on = clients.filter((c) => c.config.enabled);
  const sent7 = sends.filter((s) => (now.getTime() - new Date(s.at).getTime()) / 86400000 < 7);
  const dueWeek = on.filter((c) => (nextSend(c.config, now).getTime() - now.getTime()) / 86400000 < 7);
  const noRecipients = on.filter((c) => c.config.recipients.length === 0);
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:flex-nowrap md:px-6">
          <div className="min-w-0 md:shrink-0">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">Reports</h1>
            <p className="num text-xs text-rail-fg-2 md:whitespace-nowrap">
              {date} · {formatCount(on.length)} of {formatCount(clients.length)} clients get a weekly report
            </p>
          </div>
          <label className="relative order-last w-full md:order-none md:ml-2 md:w-auto md:min-w-[180px] md:flex-1 md:max-w-[280px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2" strokeWidth={1.75} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients and recipients" className="h-8 w-full rounded border border-rail-line bg-rail-2 pl-8 pr-3 text-sm text-rail-fg placeholder:text-rail-fg-2/80 focus:border-rail-fg-2 focus:outline-none" />
          </label>
        </header>

        <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6 xl:grid-cols-4">
          <Kpi label="Weekly reports on" value={formatCount(on.length)} aside={`${formatCount(clients.length - on.length)} off`} />
          <Kpi label="Sent, 7 days" value={formatCount(sent7.length)} aside={`${formatCount(sent7.filter((s) => s.kind === "manual").length)} by hand`} />
          <Kpi label="Due this week" value={formatCount(dueWeek.length)} aside={dueWeek[0] ? `next ${fmtDate(nextSend(dueWeek[0].config, now))}` : undefined} />
          <Kpi label="Missing recipients" value={formatCount(noRecipients.length)} aside={noRecipients.length ? "Schedule on, nobody to send to" : "Everyone covered"} attention={noRecipients.length > 0} />
        </div>

        <div className="overflow-x-auto border-y border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                {columns.map((c) => {
                  const active = sort.key === c.key;
                  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
                  return (
                    <th key={c.key} scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("whitespace-nowrap px-3 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6", c.className)}>
                      <button type="button" onClick={() => setSort(active ? { key: c.key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: c.defaultDir ?? "asc" })} className={cn("inline-flex items-center gap-1 hover:text-fg", active && "text-fg")}>
                        {c.label}
                        <Icon className={cn("size-3", !active && "opacity-60")} strokeWidth={2} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const isSelected = selected?.id === c.id;
                const cfg = c.config;
                return (
                  <tr key={c.id} aria-selected={isSelected} tabIndex={0} onClick={() => { setSelectedId(c.id); panel.show(); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(c.id); panel.show(); } }} className={cn("h-[52px] cursor-pointer border-b border-line transition-colors duration-100 focus-visible:outline-none focus-visible:bg-surface-2", isSelected ? "bg-brand-soft/40" : "hover:bg-surface-2/60")}>
                    <td className="max-w-[220px] px-3 py-1.5 pl-5 md:pl-6">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-fg-3">{rangeLabel(cfg.range)} · {formatCount(cfg.sections.length)} sections</span>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-1.5 text-fg-2 md:table-cell">{scheduleLabel(cfg)}</td>
                    <td className="hidden max-w-[240px] px-3 py-1.5 2xl:table-cell">
                      {cfg.recipients.length ? <span className="num block truncate text-fg-2">{cfg.recipients.join(", ")}</span> : <span className="text-fg-3">–</span>}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-1.5 text-fg-2 sm:table-cell">{c.lastSend ? timeAgo(c.lastSend.at, now) : <span className="text-fg-3">Never</span>}</td>
                    <td className="hidden whitespace-nowrap px-3 py-1.5 text-fg-2 md:table-cell">{cfg.enabled ? fmtDate(nextSend(cfg, now)) : <span className="text-fg-3">–</span>}</td>
                    <td className="px-3 py-1.5 pr-5 md:pr-6">
                      <Tag tone={cfg.enabled && cfg.recipients.length === 0 ? "amber" : "neutral"}>{cfg.enabled ? (cfg.recipients.length ? "Weekly" : "No recipients") : "Off"}</Tag>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-10 text-center text-sm text-fg-3">No clients match.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <>
          {panel.docked && (
          <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[384px] 2xl:w-[420px]">
            <Panel client={selected} sends={sends.filter((s) => s.accountId === selected.id)} now={now} sendNow={sendNow} onClose={panel.close} />
          </aside>
          )}
          {panel.open && (
            <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label={selected.name}>
              <button type="button" aria-label="Close panel" onClick={panel.close} className="flex-1 bg-rail/40" />
              <aside className="h-full w-[min(100%,400px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                <Panel client={selected} sends={sends.filter((s) => s.accountId === selected.id)} now={now} sendNow={sendNow} onClose={panel.close} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
