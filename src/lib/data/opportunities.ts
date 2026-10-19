import { stamp } from "@/lib/ids";
import type { ClientRecord, Contact, ContactSource, Opportunity, OpportunityEvent, OpportunityStatus, Pipeline, PipelineStage } from "@/lib/types";
import { pipelineFor } from "./pipeline-presets";
import { defineModule } from "@/lib/server/workspace";
import { findClient, findContact, listClients, listContacts, moveContactStage } from "./store";

/*
 * Pipelines and opportunities. Each client has a primary pipeline (the one a
 * contact's stage lives in) and can add more; an opportunity is one deal for
 * one contact in one pipeline, with a value, an owner, a status and a stage
 * history. Opportunities in the primary pipeline stay in step with the
 * contact's stage in both directions.
 *
 * Saved per agency in the "opportunities" module. A client gets its primary
 * pipeline the first time anything reads its pipelines.
 */

interface OppStore {
  pipelines: Pipeline[];
  opportunities: Opportunity[];
  lostReasons: Record<string, string[]>;
}

const oppModule = defineModule<OppStore>({ key: "opportunities", init: () => ({ pipelines: [], opportunities: [], lostReasons: {} }) });

export const defaultLostReasons = ["Price", "Went with a competitor", "No response", "Timing", "Not a fit", "Other"];
const fundraisingLostReasons = ["Gave elsewhere", "Budget", "No response", "Timing", "Other"];

const marketingProbability: Record<string, number> = { new: 10, contacted: 20, booked: 40, showed: 60, won: 100, lost: 0 };
const fundraisingProbability: Record<string, number> = { prospect: 10, first: 30, repeat: 60, monthly: 100, lapsed: 0 };

function newId(prefix: string) {
  return `new-${prefix}-${stamp()}-${Math.floor(Math.random() * 1e5).toString(36)}`;
}

/** The primary pipeline, as the CRM has always had it, with probabilities. */
function seedPrimary(c: ClientRecord): Pipeline {
  const base = pipelineFor(c);
  const prob = c.mode === "marketing" ? marketingProbability : fundraisingProbability;
  return { ...base, primary: true, position: 0, staleDays: c.mode === "marketing" ? 7 : 45, stages: base.stages.map((s) => ({ ...s, probability: prob[s.id] })) };
}

function jobName(c: ClientRecord, contact: Contact) {
  if (c.mode === "fundraising") return contact.recurring ? "Monthly giving" : contact.valueCents > 0 ? "Annual gift" : "First gift";
  const t = contact.tags.find((x) => ["Repair", "Replacement", "Emergency", "Commercial", "Insurance claim", "Financing"].includes(x));
  return t ? `${c.industry} · ${t.toLowerCase()}` : `${c.industry} estimate`;
}

function oppStore(now: Date): OppStore {
  const s = oppModule.get();
  // Every client has its primary pipeline, made the first time it is needed.
  for (const c of listClients(now)) {
    if (!s.pipelines.some((p) => p.accountId === c.account.id)) {
      s.pipelines.push(seedPrimary(c));
      s.lostReasons[c.account.id] = c.mode === "marketing" ? [...defaultLostReasons] : [...fundraisingLostReasons];
    }
  }
  return s;
}

/* ----------------------------- pipelines ----------------------------- */

