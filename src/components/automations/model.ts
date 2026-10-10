import type { AccountMode, Channel, OpportunityStatus, ConditionField, Contact, ContactSource, Pipeline, RunStatus, StepType, TriggerType, WaitUnit, WorkflowCondition, WorkflowStatus, WorkflowStep, WorkflowTrigger } from "@/lib/types";
import { sourceLabel, stageOf } from "@/components/crm/model";
import { formatDollars } from "@/lib/utils";
import { appAction, appEvent, findApp } from "@/components/integrations/catalog";

/*
 * Shared, framework-free helpers for automations: labels, the plain-English
 * summary of every trigger and step, step-tree edits, and validation. The
 * builder, the board, the engine and the server actions all read these, so a
 * step is described the same way everywhere it appears.
 */

/* ------------------------------ triggers ----------------------------- */

export const triggerLabel: Record<TriggerType, string> = {
  contact_created: "Contact created",
  form_submitted: "Form submitted",
  tag_added: "Tag added",
  stage_changed: "Stage changed",
  appointment_booked: "Appointment booked",
  appointment_no_show: "Appointment no-show",
  donation_received: "Donation received",
  message_received: "Message received",
  email_opened: "Campaign email opened",
  email_clicked: "Campaign email clicked",
  job_completed: "Job completed",
  webhook_received: "Webhook received",
  app_event: "Event in a connected app",
  opportunity_created: "Opportunity created",
  opportunity_status_changed: "Opportunity status changed",
};

/** Triggers grouped for the picker, filtered by the client's mode. */
export function triggerGroups(mode: AccountMode): { label: string; types: TriggerType[] }[] {
  return [
    { label: "Contacts", types: ["contact_created", "form_submitted", "tag_added"] },
    { label: "Opportunities", types: ["stage_changed", "opportunity_created", "opportunity_status_changed"] },
    { label: mode === "marketing" ? "Appointments and jobs" : "Giving", types: mode === "marketing" ? ["appointment_booked", "appointment_no_show", "job_completed"] : ["donation_received"] },
    { label: "Conversations", types: ["message_received", "email_opened", "email_clicked"] },
    { label: "Apps and webhooks", types: ["app_event", "webhook_received"] },
  ];
}

const channelName: Record<Channel, string> = { sms: "SMS", email: "email", whatsapp: "WhatsApp", facebook: "Facebook" };

/** Names for ids a trigger or step points at (forms, webhooks), passed in by whoever has them. */
export interface NameLookup {
  form?: (id: string) => string | undefined;
  hook?: (id: string) => string | undefined;
  /** Pipelines by id, for triggers that narrow to one. */
  pipeline?: (id: string) => Pipeline | undefined;
}

const statusWord: Record<string, string> = { open: "reopened", won: "won", lost: "lost", abandoned: "abandoned" };

/** “Name” when the lookup knows it, a plain noun when there is no lookup, and says so when the thing is gone. */
function quoted(lookup: ((id: string) => string | undefined) | undefined, id: string, noun: string) {
  if (!lookup) return noun;
  const name = lookup(id);
  return name ? `“${name}”` : `${noun} that was removed`;
}

export function triggerSummary(t: WorkflowTrigger, pipeline?: Pipeline, names: NameLookup = {}): string {
  switch (t.type) {
    case "contact_created":
      return t.source ? `A new contact arrives from ${sourceLabel[t.source]}` : "A new contact is added, from any source";
    case "form_submitted":
      return t.formId ? `A contact fills in ${quoted(names.form, t.formId, "a form")}` : "A contact fills in any form or funnel page";
    case "tag_added":
      return t.tag ? `The tag “${t.tag}” is added to a contact` : "Any tag is added to a contact";
    case "stage_changed": {
      const p = (t.pipelineId && names.pipeline?.(t.pipelineId)) || pipeline;
      const where = t.pipelineId && p && !p.primary ? ` in ${p.name}` : "";
      return t.stageId ? `An opportunity moves to ${stageOf(p, t.stageId).name}${where}` : `An opportunity moves to any stage${where}`;
    }
    case "opportunity_created": {
      const p = t.pipelineId ? names.pipeline?.(t.pipelineId) : undefined;
      return p ? `An opportunity is created in ${p.name}` : "An opportunity is created in any pipeline";
    }
    case "opportunity_status_changed": {
      const p = t.pipelineId ? names.pipeline?.(t.pipelineId) : undefined;
      return `An opportunity is ${t.status ? `marked ${statusWord[t.status]}` : "won, lost, abandoned or reopened"}${p ? ` in ${p.name}` : ""}`;
    }
    case "appointment_booked":
      return "A contact books an appointment";
    case "appointment_no_show":
      return "A contact misses an appointment";
    case "donation_received":
      return t.minAmountCents ? `A gift of ${formatDollars(t.minAmountCents)} or more comes in` : "Any gift comes in";
    case "message_received":
      return t.channel ? `A contact writes in by ${channelName[t.channel]}` : "A contact writes in on any channel";
    case "email_opened":
      return "A contact opens a campaign email";
    case "email_clicked":
      return "A contact clicks a link in a campaign email";
    case "job_completed":
      return "A job for the contact is marked completed";
    case "webhook_received":
      return t.hookId ? `Something posts to ${quoted(names.hook, t.hookId, "a webhook")}` : "Something posts to any incoming webhook";
    case "app_event": {
      const ev = appEvent(t.appEvent);
      return ev ? `${ev.trigger.summary}` : "Pick the app and the event";
    }
  }
}

