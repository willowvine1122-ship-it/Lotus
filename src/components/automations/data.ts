import { listRuns, listWorkflows } from "@/lib/data/automations";
import { findContact, getPipeline, listClients, listContacts, teamDirectory } from "@/lib/data/store";
import type { Pipeline, RunStatus, RunStep, TriggerType, Workflow, WorkflowRun, WorkflowStatus, WorkflowStep, WorkflowTrigger } from "@/lib/types";
import type { ClientRef } from "@/components/crm/model";
import { fullName } from "@/components/crm/model";
import { flatten, triggerSummary } from "./model";

/* Server-side loaders for the automation screens. Everything returned is serialisable. */

const DAY = 86400000;

export function automationClients(now: Date): ClientRef[] {
  return listClients(now)
    .map((c) => ({ id: c.account.id, name: c.account.name, slug: c.account.slug, mode: c.mode }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function automationPipelines(now: Date, clients: ClientRef[]): Record<string, Pipeline> {
  const out: Record<string, Pipeline> = {};
  for (const c of clients) {
    const p = getPipeline(now, c.id);
    if (p) out[c.id] = p;
  }
  return out;
}

export interface RunRow {
  id: string;
  workflowId: string;
  contactId: string;
  contactName: string;
  /** Email, else phone, else nothing. */
  contactLine?: string;
  status: RunStatus;
  triggeredBy: string;
  test: boolean;
  startedAt: string;
  finishedAt?: string;
  resumeAt?: string;
  steps: RunStep[];
}

export function runRow(now: Date, r: WorkflowRun): RunRow {
  const c = findContact(now, r.contactId);
  return {
    id: r.id,
    workflowId: r.workflowId,
    contactId: r.contactId,
    contactName: c ? fullName(c) : "Deleted contact",
    contactLine: c?.email ?? c?.phone,
    status: r.status,
    triggeredBy: r.triggeredBy,
    test: !!r.test,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    resumeAt: r.resumeAt,
    steps: r.steps,
  };
}

export interface WorkflowRow {
  id: string;
  accountId: string;
  name: string;
  status: WorkflowStatus;
  trigger: WorkflowTrigger;
  triggerText: string;
  steps: WorkflowStep[];
  /** Actions, waits and branches, counted through the branches. */
  stepCount: number;
  runs30: number;
  completed30: number;
  /** Contacts parked on a wait right now. */
  waiting: number;
  failed30: number;
  /** Steps skipped in the last 30 days: no phone, opted out, already tagged. */
  skipped30: number;
  lastRunAt?: string;
  lastRunStatus?: RunStatus;
  /** Runs started per day, oldest first, last 30 days. */
  perDay: number[];
  dayLabels: string[];
  updatedAt: string;
  recent: RunRow[];
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function workflowRow(now: Date, wf: Workflow, runs: WorkflowRun[], pipeline?: Pipeline): WorkflowRow {
  const since = now.getTime() - 30 * DAY;
  const real = runs.filter((r) => !r.test);
  const recent30 = real.filter((r) => new Date(r.startedAt).getTime() >= since);
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) days.push(dayKey(new Date(now.getTime() - i * DAY)));
  const counts = new Map(days.map((d) => [d, 0]));
  for (const r of recent30) {
    const k = r.startedAt.slice(0, 10);
    if (counts.has(k)) counts.set(k, counts.get(k)! + 1);
  }
  const sorted = [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const last = sorted.find((r) => !r.test) ?? sorted[0];
  return {
    id: wf.id,
    accountId: wf.accountId,
    name: wf.name,
    status: wf.status,
    trigger: wf.trigger,
    triggerText: triggerSummary(wf.trigger, pipeline),
    steps: wf.steps,
    stepCount: flatten(wf.steps).length,
    runs30: recent30.length,
    completed30: recent30.filter((r) => r.status === "completed").length,
    waiting: real.filter((r) => r.status === "waiting").length,
    failed30: recent30.filter((r) => r.status === "failed").length,
    skipped30: recent30.reduce((n, r) => n + r.steps.filter((s) => s.status === "skipped").length, 0),
    lastRunAt: last?.startedAt,
    lastRunStatus: last?.status,
    perDay: days.map((d) => counts.get(d)!),
    dayLabels: days,
    updatedAt: wf.updatedAt,
    recent: sorted.slice(0, 6).map((r) => runRow(now, r)),
  };
}

export function workflowRows(now: Date): WorkflowRow[] {
  const runs = listRuns(now);
  const byWf = new Map<string, WorkflowRun[]>();
  for (const r of runs) byWf.set(r.workflowId, [...(byWf.get(r.workflowId) ?? []), r]);
  const pipelines = new Map<string, Pipeline | undefined>();
  return listWorkflows(now).map((wf) => {
    if (!pipelines.has(wf.accountId)) pipelines.set(wf.accountId, getPipeline(now, wf.accountId));
    return workflowRow(now, wf, byWf.get(wf.id) ?? [], pipelines.get(wf.accountId));
  });
}

/** Per step: what happened to everyone who reached it in the last 30 days. */
export type StepStats = Record<string, { done: number; skipped: number; failed: number; waiting: number }>;

export function stepStats(now: Date, runs: WorkflowRun[]): StepStats {
  const since = new Date(now.getTime() - 30 * DAY).toISOString();
  const out: StepStats = {};
  for (const r of runs) {
    if (r.test || r.startedAt < since) continue;
    for (const s of r.steps) {
      const x = (out[s.stepId] ??= { done: 0, skipped: 0, failed: 0, waiting: 0 });
      x[s.status]++;
    }
  }
  return out;
}

export interface ContactLite {
  id: string;
  name: string;
  line?: string;
}

export function contactOptions(now: Date, accountId: string): ContactLite[] {
  return listContacts(now, accountId)
    .map((c) => ({ id: c.id, name: fullName(c), line: c.email ?? c.phone }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Tags already in use by the client's contacts, most used first, for suggestions. */
export function tagOptions(now: Date, accountId: string, wf?: Workflow): string[] {
  const counts = new Map<string, number>();
  for (const c of listContacts(now, accountId)) for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const s of wf ? flatten(wf.steps) : []) if ((s.type === "add_tag" || s.type === "remove_tag") && s.tag) counts.set(s.tag, (counts.get(s.tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

export const teamNames = () => teamDirectory.map((t) => t.name);

export type { TriggerType };