export function listPipelines(now: Date, accountId: string): Pipeline[] {
  return oppStore(now)
    .pipelines.filter((p) => p.accountId === accountId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

export function primaryPipeline(now: Date, accountId: string): Pipeline | undefined {
  const ps = listPipelines(now, accountId);
  return ps.find((p) => p.primary) ?? ps[0];
}

export function findPipeline(now: Date, id: string): Pipeline | undefined {
  return oppStore(now).pipelines.find((p) => p.id === id);
}

export function lostReasonsFor(now: Date, accountId: string): string[] {
  return oppStore(now).lostReasons[accountId] ?? defaultLostReasons;
}

export function setLostReasons(now: Date, accountId: string, reasons: string[]) {
  oppStore(now).lostReasons[accountId] = reasons;
}

export interface StageInput {
  id?: string;
  name: string;
  probability: number;
  outcome?: "won" | "lost";
}

export function createPipeline(now: Date, accountId: string, name: string, stages: StageInput[], staleDays: number): Pipeline | undefined {
  if (!findClient(now, accountId)) return undefined;
  const s = oppStore(now);
  const id = newId("pipeline");
  const p: Pipeline = {
    id, accountId, name: name.trim(), staleDays,
    position: Math.max(0, ...listPipelines(now, accountId).map((x) => x.position ?? 0)) + 1,
    stages: stages.map((x, i) => ({ id: `${id}-s${i + 1}`, name: x.name.trim(), probability: x.probability, outcome: x.outcome })),
  };
  s.pipelines.push(p);
  return p;
}

/**
 * Rename, reorder, add and remove stages. A removed stage hands its
 * opportunities (and, in the primary pipeline, its contacts) to `moveTo`.
 */
export function updatePipeline(now: Date, id: string, input: { name: string; staleDays: number; stages: StageInput[]; moveTo?: string }, by: string): { ok: true; pipeline: Pipeline } | { ok: false; message: string } {
  const p = findPipeline(now, id);
  if (!p) return { ok: false, message: "That pipeline no longer exists." };
  const stages: PipelineStage[] = input.stages.map((x, i) => ({ id: x.id && p.stages.some((s) => s.id === x.id) ? x.id : `${p.id}-n${stamp()}${i}`, name: x.name.trim(), probability: x.probability, outcome: x.outcome }));
  const keep = new Set(stages.map((s) => s.id));
  const removed = p.stages.filter((s) => !keep.has(s.id));
  if (removed.length) {
    const inUse = listOpportunities(now, { pipelineId: id }).some((o) => removed.some((r) => r.id === o.stageId)) || (p.primary && listContacts(now, p.accountId).some((c) => removed.some((r) => r.id === c.stageId)));
    const target = stages.find((s) => s.id === input.moveTo) ?? stages.find((s) => !s.outcome);
    if (inUse && !target) return { ok: false, message: "Keep at least one open stage to move its deals into." };
    if (target) {
      for (const o of listOpportunities(now, { pipelineId: id })) if (removed.some((r) => r.id === o.stageId)) applyStage(now, o, target, by);
      if (p.primary) for (const c of listContacts(now, p.accountId)) if (removed.some((r) => r.id === c.stageId)) c.stageId = target.id;
    }
  }
  p.name = input.name.trim();
  p.staleDays = input.staleDays;
  p.stages = stages;
  return { ok: true, pipeline: p };
}

export function deletePipeline(now: Date, id: string): { ok: boolean; message?: string } {
  const s = oppStore(now);
  const p = findPipeline(now, id);
  if (!p) return { ok: false, message: "That pipeline no longer exists." };
  if (p.primary) return { ok: false, message: "The primary pipeline holds every contact's stage, so it stays." };
  s.pipelines = s.pipelines.filter((x) => x.id !== id);
  s.opportunities = s.opportunities.filter((o) => o.pipelineId !== id);
  return { ok: true };
}

/* --------------------------- opportunities --------------------------- */

export function listOpportunities(now: Date, filter: { accountId?: string; pipelineId?: string; contactId?: string } = {}): Opportunity[] {
  return oppStore(now).opportunities.filter(
    (o) => (!filter.accountId || o.accountId === filter.accountId) && (!filter.pipelineId || o.pipelineId === filter.pipelineId) && (!filter.contactId || o.contactId === filter.contactId),
  );
}

export function findOpportunity(now: Date, id: string): Opportunity | undefined {
  return oppStore(now).opportunities.find((o) => o.id === id);
}

export interface NewOpportunityInput {
  contactId: string;
  pipelineId: string;
  stageId?: string;
  name: string;
  valueCents: number;
  ownerName?: string;
  source?: ContactSource;
  tags: string[];
  closeOn?: string;
}

export function createOpportunity(now: Date, input: NewOpportunityInput, by: string): Opportunity | undefined {
  const contact = findContact(now, input.contactId);
  const p = findPipeline(now, input.pipelineId);
  if (!contact || !p || p.accountId !== contact.accountId) return undefined;
  const stage = p.stages.find((s) => s.id === input.stageId) ?? p.stages[0]!;
  const at = now.toISOString();
  const o: Opportunity = {
    id: newId("opp"),
    accountId: contact.accountId,
    pipelineId: p.id,
    stageId: stage.id,
    contactId: contact.id,
    name: input.name.trim(),
    valueCents: input.valueCents,
    status: stage.outcome ?? "open",
    ownerName: input.ownerName || contact.ownerName,
    source: input.source ?? contact.source,
    tags: input.tags,
    closeOn: input.closeOn || undefined,
    createdAt: at,
    updatedAt: at,
    stageEnteredAt: at,
    closedAt: stage.outcome ? at : undefined,
    history: [{ kind: "created", label: `Created in ${stage.name}`, stageId: stage.id, by, at }],
  };
  oppStore(now).opportunities.push(o);
  if (p.primary && contact.stageId !== stage.id) moveContactStage(now, contact.id, stage.id, by);
  return o;
}

export type OpportunityPatch = Partial<Pick<Opportunity, "name" | "valueCents" | "ownerName" | "source" | "tags" | "closeOn">>;

export function updateOpportunity(now: Date, id: string, patch: OpportunityPatch, by: string): Opportunity | undefined {
  const o = findOpportunity(now, id);
  if (!o) return undefined;
  const at = now.toISOString();
  if (patch.valueCents !== undefined && patch.valueCents !== o.valueCents) {
    o.history.push({ kind: "value", label: `Value ${dollars(o.valueCents)} → ${dollars(patch.valueCents)}`, by, at });
  }
  if ("ownerName" in patch && patch.ownerName !== o.ownerName) {
    o.history.push({ kind: "owner", label: patch.ownerName ? `Owner set to ${patch.ownerName}` : "Owner removed", by, at });
  }
  Object.assign(o, patch);
  o.updatedAt = at;
  return o;
}

function dollars(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/** Move without side effects on the contact: the caller decides about syncing. */
function applyStage(now: Date, o: Opportunity, stage: PipelineStage, by: string) {
  if (o.stageId === stage.id) return false;
  const at = now.toISOString();
  o.stageId = stage.id;
  o.stageEnteredAt = at;
  o.updatedAt = at;
  o.history.push({ kind: "stage", label: `Moved to ${stage.name}`, stageId: stage.id, by, at });
  if (stage.outcome && o.status !== stage.outcome) {
    o.status = stage.outcome;
    o.closedAt = at;
    o.history.push({ kind: "status", label: stage.outcome === "won" ? "Marked won" : "Marked lost", by, at });
  } else if (!stage.outcome && (o.status === "won" || o.status === "lost")) {
    o.status = "open";
    o.closedAt = undefined;
    o.lostReason = undefined;
    o.history.push({ kind: "status", label: "Reopened", by, at });
  }
  return true;
}

export interface StageMove {
  opportunity: Opportunity;
  fromStageId: string;
  fromStatus: OpportunityStatus;
  /** Set when the move also moved the contact (primary pipeline). */
  contactFromStageId?: string;
}

export function moveOpportunity(now: Date, id: string, stageId: string, by: string): StageMove | undefined {
  const o = findOpportunity(now, id);
  const p = o && findPipeline(now, o.pipelineId);
  const stage = p?.stages.find((s) => s.id === stageId);
  if (!o || !p || !stage) return undefined;
  const move: StageMove = { opportunity: o, fromStageId: o.stageId, fromStatus: o.status };
  if (!applyStage(now, o, stage, by)) return move;
  if (p.primary) {
    const c = findContact(now, o.contactId);
    if (c && c.stageId !== stage.id && isLatestPrimary(now, o)) {
      move.contactFromStageId = c.stageId;
      moveContactStage(now, c.id, stage.id, by);
    }
  }
  return move;
}

/** Won, lost (with a reason), abandoned, or reopened. Won and lost land in the matching stage when the pipeline has one. */
export function setOpportunityStatus(now: Date, id: string, status: OpportunityStatus, by: string, lostReason?: string): StageMove | undefined {
  const o = findOpportunity(now, id);
  const p = o && findPipeline(now, o.pipelineId);
  if (!o || !p) return undefined;
  const move: StageMove = { opportunity: o, fromStageId: o.stageId, fromStatus: o.status };
  if (o.status === status && (status !== "lost" || o.lostReason === lostReason)) return move;
  const at = now.toISOString();
  let target: PipelineStage | undefined;
  if (status === "won" || status === "lost") target = p.stages.find((s) => s.outcome === status);
  if (status === "open" || status === "abandoned") {
    const cur = p.stages.find((s) => s.id === o.stageId);
    if (cur?.outcome) {
      // Back to the last open stage it was in.
      const lastOpen = [...o.history].reverse().find((e) => e.stageId && !p.stages.find((s) => s.id === e.stageId)?.outcome);
      target = p.stages.find((s) => s.id === lastOpen?.stageId) ?? [...p.stages].reverse().find((s) => !s.outcome);
    }
  }
  if (target && target.id !== o.stageId) {
    o.stageId = target.id;
    o.stageEnteredAt = at;
    o.history.push({ kind: "stage", label: `Moved to ${target.name}`, stageId: target.id, by, at });
  }
  o.status = status;
  o.lostReason = status === "lost" ? lostReason : undefined;
  o.closedAt = status === "won" || status === "lost" ? at : undefined;
  o.updatedAt = at;
  o.history.push({ kind: "status", label: status === "won" ? "Marked won" : status === "lost" ? `Marked lost${lostReason ? `: ${lostReason}` : ""}` : status === "abandoned" ? "Marked abandoned" : "Reopened", by, at });
  if (p.primary && o.stageId !== move.fromStageId) {
    const c = findContact(now, o.contactId);
    if (c && c.stageId !== o.stageId && isLatestPrimary(now, o)) {
      move.contactFromStageId = c.stageId;
      moveContactStage(now, c.id, o.stageId, by);
    }
  }
  return move;
}

export function addOpportunityNote(now: Date, id: string, body: string, by: string): OpportunityEvent | undefined {
  const o = findOpportunity(now, id);
  if (!o) return undefined;
  const e: OpportunityEvent = { kind: "note", label: "Note", body: body.trim(), by, at: now.toISOString() };
  o.history.push(e);
  o.updatedAt = e.at;
  return e;
}

export function deleteOpportunity(now: Date, id: string) {
  const s = oppStore(now);
  s.opportunities = s.opportunities.filter((o) => o.id !== id);
}

function isLatestPrimary(now: Date, o: Opportunity) {
  const mine = listOpportunities(now, { pipelineId: o.pipelineId, contactId: o.contactId });
  const live = mine.filter((x) => x.status === "open" || x.id === o.id);
  return [...live].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id === o.id;
}

/**
 * The contact moved in the primary pipeline (contact panel, contact form, an
 * automation). Carry its latest opportunity there too, or open one.
 */
export function contactStageMoved(now: Date, contactId: string, stageId: string, by: string) {
  const c = findContact(now, contactId);
  const p = c && primaryPipeline(now, c.accountId);
  const stage = p?.stages.find((s) => s.id === stageId);
  if (!c || !p || !stage) return;
  const mine = listOpportunities(now, { pipelineId: p.id, contactId }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const o = mine.find((x) => x.status === "open") ?? mine[0];
  if (o) {
    applyStage(now, o, stage, by);
    return;
  }
  const client = findClient(now, c.accountId);
  if (!client) return;
  createOpportunity(now, { contactId, pipelineId: p.id, stageId, name: `${c.firstName} ${c.lastName} · ${jobName(client, c)}`, valueCents: c.valueCents, tags: [] }, by);
}

/** A deleted contact takes its opportunities with it. */
export function contactDeleted(now: Date, contactId: string) {
  const s = oppStore(now);
  s.opportunities = s.opportunities.filter((o) => o.contactId !== contactId);
}
