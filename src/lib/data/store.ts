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
import { demoContactsFor, pipelineFor } from "./demo-contacts";

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

export function getPipeline(now: Date, accountId: string): Pipeline | undefined {
  const c = findClient(now, accountId);
  return c ? pipelineFor(c) : undefined;
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
}
