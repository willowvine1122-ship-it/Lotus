import type { ActivityKind, ClientRecord, Contact, RunStep, Workflow, WorkflowRun, WorkflowStatus, WorkflowStep, WorkflowTrigger } from "@/lib/types";
import { conditionHolds, conditionSummary, findStep, triggerMatches, waitMs, waitText, type TriggerEvent } from "@/components/automations/model";
import { renderMerge } from "@/components/email/model";
import { formatDollars } from "@/lib/utils";
import { cloneSteps, findWorkflowTemplate } from "./automation-templates";
import { listSends } from "./email";
import { listThreads, startConversation, findConversation, assignConversation } from "./inbox";
import { stepAppAction, stepSendWebhook } from "./integrations";
import { addActivity, addTask, findClient, findContact, getPipeline, listActivities, listClients, listContacts, moveContactStage, updateContact } from "./store";

/*
 * Demo automation engine. Workflows and their runs live in process memory on
 * globalThis, seeded once per day. Every run is one contact going through one
 * workflow, step by step; each step records what happened in plain words,
 * so the run history answers "why didn't it fire" without guesswork.
 *
 * Runs execute in-process: a trigger starts them, actions run immediately,
 * a wait parks the run until its time, and any read of the store resumes the
 * runs that are due. In production this becomes a durable job queue
 * (Inngest) with the same step semantics.
 *
 * The seeded history is a replay of the last 30 days of CRM, inbox and email
 * events through the seeded workflows. A replay only records runs and logs
 * activities; it never changes the seeded contacts.
 */

interface AutomationStore {
  seededFor: string;
  workflows: Workflow[];
  runs: WorkflowRun[];
}

const g = globalThis as unknown as { __lotusAutomations?: AutomationStore; __lotusAutomationsBusy?: boolean };

const ACTOR = "Automation";

/**
 * A replay leaves the seeded contacts alone, so it tracks the tags its own
 * steps would have added or removed here, per contact, to keep "already
 * tagged" and "didn't have" honest across steps and runs.
 */
const replayTags = new Map<string, Map<string, boolean>>();

function hasTag(ctx: Ctx, contact: Contact, tag: string) {
  const t = tag.toLowerCase();
  const sim = ctx.mode === "replay" ? replayTags.get(contact.id)?.get(t) : undefined;
  return sim ?? contact.tags.some((x) => x.toLowerCase() === t);
}

function setReplayTag(contactId: string, tag: string, on: boolean) {
  const m = replayTags.get(contactId) ?? new Map<string, boolean>();
  m.set(tag.toLowerCase(), on);
  replayTags.set(contactId, m);
}
const DAY = 86400000;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function store(now: Date): AutomationStore {
  const key = now.toISOString().slice(0, 10);
  if (!g.__lotusAutomations || g.__lotusAutomations.seededFor !== key) {
    const kept = g.__lotusAutomations?.workflows.filter((w) => w.id.startsWith("new-")) ?? [];
    g.__lotusAutomations = { seededFor: key, workflows: [], runs: [] };
    seed(now, g.__lotusAutomations);
    g.__lotusAutomations.workflows.push(...kept);
  }
  return g.__lotusAutomations;
}

/** The store, with every run whose wait has ended carried forward. */
function live(now: Date): AutomationStore {
  const s = store(now);
  if (!g.__lotusAutomationsBusy) {
    g.__lotusAutomationsBusy = true;
    try {
      resumeDue(s, now, "live");
    } finally {
      g.__lotusAutomationsBusy = false;
    }
  }
  return s;
}

/* ------------------------------- engine ------------------------------ */

type Mode = "live" | "replay";

interface Ctx {
  s: AutomationStore;
  /** The real clock: store reads are keyed by it. */
  now: Date;
  mode: Mode;
  skipWaits?: boolean;
  depth: number;
}

function vars(contact: Contact, client: ClientRecord | undefined) {
  return { first_name: contact.firstName, last_name: contact.lastName, client_name: client?.account.name };
}

/** App fields can also use the contact's email, phone and company. */
function renderAppField(text: string, contact: Contact, client: ClientRecord | undefined) {
  const extra: Record<string, string> = { email: contact.email ?? "", phone: contact.phone ?? "", company: contact.company ?? "", city: contact.city ?? "" };
  return renderMerge(text, vars(contact, client)).replace(/\{\{\s*(email|phone|company|city)\s*\}\}/g, (_, k: string) => extra[k] ?? "");
}