/** True when an event of this type and detail should start a workflow with this trigger. */
export function triggerMatches(t: WorkflowTrigger, e: TriggerEvent): boolean {
  if (t.type !== e.type) return false;
  if (t.tag && e.tag !== t.tag) return false;
  if (t.stageId && e.stageId !== t.stageId) return false;
  if (t.pipelineId && e.pipelineId !== t.pipelineId) return false;
  if (t.status && e.status !== t.status) return false;
  if (t.source && e.source !== t.source) return false;
  if (t.channel && e.channel !== t.channel) return false;
  if (t.minAmountCents && (e.amountCents ?? 0) < t.minAmountCents) return false;
  if (t.formId && e.formId !== t.formId) return false;
  if (t.hookId && e.hookId !== t.hookId) return false;
  if (t.type === "app_event" && e.appEvent !== t.appEvent) return false;
  return true;
}

export interface TriggerEvent {
  type: TriggerType;
  contactId: string;
  tag?: string;
  stageId?: string;
  source?: ContactSource;
  channel?: Channel;
  amountCents?: number;
  /** The Lotus form (or funnel) that was filled in, for form_submitted. */
  formId?: string;
  /** The incoming webhook that received it, for webhook_received. */
  hookId?: string;
  /** "app.event" for app_event. */
  appEvent?: string;
  /** Opportunity events: where it happened and the status it now has. */
  pipelineId?: string;
  status?: OpportunityStatus;
  opportunityId?: string;
  /** How the run history describes it: "Booked a call", "Gift of $50". */
  label: string;
}

/* ------------------------------- steps ------------------------------- */

export const stepLabel: Record<StepType, string> = {
  send_sms: "Send SMS",
  send_email: "Send email",
  add_tag: "Add tag",
  remove_tag: "Remove tag",
  move_stage: "Move stage",
  assign_owner: "Assign owner",
  create_task: "Create task",
  notify: "Notify the team",
  wait: "Wait",
  branch: "If / else",
  send_webhook: "Send to a webhook",
  app_action: "Do something in an app",
};

export const stepGroups: { label: string; types: StepType[] }[] = [
  { label: "Message", types: ["send_sms", "send_email"] },
  { label: "Update the contact", types: ["add_tag", "remove_tag", "move_stage", "assign_owner"] },
  { label: "Team", types: ["create_task", "notify"] },
  { label: "Apps", types: ["app_action", "send_webhook"] },
  { label: "Flow", types: ["wait", "branch"] },
];

export const conditionFieldLabel: Record<ConditionField, string> = {
  tag: "Tag",
  stage: "Stage",
  source: "Source",
  owner: "Owner",
  value: "Value",
  has_email: "Has an email address",
  has_phone: "Has a phone number",
};

export function waitText(amount: number, unit: WaitUnit) {
  const one = { minutes: "minute", hours: "hour", days: "day" }[unit];
  return `${amount} ${amount === 1 ? one : unit}`;
}

export function waitMs(amount: number, unit: WaitUnit) {
  return amount * { minutes: 60000, hours: 3600000, days: 86400000 }[unit];
}

export function conditionSummary(c: WorkflowCondition, pipeline?: Pipeline, mode?: AccountMode): string {
  const neg = c.op === "is_not";
  switch (c.field) {
    case "has_email":
      return neg ? "Has no email address" : "Has an email address";
    case "has_phone":
      return neg ? "Has no phone number" : "Has a phone number";
    case "tag":
      return `${neg ? "Doesn't have" : "Has"} the tag “${c.value || "…"}”`;
    case "stage":
      return `Stage ${neg ? "is not" : "is"} ${c.value ? stageOf(pipeline, c.value).name : "…"}`;
    case "source":
      return `Source ${neg ? "is not" : "is"} ${c.value ? sourceLabel[c.value as ContactSource] ?? c.value : "…"}`;
    case "owner":
      return c.value ? `Owner ${neg ? "is not" : "is"} ${c.value}` : neg ? "Has an owner" : "Has no owner";
    case "value":
      return `${mode === "fundraising" ? "Lifetime giving" : "Value"} is at least ${c.value ? formatDollars(Math.round(Number(c.value) * 100)) : "…"}`;
  }
}

