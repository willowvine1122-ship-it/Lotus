"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Download,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { ButtonLink } from "@/components/page-header";
import { Avatar, Segmented, Tag } from "@/components/diagnostic/primitives";
import { personFor, sourceLabel, type ClientRef } from "@/components/crm/model";
import type { BulkOp } from "@/app/agency/opportunities/actions";
import type {
  Assignee,
  ContactSource,
  Opportunity,
  OpportunityStatus,
  Pipeline,
} from "@/lib/types";
import { Kpi, KpiStrip } from "@/components/field/ui";
import {
  cn,
  formatCount,
  formatDollars,
  formatDollarsCompact,
  formatRate,
} from "@/lib/utils";
import {
  csvEscape,
  daysIn,
  probabilityOf,
  stageFor,
  staleTone,
  statusLabel,
  sumValue,
  weighted,
  winRate,
  type ContactRef,
} from "./model";
import { OpportunityPanel, type OpportunityActions } from "./panel";
import { PipelineReport } from "./report";

/*
 * Opportunities: the ink top bar, four numbers, a filter row, then the
 * pipeline as a board, a table or a report, with the selected deal in the
 * right panel. One client and one pipeline at a time, as in GoHighLevel,
 * but every view shares the same filters and the same panel.
 */

type View = "board" | "list" | "report";
type StatusFilter = OpportunityStatus | "all";
type Key =
  | "name"
  | "stage"
  | "status"
  | "value"
  | "days"
  | "owner"
  | "source"
  | "close"
  | "updated";
interface Sort {
  key: Key;
  dir: "asc" | "desc";
}

export interface WorkspaceActions extends OpportunityActions {
  bulk: (
    ids: string[],
    op: BulkOp,
  ) => Promise<{ ok: boolean; count: number; message?: string }>;
}

const inkSelect =
  "h-7 rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none";
const paperSelect =
  "h-7 rounded border border-line-strong bg-surface px-2 text-xs font-medium text-fg hover:border-fg-3 focus:border-brand focus:outline-none";

function DaysInStage({
  o,
  pipeline,
  now,
}: {
  o: Opportunity;
  pipeline: Pipeline;
  now: Date;
}) {
  const tone = staleTone(o, pipeline, now);
  const d = daysIn(o, now);
  return (
    <span
      className={cn(
        "num whitespace-nowrap",
        tone === "red"
          ? "font-medium text-red"
          : tone === "amber"
            ? "font-medium text-amber"
            : "text-fg-3",
      )}
      title={
        tone
          ? `Past the ${pipeline.staleDays ?? 14}-day limit for this pipeline`
          : undefined
      }
    >
      {d}d
    </span>
  );
}