function clip(text: string, n = 90) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/**
 * Log to the contact timeline. A replay logs at the moment the step ran in
 * the past without moving the contact's "last activity".
 */
function log(ctx: Ctx, at: Date, contactId: string, input: { kind: ActivityKind; title: string; body?: string }) {
  const c = findContact(ctx.now, contactId);
  const before = c?.lastActivityAt;
  const a = addActivity(ctx.now, contactId, { ...input, by: ACTOR });
  if (a && ctx.mode === "replay") {
    a.at = at.toISOString();
    if (c && before) c.lastActivityAt = before > a.at ? before : a.at;
  }
}

/** Run one action step. Returns what happened, in words. */
function act(ctx: Ctx, wf: Workflow, step: Exclude<WorkflowStep, { type: "wait" | "branch" }>, contact: Contact, at: Date): Pick<RunStep, "status" | "detail"> {
  const client = findClient(ctx.now, wf.accountId);
  const m = (t: string) => renderMerge(t, vars(contact, client));
  const replay = ctx.mode === "replay";
  switch (step.type) {
    case "send_sms": {
      if (!contact.phone) return { status: "skipped", detail: "Skipped: no phone number" };
      if (contact.doNotContact.sms) return { status: "skipped", detail: "Skipped: opted out of texts" };
      const body = m(step.body);
      if (replay) log(ctx, at, contact.id, { kind: "sms", title: "SMS sent", body });
      else {
        // The text lands in the inbox thread like any other message, which also logs it on the contact.
        const conv = startConversation(ctx.now, { contactId: contact.id, channel: "sms", body, authorName: ACTOR });
        if (conv?.assigneeName === ACTOR) assignConversation(ctx.now, conv.id, undefined);
      }
      return { status: "done", detail: `Sent: ${clip(body)}` };
    }
    case "send_email": {
      if (!contact.email) return { status: "skipped", detail: "Skipped: no email address" };
      if (contact.doNotContact.email) return { status: "skipped", detail: "Skipped: unsubscribed from email" };
      const subject = m(step.subject);
      const body = m(step.body);
      if (replay) log(ctx, at, contact.id, { kind: "email", title: "Email sent", body: `${subject}: ${body}` });
      else {
        const conv = startConversation(ctx.now, { contactId: contact.id, channel: "email", subject, body, authorName: ACTOR });
        if (conv && findConversation(ctx.now, conv.id)?.assigneeName === ACTOR) assignConversation(ctx.now, conv.id, undefined);
      }
      return { status: "done", detail: `Sent “${clip(subject, 70)}” to ${contact.email}` };
    }
    case "add_tag": {
      const tag = step.tag.trim();
      if (hasTag(ctx, contact, tag)) return { status: "skipped", detail: `Skipped: already tagged “${tag}”` };
      if (replay) setReplayTag(contact.id, tag, true);
      else {
        updateContact(ctx.now, contact.id, { tags: [...contact.tags, tag] });
        // Tags can start other workflows; a short chain is allowed, a loop is not.
        if (ctx.depth < 3) fire(ctx.now, { type: "tag_added", contactId: contact.id, tag, label: `Tag added by “${wf.name}”: ${tag}` }, ctx.depth + 1, wf.id);
      }
      log(ctx, at, contact.id, { kind: "note", title: `Tag added: ${tag}` });
      return { status: "done", detail: `Added “${tag}”` };
    }
    case "remove_tag": {
      const tag = step.tag.trim();
      if (!hasTag(ctx, contact, tag)) return { status: "skipped", detail: `Skipped: didn't have “${tag}”` };
      if (replay) setReplayTag(contact.id, tag, false);
      else updateContact(ctx.now, contact.id, { tags: contact.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()) });
      log(ctx, at, contact.id, { kind: "note", title: `Tag removed: ${tag}` });
      return { status: "done", detail: `Removed “${tag}”` };
    }
    case "move_stage": {
      const stage = getPipeline(ctx.now, wf.accountId)?.stages.find((x) => x.id === step.stageId);
      if (!stage) return { status: "failed", detail: "Failed: that stage no longer exists" };
      if (contact.stageId === stage.id) return { status: "skipped", detail: `Skipped: already in ${stage.name}` };
      if (replay) log(ctx, at, contact.id, { kind: "stage", title: `Moved to ${stage.name}` });
      else moveContactStage(ctx.now, contact.id, stage.id, ACTOR);
      return { status: "done", detail: `Moved to ${stage.name}` };
    }
    case "assign_owner": {
      if (contact.ownerName === step.ownerName) return { status: "skipped", detail: `Skipped: ${step.ownerName} already owns it` };
      if (!replay) updateContact(ctx.now, contact.id, { ownerName: step.ownerName });
      log(ctx, at, contact.id, { kind: "note", title: `Owner set to ${step.ownerName}` });
      return { status: "done", detail: `Assigned to ${step.ownerName}` };
    }
    case "create_task": {
      const title = m(step.title);
      const due = new Date(at.getTime() + step.dueInDays * DAY).toISOString().slice(0, 10);
      if (!replay) addTask(ctx.now, wf.accountId, title, step.assigneeName, due);
      log(ctx, at, contact.id, { kind: "task", title: `Task created: ${title}`, body: step.assigneeName ? `For ${step.assigneeName}` : undefined });
      return { status: "done", detail: `Task for ${step.assigneeName ?? "the team"}: ${clip(title, 70)}` };
    }
    case "notify": {
      const message = m(step.message);
      log(ctx, at, contact.id, { kind: "note", title: `${step.to} notified`, body: message });
      return { status: "done", detail: `Told ${step.to}: ${clip(message, 70)}` };
    }
    case "send_webhook": {
      const r = stepSendWebhook(ctx.now, wf.accountId, step.hookId, contact, wf.name, { replay, at });
      if (r.status === "done") log(ctx, at, contact.id, { kind: "note", title: "Sent to a webhook", body: r.detail });
      return r;
    }
    case "app_action": {
      const fields = Object.fromEntries(Object.entries(step.fields).map(([k, v]) => [k, renderAppField(v, contact, client)]));
      const r = stepAppAction(ctx.now, wf.accountId, step.app, step.action, fields, contact, { replay, at });
      if (r.status === "done") log(ctx, at, contact.id, { kind: "note", title: r.detail });
      return r;
    }
  }
}

