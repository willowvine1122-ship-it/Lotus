import type { AccountMode, Assignee, ClientRecord, ClientStatus, DiagnosticNote, Member, Task } from "@/lib/types";
import { demoAgency } from "./demo";
import { demoClients } from "./demo-clients";

/*
 * Demo store. Until Supabase is configured, clients live in process memory,
 * seeded from the synthetic set and mutated by the server actions. It is
 * kept on globalThis so dev-server reloads do not wipe it. Everything here
 * is replaced by database queries once a project is connected.
 */

interface Store {
  seededFor: string;
  clients: ClientRecord[];
}

const g = globalThis as unknown as { __lotusStore?: Store };

function store(now: Date): Store {
  const key = now.toISOString().slice(0, 10);
  if (!g.__lotusStore || g.__lotusStore.seededFor !== key) {
    const seeded = demoClients(now).map((c) => structuredClone(c));
    // Keep clients that were created in this process across the day boundary.
    const created = g.__lotusStore?.clients.filter((c) => c.account.id.startsWith("new-")) ?? [];
    g.__lotusStore = { seededFor: key, clients: [...seeded, ...created] };
  }
  return g.__lotusStore;
}

export function listClients(now: Date): ClientRecord[] {
  return store(now).clients;
}

export function findClient(now: Date, idOrSlug: string): ClientRecord | undefined {
  return store(now).clients.find((c) => c.account.id === idOrSlug || c.account.slug === idOrSlug);
}

export const teamDirectory: Assignee[] = [
  { name: "Afza", initials: "A", tone: "violet" },
  { name: "Mahad", initials: "M", tone: "orange" },
  { name: "Sara", initials: "S", tone: "teal" },
];

