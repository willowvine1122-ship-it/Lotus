import type { ClientRecord, Contact, ContactSource, Opportunity, OpportunityEvent, OpportunityStatus, Pipeline, PipelineStage } from "@/lib/types";
import { pipelineFor } from "./demo-contacts";
import { findClient, findContact, listActivities, listClients, listContacts, moveContactStage } from "./store";

/*
 * Pipelines and opportunities. Each client has a primary pipeline (the one a
 * contact's stage lives in) and can add more; an opportunity is one deal for
 * one contact in one pipeline, with a value, an owner, a status and a stage
 * history. Opportunities in the primary pipeline stay in step with the
 * contact's stage in both directions.
 *
 * Demo store on globalThis, seeded once per day from the CRM contacts.
 */

interface OppStore {
  seededFor: string;
  pipelines: Pipeline[];
  opportunities: Opportunity[];
  lostReasons: Record<string, string[]>;
}

const g = globalThis as unknown as { __lotusOpps?: OppStore };
const DAY = 86400000;

export const defaultLostReasons = ["Price", "Went with a competitor", "No response", "Timing", "Not a fit", "Other"];
const fundraisingLostReasons = ["Gave elsewhere", "Budget", "No response", "Timing", "Other"];

const marketingProbability: Record<string, number> = { new: 10, contacted: 20, booked: 40, showed: 60, won: 100, lost: 0 };
const fundraisingProbability: Record<string, number> = { prospect: 10, first: 30, repeat: 60, monthly: 100, lapsed: 0 };

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
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;

function newId(prefix: string) {
  return `new-${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`;
}

/** The primary pipeline, as the CRM has always had it, with probabilities. */
function seedPrimary(c: ClientRecord): Pipeline {
  const base = pipelineFor(c);
  const prob = c.mode === "marketing" ? marketingProbability : fundraisingProbability;
  return { ...base, primary: true, position: 0, staleDays: c.mode === "marketing" ? 7 : 45, stages: base.stages.map((s) => ({ ...s, probability: prob[s.id] })) };
}

/** A second pipeline per client so the switcher has something real in it. */
function seedSecondary(c: ClientRecord): Pipeline {
  const id = `${c.account.id}-pipeline-2`;
  const st = (key: string, name: string, probability: number, outcome?: "won" | "lost"): PipelineStage => ({ id: `${id}-${key}`, name, probability, outcome });
  return c.mode === "marketing"
    ? {
        id, accountId: c.account.id, name: "Commercial bids", position: 1, staleDays: 14,
        stages: [st("req", "Bid requested", 10), st("walk", "Site walk", 25), st("sent", "Proposal sent", 50), st("neg", "Negotiation", 75), st("won", "Signed", 100, "won"), st("lost", "Lost", 0, "lost")],
      }
    : {
        id, accountId: c.account.id, name: "Major gifts", position: 1, staleDays: 30,
        stages: [st("ident", "Identified", 5), st("qual", "Qualified", 15), st("cult", "Cultivation", 35), st("ask", "Ask made", 60), st("won", "Committed", 100, "won"), st("lost", "Declined", 0, "lost")],
      };
}

function jobName(c: ClientRecord, contact: Contact) {
  if (c.mode === "fundraising") return contact.recurring ? "Monthly giving" : contact.valueCents > 0 ? "Annual gift" : "First gift";
  const t = contact.tags.find((x) => ["Repair", "Replacement", "Emergency", "Commercial", "Insurance claim", "Financing"].includes(x));
  return t ? `${c.industry} · ${t.toLowerCase()}` : `${c.industry} estimate`;
}

function seed(now: Date): OppStore {
  const s: OppStore = { seededFor: now.toISOString().slice(0, 10), pipelines: [], opportunities: [], lostReasons: {} };
  for (const c of listClients(now)) {
    const primary = seedPrimary(c);
    const second = seedSecondary(c);
    s.pipelines.push(primary, second);
    s.lostReasons[c.account.id] = c.mode === "marketing" ? [...defaultLostReasons] : [...fundraisingLostReasons];
    if (c.account.id.startsWith("new-")) continue;
    const r = rng([...c.account.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) * 104729);
    const contacts = listContacts(now, c.account.id);
    for (const contact of contacts) {
      s.opportunities.push(primaryFromContact(now, c, primary, contact, r, s.lostReasons[c.account.id]!));
    }
    // Commercial bids or major gifts: a handful from the bigger contacts.
    const pool = [...contacts].sort((a, b) => b.valueCents - a.valueCents || a.id.localeCompare(b.id)).slice(0, 12);
    const n = Math.min(pool.length, 6 + Math.floor(r() * 5));
    for (let i = 0; i < n; i++) {
      const contact = pool[i]!;
      const createdDaysAgo = 3 + Math.floor(r() * 70);
      const open = second.stages.filter((x) => !x.outcome);
      const roll = r();
      const stage = roll < 0.18 ? second.stages.find((x) => x.outcome === "won")! : roll < 0.28 ? second.stages.find((x) => x.outcome === "lost")! : open[Math.min(open.length - 1, Math.floor(r() * open.length))]!;
      const scale = c.mode === "marketing" ? c.avgJobValueCents * (3 + r() * 9) : 250000 + r() * 2250000;
      const valueCents = Math.round(scale / 5000) * 5000;
      const createdAt = new Date(now.getTime() - createdDaysAgo * DAY - Math.floor(r() * 8) * 3600000).toISOString();
      const name = c.mode === "marketing" ? `${contact.company ?? `${contact.lastName} property`} · ${pick(r, ["re-roof", "service contract", "multi-unit job", "new build", "maintenance plan"])}` : `${contact.firstName} ${contact.lastName} · ${pick(r, ["leadership gift", "capital campaign", "named fund", "matching pledge"])}`;
      s.opportunities.push(build(second, stage, { r, now, createdAt, contact, name, valueCents, source: contact.source === "manual" ? "referral" : contact.source, reasons: s.lostReasons[c.account.id]! }));
    }
  }
  return s;
}

