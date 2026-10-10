"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, KanbanSquare, Plus, Search } from "lucide-react";
import { ButtonLink } from "@/components/page-header";
import { Avatar, Tag } from "@/components/diagnostic/primitives";
import type { Assignee, Contact, ContactActivity, Pipeline } from "@/lib/types";
import { cn, formatCount, formatDollars, formatDollarsCompact, timeAgo } from "@/lib/utils";
import { ContactPanel, type ContactActions } from "./contact-panel";
import { daysBetween, fullName, isOpen, personFor, sourceLabel, stageIndex, stageOf, type ClientRef } from "./model";

/*
 * Contacts board: top bar, KPI strip, the table, and the contact panel.
 * Same grammar as the Daily Diagnostic so the two screens read as one tool.
 */

type Key = "name" | "client" | "stage" | "source" | "value" | "activity" | "owner";
interface Sort { key: Key; dir: "asc" | "desc" }

const columns: { key: Key; label: string; className?: string; align?: "right"; defaultDir?: "asc" | "desc" }[] = [
  { key: "name", label: "Contact", className: "min-w-[200px]" },
  { key: "client", label: "Client", className: "hidden md:table-cell" },
  { key: "stage", label: "Stage" },
  { key: "source", label: "Source", className: "hidden xl:table-cell" },
  { key: "value", label: "Value", align: "right", className: "hidden sm:table-cell", defaultDir: "desc" },
  { key: "activity", label: "Last activity", className: "hidden md:table-cell", defaultDir: "desc" },
  { key: "owner", label: "Owner", className: "hidden 2xl:table-cell" },
];

