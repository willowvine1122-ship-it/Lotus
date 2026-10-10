"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Copy, History, Pause, PenLine, Play, Plus, Search, SquareArrowOutUpRight, X } from "lucide-react";
import { ButtonLink } from "@/components/page-header";
import { SectionTitle } from "@/components/diagnostic/primitives";
import { ColumnChart, Sparkline } from "@/components/charts";
import { Kpi, Tile } from "@/components/email/ui";
import type { ClientRef } from "@/components/crm/model";
import { cn, formatCount, timeAgo } from "@/lib/utils";
import type { Pipeline, WorkflowStatus } from "@/lib/types";
import type { WorkflowRow } from "./data";
import { triggerLabel } from "./model";
import { FlowOutline, RunStatusTag, StepGlyph, WorkflowStatusTag } from "./ui";

/*
 * Workflows board: the board grammar again. Top bar, four numbers for the
 * last 30 days, one sortable table of every workflow across clients, and the
 * selected workflow in the right panel: its numbers, its flow in one column,
 * and the latest contacts through it.
 */

type Key = "name" | "client" | "status" | "trigger" | "runs" | "waiting" | "last";
interface Sort { key: Key; dir: "asc" | "desc" }

const columns: { key: Key; label: string; className?: string; align?: "right"; defaultDir?: "asc" | "desc" }[] = [
  { key: "name", label: "Workflow", className: "min-w-[220px]" },
  { key: "client", label: "Client", className: "hidden 2xl:table-cell" },
  { key: "status", label: "Status" },
  { key: "trigger", label: "Starts when", className: "hidden 2xl:table-cell" },
  { key: "runs", label: "Runs, 30 days", align: "right", className: "hidden sm:table-cell", defaultDir: "desc" },
  { key: "waiting", label: "Waiting", align: "right", className: "hidden md:table-cell", defaultDir: "desc" },
  { key: "last", label: "Last run", className: "hidden md:table-cell", defaultDir: "desc" },
];

const statusOrder: Record<WorkflowStatus, number> = { active: 0, paused: 1, draft: 2 };

/** Thirty daily counts folded into ten three-day points, so a quiet workflow doesn't read as noise. */
const fold = (xs: number[]) => Array.from({ length: 10 }, (_, i) => xs.slice(i * 3, i * 3 + 3).reduce((a, b) => a + b, 0));

export interface BoardActions {
  setStatus: (id: string, status: "active" | "paused") => Promise<{ ok: boolean; message?: string } | null>;
  duplicate: (id: string) => Promise<void>;
}