export function conditionHolds(c: WorkflowCondition, contact: Contact): boolean {
  const test = (): boolean => {
    switch (c.field) {
      case "has_email":
        return !!contact.email;
      case "has_phone":
        return !!contact.phone;
      case "tag":
        return contact.tags.some((t) => t.toLowerCase() === c.value.trim().toLowerCase());
      case "stage":
        return contact.stageId === c.value;
      case "source":
        return contact.source === c.value;
      case "owner":
        return c.value ? contact.ownerName === c.value : !contact.ownerName;
      case "value":
        return contact.valueCents >= Math.round(Number(c.value || 0) * 100);
    }
  };
  if (c.field === "value") return test();
  return c.op === "is_not" ? !test() : test();
}

/** One line that says what a step does, as it reads in the builder. */
export function stepSummary(s: WorkflowStep, pipeline?: Pipeline, mode?: AccountMode, names: NameLookup = {}): string {
  switch (s.type) {
    case "send_sms":
      return s.body || "No message yet";
    case "send_email":
      return s.subject || "No subject yet";
    case "add_tag":
      return s.tag ? `Add “${s.tag}”` : "No tag picked";
    case "remove_tag":
      return s.tag ? `Remove “${s.tag}”` : "No tag picked";
    case "move_stage":
      return s.stageId ? `Move to ${stageOf(pipeline, s.stageId).name}` : "No stage picked";
    case "assign_owner":
      return s.ownerName ? `Assign to ${s.ownerName}` : "No one picked";
    case "create_task":
      return s.title ? `${s.title}${s.assigneeName ? ` · ${s.assigneeName}` : ""} · due ${s.dueInDays === 0 ? "today" : `in ${waitText(s.dueInDays, "days")}`}` : "No task title";
    case "notify":
      return s.to ? `Tell ${s.to}: ${s.message || "…"}` : "No one picked";
    case "wait":
      return `Wait ${waitText(s.amount, s.unit)}`;
    case "branch":
      return conditionSummary(s.condition, pipeline, mode);
    case "send_webhook":
      return s.hookId ? `Post the contact to ${quoted(names.hook, s.hookId, "a webhook")}` : "No webhook picked";
    case "app_action": {
      const a = appAction(s.app, s.action);
      if (!a) return s.app ? `${findApp(s.app)?.name ?? "App"}: pick an action` : "No app picked";
      const first = a.action.fields.find((f) => s.fields[f.key]?.trim());
      return `${a.app.name}: ${a.action.label}${first ? ` · ${s.fields[first.key]}` : ""}`;
    }
  }
}

