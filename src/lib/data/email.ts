import { stamp } from "@/lib/ids";
import type { AudienceFilter, EmailAudience, EmailCampaign, EmailSend, ClientRecord } from "@/lib/types";
import { audienceMembers, reachOf } from "@/components/email/model";
import { cloneBlocks, emailTemplates, findTemplate } from "./email-templates";
import { defineModule } from "@/lib/server/workspace";
import { addActivity, findClient, listClients, listContacts,} from "./store";

/*
 * Email campaigns, audiences and sends, saved per agency in the "email"
 * module. Every recipient is a CRM contact and every opt-out is the
 * contact's do-not-email flag. Each client starts with a few standard
 * segments (everyone, open leads, past customers, ...); opens and clicks
 * arrive with provider webhooks.
 */

interface EmailStore {
  audiences: EmailAudience[];
  campaigns: EmailCampaign[];
  sends: EmailSend[];
  /** One-off emails (weekly reports, receipts) that are not campaigns. */
  transactional: TransactionalEmail[];
}

export interface TransactionalEmail {
  id: string;
  accountId: string;
  to: string;
  subject: string;
  kind: "report" | "receipt" | "other";
  status: "delivered" | "queued";
  sentAt: string;
}

export function emailLive() {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Send one email outside a campaign. With RESEND_API_KEY this is where the
 * Resend call goes; in demo mode the send is recorded as delivered and
 * nothing leaves the machine.
 */
export function deliverEmail(now: Date, input: { accountId: string; to: string; subject: string; kind: TransactionalEmail["kind"] }): TransactionalEmail {
  const s = store(now);
  const t: TransactionalEmail = { id: `tx-${stamp()}-${Math.random().toString(36).slice(2, 6)}`, accountId: input.accountId, to: input.to, subject: input.subject, kind: input.kind, status: emailLive() ? "queued" : "delivered", sentAt: now.toISOString() };
  s.transactional.unshift(t);
  return t;
}

export function listTransactional(now: Date, accountId?: string) {
  const all = store(now).transactional;
  return accountId ? all.filter((t) => t.accountId === accountId) : all;
}

const emailModule = defineModule<EmailStore>({ key: "email", init: () => ({ audiences: [], campaigns: [], sends: [], transactional: [] }) });

const anyFilter = (): AudienceFilter => ({ tags: [], stageIds: [], sources: [] });

function fromEmailFor(c: ClientRecord) {
  return `hello@${c.account.slug.replace(/-/g, "")}.com`;
}

/** The standard segments every client starts with. */
function defaultAudiences(c: ClientRecord, now: Date): EmailAudience[] {
  const at = now.toISOString();
  const base = { accountId: c.account.id, contactIds: [] as string[], createdAt: at, updatedAt: at };
  const id = (k: string) => `${c.account.id}-aud-${k}`;
  const out: EmailAudience[] = [{ ...base, id: id("all"), name: "Everyone", kind: "segment", filter: anyFilter() }];
  if (c.mode === "marketing") {
    out.push({ ...base, id: id("open"), name: "Open leads", kind: "segment", filter: { ...anyFilter(), stageIds: ["new", "contacted", "booked", "showed"] } });
    out.push({ ...base, id: id("customers"), name: "Past customers", kind: "segment", filter: { ...anyFilter(), stageIds: ["won"] } });
  } else {
    out.push({ ...base, id: id("monthly"), name: "Monthly donors", kind: "segment", filter: { ...anyFilter(), stageIds: ["monthly"] } });
    out.push({ ...base, id: id("lapsed"), name: "Lapsed donors", kind: "segment", filter: { ...anyFilter(), stageIds: ["lapsed"] } });
  }
  out.push({ ...base, id: id("new30"), name: "New in the last 30 days", kind: "segment", filter: { ...anyFilter(), addedWithinDays: 30 } });
  return out;
}

function store(now: Date): EmailStore {
  const s = emailModule.get();
  for (const c of listClients(now)) {
    if (!s.audiences.some((a) => a.accountId === c.account.id)) s.audiences.push(...defaultAudiences(c, now));
  }
  // Scheduled campaigns whose time has come go out on the next read.
  for (const c of s.campaigns) if (c.status === "scheduled" && c.scheduledFor && c.scheduledFor <= now.toISOString()) sendCampaign(now, c.id, "Scheduler");
  return s;
}

const newId = (p: string) => `new-${p}-${stamp()}-${Math.floor(Math.random() * 1e4).toString(36)}`;

/* ------------------------------ reads ------------------------------- */

export function listCampaigns(now: Date, accountId?: string) {
  const all = store(now).campaigns;
  return accountId ? all.filter((c) => c.accountId === accountId) : all;
}

export function findCampaign(now: Date, id: string) {
  return store(now).campaigns.find((c) => c.id === id);
}

export function listSends(now: Date, campaignId?: string) {
  const all = store(now).sends;
  return campaignId ? all.filter((s) => s.campaignId === campaignId) : all;
}

export function listAudiences(now: Date, accountId?: string) {
  const all = store(now).audiences;
  return accountId ? all.filter((a) => a.accountId === accountId) : all;
}

export function findAudience(now: Date, id: string) {
  return store(now).audiences.find((a) => a.id === id);
}

/* ------------------------------ writes ------------------------------ */

export function createCampaign(now: Date, input: { accountId: string; name: string; templateId: string }): EmailCampaign | undefined {
  const client = findClient(now, input.accountId);
  if (!client) return undefined;
  const template = findTemplate(input.templateId) ?? emailTemplates[0]!;
  const id = newId("cmp");
  const at = now.toISOString();
  const campaign: EmailCampaign = {
    id,
    accountId: client.account.id,
    name: input.name.trim(),
    subject: template.subject,
    previewText: template.previewText,
    fromName: client.account.name,
    fromEmail: fromEmailFor(client),
    audienceId: listAudiences(now, client.account.id)[0]?.id,
    templateId: template.id,
    blocks: cloneBlocks(template.blocks, id),
    status: "draft",
    createdAt: at,
    updatedAt: at,
  };
  store(now).campaigns.push(campaign);
  return campaign;
}

export type CampaignPatch = Partial<Pick<EmailCampaign, "name" | "subject" | "previewText" | "fromName" | "fromEmail" | "audienceId" | "blocks">>;

export function updateCampaign(now: Date, id: string, patch: CampaignPatch) {
  const c = findCampaign(now, id);
  if (!c || c.status === "sent") return undefined;
  Object.assign(c, patch, { updatedAt: now.toISOString() });
  return c;
}

export function scheduleCampaign(now: Date, id: string, when: Date | null) {
  const c = findCampaign(now, id);
  if (!c || c.status === "sent") return undefined;
  c.status = when ? "scheduled" : "draft";
  c.scheduledFor = when?.toISOString();
  c.updatedAt = now.toISOString();
  return c;
}

/**
 * Send now. Contacts without an email or with do-not-email set are skipped;
 * every recipient gets an email activity on their CRM timeline.
 */
export function sendCampaign(now: Date, id: string, by: string): { sent: number; skipped: number } | undefined {
  const s = emailModule.get();
  const c = s.campaigns.find((x) => x.id === id);
  if (!c || c.status === "sent") return undefined;
  const audience = s.audiences.find((a) => a.id === c.audienceId);
  if (!audience) return undefined;
  const reach = reachOf(audienceMembers(audience, listContacts(now, c.accountId), now));
  const at = now.toISOString();
  for (const ct of reach.sendable) {
    s.sends.push({ id: `${c.id}-${ct.id}`, campaignId: c.id, contactId: ct.id, email: ct.email!, status: "delivered", sentAt: at });
    addActivity(now, ct.id, { kind: "email", title: `Campaign: ${c.subject.replace(/\{\{\s*first_name\s*\}\}/g, ct.firstName).replace(/\{\{\s*\w+\s*\}\}/g, c.fromName)}`, body: c.name, by });
  }
  c.status = "sent";
  c.sentAt = at;
  c.scheduledFor = undefined;
  c.updatedAt = at;
  return { sent: reach.sendable.length, skipped: reach.total - reach.sendable.length };
}

export function duplicateCampaign(now: Date, id: string) {
  const c = findCampaign(now, id);
  if (!c) return undefined;
  const nid = newId("cmp");
  const at = now.toISOString();
  const copy: EmailCampaign = { ...structuredClone(c), id: nid, name: `${c.name} (copy)`, status: "draft", sentAt: undefined, scheduledFor: undefined, createdAt: at, updatedAt: at, blocks: cloneBlocks(c.blocks, nid) };
  store(now).campaigns.push(copy);
  return copy;
}

export function deleteCampaign(now: Date, id: string) {
  const s = store(now);
  s.campaigns = s.campaigns.filter((c) => c.id !== id || c.status === "sent");
}

export function saveAudience(now: Date, input: { id?: string; accountId: string; name: string; kind: EmailAudience["kind"]; filter: AudienceFilter; contactIds: string[] }) {
  const s = store(now);
  const at = now.toISOString();
  const existing = input.id ? s.audiences.find((a) => a.id === input.id) : undefined;
  if (existing) {
    Object.assign(existing, { name: input.name.trim(), kind: input.kind, filter: input.filter, contactIds: input.contactIds, updatedAt: at });
    return existing;
  }
  const a: EmailAudience = { id: newId("aud"), accountId: input.accountId, name: input.name.trim(), kind: input.kind, filter: input.filter, contactIds: input.contactIds, createdAt: at, updatedAt: at };
  s.audiences.push(a);
  return a;
}

export function deleteAudience(now: Date, id: string) {
  const s = store(now);
  if (s.campaigns.some((c) => c.audienceId === id && c.status !== "sent")) return false;
  s.audiences = s.audiences.filter((a) => a.id !== id);
  return true;
}