/** Carry a run forward from its next pending step until it waits or ends. */
function advance(ctx: Ctx, run: WorkflowRun, startAt: Date) {
  const wf = ctx.s.workflows.find((w) => w.id === run.workflowId);
  let at = startAt;
  const record = (step: RunStep) => run.steps.push(step);
  while (run.pending.length) {
    const contact = findContact(ctx.now, run.contactId);
    if (!wf || !contact) {
      run.status = "failed";
      run.finishedAt = at.toISOString();
      run.pending = [];
      record({ stepId: "", type: "notify", status: "failed", detail: wf ? "Failed: the contact was deleted" : "Failed: the workflow was deleted", at: at.toISOString() });
      return;
    }
    const id = run.pending.shift()!;
    const step = findStep(wf.steps, id);
    if (!step) continue; // removed from the workflow since the run started
    if (step.type === "wait") {
      const until = new Date(at.getTime() + waitMs(step.amount, step.unit));
      if (ctx.skipWaits) {
        record({ stepId: step.id, type: "wait", status: "done", detail: `Skipped the ${waitText(step.amount, step.unit)} wait (test run)`, at: at.toISOString() });
        continue;
      }
      run.status = "waiting";
      run.resumeAt = until.toISOString();
      record({ stepId: step.id, type: "wait", status: "waiting", detail: `Waiting ${waitText(step.amount, step.unit)}`, at: at.toISOString() });
      return;
    }
    if (step.type === "branch") {
      const pipeline = getPipeline(ctx.now, wf.accountId);
      const yes = conditionHolds(step.condition, contact);
      const lane = yes ? step.yes : step.no;
      record({ stepId: step.id, type: "branch", status: "done", detail: `${yes ? "Yes" : "No"}: ${conditionSummary(step.condition, pipeline, findClient(ctx.now, wf.accountId)?.mode)}${lane.length ? "" : ", nothing to do"}`, at: at.toISOString() });
      run.pending = [...lane.map((s) => s.id), ...run.pending];
      continue;
    }
    const r = act(ctx, wf, step, contact, at);
    record({ stepId: step.id, type: step.type, ...r, at: at.toISOString() });
    if (r.status === "failed") {
      run.status = "failed";
      run.finishedAt = at.toISOString();
      run.pending = [];
      return;
    }
    at = new Date(at.getTime() + 1000);
  }
  run.status = "completed";
  run.resumeAt = undefined;
  run.finishedAt = at.toISOString();
}

