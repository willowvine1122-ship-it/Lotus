"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { Tag } from "@/components/diagnostic/primitives";
import type {
  Contact,
  ReputationSettings,
  Review,
  ReviewRequest,
  ReviewSource,
} from "@/lib/types";
import { cn, formatCount, formatRate, timeAgo } from "@/lib/utils";
import {
  averageRating,
  channelLabel,
  daysBetween,
  requestStatusLabel,
  sourceLabel,
  triggerLabel,
  windowed,
  type ClientRef,
} from "./model";
import {
  RequestsPanel,
  ReviewPanel,
  Stars,
  type ReputationActions,
} from "./review-panel";

/*
 * Reputation board. Two views on one screen: Reviews (the inbox across
 * Google and Facebook, with the reply panel) and Requests (what went out
 * after jobs, appointments and gifts, with the rules panel). Same grammar
 * as Contacts: ink top bar, KPI strip, dense table, sticky panel.
 */

type View = "reviews" | "requests";
type RKey = "author" | "client" | "source" | "rating" | "status" | "at";
type QKey = "contact" | "client" | "channel" | "trigger" | "status" | "sentAt";
interface Sort<K> {
  key: K;
  dir: "asc" | "desc";
}
interface Column<K> {
  key: K;
  label: string;
  className?: string;
  align?: "right";
  defaultDir?: "asc" | "desc";
}

const reviewColumns: Column<RKey>[] = [
  { key: "author", label: "Review", className: "w-[44%] min-w-[220px]" },
  { key: "client", label: "Client", className: "hidden md:table-cell" },
  { key: "source", label: "Source", className: "hidden 2xl:table-cell" },
  { key: "rating", label: "Rating", defaultDir: "desc" },
  { key: "status", label: "Status", className: "hidden sm:table-cell" },
  {
    key: "at",
    label: "Posted",
    className: "hidden md:table-cell",
    defaultDir: "desc",
  },
];

const requestColumns: Column<QKey>[] = [
  { key: "contact", label: "Contact", className: "min-w-[200px]" },
  { key: "client", label: "Client", className: "hidden md:table-cell" },
  { key: "channel", label: "Sent by", className: "hidden sm:table-cell" },
  { key: "trigger", label: "Trigger", className: "hidden xl:table-cell" },
  { key: "status", label: "Status" },
  {
    key: "sentAt",
    label: "Sent",
    className: "hidden md:table-cell",
    defaultDir: "desc",
  },
];

function Kpi({
  label,
  value,
  aside,
  attention,
  children,
}: {
  label: string;
  value: string;
  aside?: string;
  attention?: "amber" | "red";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded border border-line bg-surface px-4 py-3">
      <div className="whitespace-nowrap text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
        {label}
      </div>
      <div className="num mt-0.5 flex items-center gap-2 text-xl font-semibold leading-7">
        {value}
        {children}
      </div>
      <div
        className={cn(
          "num mt-1 truncate text-xs",
          attention === "red"
            ? "font-medium text-red"
            : attention === "amber"
              ? "font-medium text-amber"
              : "text-fg-3",
        )}
      >
        {aside ?? "\u00a0"}
      </div>
    </div>
  );
}

function HeaderCell<K extends string>({
  c,
  sort,
  onSort,
}: {
  c: Column<K>;
  sort: Sort<K>;
  onSort: (s: Sort<K>) => void;
}) {
  const active = sort.key === c.key;
  const Icon = active
    ? sort.dir === "asc"
      ? ArrowUp
      : ArrowDown
    : ChevronsUpDown;
  return (
    <th
      scope="col"
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
      }
      className={cn(
        "whitespace-nowrap px-3 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6",
        c.className,
        c.align === "right" ? "text-right" : "text-left",
      )}
    >
      <button
        type="button"
        onClick={() =>
          onSort(
            active
              ? { key: c.key, dir: sort.dir === "asc" ? "desc" : "asc" }
              : { key: c.key, dir: c.defaultDir ?? "asc" },
          )
        }
        className={cn(
          "inline-flex items-center gap-1 hover:text-fg",
          active && "text-fg",
        )}
      >
        {c.label}
        <Icon
          className={cn("size-3", !active && "opacity-60")}
          strokeWidth={2}
        />
      </button>
    </th>
  );
}

const rowClass = (selected: boolean) =>
  cn(
    "h-[52px] cursor-pointer border-b border-line transition-colors duration-100 focus-visible:outline-none focus-visible:bg-surface-2",
    selected ? "bg-brand-soft/40" : "hover:bg-surface-2/60",
  );
const keyActivate = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

