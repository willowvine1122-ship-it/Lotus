"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, Check, Copy, FlaskConical, Loader2, Pause, Play, Plus, Settings2, Trash2, X } from "lucide-react";
import { Button } from "@/components/page-header";
import { Field, Input, Select } from "@/components/form";
import { MergeText } from "@/components/email/ui";
import type { ClientRef } from "@/components/crm/model";
import type { AutomationActionState, WorkflowDraft } from "@/app/agency/automations/actions";
import type { Pipeline, StepType, Workflow, WorkflowStep, WorkflowTrigger } from "@/lib/types";
import { cn, formatCount, timeAgo } from "@/lib/utils";
import type { ContactLite, RunRow, StepStats } from "./data";
import { useNames } from "./integration-options";
import { findStep, insertStep, laneOf, moveStep, newStep, removeStep, replaceStep, stepGroups, stepLabel, stepSummary, triggerLabel, triggerSummary, workflowIssues, type Lane } from "./model";
import { StepControls, StepEditor, TriggerEditor } from "./step-editor";
import { RunStatusTag, RunStepMark, StepGlyph, stepIcon } from "./ui";
import { WorkflowHeader, inkButton } from "./workflow-header";

/*
 * The builder reads top to bottom like the workflow runs: the trigger, then
 * each step in order, waits drawn as time on the line between steps, and an
 * if/else splitting into two short lanes that rejoin. Every node carries what
 * happened there in the last 30 days. The selected node is edited in the
 * right panel, the same master and detail as every other Lotus screen.
 */