export function newStep(type: StepType, mode: AccountMode): WorkflowStep {
  const id = `s-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  switch (type) {
    case "send_sms":
      return { id, type, body: "" };
    case "send_email":
      return { id, type, subject: "", body: "" };
    case "add_tag":
    case "remove_tag":
      return { id, type, tag: "" };
    case "move_stage":
      return { id, type, stageId: "" };
    case "assign_owner":
      return { id, type, ownerName: "" };
    case "create_task":
      return { id, type, title: mode === "marketing" ? "Call {{first_name}}" : "Thank {{first_name}} by phone", dueInDays: 1 };
    case "notify":
      return { id, type, to: "", message: "" };
    case "wait":
      return { id, type, amount: 1, unit: "days" };
    case "branch":
      return { id, type, condition: { field: "tag", op: "is", value: "" }, yes: [], no: [] };
    case "send_webhook":
      return { id, type, hookId: "" };
    case "app_action":
      return { id, type, app: "", action: "", fields: {} };
  }
}

/* ----------------------------- step tree ----------------------------- */

/** Every step in order, branches walked yes lane before no lane. */
export function flatten(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.flatMap((s) => (s.type === "branch" ? [s, ...flatten(s.yes), ...flatten(s.no)] : [s]));
}

export function findStep(steps: WorkflowStep[], id: string): WorkflowStep | undefined {
  return flatten(steps).find((s) => s.id === id);
}

/** Where a step sits: the lane array holding it and its index. */
export type Lane = { parentId: string | null; side: "main" | "yes" | "no" };

function mapLanes(steps: WorkflowStep[], fn: (lane: WorkflowStep[], where: Lane) => WorkflowStep[], where: Lane = { parentId: null, side: "main" }): WorkflowStep[] {
  return fn(steps, where).map((s) => (s.type === "branch" ? { ...s, yes: mapLanes(s.yes, fn, { parentId: s.id, side: "yes" }), no: mapLanes(s.no, fn, { parentId: s.id, side: "no" }) } : s));
}

const sameLane = (a: Lane, b: Lane) => a.parentId === b.parentId && a.side === b.side;

export function insertStep(steps: WorkflowStep[], lane: Lane, index: number, step: WorkflowStep) {
  return mapLanes(steps, (xs, where) => (sameLane(where, lane) ? [...xs.slice(0, index), step, ...xs.slice(index)] : xs));
}

export function removeStep(steps: WorkflowStep[], id: string) {
  return mapLanes(steps, (xs) => xs.filter((s) => s.id !== id));
}

export function replaceStep(steps: WorkflowStep[], step: WorkflowStep) {
  return mapLanes(steps, (xs) => xs.map((s) => (s.id === step.id ? (s.type === "branch" && step.type === "branch" ? { ...step, yes: s.yes, no: s.no } : step) : s)));
}

export function moveStep(steps: WorkflowStep[], id: string, by: -1 | 1) {
  return mapLanes(steps, (xs) => {
    const i = xs.findIndex((s) => s.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= xs.length) return xs;
    const out = [...xs];
    [out[i], out[j]] = [out[j]!, out[i]!];
    return out;
  });
}

/** Position of a step within its lane, for the move buttons. */
export function laneOf(steps: WorkflowStep[], id: string): { index: number; length: number; nested: boolean } | null {
  const walk = (xs: WorkflowStep[], nested: boolean): ReturnType<typeof laneOf> => {
    const i = xs.findIndex((s) => s.id === id);
    if (i >= 0) return { index: i, length: xs.length, nested };
    for (const s of xs) {
      if (s.type !== "branch") continue;
      const r = walk(s.yes, true) ?? walk(s.no, true);
      if (r) return r;
    }
    return null;
  };
  return walk(steps, false);
}

/* ----------------------------- validation ---------------------------- */

/** Problems that stop a workflow from being turned on, keyed by step id ("trigger" for the trigger). */
export function workflowIssues(trigger: WorkflowTrigger, steps: WorkflowStep[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (trigger.type === "donation_received" && trigger.minAmountCents !== undefined && trigger.minAmountCents < 0) out.trigger = "Enter an amount";
  if (trigger.type === "app_event" && !appEvent(trigger.appEvent)) out.trigger = "Pick the app and the event";
  if (steps.length === 0) out.steps = "Add at least one step";
  for (const s of flatten(steps)) {
    const need = (ok: unknown, msg: string) => {
      if (!ok && !out[s.id]) out[s.id] = msg;
    };
    switch (s.type) {
      case "send_sms":
        need(s.body.trim(), "Write the message");
        need(s.body.length <= 640, "Keep texts under 640 characters");
        break;
      case "send_email":
        need(s.subject.trim(), "Add a subject");
        need(s.body.trim(), "Write the email");
        break;
      case "add_tag":
      case "remove_tag":
        need(s.tag.trim(), "Pick a tag");
        break;
      case "move_stage":
        need(s.stageId, "Pick a stage");
        break;
      case "assign_owner":
        need(s.ownerName, "Pick a teammate");
        break;
      case "create_task":
        need(s.title.trim(), "Name the task");
        break;
      case "notify":
        need(s.to, "Pick who to tell");
        need(s.message.trim(), "Write the note");
        break;
      case "wait":
        need(s.amount >= 1, "Wait at least 1");
        break;
      case "branch":
        need(s.condition.field === "has_email" || s.condition.field === "has_phone" || s.condition.field === "owner" || s.condition.value.trim(), "Finish the condition");
        need(s.yes.length + s.no.length > 0, "Add a step to Yes or No");
        break;
      case "send_webhook":
        need(s.hookId, "Pick a webhook");
        break;
      case "app_action": {
        const a = appAction(s.app, s.action);
        need(a, s.app ? "Pick what to do" : "Pick an app");
        if (a) for (const f of a.action.fields) if (!f.hint?.startsWith("Leave empty")) need(s.fields[f.key]?.trim(), `Fill in ${f.label.toLowerCase()}`);
        break;
      }
    }
  }
  return out;
}

/* ------------------------------- labels ------------------------------ */

export const workflowStatusLabel: Record<WorkflowStatus, string> = { active: "Active", paused: "Paused", draft: "Draft" };
export const runStatusLabel: Record<RunStatus, string> = { waiting: "Waiting", completed: "Completed", failed: "Failed", stopped: "Stopped" };