/** Walk the stages up to where the contact sits, spreading the moves over its life. */
function build(p: Pipeline, stage: PipelineStage, o: { r: () => number; now: Date; createdAt: string; contact: Contact; name: string; valueCents: number; source: ContactSource; reasons: string[]; endAt?: string }): Opportunity {
  const { r, now, contact } = o;
  const open = p.stages.filter((x) => !x.outcome);
  const target = stage.outcome ? open.length - 1 : open.findIndex((x) => x.id === stage.id);
  const path = open.slice(0, Math.max(0, target) + 1);
  if (stage.outcome) path.push(stage);
  const start = new Date(o.createdAt).getTime();
  const closing = !!stage.outcome;
  // Closed deals end on their last activity; open ones are still sitting in their stage today.
  const end = closing ? Math.max(start + 3600000, Math.min(now.getTime(), new Date(o.endAt ?? now.toISOString()).getTime())) : now.getTime();
  const steps = closing ? Math.max(1, path.length - 1) : path.length;
  const history: OpportunityEvent[] = [];
  const by = contact.ownerName;
  let at = start;
  path.forEach((x, i) => {
    if (i > 0) at = Math.max(at + 3600000, Math.min(end, start + ((end - start) * i * (0.8 + r() * 0.35)) / steps));
    if (closing && i === path.length - 1) at = Math.max(at, end);
    const iso = new Date(Math.min(at, now.getTime())).toISOString();
    history.push(i === 0 ? { kind: "created", label: `Created in ${x.name}`, stageId: x.id, by: by ?? "System", at: iso } : { kind: "stage", label: `Moved to ${x.name}`, stageId: x.id, by: by ?? "System", at: iso });
  });
  const last = history[history.length - 1]!;
  let status: OpportunityStatus = stage.outcome ?? "open";
  let lostReason: string | undefined;
  if (status === "lost") {
    lostReason = pick(r, o.reasons);
    history.push({ kind: "status", label: `Marked lost: ${lostReason}`, by: by ?? "System", at: last.at });
  } else if (status === "won") {
    history.push({ kind: "status", label: "Marked won", by: by ?? "System", at: last.at });
  } else if (now.getTime() - new Date(last.at).getTime() > 40 * DAY && r() < 0.5) {
    status = "abandoned";
    history.push({ kind: "status", label: "Marked abandoned", body: "No reply in six weeks.", by: by ?? "System", at: new Date(new Date(last.at).getTime() + 30 * DAY).toISOString() });
  }
  const closeDays = 5 + Math.floor(r() * 50);
  return {
    id: `${contact.id}-${p.id.endsWith("-2") ? "o2" : "o1"}`,
    accountId: contact.accountId,
    pipelineId: p.id,
    stageId: stage.id,
    contactId: contact.id,
    name: o.name,
    valueCents: o.valueCents,
    status,
    ownerName: contact.ownerName,
    source: o.source,
    tags: [],
    lostReason,
    closeOn: status === "open" ? new Date(now.getTime() + closeDays * DAY).toISOString().slice(0, 10) : undefined,
    createdAt: o.createdAt,
    updatedAt: history[history.length - 1]!.at,
    stageEnteredAt: last.at,
    closedAt: status === "won" || status === "lost" ? last.at : undefined,
    history,
  };
}

function primaryFromContact(now: Date, c: ClientRecord, p: Pipeline, contact: Contact, r: () => number, reasons: string[]): Opportunity {
  const stage = p.stages.find((x) => x.id === contact.stageId) ?? p.stages[0]!;
  // The last stage activity on the trail dates the move into the current stage.
  const lastStage = listActivities(now, contact.id).find((a) => a.kind === "stage" || a.kind === "appointment");
  const value = contact.valueCents || (c.mode === "marketing" ? Math.round(c.avgJobValueCents * (0.5 + r()) / 1000) * 1000 : 0);
  return build(p, stage, { r, now, createdAt: contact.createdAt, contact, name: `${contact.firstName} ${contact.lastName} · ${jobName(c, contact)}`, valueCents: value, source: contact.source, reasons, endAt: lastStage?.at ?? contact.lastActivityAt });
}

function oppStore(now: Date): OppStore {
  const key = now.toISOString().slice(0, 10);
  if (!g.__lotusOpps || g.__lotusOpps.seededFor !== key) {
    const prev = g.__lotusOpps;
    const next = seed(now);
    if (prev) {
      next.opportunities.push(...prev.opportunities.filter((o) => o.id.startsWith("new-") && findContact(now, o.contactId)));
      next.pipelines.push(...prev.pipelines.filter((p) => p.id.startsWith("new-")));
    }
    g.__lotusOpps = next;
  }
  // Clients created during the day get their pipelines on first read.
  const s = g.__lotusOpps;
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
  const stages: PipelineStage[] = input.stages.map((x, i) => ({ id: x.id && p.stages.some((s) => s.id === x.id) ? x.id : `${p.id}-n${Date.now().toString(36)}${i}`, name: x.name.trim(), probability: x.probability, outcome: x.outcome }));
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
  const g2 = g.__lotusOpps;
  if (!g2) return; // nothing seeded yet; the seed reads the contact's stage
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
  const s = g.__lotusOpps;
  if (s) s.opportunities = s.opportunities.filter((o) => o.contactId !== contactId);
}