export function ReputationBoard({
  reviews,
  requests,
  contacts,
  clients,
  settings,
  nowIso,
  initialView = "reviews",
  initialClientId,
  actions,
}: {
  reviews: Review[];
  requests: ReviewRequest[];
  contacts: Contact[];
  clients: ClientRef[];
  settings: Record<string, ReputationSettings>;
  nowIso: string;
  initialView?: View;
  initialClientId?: string;
  actions: ReputationActions;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [view, setView] = useState<View>(initialView);
  const [clientId, setClientId] = useState(initialClientId ?? "all");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | ReviewSource>("all");
  const [scope, setScope] = useState<"needs" | "all">("all");
  const [rSort, setRSort] = useState<Sort<RKey>>({ key: "at", dir: "desc" });
  const [qSort, setQSort] = useState<Sort<QKey>>({
    key: "sentAt",
    dir: "desc",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  );

  const inClient = useMemo(
    () => reviews.filter((r) => clientId === "all" || r.accountId === clientId),
    [reviews, clientId],
  );
  const requestsInClient = useMemo(
    () =>
      requests.filter((r) => clientId === "all" || r.accountId === clientId),
    [requests, clientId],
  );

  const reviewRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dir = rSort.dir === "asc" ? 1 : -1;
    const v = (r: Review): string | number => {
      switch (rSort.key) {
        case "author":
          return r.author.toLowerCase();
        case "client":
          return clientById.get(r.accountId)?.name ?? "";
        case "source":
          return r.source;
        case "rating":
          return r.rating;
        case "status":
          return r.reply ? 1 : 0;
        case "at":
          return r.at;
      }
    };
    return inClient
      .filter((r) => source === "all" || r.source === source)
      .filter((r) => scope === "all" || !r.reply)
      .filter(
        (r) =>
          !q ||
          [r.author, r.body, clientById.get(r.accountId)?.name ?? ""].some(
            (s) => s.toLowerCase().includes(q),
          ),
      )
      .sort((a, b) => {
        const av = v(a);
        const bv = v(b);
        const p = av < bv ? -1 : av > bv ? 1 : 0;
        return p !== 0 ? p * dir : b.at.localeCompare(a.at);
      });
  }, [inClient, query, source, scope, rSort, clientById]);

  const requestRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dir = qSort.dir === "asc" ? 1 : -1;
    const order = { sent: 0, opened: 1, reviewed: 2 };
    const v = (r: ReviewRequest): string | number => {
      switch (qSort.key) {
        case "contact":
          return r.contactName.toLowerCase();
        case "client":
          return clientById.get(r.accountId)?.name ?? "";
        case "channel":
          return r.channel;
        case "trigger":
          return r.trigger;
        case "status":
          return order[r.status];
        case "sentAt":
          return r.sentAt;
      }
    };
    return requestsInClient
      .filter(
        (r) =>
          !q ||
          [
            r.contactName,
            clientById.get(r.accountId)?.name ?? "",
            triggerLabel[r.trigger],
          ].some((s) => s.toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        const av = v(a);
        const bv = v(b);
        const p = av < bv ? -1 : av > bv ? 1 : 0;
        return p !== 0 ? p * dir : b.sentAt.localeCompare(a.sentAt);
      });
  }, [requestsInClient, query, qSort, clientById]);

  // The selection survives a filter it no longer matches (a review just replied to under "Needs reply"), so the confirmation stays in view.
  const selectedReview =
    view === "reviews"
      ? (inClient.find((r) => r.id === selectedId) ?? reviewRows[0] ?? null)
      : null;
  // In Requests view the panel belongs to a client, not a row: the one picked in the filter, or the client of the clicked row, or the first.
  const panelClientId =
    view === "requests"
      ? clientId !== "all"
        ? clientId
        : (requestRows.find((r) => r.id === selectedId)?.accountId ??
          requestRows[0]?.accountId ??
          clients[0]?.id ??
          null)
      : null;
  const panelClient = panelClientId
    ? (clientById.get(panelClientId) ?? null)
    : null;

  // KPIs follow the client filter, not the search.
  const { cur, prev } = windowed(inClient, now, 30);
  const avg30 = averageRating(cur);
  const avgPrev = averageRating(prev);
  const needsReply = inClient.filter((r) => !r.reply);
  const oldestNeedDays = needsReply.length
    ? daysBetween(needsReply[needsReply.length - 1]!.at, now)
    : 0;
  const thisMonth = inClient.filter(
    (r) =>
      new Date(r.at).getMonth() === now.getMonth() &&
      new Date(r.at).getFullYear() === now.getFullYear(),
  );
  const sent30 = requestsInClient.filter(
    (r) => daysBetween(r.sentAt, now) < 30,
  );
  const reviewed30 = sent30.filter((r) => r.status === "reviewed").length;

  const date = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const select =
    "h-7 rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none";
  const paperSelect =
    "h-7 rounded border border-line bg-surface px-2 text-xs font-medium text-fg focus:outline-none";

  const panel = (onClose?: () => void) =>
    view === "reviews" && selectedReview ? (
      <ReviewPanel
        key={selectedReview.id}
        review={selectedReview}
        client={clientById.get(selectedReview.accountId)!}
        clientReviews={reviews.filter(
          (r) => r.accountId === selectedReview.accountId,
        )}
        now={now}
        actions={actions}
        onClose={onClose}
      />
    ) : view === "requests" && panelClient && settings[panelClient.id] ? (
      <RequestsPanel
        key={panelClient.id}
        client={panelClient}
        contacts={contacts.filter((c) => c.accountId === panelClient.id)}
        settings={settings[panelClient.id]!}
        requests={requests.filter((r) => r.accountId === panelClient.id)}
        now={now}
        actions={actions}
        onClose={onClose}
      />
    ) : null;
  const hasPanel = panel() !== null;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:flex-nowrap md:px-6">
          <div className="min-w-0 md:shrink-0">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">
              Reputation
            </h1>
            <p className="num text-xs text-rail-fg-2 md:whitespace-nowrap">
              {date} ·{" "}
              {view === "reviews" ? (
                <>
                  {formatCount(inClient.length)} reviews
                  {needsReply.length > 0 && (
                    <>
                      {" · "}
                      <span
                        className={cn(
                          "font-medium",
                          oldestNeedDays > 7 ? "text-red" : "text-amber",
                        )}
                      >
                        {formatCount(needsReply.length)} need a reply
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  {formatCount(sent30.length)} requests in 30 days ·{" "}
                  {formatRate(
                    sent30.length ? reviewed30 / sent30.length : null,
                  )}{" "}
                  left a review
                </>
              )}
            </p>
          </div>
          <div
            role="tablist"
            aria-label="View"
            className="inline-flex h-7 shrink-0 items-center rounded bg-rail-2 p-0.5"
          >
            {(["reviews", "requests"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => {
                  setView(v);
                  setSelectedId(null);
                }}
                className={cn(
                  "h-6 rounded-[4px] px-2.5 text-xs font-medium transition-colors duration-150",
                  view === v
                    ? "bg-surface text-fg"
                    : "text-rail-fg-2 hover:text-rail-fg",
                )}
              >
                {v === "reviews" ? "Reviews" : "Requests"}
              </button>
            ))}
          </div>
          <label className="relative order-last w-full md:order-none md:ml-2 md:w-auto md:min-w-[140px] md:flex-1 md:max-w-[240px]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2"
              strokeWidth={1.75}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                view === "reviews" ? "Search reviews" : "Search requests"
              }
              className="h-8 w-full rounded border border-rail-line bg-rail-2 pl-8 pr-3 text-sm text-rail-fg placeholder:text-rail-fg-2/80 focus:border-rail-fg-2 focus:outline-none"
            />
          </label>
          <div className="flex shrink-0 items-center gap-2 md:ml-auto">
            <select
              aria-label="Client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setSelectedId(null);
              }}
              className={cn(select, "max-w-[150px]")}
            >
              <option value="all">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6 xl:grid-cols-4">
          <Kpi
            label="Rating, 30 days"
            value={avg30 === null ? "–" : avg30.toFixed(1)}
            aside={
              avgPrev === null
                ? `${formatCount(cur.length)} reviews`
                : `was ${avgPrev.toFixed(1)} · ${formatCount(cur.length)} reviews`
            }
          >
            {avg30 !== null && <Stars rating={avg30} />}
          </Kpi>
          <Kpi
            label="This month"
            value={formatCount(thisMonth.length)}
            aside={`${formatCount(thisMonth.filter((r) => r.rating >= 4).length)} four stars or better`}
          />
          <Kpi
            label="Needs a reply"
            value={formatCount(needsReply.length)}
            aside={
              needsReply.length
                ? `oldest ${timeAgo(needsReply[needsReply.length - 1]!.at, now)}`
                : "All caught up"
            }
            attention={
              needsReply.length === 0
                ? undefined
                : oldestNeedDays > 7
                  ? "red"
                  : "amber"
            }
          />
          <Kpi
            label="Requests, 30 days"
            value={formatCount(sent30.length)}
            aside={`${formatRate(sent30.length ? reviewed30 / sent30.length : null)} left a review`}
          />
        </div>

        {view === "reviews" && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-2 md:px-6">
            <select
              aria-label="Source"
              value={source}
              onChange={(e) => {
                setSource(e.target.value as typeof source);
                setSelectedId(null);
              }}
              className={paperSelect}
            >
              <option value="all">All sources</option>
              <option value="google">Google</option>
              <option value="facebook">Facebook</option>
            </select>
            <select
              aria-label="Scope"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as typeof scope);
                setSelectedId(null);
              }}
              className={paperSelect}
            >
              <option value="all">Everything</option>
              <option value="needs">Needs reply</option>
            </select>
          </div>
        )}
        <div className="overflow-x-auto border-y border-line bg-surface">
          {view === "reviews" ? (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  {reviewColumns.map((c) => (
                    <HeaderCell
                      key={c.key}
                      c={c}
                      sort={rSort}
                      onSort={setRSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {reviewRows.map((r) => {
                  const isSelected = selectedReview?.id === r.id;
                  return (
                    <tr
                      key={r.id}
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => {
                        setSelectedId(r.id);
                        setPanelOpen(true);
                      }}
                      onKeyDown={keyActivate(() => {
                        setSelectedId(r.id);
                        setPanelOpen(true);
                      })}
                      className={rowClass(isSelected)}
                    >
                      <td className="max-w-0 px-3 py-1.5 pl-5 md:pl-6">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="truncate">{r.author}</span>
                          {!r.reply && (
                            <span className="shrink-0 text-2xs font-medium text-fg-3 sm:hidden">
                              Needs reply
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-fg-3">
                          {r.body}
                        </span>
                      </td>
                      <td className="hidden max-w-[180px] truncate whitespace-nowrap px-3 py-1.5 text-fg-2 md:table-cell">
                        {clientById.get(r.accountId)?.name}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-1.5 text-fg-2 2xl:table-cell">
                        {sourceLabel[r.source]}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5">
                        <span className="flex items-center gap-2">
                          <Stars rating={r.rating} />
                          <span className="num text-xs text-fg-2">
                            {r.rating}
                          </span>
                        </span>
                      </td>
                      <td className="hidden px-3 py-1.5 sm:table-cell">
                        <Tag tone="neutral">
                          {r.reply ? "Replied" : "Needs reply"}
                        </Tag>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-1.5 pr-6 text-fg-2 md:table-cell">
                        {timeAgo(r.at, now)}
                      </td>
                    </tr>
                  );
                })}
                {reviewRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={reviewColumns.length}
                      className="px-5 py-10 text-center text-sm text-fg-3"
                    >
                      No reviews match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  {requestColumns.map((c) => (
                    <HeaderCell
                      key={c.key}
                      c={c}
                      sort={qSort}
                      onSort={setQSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {requestRows.map((r) => {
                  const isSelected =
                    clientId === "all" &&
                    panelClientId === r.accountId &&
                    (selectedId === r.id ||
                      (selectedId === null && requestRows[0]?.id === r.id));
                  return (
                    <tr
                      key={r.id}
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => {
                        setSelectedId(r.id);
                        setPanelOpen(true);
                      }}
                      onKeyDown={keyActivate(() => {
                        setSelectedId(r.id);
                        setPanelOpen(true);
                      })}
                      className={rowClass(isSelected)}
                    >
                      <td className="px-3 py-1.5 pl-5 md:pl-6">
                        <span className="block truncate font-medium">
                          {r.contactName}
                        </span>
                        <span className="block truncate text-xs text-fg-3 sm:hidden">
                          {channelLabel[r.channel]} · {triggerLabel[r.trigger]}
                        </span>
                        <span className="hidden truncate text-xs text-fg-3 sm:block xl:hidden">
                          {triggerLabel[r.trigger]}
                        </span>
                      </td>
                      <td className="hidden max-w-[180px] truncate whitespace-nowrap px-3 py-1.5 text-fg-2 md:table-cell">
                        {clientById.get(r.accountId)?.name}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-1.5 text-fg-2 sm:table-cell">
                        {channelLabel[r.channel]}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-1.5 text-fg-2 xl:table-cell">
                        {triggerLabel[r.trigger]}
                      </td>
                      <td className="px-3 py-1.5">
                        <Tag tone="neutral">{requestStatusLabel[r.status]}</Tag>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-1.5 pr-6 text-fg-2 md:table-cell">
                        {timeAgo(r.sentAt, now)}
                      </td>
                    </tr>
                  );
                })}
                {requestRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={requestColumns.length}
                      className="px-5 py-10 text-center text-sm text-fg-3"
                    >
                      No requests match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {hasPanel && (
        <>
          <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[384px] 2xl:w-[420px]">
            {panel()}
          </aside>
          {panelOpen && (
            <div
              className="fixed inset-0 z-20 flex lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label={view === "reviews" ? "Review" : "Requests"}
            >
              <button
                type="button"
                aria-label="Close panel"
                onClick={() => setPanelOpen(false)}
                className="flex-1 bg-rail/40"
              />
              <aside className="h-full w-[min(100%,400px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                {panel(() => setPanelOpen(false))}
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