export function WorkflowsBoard({ rows, clients, pipelines, nowIso, initialClientId, actions }: { rows: WorkflowRow[]; clients: ClientRef[]; pipelines: Record<string, Pipeline>; nowIso: string; initialClientId?: string; actions: BoardActions }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [clientId, setClientId] = useState(initialClientId ?? "all");
  const [status, setStatus] = useState<"all" | WorkflowStatus>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "status", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const inClient = useMemo(() => rows.filter((r) => clientId === "all" || r.accountId === clientId), [rows, clientId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dir = sort.dir === "asc" ? 1 : -1;
    const v = (r: WorkflowRow): string | number => {
      switch (sort.key) {
        case "name": return r.name.toLowerCase();
        case "client": return clientById.get(r.accountId)?.name ?? "";
        case "status": return statusOrder[r.status];
        case "trigger": return triggerLabel[r.trigger.type];
        case "runs": return r.runs30;
        case "waiting": return r.waiting;
        case "last": return r.lastRunAt ?? "";
      }
    };
    return inClient
      .filter((r) => status === "all" || r.status === status)
      .filter((r) => !q || [r.name, r.triggerText, clientById.get(r.accountId)?.name ?? ""].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => {
        const av = v(a);
        const bv = v(b);
        const p = av < bv ? -1 : av > bv ? 1 : 0;
        // Ties: the busiest first, then by name.
        return p !== 0 ? p * dir : b.runs30 - a.runs30 || a.name.localeCompare(b.name);
      });
  }, [inClient, status, query, sort, clientById]);

  const selected = visible.find((r) => r.id === selectedId) ?? visible[0] ?? null;

  const active = inClient.filter((r) => r.status === "active").length;
  const runs = inClient.reduce((n, r) => n + r.runs30, 0);
  const completed = inClient.reduce((n, r) => n + r.completed30, 0);
  const waiting = inClient.reduce((n, r) => n + r.waiting, 0);
  const failed = inClient.reduce((n, r) => n + r.failed30, 0);
  const skipped = inClient.reduce((n, r) => n + r.skipped30, 0);
  const finished = completed + failed;
  const paused = inClient.filter((r) => r.status === "paused").length;
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const clientSlug = clientId === "all" ? "" : clientById.get(clientId)?.slug ?? "";
  const newHref = clientSlug ? `/agency/automations/new?client=${clientSlug}` : "/agency/automations/new";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:flex-nowrap md:px-6">
          <div className="min-w-0 md:shrink-0">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">Automations</h1>
            <p className="num text-xs text-rail-fg-2 md:whitespace-nowrap">
              {date} · {active} on
              {paused > 0 && <span className="font-medium text-amber-soft"> · {paused} paused</span>}
              {failed > 0 && <span className="font-medium text-red-soft"> · {failed} failed</span>}
            </p>
          </div>
          <label className="relative order-last w-full md:order-none md:ml-2 md:w-auto md:min-w-[120px] md:max-w-[260px] md:flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2" strokeWidth={1.75} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workflows"
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
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Drafts</option>
            </select>
            <ButtonLink href={newHref} className="h-7 whitespace-nowrap px-2.5 text-xs">
              <Plus className="size-3.5" strokeWidth={2.25} />
              <span className="hidden 2xl:inline">New workflow</span>
              <span className="sr-only 2xl:hidden">New workflow</span>
            </ButtonLink>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6 xl:grid-cols-4">
          <Kpi label="Workflows on" value={formatCount(active)} aside={`of ${inClient.length}`} />
          <Kpi label="Runs, 30 days" value={formatCount(runs)} aside={`${formatCount(waiting)} waiting now`} />
          <Kpi label="Finished" value={finished ? `${Math.round((completed / Math.max(1, finished)) * 100)}%` : "–"} aside={`${formatCount(completed)} completed`} />
          <Kpi label="Needs a look" value={formatCount(failed)} aside={`${formatCount(skipped)} steps skipped`} asideTone={failed > 0 ? "red" : undefined} />
        </div>

        <div className="overflow-x-auto border-y border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                {columns.map((c) => {
                  const isActive = sort.key === c.key;
                  const Icon = isActive ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={isActive ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={cn("whitespace-nowrap px-3 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6", c.className, c.align === "right" ? "text-right" : "text-left")}
                    >
                      <button
                        type="button"
                        onClick={() => setSort(isActive ? { key: c.key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: c.defaultDir ?? "asc" })}
                        className={cn("inline-flex items-center gap-1 hover:text-fg", isActive && "text-fg", c.align === "right" && "flex-row-reverse")}
                      >
                        {c.label}
                        <Icon className={cn("size-3", !isActive && "opacity-60")} strokeWidth={2} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const isSelected = selected?.id === r.id;
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
                    <td className="max-w-[calc(100vw-140px)] px-3 py-1.5 pl-5 sm:max-w-[340px] md:pl-6">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-fg-3">
                        <span className="text-fg-2 2xl:hidden">{clientById.get(r.accountId)?.name}</span>
                        <span className="2xl:hidden"> · </span>
                        <span className="2xl:hidden">{triggerLabel[r.trigger.type]} · </span>
                        {r.stepCount} {r.stepCount === 1 ? "step" : "steps"}
                      </span>
                    </td>
                    <td className="hidden max-w-[180px] truncate px-3 py-1.5 text-fg-2 2xl:table-cell">{clientById.get(r.accountId)?.name}</td>
                    <td className="px-3 py-1.5">
                      <WorkflowStatusTag status={r.status} />
                    </td>
                    <td className="hidden max-w-[260px] px-3 py-1.5 2xl:table-cell">
                      <span className="flex items-center gap-2">
                        <StepGlyph type="trigger" className="size-6" />
                        <span className="min-w-0">
                          <span className="block truncate text-fg">{triggerLabel[r.trigger.type]}</span>
                          <span className="block truncate text-xs text-fg-3">{r.triggerText}</span>
                        </span>
                      </span>
                    </td>
                    <td className="hidden px-3 py-1.5 text-right sm:table-cell">
                      <span className="flex items-center justify-end gap-3">
                        {r.runs30 > 0 && <Sparkline values={fold(r.perDay)} color="var(--chart-1)" width={56} />}
                        <span className="num w-10 font-medium">{r.runs30 ? formatCount(r.runs30) : <span className="text-fg-3">0</span>}</span>
                      </span>
                    </td>
                    <td className="num hidden px-3 py-1.5 text-right md:table-cell">{r.waiting ? formatCount(r.waiting) : <span className="text-fg-3">0</span>}</td>
                    <td className="hidden whitespace-nowrap px-3 py-1.5 pr-6 md:table-cell">
                      {r.lastRunAt ? (
                        <>
                          <span className="block text-fg-2">{timeAgo(r.lastRunAt, now)}</span>
                          <span className={cn("block text-xs", r.failed30 ? "font-medium text-red" : "text-fg-3")}>
                            {r.failed30 ? `${r.failed30} failed` : r.lastRunStatus === "waiting" ? "On a wait" : "Completed"}
                          </span>
                        </>
                      ) : (
                        <span className="text-fg-3">{r.status === "draft" ? "Not turned on" : "No runs yet"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-fg-3">
                    {inClient.length === 0 ? (
                      <>
                        No workflows yet.{" "}
                        <Link href={newHref} className="font-medium text-fg underline-offset-2 hover:underline">
                          Start from a recipe
                        </Link>
                      </>
                    ) : (
                      "No workflows match."
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
          <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[384px] 2xl:w-[420px]">
            <WorkflowPanel row={selected} client={clientById.get(selected.accountId)!} pipeline={pipelines[selected.accountId]} now={now} actions={actions} />
          </aside>
          {panelOpen && (
            <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label={selected.name}>
              <button type="button" aria-label="Close panel" onClick={() => setPanelOpen(false)} className="flex-1 bg-rail/40" />
              <aside className="h-full w-[min(100%,420px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                <WorkflowPanel row={selected} client={clientById.get(selected.accountId)!} pipeline={pipelines[selected.accountId]} now={now} actions={actions} onClose={() => setPanelOpen(false)} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const panelButton = "inline-flex h-7 items-center gap-1.5 rounded border border-line-strong px-2 text-xs font-medium text-fg hover:bg-surface-2 disabled:opacity-50";

function WorkflowPanel({ row, client, pipeline, now, actions, onClose }: { row: WorkflowRow; client: ClientRef; pipeline?: Pipeline; now: Date; actions: BoardActions; onClose?: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const finished = row.completed30 + row.failed30;
  const toggle = (status: "active" | "paused") =>
    start(async () => {
      setError(null);
      const r = await actions.setStatus(row.id, status);
      if (r && !r.ok) setError(r.message ?? "Couldn't change it.");
    });
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-2.5 border-b border-line bg-surface px-5 pb-4 pt-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 tracking-tight">
              <span className="truncate">{row.name}</span>
              <Link href={`/agency/automations/${row.id}`} aria-label="Open builder" className="text-fg-3 hover:text-fg">
                <SquareArrowOutUpRight className="size-4" strokeWidth={1.75} />
              </Link>
            </h2>
            <p className="truncate text-xs text-fg-3">
              <Link href={`/agency/clients/${client.slug}`} className="hover:underline">
                {client.name}
              </Link>
              {" · "}
              {row.stepCount} {row.stepCount === 1 ? "step" : "steps"}
            </p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
              <X className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkflowStatusTag status={row.status} />
          <span className="text-xs text-fg-2">Edited {timeAgo(row.updatedAt, now)}</span>
          <span className="ml-auto flex items-center gap-1">
            <Link href={`/agency/automations/${row.id}`} className={panelButton}>
              <PenLine className="size-3.5" strokeWidth={1.75} />
              Edit
            </Link>
            {row.status === "active" ? (
              <button type="button" disabled={pending} onClick={() => toggle("paused")} className={panelButton}>
                <Pause className="size-3.5" strokeWidth={1.75} />
                Pause
              </button>
            ) : (
              <button type="button" disabled={pending} onClick={() => toggle("active")} className={panelButton}>
                <Play className="size-3.5" strokeWidth={1.75} />
                Turn on
              </button>
            )}
            <form action={actions.duplicate.bind(null, row.id)}>
              <button type="submit" aria-label="Duplicate" title="Duplicate" className={cn(panelButton, "px-1.5")}>
                <Copy className="size-3.5" strokeWidth={1.75} />
              </button>
            </form>
          </span>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red">
            {error}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-6 px-5 py-5">
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Started, 30 days" value={formatCount(row.runs30)} sub={row.lastRunAt ? `Last ${timeAgo(row.lastRunAt, now)}` : "No runs yet"} />
          <Tile label="Completed" value={finished ? `${Math.round((row.completed30 / finished) * 100)}%` : "–"} sub={`${formatCount(row.completed30)} contacts`} />
          <Tile label="Waiting now" value={formatCount(row.waiting)} sub={row.waiting ? "On a wait step" : "Nobody parked"} />
          <Tile label="Skipped steps" value={formatCount(row.skipped30)} sub={row.failed30 ? <span className="font-medium text-red">{row.failed30} runs failed</span> : "No failures"} />
        </div>

        <section className="flex flex-col gap-3">
          <SectionTitle sub="Contacts entering per day">Runs</SectionTitle>
          {row.runs30 ? (
            <ColumnChart labels={row.dayLabels} values={row.perDay} color="var(--chart-1)" label="Runs" format={(v) => String(Math.round(v))} height={120} />
          ) : (
            <p className="rounded border border-dashed border-line-strong px-3.5 py-4 text-center text-xs text-fg-3">{row.status === "draft" ? "Turn it on to start runs." : "No one has entered in the last 30 days."}</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle aside={<Link href={`/agency/automations/${row.id}`} className="text-xs font-medium text-fg-2 hover:text-fg hover:underline">Open builder</Link>}>Flow</SectionTitle>
          <div className="rounded border border-line bg-surface-2/40 px-3.5 py-3">
            <div className="flex items-start gap-2 border-b border-line pb-2.5">
              <StepGlyph type="trigger" className="size-6" />
              <span className="min-w-0 text-sm leading-5">
                <span className="font-medium">{triggerLabel[row.trigger.type]}</span>
                <span className="block text-xs text-fg-2">{row.triggerText}</span>
              </span>
            </div>
            <div className="pt-2">
              <FlowOutline steps={row.steps} pipeline={pipeline} mode={client.mode} />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle
            aside={
              <Link href={`/agency/automations/${row.id}/runs`} className="inline-flex items-center gap-1 text-xs font-medium text-fg-2 hover:text-fg hover:underline">
                <History className="size-3.5" strokeWidth={1.75} />
                All runs
              </Link>
            }
          >
            Latest runs
          </SectionTitle>
          {row.recent.length ? (
            <ul className="flex flex-col">
              {row.recent.map((r) => {
                const last = r.steps[r.steps.length - 1];
                return (
                  <li key={r.id} className="border-b border-line last:border-b-0">
                    <Link href={`/agency/automations/${row.id}/runs?run=${encodeURIComponent(r.id)}`} className="flex flex-col gap-0.5 py-2.5 hover:bg-surface-2/50">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.contactName}</span>
                        <RunStatusTag status={r.status} test={r.test} />
                        <span className="w-[72px] shrink-0 text-right text-2xs text-fg-3">{timeAgo(r.startedAt, now)}</span>
                      </span>
                      <span className="truncate text-xs text-fg-3">{last ? last.detail : r.triggeredBy}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-fg-3">Nobody has gone through it yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
