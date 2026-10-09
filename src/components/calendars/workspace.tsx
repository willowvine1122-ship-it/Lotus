"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Plus, Search } from "lucide-react";
import { Kpi } from "@/components/diagnostic/diagnostic";
import { Segmented } from "@/components/diagnostic/primitives";
import { ButtonLink } from "@/components/page-header";
import { dayIn, formatDay, formatDuration, formatTime, hoursSummary, needsOutcome, tzAbbr } from "@/lib/calendars";
import type { AccountMode, Appointment, Calendar, Health } from "@/lib/types";
import { cn, formatRate, timeAgo } from "@/lib/utils";
import { BookingPanel } from "./panel";
import { BookingStatus } from "./status";

/*
 * Calendars workspace. Bookings: the KPI strip, one timeline table of every
 * client's appointments grouped by day, and the booking panel on the right.
 * Calendars: one row per calendar with its types, hours and booking link.
 */

export interface ClientLite {
  id: string;
  name: string;
  slug: string;
  mode: AccountMode;
  timeZone: string;
  health: Health;
}

export type View = "bookings" | "calendars";
type Filter = "upcoming" | "outcome" | "past" | "cancelled";

export function CalendarsWorkspace({
  view,
  calendars,
  appointments,
  clients,
  nowIso,
}: {
  view: View;
  calendars: Calendar[];
  appointments: Appointment[];
  clients: ClientLite[];
  nowIso: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [query, setQuery] = useState("");
  const [clientId, setClientId] = useState("all");
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const calById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const clientsWithCalendars = useMemo(() => clients.filter((c) => calendars.some((k) => k.accountId === c.id)), [clients, calendars]);

  const scoped = useMemo(() => appointments.filter((a) => clientId === "all" || a.accountId === clientId), [appointments, clientId]);

  const counts = useMemo(() => {
    const t = now.getTime();
    return {
      upcoming: scoped.filter((a) => a.status !== "cancelled" && new Date(a.endsAt).getTime() > t).length,
      outcome: scoped.filter((a) => needsOutcome(a, now)).length,
    };
  }, [scoped, now]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const t = now.getTime();
    const list = scoped.filter((a) => {
      const end = new Date(a.endsAt).getTime();
      if (filter === "upcoming" && (a.status === "cancelled" || end <= t)) return false;
      if (filter === "outcome" && !needsOutcome(a, now)) return false;
      if (filter === "past" && (a.status === "cancelled" || end > t)) return false;
      if (filter === "cancelled" && a.status !== "cancelled") return false;
      if (!q) return true;
      const cal = calById.get(a.calendarId);
      const type = cal?.types.find((x) => x.id === a.typeId);
      return [a.contact.name, a.contact.email, a.contact.phone ?? "", clientById.get(a.accountId)?.name ?? "", cal?.name ?? "", type?.name ?? ""].some((v) => v.toLowerCase().includes(q));
    });
    const dir = filter === "upcoming" ? 1 : -1;
    return list.sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0) * dir);
  }, [scoped, filter, query, now, calById, clientById]);

  const selected = rows.find((a) => a.id === selectedId) ?? rows[0] ?? null;
  const selectedCal = selected ? calById.get(selected.calendarId) : undefined;
  const scopedCalendars = calendars.filter((c) => clientId === "all" || c.accountId === clientId);

  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-rail text-rail-fg">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-5 pt-3 md:flex-nowrap md:px-6">
            <div className="min-w-0 md:shrink-0">
              <h1 className="text-lg font-semibold leading-6 tracking-tight">Calendars</h1>
              <p className="text-xs text-rail-fg-2 md:whitespace-nowrap">
                {date} · <span className="num">{scopedCalendars.length}</span> calendar{scopedCalendars.length === 1 ? "" : "s"}
                {counts.outcome > 0 && (
                  <span className="text-[#ffc46b]">
                    {" · "}
                    <span className="num">{counts.outcome}</span> need{counts.outcome === 1 ? "s" : ""} an outcome
                  </span>
                )}
              </p>
            </div>
            <label className="relative order-last w-full md:order-none md:ml-2 md:w-auto md:min-w-[120px] md:max-w-[320px] md:flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2" strokeWidth={1.75} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={view === "bookings" ? "Search people, clients, appointments" : "Search calendars"}
                className="h-8 w-full rounded border border-rail-line bg-rail-2 pl-8 pr-3 text-sm text-rail-fg placeholder:text-rail-fg-2/80 focus:border-rail-fg-2 focus:outline-none"
              />
            </label>
            <div className="flex w-full items-center gap-2 md:ml-auto md:w-auto md:shrink-0">
              <select
                aria-label="Client"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setSelectedId(null);
                }}
                className="h-7 min-w-0 flex-1 rounded border md:max-w-[180px] md:flex-none border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none"
              >
                <option value="all">All clients</option>
                {clientsWithCalendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ButtonLink href="/agency/calendars/new" className="h-7 whitespace-nowrap px-2.5 text-xs">
                <Plus className="size-3.5" strokeWidth={2.25} />
                <span className="hidden sm:inline">New calendar</span>
                <span className="sr-only sm:hidden">New calendar</span>
              </ButtonLink>
            </div>
          </div>
          <nav aria-label="Calendar sections" className="mt-2 flex gap-1 overflow-x-auto px-3 md:px-4">
            {(
              [
                { key: "bookings", label: "Bookings", href: "/agency/calendars", count: counts.upcoming },
                { key: "calendars", label: "Calendars", href: "/agency/calendars?view=calendars", count: scopedCalendars.length },
              ] as const
            ).map((t) => (
              <Link
                key={t.key}
                href={t.href}
                aria-current={view === t.key ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-1.5 whitespace-nowrap border-b-2 px-2 text-sm transition-colors duration-150",
                  view === t.key ? "border-surface text-rail-fg" : "border-transparent text-rail-fg-2 hover:text-rail-fg",
                )}
              >
                {t.label}
                <span className="num rounded-[4px] bg-rail-2 px-1.5 text-2xs">{t.count}</span>
              </Link>
            ))}
          </nav>
        </header>

        {view === "bookings" ? (
          <>
            <KpiStrip appointments={scoped} now={now} />
            <div className="flex flex-wrap items-center gap-3 border-t border-line bg-surface px-5 py-2.5 md:px-6">
              <Segmented
                tone="paper"
                label="Show"
                value={filter}
                onChange={(f) => {
                  setFilter(f);
                  setSelectedId(null);
                }}
                options={[
                  { value: "upcoming", label: "Upcoming" },
                  { value: "outcome", label: counts.outcome ? `Needs outcome ${counts.outcome}` : "Needs outcome" },
                  { value: "past", label: "Past" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
              />
              <span className="num ml-auto text-xs text-fg-3">
                {rows.length} booking{rows.length === 1 ? "" : "s"}
              </span>
            </div>
            <BookingsTable
              rows={rows}
              now={now}
              calById={calById}
              clientById={clientById}
              selectedId={selected?.id ?? null}
              empty={filter === "outcome" ? "Every past booking has an outcome. Nothing to mark." : query ? "No bookings match the search." : "No bookings here yet."}
              onSelect={(id) => {
                setSelectedId(id);
                setPanelOpen(true);
              }}
            />
          </>
        ) : (
          <CalendarsTable calendars={scopedCalendars.filter((c) => !query.trim() || [c.name, clientById.get(c.accountId)?.name ?? "", c.ownerName, ...c.types.map((t) => t.name)].some((v) => v.toLowerCase().includes(query.trim().toLowerCase())))} appointments={appointments} clientById={clientById} now={now} />
        )}
      </div>

      {view === "bookings" && selected && selectedCal && (
        <>
          <aside className="sticky top-0 hidden h-screen w-[340px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[360px] 2xl:w-[420px]">
            <BookingPanel appointment={selected} calendar={selectedCal} client={clientById.get(selected.accountId)} history={appointments} now={now} />
          </aside>
          {panelOpen && (
            <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label={selected.contact.name}>
              <button type="button" aria-label="Close panel" onClick={() => setPanelOpen(false)} className="flex-1 bg-rail/40" />
              <aside className="h-full w-[min(100%,400px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                <BookingPanel appointment={selected} calendar={selectedCal} client={clientById.get(selected.accountId)} history={appointments} now={now} onClose={() => setPanelOpen(false)} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------- KPIs ------------------------------- */

function KpiStrip({ appointments, now }: { appointments: Appointment[]; now: Date }) {
  const t = now.getTime();
  const day = 86400000;
  const live = appointments.filter((a) => a.status !== "cancelled");
  const next7 = live.filter((a) => {
    const s = new Date(a.startsAt).getTime();
    return new Date(a.endsAt).getTime() > t && s < t + 7 * day;
  });
  const today = live.filter((a) => {
    const s = new Date(a.startsAt).getTime();
    return s >= t - 12 * 3600000 && s < t + 12 * 3600000 && new Date(a.endsAt).getTime() > t;
  }).length;
  const bookedWeek = appointments.filter((a) => new Date(a.createdAt).getTime() > t - 7 * day);
  const fromPage = bookedWeek.filter((a) => a.source === "booking_page").length;
  const month = appointments.filter((a) => new Date(a.endsAt).getTime() > t - 30 * day && new Date(a.endsAt).getTime() <= t);
  const showed = month.filter((a) => a.status === "showed").length;
  const noShow = month.filter((a) => a.status === "no_show").length;
  const outcome = appointments.filter((a) => needsOutcome(a, now)).length;
  const unconfirmed = next7.filter((a) => a.status === "booked").length;
  return (
    <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6 xl:grid-cols-4">
      <Kpi label="Next 7 days" value={String(next7.length)} aside={`${unconfirmed} unconfirmed`} asideClassName={unconfirmed ? "text-amber" : undefined} />
      <Kpi label="Booked this week" value={String(bookedWeek.length)} aside={`${formatRate(bookedWeek.length ? fromPage / bookedWeek.length : null)} self-booked`} />
      <Kpi label="Show rate · 30 days" value={formatRate(showed + noShow ? showed / (showed + noShow) : null)} aside={`${noShow} no-show${noShow === 1 ? "" : "s"}`} />
      <Kpi label="Needs outcome" value={String(outcome)} aside={outcome ? "past, not marked" : `${today} still today`} asideClassName={outcome ? "text-amber" : undefined} />
    </div>
  );
}

/* --------------------------- bookings table ------------------------- */

const thClass = "whitespace-nowrap px-3 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6";

function BookingsTable({
  rows,
  now,
  calById,
  clientById,
  selectedId,
  onSelect,
  empty,
}: {
  rows: Appointment[];
  now: Date;
  calById: Map<string, Calendar>;
  clientById: Map<string, ClientLite>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  empty: string;
}) {
  const groups: { day: string; tz: string; items: Appointment[] }[] = [];
  for (const a of rows) {
    const tz = calById.get(a.calendarId)?.timeZone ?? "UTC";
    const day = dayIn(new Date(a.startsAt), tz);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(a);
    else groups.push({ day, tz, items: [a] });
  }
  const relative = (day: string, tz: string) => {
    const today = dayIn(now, tz);
    if (day === today) return "Today";
    if (day === dayIn(new Date(now.getTime() + 86400000), tz)) return "Tomorrow";
    if (day === dayIn(new Date(now.getTime() - 86400000), tz)) return "Yesterday";
    return null;
  };

  return (
    <div className="flex-1 overflow-x-auto border-t border-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={cn(thClass, "w-[112px]")}>Time</th>
            <th scope="col" className={thClass}>Contact</th>
            <th scope="col" className={cn(thClass, "hidden sm:table-cell")}>Client</th>
            <th scope="col" className={cn(thClass, "hidden md:table-cell")}>Appointment</th>
            <th scope="col" className={thClass}>Status</th>
                        <th scope="col" className={cn(thClass, "hidden text-right 2xl:table-cell")}>Booked</th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.day}>
            <tr className="border-b border-line bg-bg">
              <th scope="colgroup" colSpan={6} className="px-5 py-1.5 text-left md:px-6">
                <span className="flex items-baseline gap-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
                  {relative(g.day, g.tz) && <span className="text-fg">{relative(g.day, g.tz)}</span>}
                  {formatDay(g.day, { weekday: "short", month: "short", day: "numeric" })}
                  <span className="num ml-auto normal-case tracking-normal">
                    {g.items.length} booking{g.items.length === 1 ? "" : "s"}
                  </span>
                </span>
              </th>
            </tr>
            {g.items.map((a) => {
              const cal = calById.get(a.calendarId);
              const type = cal?.types.find((t) => t.id === a.typeId);
              const tz = cal?.timeZone ?? "UTC";
              const start = new Date(a.startsAt);
              const isSelected = a.id === selectedId;
              const cancelled = a.status === "cancelled";
              return (
                <tr
                  key={a.id}
                  onClick={() => onSelect(a.id)}
                  aria-selected={isSelected}
                  className={cn(
                    "h-[52px] cursor-pointer border-b border-line transition-colors duration-100 hover:bg-surface-2/60",
                    isSelected && "bg-surface-2 shadow-[inset_2px_0_0_var(--rail)] hover:bg-surface-2",
                  )}
                >
                  <td className="whitespace-nowrap px-3 py-2 pl-5 md:pl-6">
                    <div className={cn("num font-medium", cancelled && "text-fg-3 line-through")}>{formatTime(start, tz)}</div>
                    <div className="num text-xs text-fg-3">
                      {tzAbbr(start, tz)} · {formatDuration(type?.durationMinutes ?? Math.round((new Date(a.endsAt).getTime() - start.getTime()) / 60000))}
                    </div>
                  </td>
                  <td className="max-w-[220px] px-3 py-2">
                    <button type="button" className="block max-w-full truncate text-left font-medium hover:underline" onClick={() => onSelect(a.id)}>
                      {a.contact.name}
                    </button>
                    <div className="num truncate text-xs text-fg-3">{a.contact.phone ?? a.contact.email}</div>
                  </td>
                  <td className="hidden max-w-[220px] px-3 py-2 sm:table-cell">
                    <div className="truncate">{clientById.get(a.accountId)?.name}</div>
                    <div className="truncate text-xs text-fg-3">{cal?.name}</div>
                  </td>
                  <td className="hidden max-w-[200px] px-3 py-2 md:table-cell">
                    <div className="truncate text-fg-2">{type?.name ?? "Appointment"}</div>
                    {a.notes && (
                      <div className="truncate text-xs text-fg-3" title={a.notes}>
                        {a.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <BookingStatus appointment={a} now={now} />
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2 pr-5 text-right text-xs text-fg-3 md:pr-6 2xl:table-cell">{timeAgo(a.createdAt, now)}</td>
                </tr>
              );
            })}
          </tbody>
        ))}
        {rows.length === 0 && (
          <tbody>
            <tr>
              <td colSpan={6} className="px-5 py-12 text-center text-sm text-fg-3">
                {empty}
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  );
}

/* --------------------------- calendars table ------------------------ */

function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(`${window.location.origin}${path}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="grid size-7 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg"
      title="Copy booking link"
    >
      {copied ? <Check className="size-4 text-green" strokeWidth={2} /> : <Copy className="size-4" strokeWidth={1.75} />}
      <span className="sr-only">{copied ? "Copied" : "Copy booking link"}</span>
    </button>
  );
}

function CalendarsTable({ calendars, appointments, clientById, now }: { calendars: Calendar[]; appointments: Appointment[]; clientById: Map<string, ClientLite>; now: Date }) {
  const t = now.getTime();
  const day = 86400000;
  return (
    <div className="flex-1 overflow-x-auto bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={thClass}>Calendar</th>
            <th scope="col" className={cn(thClass, "hidden md:table-cell")}>Appointment types</th>
            <th scope="col" className={cn(thClass, "hidden xl:table-cell")}>Hours</th>
            <th scope="col" className={cn(thClass, "text-right")}>Next 7 days</th>
            <th scope="col" className={cn(thClass, "hidden text-right sm:table-cell")}>Show rate</th>
            <th scope="col" className={cn(thClass, "text-right")}>Booking page</th>
          </tr>
        </thead>
        <tbody>
          {calendars.map((c) => {
            const mine = appointments.filter((a) => a.calendarId === c.id);
            const next = mine.filter((a) => a.status !== "cancelled" && new Date(a.endsAt).getTime() > t && new Date(a.startsAt).getTime() < t + 7 * day).length;
            const month = mine.filter((a) => new Date(a.endsAt).getTime() <= t && new Date(a.endsAt).getTime() > t - 30 * day);
            const showed = month.filter((a) => a.status === "showed").length;
            const noShow = month.filter((a) => a.status === "no_show").length;
            const rate = showed + noShow ? showed / (showed + noShow) : null;
            const active = c.types.filter((x) => x.active);
            return (
              <tr key={c.id} className="group h-[56px] border-b border-line transition-colors duration-100 hover:bg-surface-2/60">
                <td className="max-w-[260px] px-3 py-2 pl-5 md:pl-6">
                  <Link href={`/agency/calendars/${c.id}`} className="block truncate font-medium group-hover:underline">
                    {c.name}
                  </Link>
                  <div className="truncate text-xs text-fg-3">
                    {clientById.get(c.accountId)?.name} · {c.ownerName}
                  </div>
                </td>
                <td className="hidden max-w-[320px] px-3 py-2 md:table-cell">
                  <div className="truncate text-fg-2">{active.map((x) => x.name).join(", ") || <span className="text-fg-3">None active</span>}</div>
                  <div className="num truncate text-xs text-fg-3">{active.map((x) => formatDuration(x.durationMinutes)).join(" · ")}</div>
                </td>
                <td className="hidden max-w-[260px] px-3 py-2 text-fg-2 xl:table-cell">
                  <span className="num block truncate" title={hoursSummary(c.weekly)}>
                    {hoursSummary(c.weekly)}
                  </span>
                  <span className="text-xs text-fg-3">{tzAbbr(now, c.timeZone)}</span>
                </td>
                <td className="num px-3 py-2 text-right font-medium">{next || <span className="font-normal text-fg-3">0</span>}</td>
                <td className={cn("num hidden px-3 py-2 text-right sm:table-cell", rate === null ? "text-fg-3" : rate < 0.7 ? "text-red" : "text-fg")}>{formatRate(rate)}</td>
                <td className="px-3 py-2 pr-5 md:pr-6">
                  <span className="flex items-center justify-end gap-1">
                    {c.bookingEnabled ? (
                      <>
                        <span className="mr-1 hidden max-w-[180px] truncate text-xs text-fg-3 2xl:inline">/book/{c.slug}</span>
                        <CopyLink path={`/book/${c.slug}`} />
                        <a href={`/book/${c.slug}`} target="_blank" rel="noreferrer" className="grid size-7 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg" title="Open booking page">
                          <ExternalLink className="size-4" strokeWidth={1.75} />
                          <span className="sr-only">Open booking page</span>
                        </a>
                      </>
                    ) : (
                      <span className="text-xs text-fg-3">Off</span>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
          {calendars.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-12 text-center text-sm text-fg-3">
                No calendars match.{" "}
                <Link href="/agency/calendars/new" className="font-medium text-fg underline">
                  Create one
                </Link>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