function Kpi({ label, value, aside }: { label: string; value: string; aside?: string }) {
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

export function ContactsBoard({
  contacts,
  activities,
  clients,
  pipelines,
  team,
  nowIso,
  initialClientId,
  actions,
}: {
  contacts: Contact[];
  activities: ContactActivity[];
  clients: ClientRef[];
  pipelines: Record<string, Pipeline>;
  team: Assignee[];
  nowIso: string;
  initialClientId?: string;
  actions: ContactActions;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [clientId, setClientId] = useState(initialClientId ?? "all");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"open" | "all">("open");
  const [sort, setSort] = useState<Sort>({ key: "activity", dir: "desc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const inClient = useMemo(() => contacts.filter((c) => clientId === "all" || c.accountId === clientId), [contacts, clientId]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dir = sort.dir === "asc" ? 1 : -1;
    const v = (c: Contact): string | number => {
      switch (sort.key) {
        case "name": return fullName(c).toLowerCase();
        case "client": return clientById.get(c.accountId)?.name ?? "";
        case "stage": return stageIndex(pipelines[c.accountId], c.stageId);
        case "source": return c.source;
        case "value": return c.valueCents;
        case "activity": return c.lastActivityAt;
        case "owner": return c.ownerName ?? "zz";
      }
    };
    return inClient
      .filter((c) => scope === "all" || isOpen(pipelines[c.accountId], c))
      .filter((c) => !q || [fullName(c), c.email ?? "", c.phone ?? "", c.company ?? "", c.city ?? "", ...c.tags, clientById.get(c.accountId)?.name ?? ""].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => {
        const av = v(a);
        const bv = v(b);
        const p = av < bv ? -1 : av > bv ? 1 : 0;
        return p !== 0 ? p * dir : fullName(a).localeCompare(fullName(b));
      });
  }, [inClient, query, scope, sort, pipelines, clientById]);

  const selected = rows.find((c) => c.id === selectedId) ?? rows[0] ?? null;
  const selectedActivities = useMemo(() => (selected ? activities.filter((a) => a.contactId === selected.id).sort((a, b) => b.at.localeCompare(a.at)) : []), [activities, selected]);

  // KPIs follow the client filter, not the search.
  const newWeek = inClient.filter((c) => daysBetween(c.createdAt, now) < 7).length;
  const open = inClient.filter((c) => isOpen(pipelines[c.accountId], c));
  const won = inClient.filter((c) => stageOf(pipelines[c.accountId], c.stageId).outcome === "won");
  const wonRecent = won.filter((c) => daysBetween(c.lastActivityAt, now) < 30);
  const monthly = inClient.filter((c) => c.recurring);
  const sum = (xs: Contact[]) => xs.reduce((a, c) => a + c.valueCents, 0);
  const fundraisingOnly = clientId !== "all" && clientById.get(clientId)?.mode === "fundraising";

  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:flex-nowrap md:px-6">
          <div className="min-w-0 md:shrink-0">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">Contacts</h1>
            <p className="num text-xs text-rail-fg-2 md:whitespace-nowrap">
              {date} · {formatCount(inClient.length)} contacts
              {newWeek > 0 && ` · ${newWeek} new this week`}
            </p>
          </div>
          <label className="relative order-last w-full md:order-none md:ml-2 md:w-auto md:min-w-[160px] md:flex-1 md:max-w-[280px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2" strokeWidth={1.75} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search names, emails, phones, tags"
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
              aria-label="Scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as "open" | "all")}
              className="h-7 rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none"
            >
              <option value="open">Open</option>
              <option value="all">Everyone</option>
            </select>
            <Link
              href={clientId === "all" ? "/agency/opportunities" : `/agency/opportunities?client=${clientById.get(clientId)?.slug ?? ""}`}
              className="inline-flex h-7 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium text-rail-fg hover:bg-rail-line"
            >
              <KanbanSquare className="size-3.5" strokeWidth={1.75} />
              <span className="hidden 2xl:inline">Pipeline</span>
              <span className="sr-only 2xl:hidden">Pipeline</span>
            </Link>
            <ButtonLink href={clientId === "all" ? "/agency/contacts/new" : `/agency/contacts/new?client=${clientId}`} className="h-7 whitespace-nowrap px-2.5 text-xs">
              <Plus className="size-3.5" strokeWidth={2.25} />
              <span className="hidden 2xl:inline">Add contact</span>
              <span className="sr-only 2xl:hidden">Add contact</span>
            </ButtonLink>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6 xl:grid-cols-4">
          <Kpi label="Contacts" value={formatCount(inClient.length)} aside={`${formatCount(newWeek)} new this week`} />
          <Kpi label="Open pipeline" value={formatCount(open.length)} aside={fundraisingOnly ? `${formatCount(open.filter((c) => c.valueCents > 0).length)} have given` : `${formatDollarsCompact(sum(open))} est. value`} />
          <Kpi label={fundraisingOnly ? "Monthly donors" : "Won"} value={formatCount(fundraisingOnly ? monthly.length : won.length)} aside={fundraisingOnly ? `${formatDollarsCompact(sum(monthly))} lifetime` : `${formatCount(wonRecent.length)} in the last 30 days`} />
          <Kpi label={fundraisingOnly ? "Lifetime giving" : "Won value"} value={formatDollarsCompact(fundraisingOnly ? sum(inClient) : sum(won))} aside={fundraisingOnly ? `${formatCount(inClient.filter((c) => c.valueCents > 0).length)} donors` : `${formatDollarsCompact(sum(wonRecent))} last 30 days`} />
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
                        {c.key === "value" && fundraisingOnly ? "Lifetime giving" : c.label}
                        <Icon className={cn("size-3", !active && "opacity-60")} strokeWidth={2} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const client = clientById.get(c.accountId);
                const stage = stageOf(pipelines[c.accountId], c.stageId);
                const owner = personFor(team, c.ownerName);
                const isSelected = selected?.id === c.id;
                return (
                  <tr
                    key={c.id}
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedId(c.id);
                      setPanelOpen(true);
                    }}
                    className={cn("h-[52px] cursor-pointer border-b border-line transition-colors duration-100", isSelected ? "bg-brand-soft/40" : "hover:bg-surface-2/60")}
                  >
                    <td className="px-3 py-1.5 pl-5 md:pl-6">
                      <span className="block truncate font-medium">{fullName(c)}</span>
                      <span className="block truncate text-xs text-fg-3">{c.email ?? c.phone ?? (c.city || "No contact details")}</span>
                    </td>
                    <td className="hidden max-w-[180px] truncate whitespace-nowrap px-3 py-1.5 text-fg-2 md:table-cell">{client?.name}</td>
                    <td className="px-3 py-1.5">
                      <Tag tone="neutral">{stage.name}</Tag>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-1.5 text-fg-2 xl:table-cell">{sourceLabel[c.source]}</td>
                    <td className="num hidden px-3 py-1.5 text-right sm:table-cell">{c.valueCents ? formatDollars(c.valueCents) : <span className="text-fg-3">–</span>}</td>
                    <td className="hidden px-3 py-1.5 text-fg-2 md:table-cell">{timeAgo(c.lastActivityAt, now)}</td>
                    <td className="hidden px-3 py-1.5 pr-6 2xl:table-cell">{owner ? <Avatar person={owner} /> : <span className="text-fg-3">–</span>}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-10 text-center text-sm text-fg-3">
                    No contacts match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <>
          <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[384px] 2xl:w-[420px]">
            <ContactPanel contact={selected} client={clientById.get(selected.accountId)!} pipeline={pipelines[selected.accountId]!} activities={selectedActivities} team={team} now={now} actions={actions} />
          </aside>
          {panelOpen && (
            <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label={fullName(selected)}>
              <button type="button" aria-label="Close panel" onClick={() => setPanelOpen(false)} className="flex-1 bg-rail/40" />
              <aside className="h-full w-[min(100%,400px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                <ContactPanel contact={selected} client={clientById.get(selected.accountId)!} pipeline={pipelines[selected.accountId]!} activities={selectedActivities} team={team} now={now} actions={actions} onClose={() => setPanelOpen(false)} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
