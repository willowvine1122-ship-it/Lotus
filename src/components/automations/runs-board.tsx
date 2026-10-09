"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Loader2, Search, Square, SquareArrowOutUpRight, X } from "lucide-react";
import { Segmented } from "@/components/diagnostic/primitives";
import { MergeText, relativeWhen, when } from "@/components/email/ui";
import type { AutomationActionState } from "@/app/agency/automations/actions";
import type { RunStatus, StepType } from "@/lib/types";
import { cn, formatCount, timeAgo } from "@/lib/utils";
import type { RunRow } from "./data";
import { stepLabel } from "./model";
import { RunStatusTag, RunStepMark, stepIcon } from "./ui";

/*
 * Run history: one row per contact per time through the workflow, and the
 * selected run in the panel, step by step, with the reason for every skip.
 * This is the screen that answers "why didn't it fire".
 */

export interface RunView extends RunRow {
  /** Steps still to come for a waiting run, in words. */
  upcoming: { type: StepType; summary: string }[];
}

type Filter = "all" | RunStatus | "test";

export function RunsBoard({ runs, totalSteps, initialRunId, nowIso, stop }: { runs: RunView[]; totalSteps: number; initialRunId?: string; nowIso: string; stop: (runId: string) => Promise<AutomationActionState> }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [filter, setFilter] = useState<Filter>(() => (initialRunId && runs.find((r) => r.id === initialRunId)?.test ? "test" : "all"));
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialRunId ?? null);
  const [panelOpen, setPanelOpen] = useState(!!initialRunId);

  const count = (f: Filter) => runs.filter((r) => (f === "all" ? !r.test : f === "test" ? r.test : r.status === f && !r.test)).length;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs
      .filter((r) => (filter === "all" ? !r.test : filter === "test" ? r.test : r.status === filter && !r.test))
      .filter((r) => !q || r.contactName.toLowerCase().includes(q) || (r.contactLine ?? "").toLowerCase().includes(q))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [runs, filter, query]);
  const selected = visible.find((r) => r.id === selectedId) ?? visible[0] ?? null;

  const options: { value: Filter; label: string }[] = [
    { value: "all", label: `All ${formatCount(count("all"))}` },
    { value: "waiting", label: `Waiting ${formatCount(count("waiting"))}` },
    { value: "completed", label: `Completed ${formatCount(count("completed"))}` },
    ...(count("failed") ? [{ value: "failed" as const, label: `Failed ${formatCount(count("failed"))}` }] : []),
    ...(count("stopped") ? [{ value: "stopped" as const, label: `Stopped ${formatCount(count("stopped"))}` }] : []),
    ...(count("test") ? [{ value: "test" as const, label: `Tests ${formatCount(count("test"))}` }] : []),
  ];

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 md:px-6">
          <div className="max-w-full overflow-x-auto">
            <Segmented options={options} value={filter} onChange={(v) => { setFilter(v); setSelectedId(null); }} label="Show runs" tone="paper" />
          </div>
          <label className="relative ml-auto w-full sm:w-[240px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-3" strokeWidth={1.75} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a contact"
              className="h-8 w-full rounded border border-line-strong bg-surface pl-8 pr-3 text-sm placeholder:text-fg-3 focus:border-brand focus:outline-none"
            />
          </label>
        </div>

        <div className="overflow-x-auto border-y border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
                <th scope="col" className="px-3 py-2 pl-5 md:pl-6">Contact</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th scope="col" className="hidden px-3 py-2 sm:table-cell">Started</th>
                <th scope="col" className="hidden px-3 py-2 md:table-cell">Where it is</th>
                <th scope="col" className="hidden px-3 py-2 pr-6 2xl:table-cell">Started by</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const isSelected = selected?.id === r.id;
                const done = r.steps.filter((s) => s.status !== "waiting").length;
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
                    <td className="max-w-[260px] px-3 py-1.5 pl-5 md:pl-6">
                      <span className="block truncate font-medium">{r.contactName}</span>
                      <span className="block truncate text-xs text-fg-3">{r.contactLine ?? "No email or phone"}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <RunStatusTag status={r.status} test={r.test && filter !== "test"} />
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-1.5 sm:table-cell">
                      <span className="block text-fg-2">{timeAgo(r.startedAt, now)}</span>
                      <span className="num block text-xs text-fg-3">{when(r.startedAt)}</span>
                    </td>
                    <td className="hidden max-w-[340px] px-3 py-1.5 md:table-cell">
                      <span className="num block truncate text-fg-2">
                        {r.status === "waiting" && r.resumeAt ? `Waiting until ${relativeWhen(r.resumeAt, now)}` : r.status === "completed" ? `All ${done} steps run` : `Stopped at step ${done} of ${Math.max(done, totalSteps)}`}
                      </span>
                      <span className="block truncate text-xs text-fg-3">{lastDetail(r)}</span>
                    </td>
                    <td className="hidden max-w-[220px] truncate px-3 py-1.5 pr-6 text-fg-2 2xl:table-cell">{r.triggeredBy}</td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-fg-3">
                    {runs.length === 0 ? "Nobody has gone through this workflow yet. Turn it on, or run a test from the builder." : "No runs match."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <>
          <aside className="sticky top-0 hidden h-screen w-[380px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block 2xl:w-[420px]">
            <RunPanel run={selected} now={now} stop={stop} />
          </aside>
          {panelOpen && (
            <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label={selected.contactName}>
              <button type="button" aria-label="Close panel" onClick={() => setPanelOpen(false)} className="flex-1 bg-rail/40" />
              <aside className="h-full w-[min(100%,420px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                <RunPanel run={selected} now={now} stop={stop} onClose={() => setPanelOpen(false)} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function lastDetail(r: RunRow) {
  const last = [...r.steps].reverse().find((s) => s.status !== "waiting") ?? r.steps[r.steps.length - 1];
  return last?.detail ?? r.triggeredBy;
}

function RunPanel({ run, now, stop, onClose }: { run: RunView; now: Date; stop: (runId: string) => Promise<AutomationActionState>; onClose?: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const skipped = run.steps.filter((s) => s.status === "skipped").length;
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-2.5 border-b border-line bg-surface px-5 pb-4 pt-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 tracking-tight">
              <span className="truncate">{run.contactName}</span>
              <Link href={`/agency/contacts/${run.contactId}`} aria-label="Open contact" className="text-fg-3 hover:text-fg">
                <SquareArrowOutUpRight className="size-4" strokeWidth={1.75} />
              </Link>
            </h2>
            <p className="truncate text-xs text-fg-3">{run.contactLine ?? "No email or phone"}</p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
              <X className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RunStatusTag status={run.status} test={run.test} />
          <span className="num text-xs text-fg-2">
            {run.status === "waiting" && run.resumeAt ? `Carries on ${relativeWhen(run.resumeAt, now)}` : run.finishedAt ? `Finished ${timeAgo(run.finishedAt, now)}` : `Started ${timeAgo(run.startedAt, now)}`}
          </span>
          {run.status === "waiting" && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await stop(run.id);
                  setError(r && !r.ok ? r.message ?? "Couldn't stop it." : null);
                })
              }
              className="ml-auto inline-flex h-7 items-center gap-1.5 rounded border border-line-strong px-2 text-xs font-medium text-fg hover:border-red/40 hover:text-red disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2} /> : <Square className="size-3" strokeWidth={2} />}
              Stop run
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-xs text-red">
            {error}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-5 px-5 py-5">
        <dl className="rounded border border-line bg-surface-2/40 px-3.5">
          <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm">
            <dt className="shrink-0 text-xs text-fg-3">Started by</dt>
            <dd className="min-w-0 truncate text-right">{run.triggeredBy}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm">
            <dt className="shrink-0 text-xs text-fg-3">Started</dt>
            <dd className="num text-right">{when(run.startedAt)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <dt className="shrink-0 text-xs text-fg-3">Skipped</dt>
            <dd className="num text-right">{skipped ? `${skipped} ${skipped === 1 ? "step" : "steps"}, reasons below` : "Nothing"}</dd>
          </div>
        </dl>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Steps</h3>
          <ol className="relative flex flex-col">
            {run.steps.map((s, i) => {
              const Icon = stepIcon[s.type];
              return (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {/* The thread joining one step to the next. */}
                  {(i < run.steps.length - 1 || run.upcoming.length > 0) && <span aria-hidden className="absolute bottom-0 left-[9.5px] top-6 w-px bg-line" />}
                  <RunStepMark status={s.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                        <Icon className="size-3.5 text-fg-3" strokeWidth={1.75} aria-hidden />
                        {s.stepId ? stepLabel[s.type] : "Run"}
                      </span>
                      <time dateTime={s.at} className="num ml-auto shrink-0 text-2xs text-fg-3">
                        {when(s.at)}
                      </time>
                    </div>
                    <p className={cn("mt-0.5 text-sm leading-relaxed", s.status === "skipped" ? "text-fg-3" : s.status === "failed" ? "font-medium text-red" : "text-fg-2")}>{s.detail}</p>
                  </div>
                </li>
              );
            })}
            {run.upcoming.map((u, i) => {
              const Icon = stepIcon[u.type];
              return (
                <li key={`u${i}`} className="relative flex gap-3 pb-4 opacity-70 last:pb-0">
                  {i < run.upcoming.length - 1 && <span aria-hidden className="absolute bottom-0 left-[9.5px] top-6 w-px border-l border-dashed border-line-strong" />}
                  <span className="grid size-5 shrink-0 place-items-center">
                    <span aria-hidden className="size-2 rounded-full border border-line-strong bg-surface" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-2">
                      <Icon className="size-3.5 text-fg-3" strokeWidth={1.75} aria-hidden />
                      {stepLabel[u.type]}
                      {i === 0 && <span className="text-2xs font-normal text-fg-3">Up next</span>}
                    </span>
                    <p className="mt-0.5 truncate text-sm text-fg-3">
                      <MergeText text={u.summary} />
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