export interface NewClientInput {
  name: string;
  mode: AccountMode;
  industry: string;
  website?: string;
  location: string;
  timeZone: string;
  monthlyAmountCents: number; // budget (marketing) or goal (fundraising)
  avgJobValueCents?: number;
  tags: string[];
  assignees: string[]; // names from teamDirectory
  clientContact?: { name: string; email: string };
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createClient(now: Date, input: NewClientInput): ClientRecord {
  const s = store(now);
  let slug = slugify(input.name) || "client";
  if (s.clients.some((c) => c.account.slug === slug)) slug = `${slug}-${s.clients.length + 1}`;
  const id = `new-${Date.now().toString(36)}`;
  const base = {
    account: { id, agencyId: demoAgency.id, name: input.name.trim(), slug, mode: input.mode },
    status: "onboarding" as ClientStatus,
    industry: input.industry,
    website: input.website || undefined,
    location: input.location,
    timeZone: input.timeZone,
    tags: input.tags,
    assignees: teamDirectory.filter((a) => input.assignees.includes(a.name)),
    startedOn: now.toISOString().slice(0, 10),
    health: "green" as const,
    alerts: [],
    summary: null,
    notes: [] as DiagnosticNote[],
    tasks: [
      { id: `${id}-t1`, accountId: id, title: "Connect ad accounts and tracking", status: "todo", assigneeName: input.assignees[0] },
      { id: `${id}-t2`, accountId: id, title: "Kickoff call and goals", status: "todo", assigneeName: input.assignees[0] },
    ] as Task[],
    clientMembers: input.clientContact
      ? [
          {
            id: `${id}-m1`,
            name: input.clientContact.name,
            email: input.clientContact.email,
            role: "client" as const,
            initials: initialsOf(input.clientContact.name),
            tone: "ink" as const,
            invitedAt: now.toISOString(),
          },
        ]
      : [],
  };
  const record: ClientRecord =
    input.mode === "marketing"
      ? { ...base, mode: "marketing", monthlyBudgetCents: input.monthlyAmountCents, avgJobValueCents: input.avgJobValueCents ?? 0, days: [] }
      : { ...base, mode: "fundraising", monthlyGoalCents: input.monthlyAmountCents, days: [], countries: [] };
  s.clients.push(record);
  return record;
}

export interface ClientPatch {
  name?: string;
  industry?: string;
  website?: string;
  location?: string;
  timeZone?: string;
  monthlyAmountCents?: number;
  avgJobValueCents?: number;
  tags?: string[];
  assignees?: string[];
  status?: ClientStatus;
}

export function updateClient(now: Date, id: string, patch: ClientPatch): ClientRecord | undefined {
  const c = findClient(now, id);
  if (!c) return undefined;
  if (patch.name !== undefined) c.account.name = patch.name.trim();
  if (patch.industry !== undefined) c.industry = patch.industry;
  if (patch.website !== undefined) c.website = patch.website || undefined;
  if (patch.location !== undefined) c.location = patch.location;
  if (patch.timeZone !== undefined) c.timeZone = patch.timeZone;
  if (patch.tags !== undefined) c.tags = patch.tags;
  if (patch.status !== undefined) c.status = patch.status;
  if (patch.assignees !== undefined) c.assignees = teamDirectory.filter((a) => patch.assignees!.includes(a.name));
  if (patch.monthlyAmountCents !== undefined) {
    if (c.mode === "marketing") c.monthlyBudgetCents = patch.monthlyAmountCents;
    else c.monthlyGoalCents = patch.monthlyAmountCents;
  }
  if (patch.avgJobValueCents !== undefined && c.mode === "marketing") c.avgJobValueCents = patch.avgJobValueCents;
  return c;
}

export function inviteMember(now: Date, id: string, name: string, email: string): Member | undefined {
  const c = findClient(now, id);
  if (!c) return undefined;
  const existing = c.clientMembers.find((m) => m.email.toLowerCase() === email.toLowerCase());
  if (existing) return existing;
  const m: Member = {
    id: `${id}-m${c.clientMembers.length + 1}-${Date.now().toString(36)}`,
    name: name.trim(),
    email: email.trim(),
    role: "client",
    initials: initialsOf(name),
    tone: (["ink", "teal", "violet", "orange"] as const)[c.clientMembers.length % 4],
    invitedAt: now.toISOString(),
  };
  c.clientMembers.push(m);
  return m;
}

export function removeMember(now: Date, id: string, memberId: string) {
  const c = findClient(now, id);
  if (!c) return;
  c.clientMembers = c.clientMembers.filter((m) => m.id !== memberId);
}

export function addNote(now: Date, id: string, authorName: string, body: string): DiagnosticNote | undefined {
  const c = findClient(now, id);
  if (!c) return undefined;
  const n: DiagnosticNote = {
    id: `${id}-n-${Date.now().toString(36)}`,
    accountId: c.account.id,
    authorName,
    body: body.trim(),
    internalOnly: true,
    createdAt: now.toISOString(),
  };
  c.notes.unshift(n);
  return n;
}

export function setTaskStatus(now: Date, id: string, taskId: string, status: Task["status"]) {
  const c = findClient(now, id);
  const t = c?.tasks.find((t) => t.id === taskId);
  if (t) t.status = status;
}

export function addTask(now: Date, id: string, title: string, assigneeName?: string, dueOn?: string): Task | undefined {
  const c = findClient(now, id);
  if (!c) return undefined;
  const t: Task = { id: `${id}-t-${Date.now().toString(36)}`, accountId: c.account.id, title: title.trim(), status: "todo", assigneeName, dueOn };
  c.tasks.push(t);
  return t;
}

export function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/* ------------------------------- CRM -------------------------------- */

import type { ActivityKind, Contact, ContactActivity, ContactSource, Pipeline } from "@/lib/types";
import { demoContactsFor } from "./demo-contacts";
import { contactDeleted, contactStageMoved, primaryPipeline } from "./opportunities";

interface CrmStore {
  seededFor: string;
  contacts: Contact[];
  activities: ContactActivity[];
}

const gc = globalThis as unknown as { __lotusCrm?: CrmStore };

function crm(now: Date): CrmStore {
  const key = now.toISOString().slice(0, 10);
  if (!gc.__lotusCrm || gc.__lotusCrm.seededFor !== key) {
    const contacts: Contact[] = [];
    const activities: ContactActivity[] = [];
    for (const c of listClients(now)) {
      if (c.account.id.startsWith("new-")) continue;
      const d = demoContactsFor(c, now);
      contacts.push(...d.contacts);
      activities.push(...d.activities);
    }
    const kept = gc.__lotusCrm?.contacts.filter((c) => c.id.startsWith("new-")) ?? [];
    const keptIds = new Set(kept.map((c) => c.id));
    const keptActs = gc.__lotusCrm?.activities.filter((a) => keptIds.has(a.contactId)) ?? [];
    gc.__lotusCrm = { seededFor: key, contacts: [...contacts, ...kept], activities: [...activities, ...keptActs] };
  }
  return gc.__lotusCrm;
}

/** The client's primary pipeline: the one a contact's stage lives in. */
export function getPipeline(now: Date, accountId: string): Pipeline | undefined {
  return findClient(now, accountId) ? primaryPipeline(now, accountId) : undefined;
}

export function listContacts(now: Date, accountId?: string): Contact[] {
  const all = crm(now).contacts;
  return accountId ? all.filter((c) => c.accountId === accountId) : all;
}

export function findContact(now: Date, id: string): Contact | undefined {
  return crm(now).contacts.find((c) => c.id === id);
}

export function listActivities(now: Date, contactId: string): ContactActivity[] {
  return crm(now)
    .activities.filter((a) => a.contactId === contactId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export interface NewContactInput {
  accountId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  city?: string;
  tags: string[];
  source: ContactSource;
  stageId?: string;
  ownerName?: string;
  valueCents?: number;
}

export function createContact(now: Date, input: NewContactInput): Contact | undefined {
  const pipeline = getPipeline(now, input.accountId);
  if (!pipeline) return undefined;
  const id = `new-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
  const at = now.toISOString();
  const contact: Contact = {
    id,
    accountId: input.accountId,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    company: input.company?.trim() || undefined,
    city: input.city?.trim() || undefined,
    tags: input.tags,
    source: input.source,
    stageId: input.stageId && pipeline.stages.some((s) => s.id === input.stageId) ? input.stageId : pipeline.stages[0]!.id,
    ownerName: input.ownerName || undefined,
    valueCents: input.valueCents ?? 0,
    doNotContact: { email: false, sms: false, call: false },
    createdAt: at,
    lastActivityAt: at,
  };
  const s = crm(now);
  s.contacts.push(contact);
  s.activities.push({ id: `${id}-a1`, contactId: id, kind: "form", title: "Added by hand", by: "System", at });
  contactStageMoved(now, id, contact.stageId, input.ownerName || "System");
  return contact;
}

export type ContactPatch = Partial<Pick<Contact, "firstName" | "lastName" | "email" | "phone" | "company" | "city" | "tags" | "source" | "ownerName" | "valueCents" | "doNotContact">>;

export function updateContact(now: Date, id: string, patch: ContactPatch): Contact | undefined {
  const c = findContact(now, id);
  if (!c) return undefined;
  Object.assign(c, patch);
  return c;
}

export function moveContactStage(now: Date, id: string, stageId: string, by: string): Contact | undefined {
  const c = findContact(now, id);
  if (!c || c.stageId === stageId) return c;
  const pipeline = getPipeline(now, c.accountId);
  const stage = pipeline?.stages.find((s) => s.id === stageId);
  if (!stage) return c;
  c.stageId = stageId;
  addActivity(now, id, { kind: "stage", title: `Moved to ${stage.name}`, by });
  contactStageMoved(now, id, stageId, by);
  return c;
}

export function addActivity(
  now: Date,
  contactId: string,
  input: { kind: ActivityKind; title: string; body?: string; by?: string; amountCents?: number; at?: string },
): ContactActivity | undefined {
  const c = findContact(now, contactId);
  if (!c) return undefined;
  const a: ContactActivity = {
    id: `${contactId}-a-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
    contactId,
    kind: input.kind,
    title: input.title.trim(),
    body: input.body?.trim() || undefined,
    by: input.by,
    amountCents: input.amountCents,
    at: input.at ?? now.toISOString(),
  };
  crm(now).activities.push(a);
  if (a.at > c.lastActivityAt) c.lastActivityAt = a.at;
  if (input.kind === "donation" && input.amountCents) c.valueCents += input.amountCents;
  return a;
}

export function deleteContact(now: Date, id: string) {
  const s = crm(now);
  s.contacts = s.contacts.filter((c) => c.id !== id);
  s.activities = s.activities.filter((a) => a.contactId !== id);
  contactDeleted(now, id);
}

/* ------------------------------ Funnels ------------------------------ */

import type { BuilderDoc, BuilderTheme, Funnel, FunnelBlock, FunnelOrder, FunnelStep, FunnelStepKind, FunnelSubmission } from "@/lib/types";
import { demoFunnelsFor, withDocs } from "./demo-funnels";
import { funnelTemplate } from "@/components/builder/templates";
import { reId, section, row, column, newElement, emptyDoc } from "@/components/builder/model";
import { sectionTemplates } from "@/components/builder/templates";

interface FunnelStore {
  seededFor: string;
  funnels: Funnel[];
  submissions: FunnelSubmission[];
  orders?: FunnelOrder[];
}

const gf = globalThis as unknown as { __lotusFunnels?: FunnelStore };

function funnelStore(now: Date): FunnelStore {
  const key = now.toISOString().slice(0, 10);
  if (!gf.__lotusFunnels || gf.__lotusFunnels.seededFor !== key) {
    const seeded = listClients(now)
      .filter((c) => !c.account.id.startsWith("new-"))
      .flatMap((c) => demoFunnelsFor(c, now));
    const kept = gf.__lotusFunnels?.funnels.filter((f) => f.id.startsWith("new-")) ?? [];
    const all = [...seeded, ...kept];
    for (const f of all) f.steps = withDocs(f.steps);
    gf.__lotusFunnels = { seededFor: key, funnels: all, submissions: gf.__lotusFunnels?.submissions ?? [], orders: gf.__lotusFunnels?.orders ?? [] };
  }
  return gf.__lotusFunnels;
}

export function listFunnels(now: Date, accountId?: string): Funnel[] {
  const all = funnelStore(now).funnels;
  return accountId ? all.filter((f) => f.accountId === accountId) : all;
}

export function findFunnel(now: Date, idOrSlug: string): Funnel | undefined {
  return funnelStore(now).funnels.find((f) => f.id === idOrSlug || f.slug === idOrSlug);
}

export function createFunnel(now: Date, input: { accountId: string; name: string; template: string }): Funnel | undefined {
  const c = findClient(now, input.accountId);
  if (!c) return undefined;
  const t = funnelTemplate(input.template);
  const id = `new-${Date.now().toString(36)}`;
  let slug = `${c.account.slug}-${slugify(input.name)}`;
  if (findFunnel(now, slug)) slug = `${slug}-${id.slice(-4)}`;
  const f: Funnel = {
    id,
    accountId: c.account.id,
    name: input.name.trim(),
    slug,
    status: "draft",
    template: t.key,
    brandColor: c.account.brandColor ?? "#0f1221",
    steps: withDocs(t.build({ name: c.account.name, industry: c.industry, location: c.location })).map((s) => ({ ...s, stats: { a: { views: 0, conversions: 0, revenueCents: 0 } } })),
    days: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  funnelStore(now).funnels.push(f);
  return f;
}

export function updateFunnel(now: Date, id: string, patch: Partial<Pick<Funnel, "name" | "status" | "brandColor" | "slug" | "theme">>): Funnel | undefined {
  const f = findFunnel(now, id);
  if (!f) return undefined;
  Object.assign(f, patch, { updatedAt: now.toISOString() });
  return f;
}

export function saveStepBlocks(now: Date, funnelId: string, stepId: string, blocks: FunnelBlock[], name?: string): FunnelStep | undefined {
  const f = findFunnel(now, funnelId);
  const s = f?.steps.find((s) => s.id === stepId);
  if (!f || !s) return undefined;
  s.blocks = blocks;
  if (name) s.name = name.trim();
  f.updatedAt = now.toISOString();
  return s;
}

/** A new step starts from the section that fits its job, so it is never blank. */
function starterDoc(kind: FunnelStepKind, name: string, ctx: { name: string; industry: string; location: string }): BuilderDoc {
  const pick = (key: string) => sectionTemplates.find((t) => t.key === key)?.build(ctx);
  const keys: Record<FunnelStepKind, string[]> = {
    optin: ["hero-split-form", "stats-strip", "footer"],
    sales: ["hero-centered", "features-3", "testimonial-grid", "pricing-single", "faq", "footer"],
    order: ["order-two-column", "footer"],
    upsell: ["upsell", "footer"],
    downsell: ["upsell", "footer"],
    webinar: ["hero-split-form", "benefit-checklist", "footer"],
    application: ["application", "footer"],
    thankyou: [],
    custom: [],
  };
  const secs = keys[kind].map(pick).filter((x): x is NonNullable<typeof x> => !!x);
  if (secs.length) return { v: 1, sections: secs };
  if (kind === "thankyou") {
    const h = newElement("headline");
    const p = newElement("text");
    if (h.type === "headline") {
      h.tag = "h1";
      h.text = "Thank you. You're all set.";
    }
    if (p.type === "text") p.text = `We've sent the details to your inbox. ${ctx.name} will be in touch soon.`;
    return { v: 1, sections: [section([row([column(12, [h, p])])], { name: "Thank you", style: { padTop: 120, padBottom: 120, maxWidth: 680, align: "center" } })] };
  }
  const d = emptyDoc();
  const h = d.sections[0]?.rows[0]?.columns[0]?.elements[0];
  if (h?.type === "headline") h.text = name;
  return d;
}

export function addStep(now: Date, funnelId: string, name: string, kind: FunnelStepKind = "custom"): FunnelStep | undefined {
  const f = findFunnel(now, funnelId);
  if (!f) return undefined;
  const c = findClient(now, f.accountId);
  const id = `s-${Date.now().toString(36)}`;
  let path = slugify(name) || "step";
  while (f.steps.some((s) => s.path === path)) path = `${path}-2`;
  const ctx = { name: c?.account.name ?? f.name, industry: c?.industry ?? "", location: c?.location ?? "" };
  const s: FunnelStep = { id, name: name.trim(), path: f.steps.length ? path : "", kind, blocks: [], doc: starterDoc(kind, name.trim(), ctx), stats: { a: { views: 0, conversions: 0, revenueCents: 0 } } };
  f.steps.push(s);
  f.updatedAt = now.toISOString();
  return s;
}

export function updateStep(now: Date, funnelId: string, stepId: string, patch: Partial<Pick<FunnelStep, "name" | "path" | "kind">>): { step?: FunnelStep; error?: string } {
  const f = findFunnel(now, funnelId);
  const s = f?.steps.find((x) => x.id === stepId);
  if (!f || !s) return { error: "Step not found." };
  if (patch.path !== undefined) {
    const path = slugify(patch.path);
    if (f.steps[0] === s) patch.path = "";
    else if (!path) return { error: "Give the step a path." };
    else if (f.steps.some((x) => x !== s && x.path === path)) return { error: "Another step already uses that path." };
    else patch.path = path;
  }
  Object.assign(s, patch);
  f.updatedAt = now.toISOString();
  return { step: s };
}

export function saveStepDoc(now: Date, funnelId: string, stepId: string, doc: BuilderDoc, variant: "a" | "b", theme?: BuilderTheme): FunnelStep | undefined {
  const f = findFunnel(now, funnelId);
  const s = f?.steps.find((x) => x.id === stepId);
  if (!f || !s) return undefined;
  if (variant === "b") {
    if (!s.variant) return undefined;
    s.variant.doc = doc;
  } else s.doc = doc;
  if (theme) f.theme = theme;
  f.updatedAt = now.toISOString();
  return s;
}

export function duplicateStep(now: Date, funnelId: string, stepId: string): FunnelStep | undefined {
  const f = findFunnel(now, funnelId);
  const i = f?.steps.findIndex((x) => x.id === stepId) ?? -1;
  if (!f || i < 0) return undefined;
  const src = f.steps[i]!;
  let path = `${src.path || "page"}-copy`;
  while (f.steps.some((s) => s.path === path)) path = `${path}-2`;
  const copy: FunnelStep = { ...structuredClone(src), id: `s-${Date.now().toString(36)}`, name: `${src.name} copy`, path, variant: undefined, doc: src.doc ? reId(src.doc) : undefined, stats: { a: { views: 0, conversions: 0, revenueCents: 0 } } };
  f.steps.splice(i + 1, 0, copy);
  f.updatedAt = now.toISOString();
  return copy;
}

/** Version B starts as a copy of A so the first change is the only difference. */
export function startSplitTest(now: Date, funnelId: string, stepId: string) {
  const f = findFunnel(now, funnelId);
  const s = f?.steps.find((x) => x.id === stepId);
  if (!f || !s || s.variant || !s.doc) return;
  s.variant = { doc: reId(s.doc), split: 50, startedAt: now.toISOString() };
  s.stats = { a: s.stats?.a ?? { views: 0, conversions: 0, revenueCents: 0 }, b: { views: 0, conversions: 0, revenueCents: 0 } };
  f.updatedAt = now.toISOString();
}

export function setSplit(now: Date, funnelId: string, stepId: string, split: number) {
  const s = findFunnel(now, funnelId)?.steps.find((x) => x.id === stepId);
  if (s?.variant) s.variant.split = Math.min(95, Math.max(5, Math.round(split)));
}

/** Ends the test. The winner becomes the page; the loser is discarded. */
export function endSplitTest(now: Date, funnelId: string, stepId: string, winner: "a" | "b") {
  const f = findFunnel(now, funnelId);
  const s = f?.steps.find((x) => x.id === stepId);
  if (!f || !s?.variant) return;
  if (winner === "b") s.doc = s.variant.doc;
  const a = s.stats?.a ?? { views: 0, conversions: 0, revenueCents: 0 };
  const b = s.stats?.b ?? { views: 0, conversions: 0, revenueCents: 0 };
  s.stats = { a: { views: a.views + b.views, conversions: a.conversions + b.conversions, revenueCents: a.revenueCents + b.revenueCents } };
  s.variant = undefined;
  f.updatedAt = now.toISOString();
}

function bump(now: Date, funnelId: string, stepId: string, v: "a" | "b", k: "views" | "conversions", revenueCents = 0) {
  const s = findFunnel(now, funnelId)?.steps.find((x) => x.id === stepId);
  if (!s) return;
  s.stats ??= { a: { views: 0, conversions: 0, revenueCents: 0 } };
  const bucket = v === "b" && s.variant ? (s.stats.b ??= { views: 0, conversions: 0, revenueCents: 0 }) : s.stats.a;
  bucket[k] += 1;
  bucket.revenueCents += revenueCents;
}

export function recordStepView(now: Date, funnelId: string, stepId: string, v: "a" | "b") {
  bump(now, funnelId, stepId, v, "views");
  const f = findFunnel(now, funnelId);
  if (f && f.steps[0]?.id === stepId) {
    const today = now.toISOString().slice(0, 10);
    const d = f.days.find((d) => d.day === today);
    if (d) d.visitors += 1;
    else f.days.push({ day: today, visitors: 1, leads: 0 });
  }
}

export function recordStepConversion(now: Date, funnelId: string, stepId: string, v: "a" | "b", revenueCents = 0) {
  bump(now, funnelId, stepId, v, "conversions", revenueCents);
}

export function recordOrder(now: Date, o: Omit<FunnelOrder, "id" | "at">): FunnelOrder {
  const order: FunnelOrder = { ...o, id: `ord-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, at: now.toISOString() };
  const st = funnelStore(now);
  (st.orders ??= []).push(order);
  return order;
}

export function findOrder(now: Date, id: string): FunnelOrder | undefined {
  return funnelStore(now).orders?.find((o) => o.id === id);
}

export function listOrders(now: Date, funnelId: string): FunnelOrder[] {
  return (funnelStore(now).orders ?? []).filter((o) => o.funnelId === funnelId).sort((a, b) => b.at.localeCompare(a.at));
}

export function moveStep(now: Date, funnelId: string, stepId: string, dir: -1 | 1) {
  const f = findFunnel(now, funnelId);
  if (!f) return;
  const i = f.steps.findIndex((s) => s.id === stepId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= f.steps.length) return;
  [f.steps[i], f.steps[j]] = [f.steps[j]!, f.steps[i]!];
  // The first step is always the root path.
  f.steps.forEach((s, k) => (s.path = k === 0 ? "" : s.path || slugify(s.name)));
  f.updatedAt = now.toISOString();
}

export function removeStep(now: Date, funnelId: string, stepId: string) {
  const f = findFunnel(now, funnelId);
  if (!f || f.steps.length <= 1) return;
  f.steps = f.steps.filter((s) => s.id !== stepId);
  f.steps.forEach((s, k) => (s.path = k === 0 ? "" : s.path || slugify(s.name)));
  f.updatedAt = now.toISOString();
}

export function deleteFunnel(now: Date, id: string) {
  const s = funnelStore(now);
  s.funnels = s.funnels.filter((f) => f.id !== id);
}

export function recordSubmission(now: Date, funnelId: string, stepId: string, values: Record<string, string>, contactId?: string): FunnelSubmission {
  const sub: FunnelSubmission = { id: `sub-${Date.now().toString(36)}`, funnelId, stepId, values, contactId, at: now.toISOString() };
  const s = funnelStore(now);
  s.submissions.push(sub);
  const f = s.funnels.find((f) => f.id === funnelId);
  if (f) {
    const today = now.toISOString().slice(0, 10);
    const d = f.days.find((d) => d.day === today);
    if (d) d.leads += 1;
    else f.days.push({ day: today, visitors: 1, leads: 1 });
  }
  return sub;
}

export function listSubmissions(now: Date, funnelId: string): FunnelSubmission[] {
  return funnelStore(now).submissions.filter((s) => s.funnelId === funnelId).sort((a, b) => b.at.localeCompare(a.at));
}

/* ------------------------ Reputation and reporting ------------------------ */

import type { ReportConfig, ReportSend, ReputationSettings, Review, ReviewRequest, ReviewRequestChannel } from "@/lib/types";
import { defaultReportConfig, defaultReputationSettings, demoReportSendsFor, demoRequestsFor, demoReviewsFor } from "./demo-reputation";

interface ReputationStore {
  seededFor: string;
  reviews: Review[];
  requests: ReviewRequest[];
  settings: Record<string, ReputationSettings>;
  reports: Record<string, ReportConfig>;
  sends: ReportSend[];
}

const gr = globalThis as unknown as { __lotusReputation?: ReputationStore };

function reputationStore(now: Date): ReputationStore {
  const key = now.toISOString().slice(0, 10);
  if (!gr.__lotusReputation || gr.__lotusReputation.seededFor !== key) {
    const prev = gr.__lotusReputation;
    const clients = listClients(now).filter((c) => !c.account.id.startsWith("new-"));
    const reviews: Review[] = [];
    const requests: ReviewRequest[] = [];
    const settings: Record<string, ReputationSettings> = {};
    const reports: Record<string, ReportConfig> = {};
    const sends: ReportSend[] = [];
    for (const c of clients) {
      const rv = demoReviewsFor(c, now);
      reviews.push(...rv);
      requests.push(...demoRequestsFor(c, now, listContacts(now, c.account.id), rv));
      settings[c.account.id] = prev?.settings[c.account.id] ?? defaultReputationSettings(c);
      reports[c.account.id] = prev?.reports[c.account.id] ?? defaultReportConfig(c);
      sends.push(...demoReportSendsFor(c, reports[c.account.id]!, now));
    }
    const keep = <T extends { id: string }>(xs: T[] | undefined) => xs?.filter((x) => x.id.startsWith("new-")) ?? [];
    gr.__lotusReputation = {
      seededFor: key,
      reviews: [...reviews, ...keep(prev?.reviews)],
      requests: [...keep(prev?.requests), ...requests],
      settings: { ...settings, ...(prev?.settings ?? {}) },
      reports: { ...reports, ...(prev?.reports ?? {}) },
      sends: [...keep(prev?.sends), ...sends],
    };
  }
  return gr.__lotusReputation;
}

export function listReviews(now: Date, accountId?: string): Review[] {
  const all = reputationStore(now).reviews;
  return (accountId ? all.filter((r) => r.accountId === accountId) : all).slice().sort((a, b) => b.at.localeCompare(a.at));
}

export function findReview(now: Date, id: string): Review | undefined {
  return reputationStore(now).reviews.find((r) => r.id === id);
}

export function replyToReview(now: Date, id: string, body: string, by: string): Review | undefined {
  const r = findReview(now, id);
  if (!r) return undefined;
  r.reply = { body: body.trim(), by, at: now.toISOString() };
  return r;
}

export function listReviewRequests(now: Date, accountId?: string): ReviewRequest[] {
  const all = reputationStore(now).requests;
  return (accountId ? all.filter((r) => r.accountId === accountId) : all).slice().sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function getReputationSettings(now: Date, accountId: string): ReputationSettings | undefined {
  const s = reputationStore(now);
  if (!s.settings[accountId]) {
    const c = findClient(now, accountId);
    if (!c) return undefined;
    s.settings[accountId] = defaultReputationSettings(c);
  }
  return s.settings[accountId];
}

export function updateReputationSettings(now: Date, accountId: string, patch: Partial<Omit<ReputationSettings, "accountId">>): ReputationSettings | undefined {
  const cur = getReputationSettings(now, accountId);
  if (!cur) return undefined;
  Object.assign(cur, patch);
  return cur;
}

/** Send a review request to a contact: records the request and logs it on the contact. */
export function sendReviewRequest(now: Date, accountId: string, contactId: string, channel: ReviewRequestChannel, by: string, opts: { trigger?: ReviewRequest["trigger"]; recordActivity?: boolean } = {}): ReviewRequest | undefined {
  const contact = findContact(now, contactId);
  if (!contact || contact.accountId !== accountId) return undefined;
  const req: ReviewRequest = {
    id: `new-rq-${Date.now().toString(36)}`,
    accountId,
    contactId,
    contactName: `${contact.firstName} ${contact.lastName}`,
    channel,
    trigger: opts.trigger ?? "manual",
    status: "sent",
    sentAt: now.toISOString(),
  };
  reputationStore(now).requests.unshift(req);
  if (opts.recordActivity !== false) addActivity(now, contactId, { kind: channel === "sms" ? "sms" : "email", title: `Review request sent by ${channel === "sms" ? "text" : "email"}`, by });
  return req;
}

export function getReportConfig(now: Date, accountId: string): ReportConfig | undefined {
  const s = reputationStore(now);
  if (!s.reports[accountId]) {
    const c = findClient(now, accountId);
    if (!c) return undefined;
    s.reports[accountId] = defaultReportConfig(c);
  }
  return s.reports[accountId];
}

export function updateReportConfig(now: Date, accountId: string, patch: Partial<Omit<ReportConfig, "accountId">>): ReportConfig | undefined {
  const cur = getReportConfig(now, accountId);
  if (!cur) return undefined;
  Object.assign(cur, patch);
  return cur;
}

export function listReportSends(now: Date, accountId?: string): ReportSend[] {
  const all = reputationStore(now).sends;
  return (accountId ? all.filter((r) => r.accountId === accountId) : all).slice().sort((a, b) => b.at.localeCompare(a.at));
}

/** Records the send for the board. Delivery itself goes through the email module (see sendReport in reports-send.ts). */
export function sendReportNow(now: Date, accountId: string): ReportSend | undefined {
  const cfg = getReportConfig(now, accountId);
  if (!cfg) return undefined;
  const send: ReportSend = { id: `new-rs-${Date.now().toString(36)}`, accountId, at: now.toISOString(), recipients: cfg.recipients, range: cfg.range, kind: "manual" };
  reputationStore(now).sends.unshift(send);
  return send;
}