/** Seeded paused workflows were paused nine days ago. */
const pausedSince = (now: Date) => new Date(now.getTime() - 9 * DAY).toISOString();

function resumeDue(s: AutomationStore, now: Date, mode: Mode, until = now) {
  const due = s.runs.filter((r) => r.status === "waiting" && r.resumeAt && r.resumeAt <= until.toISOString()).sort((a, b) => a.resumeAt!.localeCompare(b.resumeAt!));
  for (const run of due) {
    const wf = s.workflows.find((w) => w.id === run.workflowId);
    // A paused workflow holds its waiting contacts until it is turned back on
    // (in a replay, only from the day it was paused).
    if (wf && wf.status !== "active" && !run.test && (mode === "live" || run.resumeAt! > pausedSince(now))) continue;
    const at = new Date(run.resumeAt!);
    const waitStep = [...run.steps].reverse().find((x) => x.status === "waiting");
    if (waitStep) {
      waitStep.status = "done";
      waitStep.detail = waitStep.detail.replace(/^Waiting/, "Waited");
    }
    run.status = "completed";
    run.resumeAt = undefined;
    advance({ s, now, mode, depth: 0 }, run, at);
  }
}

function startRun(ctx: Ctx, wf: Workflow, contactId: string, label: string, at: Date, test = false): WorkflowRun | undefined {
  const mine = ctx.s.runs.filter((r) => r.workflowId === wf.id && r.contactId === contactId && !r.test);
  if (!test) {
    if (mine.some((r) => r.status === "waiting")) return undefined;
    if (!wf.allowReentry && mine.length) return undefined;
  }
  const run: WorkflowRun = {
    id: `run-${wf.id}-${contactId}-${at.getTime().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
    workflowId: wf.id,
    accountId: wf.accountId,
    contactId,
    status: "completed",
    triggeredBy: label,
    test: test || undefined,
    startedAt: at.toISOString(),
    pending: wf.steps.map((s) => s.id),
    steps: [],
  };
  ctx.s.runs.push(run);
  advance(ctx, run, at);
  return run;
}

function fire(now: Date, e: TriggerEvent, depth = 0, fromWorkflowId?: string): WorkflowRun[] {
  const s = store(now);
  const contact = findContact(now, e.contactId);
  if (!contact) return [];
  const out: WorkflowRun[] = [];
  for (const wf of s.workflows) {
    if (wf.status !== "active" || wf.accountId !== contact.accountId || wf.id === fromWorkflowId) continue;
    if (!triggerMatches(wf.trigger, e)) continue;
    const r = startRun({ s, now, mode: "live", depth }, wf, contact.id, e.label, now);
    if (r) out.push(r);
  }
  return out;
}

/* ------------------------------- seeding ----------------------------- */

const plans: Record<ClientRecord["mode"], { id: string; status: WorkflowStatus; p: number }[]> = {
  marketing: [
    { id: "speed-to-lead", status: "active", p: 1 },
    { id: "booking-confirmation", status: "active", p: 0.85 },
    { id: "no-show-recovery", status: "active", p: 0.7 },
    { id: "review-request", status: "paused", p: 0.5 },
    { id: "email-clicked", status: "draft", p: 0.35 },
  ],
  fundraising: [
    { id: "donation-thanks", status: "active", p: 1 },
    { id: "lapsed-winback", status: "active", p: 0.75 },
    { id: "monthly-upgrade", status: "active", p: 0.6 },
    { id: "reply-handoff", status: "draft", p: 0.4 },
  ],
};

function seed(now: Date, s: AutomationStore) {
  listThreads(now); // the inbox adds its contacts to the CRM; make sure they exist first
  const events: (TriggerEvent & { at: string })[] = [];
  const since = new Date(now.getTime() - 30 * DAY).toISOString();
  const nowIso = now.toISOString();

  for (const c of listClients(now)) {
    if (c.account.id.startsWith("new-")) continue;
    const r = rng([...c.account.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 11));
    for (const plan of plans[c.mode]) {
      if (r() > plan.p) continue;
      const t = findWorkflowTemplate(plan.id)!;
      const id = `${c.account.id}-wf-${t.id}`;
      const created = new Date(now.getTime() - (45 + Math.floor(r() * 60)) * DAY).toISOString();
      s.workflows.push({
        id,
        accountId: c.account.id,
        name: t.name,
        status: plan.status,
        trigger: { ...t.trigger },
        steps: cloneSteps(t.steps, id),
        allowReentry: t.trigger.type === "donation_received" || t.trigger.type === "message_received" || t.trigger.type === "appointment_booked",
        templateId: t.id,
        createdAt: created,
        updatedAt: new Date(now.getTime() - Math.floor(r() * 20) * DAY).toISOString(),
      });
    }

    // Events from the last 30 days of each contact's history.
    for (const ct of listContacts(now, c.account.id)) {
      for (const a of listActivities(now, ct.id)) {
        if (a.at < since || a.at > nowIso || a.by === ACTOR) continue;
        if (a.kind === "form") {
          events.push({ type: "contact_created", contactId: ct.id, source: ct.source, label: a.title, at: a.at });
          if (ct.source === "website" || ct.source === "meta" || ct.source === "donation-page") events.push({ type: "form_submitted", contactId: ct.id, label: a.title, at: a.at });
        } else if (a.kind === "appointment") {
          events.push({ type: "appointment_booked", contactId: ct.id, label: a.title, at: a.at });
          // A booking that never became a visit is a no-show two days on.
          const noShow = new Date(new Date(a.at).getTime() + 2 * DAY).toISOString();
          if (ct.stageId === "booked" && noShow < nowIso && r() < 0.5) events.push({ type: "appointment_no_show", contactId: ct.id, label: "Missed the appointment", at: noShow });
        } else if (a.kind === "donation" && a.amountCents) {
          events.push({ type: "donation_received", contactId: ct.id, amountCents: a.amountCents, label: `Gift of ${formatDollars(a.amountCents)}`, at: a.at });
        } else if (a.kind === "stage" && /won/i.test(a.title)) {
          events.push({ type: "stage_changed", contactId: ct.id, stageId: "won", label: "Moved to Won", at: a.at });
        } else if (a.kind === "stage" && /lost/i.test(a.title)) {
          events.push({ type: "stage_changed", contactId: ct.id, stageId: "lost", label: "Moved to Lost", at: a.at });
        }
      }
      // Lapsed donors lapse 60 days after their last gift; replay that moment when it fell in the window.
      if (ct.stageId === "lapsed") {
        const at = new Date(now.getTime() - (2 + Math.floor(r() * 26)) * DAY - Math.floor(r() * 8) * 3600000).toISOString();
        events.push({ type: "stage_changed", contactId: ct.id, stageId: "lapsed", label: "Moved to Lapsed", at });
      }
    }
  }

  for (const t of listThreads(now)) {
    for (const msg of t.messages) {
      if (msg.direction !== "inbound" || msg.kind !== "message" || msg.sentAt < since) continue;
      events.push({ type: "message_received", contactId: t.contactId, channel: msg.channel, label: `Wrote in by ${msg.channel === "sms" ? "SMS" : msg.channel === "email" ? "email" : msg.channel === "whatsapp" ? "WhatsApp" : "Facebook"}`, at: msg.sentAt });
    }
  }
  for (const send of listSends(now)) {
    if (send.clickedAt && send.clickedAt >= since) events.push({ type: "email_clicked", contactId: send.contactId, label: "Clicked a campaign link", at: send.clickedAt });
  }

  events.sort((a, b) => a.at.localeCompare(b.at));
  const pausedAt = pausedSince(now);
  for (const e of events) {
    resumeDue(s, now, "replay", new Date(e.at));
    const contact = findContact(now, e.contactId);
    if (!contact) continue;
    for (const wf of s.workflows) {
      if (wf.accountId !== contact.accountId || !triggerMatches(wf.trigger, e)) continue;
      // Paused workflows ran until they were paused; drafts never ran.
      if (wf.status === "draft" || (wf.status === "paused" && e.at > pausedAt) || e.at < wf.createdAt) continue;
      startRun({ s, now, mode: "replay", depth: 0 }, wf, contact.id, e.label, new Date(e.at));
    }
  }
  // Paused workflows hold their waiting contacts from the moment they were paused.
  resumeDue(s, now, "replay", now);
  replayTags.clear();
}

/* --------------------------------- API -------------------------------- */

export function listWorkflows(now: Date, accountId?: string): Workflow[] {
  const all = live(now).workflows;
  return accountId ? all.filter((w) => w.accountId === accountId) : all;
}

export function findWorkflow(now: Date, id: string): Workflow | undefined {
  return live(now).workflows.find((w) => w.id === id);
}

export function listRuns(now: Date, workflowId?: string): WorkflowRun[] {
  const all = live(now).runs;
  return workflowId ? all.filter((r) => r.workflowId === workflowId) : all;
}

export function findRun(now: Date, id: string): WorkflowRun | undefined {
  return live(now).runs.find((r) => r.id === id);
}

/** Something happened to a contact: start every active workflow listening for it. */
export function fireTrigger(now: Date, e: TriggerEvent): WorkflowRun[] {
  live(now);
  return fire(now, e);
}

export function createWorkflow(now: Date, input: { accountId: string; name: string; templateId?: string }): Workflow | undefined {
  const client = findClient(now, input.accountId);
  if (!client) return undefined;
  const t = input.templateId ? findWorkflowTemplate(input.templateId) : undefined;
  const id = `new-wf-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
  const at = now.toISOString();
  const trigger: WorkflowTrigger = t ? { ...t.trigger } : { type: "contact_created" };
  const wf: Workflow = { id, accountId: client.account.id, name: input.name.trim(), status: "draft", trigger, steps: t ? cloneSteps(t.steps, id) : [], allowReentry: false, templateId: t?.id, createdAt: at, updatedAt: at };
  live(now).workflows.push(wf);
  return wf;
}

export type WorkflowPatch = Partial<Pick<Workflow, "name" | "trigger" | "steps" | "allowReentry">>;

export function updateWorkflow(now: Date, id: string, patch: WorkflowPatch): Workflow | undefined {
  const wf = findWorkflow(now, id);
  if (!wf) return undefined;
  Object.assign(wf, patch, { updatedAt: now.toISOString() });
  return wf;
}

export function setWorkflowStatus(now: Date, id: string, status: WorkflowStatus): Workflow | undefined {
  const wf = findWorkflow(now, id);
  if (!wf) return undefined;
  wf.status = status;
  wf.updatedAt = now.toISOString();
  if (status === "active") resumeDue(store(now), now, "live");
  return wf;
}

export function duplicateWorkflow(now: Date, id: string): Workflow | undefined {
  const wf = findWorkflow(now, id);
  if (!wf) return undefined;
  const copyId = `new-wf-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
  const at = now.toISOString();
  const copy: Workflow = { ...structuredClone(wf), id: copyId, name: `${wf.name} (copy)`, status: "draft", steps: cloneSteps(wf.steps, copyId), createdAt: at, updatedAt: at };
  store(now).workflows.push(copy);
  return copy;
}

export function deleteWorkflow(now: Date, id: string) {
  const s = store(now);
  s.workflows = s.workflows.filter((w) => w.id !== id);
  s.runs = s.runs.filter((r) => r.workflowId !== id);
}

export function stopRun(now: Date, id: string, by: string): WorkflowRun | undefined {
  const run = findRun(now, id);
  if (!run || run.status !== "waiting") return run;
  const w = [...run.steps].reverse().find((x) => x.status === "waiting");
  if (w) {
    w.status = "skipped";
    w.detail = `Stopped by ${by} while waiting`;
  }
  run.status = "stopped";
  run.resumeAt = undefined;
  run.pending = [];
  run.finishedAt = now.toISOString();
  return run;
}

/** Run a workflow for one contact right now, whatever its status or trigger. */
export function testRun(now: Date, workflowId: string, contactId: string, opts: { skipWaits: boolean }): WorkflowRun | undefined {
  const s = live(now);
  const wf = s.workflows.find((w) => w.id === workflowId);
  const contact = findContact(now, contactId);
  if (!wf || !contact || contact.accountId !== wf.accountId) return undefined;
  return startRun({ s, now, mode: "live", depth: 0, skipWaits: opts.skipWaits }, wf, contact.id, "Test run", now, true);
}