export interface BuilderActions {
  save: (id: string, draft: WorkflowDraft) => Promise<AutomationActionState>;
  setStatus: (id: string, draft: WorkflowDraft, status: "active" | "paused") => Promise<AutomationActionState>;
  test: (id: string, draft: WorkflowDraft, contactId: string, skipWaits: boolean) => Promise<AutomationActionState>;
  duplicate: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

type Selection = "trigger" | "test" | "settings" | string;

const draftOf = (w: Pick<Workflow, "name" | "trigger" | "steps" | "allowReentry">): WorkflowDraft => ({ name: w.name, trigger: w.trigger, steps: w.steps, allowReentry: w.allowReentry });

export function WorkflowBuilder({
  workflow,
  client,
  pipeline,
  tags,
  team,
  contacts,
  stats,
  laneCounts,
  started,
  runs,
  testRuns,
  nowIso,
  actions,
}: {
  workflow: Workflow;
  client: ClientRef;
  pipeline?: Pipeline;
  tags: string[];
  team: string[];
  contacts: ContactLite[];
  stats: StepStats;
  laneCounts: Record<string, { yes: number; no: number }>;
  started: number;
  runs: number;
  testRuns: RunRow[];
  nowIso: string;
  actions: BuilderActions;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [name, setName] = useState(workflow.name);
  const [trigger, setTrigger] = useState<WorkflowTrigger>(workflow.trigger);
  const [steps, setSteps] = useState<WorkflowStep[]>(workflow.steps);
  const [allowReentry, setAllowReentry] = useState(workflow.allowReentry);
  const [selected, setSelected] = useState<Selection>("trigger");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [serverIssues, setServerIssues] = useState<Record<string, string>>({});
  const [showIssues, setShowIssues] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"save" | "status" | "test" | null>(null);

  const draft = useMemo<WorkflowDraft>(() => ({ name, trigger, steps, allowReentry }), [name, trigger, steps, allowReentry]);
  const saved = useMemo(() => JSON.stringify(draftOf(workflow)), [workflow]);
  const dirty = JSON.stringify(draft) !== saved;
  const localIssues = useMemo(() => workflowIssues(trigger, steps), [trigger, steps]);
  const issues = showIssues ? { ...serverIssues, ...localIssues } : {};
  const issueCount = Object.keys(localIssues).length;

  // Leaving with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const run = useCallback(
    (kind: "save" | "status" | "test", fn: () => Promise<AutomationActionState>, after?: (r: NonNullable<AutomationActionState>) => void) => {
      setBusy(kind);
      start(async () => {
        const r = await fn();
        setBusy(null);
        if (!r) return;
        setServerIssues(r.errors ?? {});
        if (!r.ok && r.errors) setShowIssues(true);
        setNotice(r.message ? { ok: r.ok, message: r.message } : null);
        after?.(r);
      });
    },
    [],
  );

  const save = useCallback(() => run("save", () => actions.save(workflow.id, draft)), [run, actions, workflow.id, draft]);

  // Cmd or Ctrl + S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!pending) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, pending]);

  const select = (s: Selection) => {
    setSelected(s);
    setSheetOpen(true);
  };

  const add = (lane: Lane, index: number, type: StepType) => {
    const s = newStep(type, client.mode);
    setSteps((xs) => insertStep(xs, lane, index, s));
    select(s.id);
  };

  const selectedStep = selected !== "trigger" && selected !== "test" && selected !== "settings" ? findStep(steps, selected) : undefined;

  const turnOn = () => {
    setShowIssues(true);
    if (issueCount) {
      setNotice({ ok: false, message: `Finish ${issueCount === 1 ? "1 step" : `${issueCount} steps`} before turning it on.` });
      const first = Object.keys(localIssues).find((k) => k !== "steps");
      if (first) select(first);
      return;
    }
    run("status", () => actions.setStatus(workflow.id, draft, "active"));
  };

  const panel = (
    <Panel
      selected={selected}
      step={selectedStep}
      steps={steps}
      setSteps={setSteps}
      setSelected={setSelected}
      trigger={trigger}
      setTrigger={setTrigger}
      allowReentry={allowReentry}
      setAllowReentry={setAllowReentry}
      name={name}
      setName={setName}
      client={client}
      pipeline={pipeline}
      tags={tags}
      team={team}
      contacts={contacts}
      stats={stats}
      started={started}
      issues={issues}
      testRuns={testRuns}
      workflowId={workflow.id}
      now={now}
      testing={busy === "test"}
      onTest={(contactId, skipWaits) => {
        setShowIssues(true);
        run("test", () => actions.test(workflow.id, draft, contactId, skipWaits));
      }}
      actions={actions}
      onClose={() => setSheetOpen(false)}
    />
  );

  return (
    <div className="flex min-h-screen flex-col">
      <WorkflowHeader
        id={workflow.id}
        name={name || workflow.name}
        status={workflow.status}
        client={client}
        tab="builder"
        runs={runs}
        meta={
          <span className="inline-flex flex-wrap items-center gap-x-1.5" aria-live="polite">
            <span>{triggerLabel[trigger.type]}</span>
            <span aria-hidden>·</span>
            {notice ? (
              <span className={cn("font-medium", notice.ok ? "text-rail-fg" : "text-red-soft")}>{notice.message}</span>
            ) : dirty ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-rail-fg">
                <span aria-hidden className="size-1.5 rounded-full bg-amber-soft" />
                Unsaved changes
              </span>
            ) : (
              <span>Saved {timeAgo(workflow.updatedAt, now)}</span>
            )}
          </span>
        }
        actions={
          <>
            <button type="button" className={inkButton} onClick={() => select("test")}>
              <FlaskConical className="size-3.5" strokeWidth={1.75} />
              Test
            </button>
            <button type="button" className={cn(inkButton, "px-2")} onClick={() => select("settings")} aria-label="Workflow settings" title="Workflow settings">
              <Settings2 className="size-4" strokeWidth={1.75} />
            </button>
            {workflow.status === "active" ? (
              <>
                <button type="button" className={inkButton} disabled={pending} onClick={() => run("status", () => actions.setStatus(workflow.id, draft, "paused"))}>
                  <Pause className="size-3.5" strokeWidth={1.75} />
                  Pause
                </button>
                <Button type="button" disabled={pending || !dirty} onClick={save}>
                  {busy === "save" ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2} /> : <Check className="size-3.5" strokeWidth={2.25} />}
                  Save
                </Button>
              </>
            ) : (
              <>
                <button type="button" className={inkButton} disabled={pending || !dirty} onClick={save}>
                  {busy === "save" && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
                  Save draft
                </button>
                <Button type="button" disabled={pending} onClick={turnOn}>
                  {busy === "status" ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2} /> : <Play className="size-3.5" strokeWidth={2} />}
                  Turn on
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="min-w-0 flex-1 px-5 py-8 md:px-8">
          <div className="mx-auto flex w-full max-w-[600px] flex-col items-center">
            <TriggerNode trigger={trigger} pipeline={pipeline} started={started} selected={selected === "trigger"} error={issues.trigger} onSelect={() => select("trigger")} />
            <LaneView
              steps={steps}
              lane={{ parentId: null, side: "main" }}
              client={client}
              pipeline={pipeline}
              stats={stats}
              laneCounts={laneCounts}
              selected={selected}
              issues={issues}
              onSelect={select}
              onAdd={add}
            />
            <div className="flex flex-col items-center gap-1.5 pt-0.5">
              <span aria-hidden className="size-2 rounded-full bg-line-strong" />
              <span className="text-xs text-fg-3">End</span>
              {issues.steps && <p className="text-xs font-medium text-red">{issues.steps}</p>}
            </div>
          </div>
        </div>

        <aside className="sticky top-0 hidden h-screen w-[380px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block 2xl:w-[420px]">{panel}</aside>
        {sheetOpen && (
          <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Edit step">
            <button type="button" aria-label="Close panel" onClick={() => setSheetOpen(false)} className="flex-1 bg-rail/40" />
            <aside className="h-full w-[min(100%,420px)] overflow-y-auto border-l border-line bg-surface shadow-2">{panel}</aside>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- canvas ------------------------------ */

const nodeBase =
  "group relative flex w-full items-start gap-3 rounded border bg-surface px-3.5 py-3 text-left transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

function nodeState(selected: boolean, error?: string) {
  return selected ? "border-rail shadow-[0_0_0_1px_var(--rail)]" : error ? "border-red/40 hover:border-red/70" : "border-line hover:border-line-strong";
}

function TriggerNode({ trigger, pipeline, started, selected, error, onSelect }: { trigger: WorkflowTrigger; pipeline?: Pipeline; started: number; selected: boolean; error?: string; onSelect: () => void }) {
  const names = useNames();
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={cn(nodeBase, nodeState(selected, error))}>
      <StepGlyph type="trigger" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{triggerLabel[trigger.type]}</span>
          <span className="ml-auto num shrink-0 text-2xs text-fg-3">{started ? `${formatCount(started)} started` : ""}</span>
        </span>
        <span className="block text-xs leading-relaxed text-fg-2">{triggerSummary(trigger, pipeline, names)}</span>
        {error && <NodeError text={error} />}
      </span>
    </button>
  );
}

function NodeError({ text }: { text: string }) {
  return (
    <span className="mt-1 flex items-center gap-1 text-xs font-medium text-red">
      <AlertCircle className="size-3.5" strokeWidth={2} aria-hidden />
      {text}
    </span>
  );
}

function StatLine({ s }: { s?: StepStats[string] }) {
  if (!s) return null;
  const parts: React.ReactNode[] = [];
  if (s.done) parts.push(<span key="d">{formatCount(s.done)} done</span>);
  if (s.waiting) parts.push(<span key="w" className="text-brand">{formatCount(s.waiting)} waiting</span>);
  if (s.skipped) parts.push(<span key="s">{formatCount(s.skipped)} skipped</span>);
  if (s.failed) parts.push(<span key="f" className="font-medium text-red">{formatCount(s.failed)} failed</span>);
  if (!parts.length) return null;
  return (
    <span className="num flex shrink-0 gap-1.5 text-2xs text-fg-3">
      {parts.map((p, i) => (
        <span key={i} className="flex gap-1.5">
          {i > 0 && <span aria-hidden>·</span>}
          {p}
        </span>
      ))}
    </span>
  );
}

function LaneView({
  steps,
  lane,
  client,
  pipeline,
  stats,
  laneCounts,
  selected,
  issues,
  onSelect,
  onAdd,
}: {
  steps: WorkflowStep[];
  lane: Lane;
  client: ClientRef;
  pipeline?: Pipeline;
  stats: StepStats;
  laneCounts: Record<string, { yes: number; no: number }>;
  selected: Selection;
  issues: Record<string, string>;
  onSelect: (s: Selection) => void;
  onAdd: (lane: Lane, index: number, type: StepType) => void;
}) {
  const nested = lane.side !== "main";
  const names = useNames();
  return (
    <>
      <Connector onAdd={(t) => onAdd(lane, 0, t)} allowBranch={!nested} />
      {steps.map((s, i) => (
        <div key={s.id} className="flex w-full flex-col items-center">
          {s.type === "wait" ? (
            <WaitNode step={s} selected={selected === s.id} stat={stats[s.id]} onSelect={() => onSelect(s.id)} />
          ) : (
            <button type="button" onClick={() => onSelect(s.id)} aria-pressed={selected === s.id} className={cn(nodeBase, nodeState(selected === s.id, issues[s.id]))}>
              <StepGlyph type={s.type} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">{stepLabel[s.type]}</span>
                  <span className="ml-auto">
                    <StatLine s={stats[s.id]} />
                  </span>
                </span>
                <span className={cn("line-clamp-2 block text-xs leading-relaxed", isBlank(s) ? "text-fg-3" : "text-fg-2")}>
                  <MergeText text={stepSummary(s, pipeline, client.mode, names)} />
                </span>
                {issues[s.id] && <NodeError text={issues[s.id]!} />}
              </span>
            </button>
          )}
          {s.type === "branch" && (
            <BranchLanes step={s} client={client} pipeline={pipeline} stats={stats} laneCounts={laneCounts} selected={selected} issues={issues} onSelect={onSelect} onAdd={onAdd} />
          )}
          <Connector onAdd={(t) => onAdd(lane, i + 1, t)} allowBranch={!nested} />
        </div>
      ))}
    </>
  );
}

function isBlank(s: WorkflowStep) {
  switch (s.type) {
    case "send_sms": return !s.body;
    case "send_email": return !s.subject;
    case "add_tag":
    case "remove_tag": return !s.tag;
    case "move_stage": return !s.stageId;
    case "assign_owner": return !s.ownerName;
    case "notify": return !s.to;
    case "send_webhook": return !s.hookId;
    case "app_action": return !s.app;
    default: return false;
  }
}

/** Time on the line: a wait is not an action, so it is drawn smaller, between the steps it separates. */
function WaitNode({ step, selected, stat, onSelect }: { step: Extract<WorkflowStep, { type: "wait" }>; selected: boolean; stat?: StepStats[string]; onSelect: () => void }) {
  const Icon = stepIcon.wait;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded border bg-surface-2 px-3 text-sm transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        selected ? "border-rail shadow-[0_0_0_1px_var(--rail)]" : "border-line hover:border-line-strong",
      )}
    >
      <Icon className="size-3.5 text-fg-2" strokeWidth={1.75} aria-hidden />
      <span className="font-medium">{stepSummary(step)}</span>
      {stat?.waiting ? <span className="num text-2xs font-medium text-brand">{formatCount(stat.waiting)} here now</span> : null}
    </button>
  );
}

function BranchLanes({
  step,
  client,
  pipeline,
  stats,
  laneCounts,
  selected,
  issues,
  onSelect,
  onAdd,
}: {
  step: Extract<WorkflowStep, { type: "branch" }>;
  client: ClientRef;
  pipeline?: Pipeline;
  stats: StepStats;
  laneCounts: Record<string, { yes: number; no: number }>;
  selected: Selection;
  issues: Record<string, string>;
  onSelect: (s: Selection) => void;
  onAdd: (lane: Lane, index: number, type: StepType) => void;
}) {
  const counts = laneCounts[step.id];
  return (
    <div className="relative w-full">
      {/* The split: one line down from the condition, across to both lanes. */}
      <span aria-hidden className="mx-auto block h-4 w-px bg-line-strong" />
      <span aria-hidden className="absolute left-1/4 right-1/4 top-4 hidden h-px bg-line-strong sm:block" />
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        {(["yes", "no"] as const).map((side) => (
          <div key={side} className="flex min-w-0 flex-col items-center">
            <span aria-hidden className="hidden h-4 w-px bg-line-strong sm:block" />
            <span className="inline-flex h-6 items-center gap-1.5 rounded-[4px] border border-line bg-surface px-2 text-xs font-medium">
              {side === "yes" ? "Yes" : "No"}
              {counts && <span className="num text-2xs font-normal text-fg-3">{formatCount(counts[side])}</span>}
            </span>
            <LaneView
              steps={step[side]}
              lane={{ parentId: step.id, side }}
              client={client}
              pipeline={pipeline}
              stats={stats}
              laneCounts={laneCounts}
              selected={selected}
              issues={issues}
              onSelect={onSelect}
              onAdd={onAdd}
            />
            {step[side].length === 0 && <span className="relative -mt-1 bg-bg px-1.5 pb-1 text-xs text-fg-3">Nothing, carry on</span>}
            <span aria-hidden className="hidden w-px flex-1 bg-line-strong sm:block" />
          </div>
        ))}
      </div>
      {/* The join: both lanes meet again and the workflow carries on. */}
      <span aria-hidden className="absolute bottom-0 left-1/4 right-1/4 hidden h-px bg-line-strong sm:block" />
    </div>
  );
}

/** The line between two nodes, with the one way to add a step there. */
function Connector({ onAdd, allowBranch }: { onAdd: (t: StepType) => void; allowBranch: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative flex h-12 w-full flex-col items-center justify-center">
      <span aria-hidden className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line-strong" />
      <button
        type="button"
        aria-label="Add a step here"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative grid size-6 place-items-center rounded-[4px] border bg-surface text-fg-3 transition-colors duration-150 hover:border-fg-3 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          open ? "border-rail text-fg" : "border-line-strong",
        )}
      >
        <Plus className="size-3.5" strokeWidth={2} />
      </button>
      {open && (
        <div role="menu" className="absolute left-1/2 top-[calc(50%+16px)] z-30 w-[248px] -translate-x-1/2 rounded border border-line bg-surface p-1.5 shadow-2">
          {stepGroups.map((g) => {
            const types = g.types.filter((t) => allowBranch || t !== "branch");
            if (!types.length) return null;
            return (
              <div key={g.label} className="py-1 first:pt-0 last:pb-0 [&+&]:border-t [&+&]:border-line">
                <div className="px-2 pb-1 pt-1.5 text-2xs font-medium text-fg-3">{g.label}</div>
                {types.map((t) => {
                  const Icon = stepIcon[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        onAdd(t);
                      }}
                      className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                    >
                      <Icon className="size-3.5 text-fg-2" strokeWidth={1.75} aria-hidden />
                      {stepLabel[t]}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {!allowBranch && <p className="border-t border-line px-2 pb-1 pt-2 text-2xs leading-relaxed text-fg-3">An if/else can&apos;t go inside another one. Add it after the lanes rejoin.</p>}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- panel ------------------------------ */

function Panel({
  selected,
  step,
  steps,
  setSteps,
  setSelected,
  trigger,
  setTrigger,
  allowReentry,
  setAllowReentry,
  name,
  setName,
  client,
  pipeline,
  tags,
  team,
  contacts,
  stats,
  started,
  issues,
  testRuns,
  workflowId,
  now,
  testing,
  onTest,
  actions,
  onClose,
}: {
  selected: Selection;
  step?: WorkflowStep;
  steps: WorkflowStep[];
  setSteps: (fn: (xs: WorkflowStep[]) => WorkflowStep[]) => void;
  setSelected: (s: Selection) => void;
  trigger: WorkflowTrigger;
  setTrigger: (t: WorkflowTrigger) => void;
  allowReentry: boolean;
  setAllowReentry: (v: boolean) => void;
  name: string;
  setName: (v: string) => void;
  client: ClientRef;
  pipeline?: Pipeline;
  tags: string[];
  team: string[];
  contacts: ContactLite[];
  stats: StepStats;
  started: number;
  issues: Record<string, string>;
  testRuns: RunRow[];
  workflowId: string;
  now: Date;
  testing: boolean;
  onTest: (contactId: string, skipWaits: boolean) => void;
  actions: BuilderActions;
  onClose: () => void;
}) {
  const title = selected === "trigger" ? "Trigger" : selected === "test" ? "Test with a contact" : selected === "settings" ? "Workflow settings" : step ? stepLabel[step.type] : "Step";
  const pos = step ? laneOf(steps, step.id) : null;
  const s = step ? stats[step.id] : undefined;
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface px-5 py-3.5">
        {step ? <StepGlyph type={step.type} /> : selected === "trigger" ? <StepGlyph type="trigger" /> : null}
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg lg:hidden">
          <X className="size-4" strokeWidth={2} />
        </button>
      </header>

      <div className="flex flex-col gap-6 px-5 py-5">
        {selected === "trigger" && (
          <TriggerEditor trigger={trigger} onChange={setTrigger} allowReentry={allowReentry} onReentry={setAllowReentry} mode={client.mode} pipeline={pipeline} tags={tags} started={started} error={issues.trigger} />
        )}

        {step && pos && (
          <>
            <StepEditor step={step} onChange={(next) => setSteps((xs) => replaceStep(xs, next))} mode={client.mode} pipeline={pipeline} tags={tags} team={team} error={issues[step.id]} />
            {s && (
              <div className="num rounded border border-line bg-surface-2/40 px-3.5 py-2.5 text-xs text-fg-2">
                Last 30 days: {formatCount(s.done)} done
                {s.waiting ? ` · ${formatCount(s.waiting)} waiting` : ""}
                {s.skipped ? ` · ${formatCount(s.skipped)} skipped` : ""}
                {s.failed ? ` · ${formatCount(s.failed)} failed` : ""}.{" "}
                <Link href={`/agency/automations/${workflowId}/runs`} className="font-medium text-fg underline-offset-2 hover:underline">
                  See runs
                </Link>
              </div>
            )}
            <div className="border-t border-line pt-4">
              <StepControls
                label={stepLabel[step.type]}
                canUp={pos.index > 0}
                canDown={pos.index < pos.length - 1}
                onUp={() => setSteps((xs) => moveStep(xs, step.id, -1))}
                onDown={() => setSteps((xs) => moveStep(xs, step.id, 1))}
                onRemove={() => {
                  setSteps((xs) => removeStep(xs, step.id));
                  setSelected("trigger");
                }}
              />
              {step.type === "branch" && (step.yes.length + step.no.length > 0) && <p className="mt-2 text-xs text-fg-3">Removing an if/else removes the steps in both lanes.</p>}
            </div>
          </>
        )}

        {selected === "test" && <TestPanel contacts={contacts} testRuns={testRuns} workflowId={workflowId} now={now} testing={testing} onTest={onTest} />}

        {selected === "settings" && <SettingsPanel name={name} setName={setName} workflowId={workflowId} actions={actions} />}

        {!step && selected !== "trigger" && selected !== "test" && selected !== "settings" && <p className="text-sm text-fg-3">That step was removed.</p>}
      </div>
    </div>
  );
}

function TestPanel({ contacts, testRuns, workflowId, now, testing, onTest }: { contacts: ContactLite[]; testRuns: RunRow[]; workflowId: string; now: Date; testing: boolean; onTest: (contactId: string, skipWaits: boolean) => void }) {
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [skipWaits, setSkipWaits] = useState(true);
  const last = testRuns[0];
  return (
    <>
      <p className="text-xs leading-relaxed text-fg-2">
        Runs the workflow for one contact now, whatever starts it. It really runs: texts and emails land in their inbox thread, and tags, stage and owner change. Saves your edits first.
      </p>
      <Field label="Contact" htmlFor="test-contact">
        <Select id="test-contact" value={contactId} onChange={(e) => setContactId(e.target.value)}>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.line ? ` · ${c.line}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={skipWaits} onChange={(e) => setSkipWaits(e.target.checked)} className="size-3.5 accent-[var(--rail)]" />
        Skip waits, so the whole workflow runs now
      </label>
      <div>
        <button
          type="button"
          disabled={!contactId || testing}
          onClick={() => onTest(contactId, skipWaits)}
          className="inline-flex h-8 items-center gap-1.5 rounded bg-rail px-3 text-sm font-medium text-rail-fg transition-colors duration-150 hover:bg-rail-2 disabled:opacity-50"
        >
          {testing ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2} /> : <FlaskConical className="size-3.5" strokeWidth={1.75} />}
          Run test
        </button>
      </div>

      {last && (
        <section className="flex flex-col gap-2 border-t border-line pt-5">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{last.contactName}</h3>
            <RunStatusTag status={last.status} />
            <span className="text-2xs text-fg-3">{timeAgo(last.startedAt, now)}</span>
          </div>
          <ol className="flex flex-col">
            {last.steps.map((x, i) => (
              <li key={i} className="flex gap-2 border-b border-line py-2 last:border-b-0">
                <RunStepMark status={x.status} />
                <span className="min-w-0 text-sm leading-5">
                  <span className="font-medium">{stepLabel[x.type]}</span>
                  <span className="block text-xs text-fg-2">{x.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <Link href={`/agency/automations/${workflowId}/runs?run=${encodeURIComponent(last.id)}`} className="text-xs font-medium text-fg-2 underline-offset-2 hover:text-fg hover:underline">
            Open in run history
          </Link>
        </section>
      )}
    </>
  );
}

function SettingsPanel({ name, setName, workflowId, actions }: { name: string; setName: (v: string) => void; workflowId: string; actions: BuilderActions }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Field label="Name" htmlFor="wf-name" hint="Only the team sees it." error={name.trim().length < 2 ? "Name the workflow" : undefined}>
        <Input id="wf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Field>
      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <form action={actions.duplicate.bind(null, workflowId)}>
          <button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded border border-line-strong px-3 text-sm font-medium hover:bg-surface-2">
            <Copy className="size-3.5" strokeWidth={1.75} />
            Duplicate as a draft
          </button>
        </form>
        {confirm ? (
          <div className="flex flex-col gap-2.5 rounded border border-red/25 bg-red-soft/50 p-3">
            <p className="text-sm text-fg">Delete this workflow and its run history? Contacts on a wait stop where they are.</p>
            <div className="flex gap-2">
              <form action={actions.remove.bind(null, workflowId)}>
                <button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded bg-red px-3 text-sm font-medium text-white hover:bg-red/90">
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                  Delete
                </button>
              </form>
              <button type="button" onClick={() => setConfirm(false)} className="h-8 px-2 text-sm text-fg-2 hover:text-fg">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="inline-flex h-8 w-fit items-center gap-1.5 rounded border border-line-strong px-3 text-sm font-medium text-fg-2 hover:border-red/40 hover:text-red">
            <Trash2 className="size-3.5" strokeWidth={1.75} />
            Delete workflow
          </button>
        )}
      </div>
    </>
  );
}