export function OpportunitiesWorkspace({
  client,
  clients,
  pipeline,
  pipelines,
  opportunities,
  allForClient,
  contacts,
  team,
  reasons,
  nowIso,
  initialView,
  initialSelected,
  actions,
}: {
  client: ClientRef;
  clients: ClientRef[];
  pipeline: Pipeline;
  pipelines: Pipeline[];
  opportunities: Opportunity[];
  /** Every opportunity of the client, for "other opportunities" in the panel. */
  allForClient: Opportunity[];
  contacts: Record<string, ContactRef>;
  team: Assignee[];
  reasons: string[];
  nowIso: string;
  initialView: View;
  initialSelected?: string;
  actions: WorkspaceActions;
}) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [view, setViewState] = useState<View>(initialView);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [owner, setOwner] = useState("all");
  const [source, setSource] = useState<"all" | ContactSource>("all");
  const [stalledOnly, setStalledOnly] = useState(false);
  const [sort, setSort] = useState<Sort>({ key: "updated", dir: "desc" });
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelected ?? null,
  );
  const [panelOpen, setPanelOpen] = useState(!!initialSelected);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [bulkPending, startBulk] = useTransition();
  const [bulkNote, setBulkNote] = useState<string | null>(null);

  // A drag lands at once; the server confirms on the next render.
  const [live, moveLocal] = useOptimistic(
    opportunities,
    (os: Opportunity[], m: { id: string; stageId: string }) =>
      os.map((o) => {
        if (o.id !== m.id) return o;
        const outcome = stageFor(pipeline, m.stageId).outcome;
        return {
          ...o,
          stageId: m.stageId,
          stageEnteredAt: new Date().toISOString(),
          status:
            outcome ??
            (o.status === "won" || o.status === "lost" ? "open" : o.status),
        };
      }),
  );

  const setView = (v: View) => {
    setViewState(v);
    const url = new URL(window.location.href);
    url.searchParams.set("view", v);
    window.history.replaceState(null, "", url);
  };

  const go = (clientSlug: string, pipelineId?: string) =>
    router.push(
      `/agency/opportunities?client=${clientSlug}${pipelineId ? `&pipeline=${pipelineId}` : ""}&view=${view}`,
    );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return live.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (owner !== "all" && (o.ownerName ?? "none") !== owner) return false;
      if (source !== "all" && o.source !== source) return false;
      if (stalledOnly && !staleTone(o, pipeline, now)) return false;
      if (!q) return true;
      const c = contacts[o.contactId];
      return [
        o.name,
        c?.name ?? "",
        c?.email ?? "",
        c?.phone ?? "",
        c?.company ?? "",
        ...o.tags,
      ].some((s) => s.toLowerCase().includes(q));
    });
  }, [
    live,
    status,
    owner,
    source,
    stalledOnly,
    query,
    contacts,
    pipeline,
    now,
  ]);

  const rows = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const idx = new Map(pipeline.stages.map((s, i) => [s.id, i]));
    const v = (o: Opportunity): string | number => {
      switch (sort.key) {
        case "name":
          return o.name.toLowerCase();
        case "stage":
          return idx.get(o.stageId) ?? 99;
        case "status":
          return o.status;
        case "value":
          return o.valueCents;
        case "days":
          return daysIn(o, now);
        case "owner":
          return o.ownerName ?? "zz";
        case "source":
          return sourceLabel[o.source];
        case "close":
          return o.closeOn ?? "9999";
        case "updated":
          return o.updatedAt;
      }
    };
    return [...filtered].sort((a, b) => {
      const av = v(a);
      const bv = v(b);
      const p = av < bv ? -1 : av > bv ? 1 : 0;
      return p !== 0 ? p * dir : a.name.localeCompare(b.name);
    });
  }, [filtered, sort, pipeline, now]);

  const selected =
    live.find((o) => o.id === selectedId) ??
    (view !== "report" ? rows[0] : undefined) ??
    null;
  const select = (o: Opportunity) => {
    setSelectedId(o.id);
    setPanelOpen(true);
  };

  // The four numbers follow the pipeline, not the filters.
  const open = live.filter((o) => o.status === "open");
  const stalled = open.filter((o) => staleTone(o, pipeline, now));
  const stalledRed = stalled.filter(
    (o) => staleTone(o, pipeline, now) === "red",
  );
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const won30 = live.filter(
    (o) => o.status === "won" && (o.closedAt ?? "") >= since30,
  );
  const wr = winRate(live, now);
  const openValue = sumValue(open);
  const forecast = weighted(pipeline, open);
  const owners = useMemo(
    () => [
      ...new Set([
        ...team.map((t) => t.name),
        ...live.map((o) => o.ownerName).filter((x): x is string => !!x),
      ]),
    ],
    [team, live],
  );
  const sourcesHere = useMemo(
    () => [...new Set(live.map((o) => o.source))],
    [live],
  );

  const toggle = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allChecked = rows.length > 0 && rows.every((o) => checked.has(o.id));

  const bulk = (op: BulkOp) => {
    const ids = [...checked];
    startBulk(async () => {
      const r = await actions.bulk(ids, op);
      setBulkNote(
        r.ok
          ? `${formatCount(r.count)} updated`
          : (r.message ?? "Could not update them"),
      );
      if (r.ok) setChecked(new Set());
    });
  };

  const exportCsv = () => {
    const head = [
      "Opportunity",
      "Contact",
      "Email",
      "Phone",
      "Pipeline",
      "Stage",
      "Status",
      "Lost reason",
      "Value",
      "Weighted",
      "Owner",
      "Source",
      "Days in stage",
      "Expected close",
      "Created",
      "Updated",
    ];
    const lines = rows.map((o) => {
      const c = contacts[o.contactId];
      return [
        o.name,
        c?.name,
        c?.email,
        c?.phone,
        pipeline.name,
        stageFor(pipeline, o.stageId).name,
        statusLabel[o.status],
        o.lostReason,
        (o.valueCents / 100).toFixed(2),
        ((o.valueCents * probabilityOf(pipeline, o)) / 10000).toFixed(2),
        o.ownerName,
        sourceLabel[o.source],
        daysIn(o, now),
        o.closeOn,
        o.createdAt.slice(0, 10),
        o.updatedAt.slice(0, 10),
      ]
        .map(csvEscape)
        .join(",");
    });
    const blob = new Blob([[head.join(","), ...lines].join("\n")], {
      type: "text/csv",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${client.slug}-${pipeline.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-opportunities.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const drop = (stageId: string) => {
    const id = dragId;
    setDragId(null);
    setOverStage(null);
    if (!id) return;
    const o = live.find((x) => x.id === id);
    if (!o || o.stageId === stageId) return;
    startTransition(async () => {
      moveLocal({ id, stageId });
      await actions.move(id, stageId);
    });
  };

  const panelProps = selected
    ? {
        o: selected,
        pipeline,
        contact: contacts[selected.contactId],
        client,
        related: allForClient.filter(
          (x) => x.contactId === selected.contactId && x.id !== selected.id,
        ),
        pipelines,
        reasons,
        team,
        now,
        actions,
        onSelect: (r: Opportunity) => {
          if (r.pipelineId === pipeline.id) select(r);
          else
            router.push(
              `/agency/opportunities?client=${client.slug}&pipeline=${r.pipelineId}&opp=${r.id}&view=${view}`,
            );
        },
      }
    : null;

  const columns: {
    key: Key;
    label: string;
    className?: string;
    align?: "right";
    defaultDir?: "asc" | "desc";
  }[] = [
    { key: "name", label: "Opportunity", className: "min-w-[220px]" },
    { key: "stage", label: "Stage" },
    { key: "status", label: "Status", className: "hidden xl:table-cell" },
    { key: "value", label: "Value", align: "right", defaultDir: "desc" },
    {
      key: "days",
      label: "In stage",
      align: "right",
      className: "hidden sm:table-cell",
      defaultDir: "desc",
    },
    { key: "close", label: "Close", className: "hidden 2xl:table-cell" },
    { key: "source", label: "Source", className: "hidden 2xl:table-cell" },
    { key: "owner", label: "Owner", className: "hidden md:table-cell" },
  ];

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip lg:flex-row lg:overflow-visible">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2.5 bg-rail px-5 py-3 text-rail-fg md:px-6">
          <div className="order-1 min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold leading-6 tracking-tight">
              Opportunities
            </h1>
            <p className="num truncate text-xs text-rail-fg-2">
              {formatCount(open.length)} open ·{" "}
              {formatDollarsCompact(openValue)}
              {stalled.length > 0 && (
                <span
                  className={cn(
                    "font-medium",
                    stalledRed.length ? "text-[#ff8a95]" : "text-[#ffc46b]",
                  )}
                >
                  {" "}
                  · {stalled.length} stalled
                </span>
              )}
            </p>
          </div>
          <label className="relative order-5 w-full xl:order-2 xl:w-auto xl:min-w-[160px] xl:max-w-[280px] xl:flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2"
              strokeWidth={1.75}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search deals, contacts, tags"
              className="h-8 w-full rounded border border-rail-line bg-rail-2 pl-8 pr-3 text-sm text-rail-fg placeholder:text-rail-fg-2/80 focus:border-rail-fg-2 focus:outline-none"
            />
          </label>
          <div className="order-3 flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
              <select
                aria-label="Client"
                value={client.id}
                onChange={(e) =>
                  go(
                    clients.find((c) => c.id === e.target.value)?.slug ??
                      client.slug,
                  )
                }
                className={cn(
                  inkSelect,
                  "w-0 min-w-0 flex-1 sm:w-auto sm:max-w-[150px] sm:flex-none",
                )}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Pipeline"
                value={pipeline.id}
                onChange={(e) => go(client.slug, e.target.value)}
                className={cn(
                  inkSelect,
                  "w-0 min-w-0 flex-1 sm:w-auto sm:max-w-[140px] sm:flex-none",
                )}
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <a
                href={`/agency/opportunities/pipelines?client=${client.slug}&pipeline=${pipeline.id}`}
                className="inline-flex h-7 shrink-0 items-center rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg hover:bg-rail-line"
                title="Pipelines and stages"
              >
                <Settings2 className="size-3.5" strokeWidth={1.75} />
                <span className="sr-only">Pipelines and stages</span>
              </a>
            </div>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: "board", label: "Board" },
                { value: "list", label: "List" },
                { value: "report", label: "Report" },
              ]}
            />
          </div>
          <ButtonLink
            href={`/agency/opportunities/new?client=${client.slug}&pipeline=${pipeline.id}`}
            className="order-4 h-7 whitespace-nowrap px-2.5 text-xs"
          >
            <Plus className="size-3.5" strokeWidth={2.25} />
            Add<span className="sr-only"> opportunity</span>
          </ButtonLink>
        </header>

        <KpiStrip>
          <Kpi
            label="Open pipeline"
            value={formatDollarsCompact(openValue)}
            aside={
              stalled.length
                ? `${formatCount(stalled.length)} stalled`
                : `${formatCount(open.length)} open`
            }
            tone={
              stalledRed.length ? "red" : stalled.length ? "amber" : undefined
            }
          />
          <Kpi
            label="Weighted forecast"
            value={formatDollarsCompact(forecast)}
            aside={
              openValue
                ? `${formatRate(forecast / openValue)} of open`
                : "No open value"
            }
          />
          <Kpi
            label="Won, 30 days"
            value={formatDollarsCompact(sumValue(won30))}
            aside={`${formatCount(won30.length)} ${won30.length === 1 ? "deal" : "deals"}`}
          />
          <Kpi
            label="Win rate, 90 days"
            value={wr.rate === null ? "–" : formatRate(wr.rate)}
            aside={
              wr.avgDays === null
                ? `${wr.closed} closed`
                : `${wr.avgDays} days to win`
            }
          />
        </KpiStrip>

        {view !== "report" && (
          <div className="relative flex w-full min-w-0 items-center gap-2 overflow-x-auto px-5 py-3 md:flex-wrap md:overflow-visible md:px-6">
            <Segmented
              label="Status"
              tone="paper"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setChecked(new Set());
              }}
              options={[
                { value: "open", label: "Open" },
                { value: "won", label: "Won" },
                { value: "lost", label: "Lost" },
                { value: "abandoned", label: "Abandoned" },
                { value: "all", label: "All" },
              ]}
            />
            <select
              aria-label="Owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className={paperSelect}
            >
              <option value="all">Any owner</option>
              {owners.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="none">Unassigned</option>
            </select>
            <select
              aria-label="Source"
              value={source}
              onChange={(e) =>
                setSource(e.target.value as "all" | ContactSource)
              }
              className={paperSelect}
            >
              <option value="all">Any source</option>
              {sourcesHere.map((s) => (
                <option key={s} value={s}>
                  {sourceLabel[s]}
                </option>
              ))}
            </select>
            <label className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded border border-line-strong bg-surface px-2 text-xs font-medium text-fg has-[:checked]:border-rail has-[:checked]:bg-rail has-[:checked]:text-rail-fg">
              <input
                type="checkbox"
                checked={stalledOnly}
                onChange={(e) => setStalledOnly(e.target.checked)}
                className="size-3 accent-[var(--rail)]"
              />
              Stalled only
            </label>
            {view === "board" && (
              <select
                aria-label="Sort cards"
                value={`${sort.key}:${sort.dir}`}
                onChange={(e) => {
                  const [k, d] = e.target.value.split(":");
                  setSort({ key: k as Key, dir: d as "asc" | "desc" });
                }}
                className={paperSelect}
              >
                <option value="updated:desc">Recently updated</option>
                <option value="value:desc">Highest value</option>
                <option value="days:desc">Longest in stage</option>
                <option value="close:asc">Closing soonest</option>
              </select>
            )}
            <span className="num ml-auto shrink-0 whitespace-nowrap pl-2 text-xs text-fg-3">
              {formatCount(rows.length)} · {formatDollars(sumValue(rows))}
            </span>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded px-2 text-xs font-medium text-fg-2 hover:bg-surface-2 hover:text-fg"
              title="Download these rows as CSV"
            >
              <Download className="size-3.5" strokeWidth={1.75} />
              CSV
            </button>
          </div>
        )}

        {view === "board" && (
          <div
            className="relative flex w-full min-w-0 min-h-0 flex-1 gap-2.5 overflow-x-auto px-5 pb-6 md:px-6"
            role="list"
            aria-label={`${pipeline.name} stages`}
          >
            {pipeline.stages.map((s) => {
              const cards = rows.filter((o) => o.stageId === s.id);
              const isOver = overStage === s.id && dragId !== null;
              return (
                <section
                  key={s.id}
                  role="listitem"
                  aria-label={s.name}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (overStage !== s.id) setOverStage(s.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node))
                      setOverStage(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    drop(s.id);
                  }}
                  className={cn(
                    "flex w-[264px] shrink-0 flex-col rounded border bg-surface-2/70 transition-colors duration-100",
                    isOver ? "border-rail bg-surface-2" : "border-line",
                  )}
                >
                  <header className="flex flex-col gap-0.5 border-b border-line px-3 py-2.5">
                    <div className="flex items-baseline gap-2">
                      <h2 className="truncate text-sm font-semibold">
                        {s.name}
                      </h2>
                      <span className="num text-xs text-fg-3">
                        {cards.length}
                      </span>
                      <span className="num ml-auto text-sm font-medium">
                        {formatDollarsCompact(sumValue(cards))}
                      </span>
                    </div>
                    <div className="num flex items-baseline justify-between text-2xs text-fg-3">
                      <span>
                        {s.outcome
                          ? s.outcome === "won"
                            ? "Closed won"
                            : "Closed lost"
                          : `${s.probability ?? 0}% likely`}
                      </span>
                      {!s.outcome && cards.length > 0 && (
                        <span>
                          {formatDollarsCompact(weighted(pipeline, cards))}{" "}
                          weighted
                        </span>
                      )}
                    </div>
                  </header>
                  <ol className="flex min-h-[120px] flex-col gap-1.5 p-1.5">
                    {cards.map((o) => {
                      const c = contacts[o.contactId];
                      const person = personFor(team, o.ownerName);
                      const isSel = selected?.id === o.id;
                      return (
                        <li key={o.id}>
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => {
                              setDragId(o.id);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", o.id);
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setOverStage(null);
                            }}
                            onClick={() => select(o)}
                            aria-pressed={isSel}
                            className={cn(
                              "flex w-full cursor-grab flex-col gap-1.5 rounded border bg-surface px-3 py-2.5 text-left transition-[border-color,opacity] duration-100 active:cursor-grabbing",
                              isSel
                                ? "border-rail"
                                : "border-line hover:border-line-strong",
                              dragId === o.id && "opacity-50",
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-5">
                                {o.name}
                              </span>
                              <span className="num shrink-0 text-sm font-medium">
                                {o.valueCents ? (
                                  formatDollarsCompact(o.valueCents)
                                ) : (
                                  <span className="text-fg-3">–</span>
                                )}
                              </span>
                            </div>
                            <span className="truncate text-xs text-fg-3">
                              {c
                                ? [c.name, c.company ?? c.city]
                                    .filter(Boolean)
                                    .join(" · ")
                                : "Contact removed"}
                            </span>
                            <div className="flex items-center gap-2 text-2xs">
                              {person ? (
                                <Avatar person={person} size="xs" />
                              ) : (
                                <span
                                  className="size-4 rounded-full border border-dashed border-line-strong"
                                  title="Unassigned"
                                />
                              )}
                              {o.status !== "open" ? (
                                <Tag tone="neutral">
                                  {o.status === "lost" && o.lostReason
                                    ? `Lost: ${o.lostReason}`
                                    : statusLabel[o.status]}
                                </Tag>
                              ) : (
                                <DaysInStage
                                  o={o}
                                  pipeline={pipeline}
                                  now={now}
                                />
                              )}
                              {o.status === "open" && o.closeOn && (
                                <span
                                  className={cn(
                                    "num ml-auto",
                                    o.closeOn < nowIso.slice(0, 10)
                                      ? "text-amber"
                                      : "text-fg-3",
                                  )}
                                >
                                  {new Date(
                                    `${o.closeOn}T12:00:00`,
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                    {cards.length === 0 && (
                      <li
                        className={cn(
                          "grid flex-1 place-items-center rounded border border-dashed px-3 py-6 text-center text-xs",
                          isOver
                            ? "border-rail text-fg-2"
                            : "border-line-strong text-fg-3",
                        )}
                      >
                        {isOver ? "Drop to move here" : "Nothing here"}
                      </li>
                    )}
                  </ol>
                </section>
              );
            })}
          </div>
        )}

        {view === "list" && (
          <>
            {checked.size > 0 && (
              <div
                className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-y border-line bg-surface px-5 py-2 md:px-6"
                role="toolbar"
                aria-label="Bulk actions"
              >
                <span className="num text-xs font-medium">
                  {formatCount(checked.size)} selected
                </span>
                <select
                  aria-label="Move selected to stage"
                  disabled={bulkPending}
                  value=""
                  onChange={(e) =>
                    e.target.value &&
                    bulk({ type: "stage", stageId: e.target.value })
                  }
                  className={paperSelect}
                >
                  <option value="">Move to…</option>
                  {pipeline.stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Set status of selected"
                  disabled={bulkPending}
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    if (v.startsWith("lost:"))
                      bulk({
                        type: "status",
                        status: "lost",
                        lostReason: v.slice(5),
                      });
                    else
                      bulk({ type: "status", status: v as OpportunityStatus });
                  }}
                  className={paperSelect}
                >
                  <option value="">Set status…</option>
                  <option value="won">Won</option>
                  <optgroup label="Lost because">
                    {reasons.map((r) => (
                      <option key={r} value={`lost:${r}`}>
                        {r}
                      </option>
                    ))}
                  </optgroup>
                  <option value="abandoned">Abandoned</option>
                  <option value="open">Reopen</option>
                </select>
                <select
                  aria-label="Assign selected"
                  disabled={bulkPending}
                  value=""
                  onChange={(e) =>
                    e.target.value &&
                    bulk({
                      type: "owner",
                      ownerName:
                        e.target.value === "none" ? "" : e.target.value,
                    })
                  }
                  className={paperSelect}
                >
                  <option value="">Assign to…</option>
                  {team.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                  <option value="none">Nobody</option>
                </select>
                <button
                  type="button"
                  disabled={bulkPending}
                  onClick={() => bulk({ type: "delete" })}
                  className="h-7 rounded px-2 text-xs font-medium text-fg-2 hover:bg-red-soft hover:text-red"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setChecked(new Set())}
                  className="ml-auto inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-fg-3 hover:text-fg"
                >
                  <X className="size-3.5" strokeWidth={2} />
                  Clear
                </button>
              </div>
            )}
            {bulkNote && checked.size === 0 && (
              <p role="status" className="px-5 pb-2 text-xs text-fg-2 md:px-6">
                {bulkNote}
              </p>
            )}
            <div className="overflow-x-auto border-y border-line bg-surface">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="w-10 py-2 pl-5 md:pl-6">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allChecked}
                        onChange={() =>
                          setChecked(
                            allChecked
                              ? new Set()
                              : new Set(rows.map((o) => o.id)),
                          )
                        }
                        className="size-3.5 accent-[var(--rail)]"
                      />
                    </th>
                    {columns.map((c) => {
                      const active = sort.key === c.key;
                      const Icon = active
                        ? sort.dir === "asc"
                          ? ArrowUp
                          : ArrowDown
                        : ChevronsUpDown;
                      return (
                        <th
                          key={c.key}
                          scope="col"
                          aria-sort={
                            active
                              ? sort.dir === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                          className={cn(
                            "whitespace-nowrap px-3 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 last:pr-5 md:last:pr-6",
                            c.className,
                            c.align === "right" ? "text-right" : "text-left",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setSort(
                                active
                                  ? {
                                      key: c.key,
                                      dir: sort.dir === "asc" ? "desc" : "asc",
                                    }
                                  : { key: c.key, dir: c.defaultDir ?? "asc" },
                              )
                            }
                            className={cn(
                              "inline-flex items-center gap-1 hover:text-fg",
                              active && "text-fg",
                              c.align === "right" && "flex-row-reverse",
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
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => {
                    const c = contacts[o.contactId];
                    const person = personFor(team, o.ownerName);
                    const isSel = selected?.id === o.id;
                    return (
                      <tr
                        key={o.id}
                        aria-selected={isSel}
                        onClick={() => select(o)}
                        className={cn(
                          "h-[52px] cursor-pointer border-b border-line transition-colors duration-100",
                          isSel
                            ? "bg-brand-soft/40 shadow-[inset_2px_0_0_var(--brand)]"
                            : "hover:bg-surface-2/60",
                        )}
                      >
                        <td
                          className="py-1.5 pl-5 md:pl-6"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select ${o.name}`}
                            checked={checked.has(o.id)}
                            onChange={() => toggle(o.id)}
                            className="size-3.5 accent-[var(--rail)]"
                          />
                        </td>
                        <td className="max-w-[320px] px-3 py-1.5">
                          <span className="block truncate font-medium">
                            {o.name}
                          </span>
                          <span className="block truncate text-xs text-fg-3">
                            {c?.name ?? "Contact removed"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <Tag tone="neutral">
                            {stageFor(pipeline, o.stageId).name}
                          </Tag>
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-1.5 text-fg-2 xl:table-cell">
                          {o.status === "lost" && o.lostReason
                            ? `Lost: ${o.lostReason}`
                            : statusLabel[o.status]}
                        </td>
                        <td className="num px-3 py-1.5 text-right">
                          {o.valueCents ? (
                            formatDollars(o.valueCents)
                          ) : (
                            <span className="text-fg-3">–</span>
                          )}
                        </td>
                        <td className="hidden px-3 py-1.5 text-right sm:table-cell">
                          {o.status === "open" ? (
                            <DaysInStage o={o} pipeline={pipeline} now={now} />
                          ) : (
                            <span className="text-fg-3">–</span>
                          )}
                        </td>
                        <td className="num hidden whitespace-nowrap px-3 py-1.5 text-fg-2 2xl:table-cell">
                          {o.closeOn ? (
                            new Date(
                              `${o.closeOn}T12:00:00`,
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          ) : (
                            <span className="text-fg-3">–</span>
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-1.5 text-fg-2 2xl:table-cell">
                          {sourceLabel[o.source]}
                        </td>
                        <td className="hidden px-3 py-1.5 pr-6 md:table-cell">
                          {person ? (
                            <Avatar person={person} />
                          ) : (
                            <span className="text-fg-3">–</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={columns.length + 1}
                        className="px-5 py-10 text-center text-sm text-fg-3"
                      >
                        No opportunities match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {view === "report" && (
          <PipelineReport
            pipeline={pipeline}
            opportunities={live}
            team={team}
            reasons={reasons}
            now={now}
          />
        )}
      </div>

      {panelProps && view !== "report" && (
        <>
          <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[384px] 2xl:w-[420px]">
            <OpportunityPanel key={panelProps.o.id} {...panelProps} />
          </aside>
          {panelOpen && (
            <div
              className="fixed inset-0 z-20 flex lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label={panelProps.o.name}
            >
              <button
                type="button"
                aria-label="Close panel"
                onClick={() => setPanelOpen(false)}
                className="flex-1 bg-rail/40"
              />
              <aside className="h-full w-[min(100%,400px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                <OpportunityPanel
                  key={panelProps.o.id}
                  {...panelProps}
                  onClose={() => setPanelOpen(false)}
                />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
