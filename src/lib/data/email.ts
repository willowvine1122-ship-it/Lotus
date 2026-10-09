import type { AudienceFilter, Contact, EmailAudience, EmailBlock, EmailCampaign, EmailSend, ClientRecord } from "@/lib/types";
import { audienceMembers, reachOf } from "@/components/email/model";
import { cloneBlocks, emailTemplates, findTemplate } from "./email-templates";
import { addActivity, findClient, listClients, listContacts, updateContact } from "./store";

/*
 * Demo email store. Campaigns, audiences and sends live in process memory on
 * globalThis, seeded once per day from the CRM contacts so every recipient
 * is a real CRM contact and every opt-out is a real do-not-email flag.
 * Sending is simulated: a send records delivery and logs an email activity
 * on the contact; opens and clicks arrive with provider webhooks (Resend).
 */

interface EmailStore {
  seededFor: string;
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
  const t: TransactionalEmail = { id: `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, accountId: input.accountId, to: input.to, subject: input.subject, kind: input.kind, status: emailLive() ? "queued" : "delivered", sentAt: now.toISOString() };
  s.transactional.unshift(t);
  return t;
}

export function listTransactional(now: Date, accountId?: string) {
  const all = store(now).transactional;
  return accountId ? all.filter((t) => t.accountId === accountId) : all;
}

const g = globalThis as unknown as { __lotusEmail?: EmailStore };

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

const anyFilter = (): AudienceFilter => ({ tags: [], stageIds: [], sources: [] });

function fromEmailFor(c: ClientRecord) {
  return `hello@${c.account.slug.replace(/-/g, "")}.com`;
}

function seedAudiences(c: ClientRecord, contacts: Contact[], now: Date, r: () => number): EmailAudience[] {
  const at = new Date(now.getTime() - 90 * 86400000).toISOString();
  const base = { accountId: c.account.id, contactIds: [] as string[], createdAt: at, updatedAt: at };
  const id = (k: string) => `${c.account.id}-aud-${k}`;
  const tagCounts = new Map<string, number>();
  for (const ct of contacts) for (const t of ct.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const topTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const out: EmailAudience[] = [{ ...base, id: id("all"), name: "Everyone", kind: "segment", filter: anyFilter() }];
  if (c.mode === "marketing") {
    out.push({ ...base, id: id("open"), name: "Open leads", kind: "segment", filter: { ...anyFilter(), stageIds: ["new", "contacted", "booked", "showed"] } });
    out.push({ ...base, id: id("customers"), name: "Past customers", kind: "segment", filter: { ...anyFilter(), stageIds: ["won"] } });
  } else {
    out.push({ ...base, id: id("monthly"), name: "Monthly donors", kind: "segment", filter: { ...anyFilter(), stageIds: ["monthly"] } });
    out.push({ ...base, id: id("lapsed"), name: "Lapsed donors", kind: "segment", filter: { ...anyFilter(), stageIds: ["lapsed"] } });
  }
  if (topTag) out.push({ ...base, id: id("tag"), name: topTag, kind: "segment", filter: { ...anyFilter(), tags: [topTag] } });
  out.push({ ...base, id: id("new30"), name: "New in the last 30 days", kind: "segment", filter: { ...anyFilter(), addedWithinDays: 30 } });
  const vip = contacts.filter(() => r() < 0.25).slice(0, 10).map((x) => x.id);
  if (vip.length >= 3) out.push({ ...base, id: id("vip"), name: c.mode === "marketing" ? "VIP list" : "Board and major donors", kind: "list", filter: anyFilter(), contactIds: vip });
  return out;
}

const subjects = {
  marketing: [
    ["Fall inspection offer", "{{first_name}}, 15% off ends Friday", "offer"],
    ["October newsletter", "{{client_name}} this month", "newsletter"],
    ["Storm season check", "Is your roof ready for storm season?", "announcement"],
    ["Online booking launch", "Book online in under a minute", "announcement"],
    ["Thank you, customers", "Thank you, {{first_name}}", "thanks"],
    ["Financing now available", "Pay over 12 months, 0% interest", "offer"],
  ],
  fundraising: [
    ["Winter appeal", "{{first_name}}, can you help this winter?", "appeal"],
    ["Impact report", "What your gift did this year", "newsletter"],
    ["Matching gift week", "Your gift, doubled until Sunday", "appeal"],
    ["Monthly donor thank you", "Thank you, {{first_name}}", "thanks"],
    ["Volunteer day", "Join us on the 18th", "announcement"],
    ["Giving Tuesday", "Today, every gift goes twice as far", "appeal"],
  ],
} as const;

function seedClient(c: ClientRecord, now: Date, s: EmailStore) {
  const contacts = listContacts(now, c.account.id);
  if (!contacts.length) return;
  const seed = [...c.account.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7);
  const r = rng(seed);
  const audiences = seedAudiences(c, contacts, now, r);
  s.audiences.push(...audiences);

  // Most clients run email; a few have not started yet.
  if (r() < 0.2) return;
  const pool = subjects[c.mode];
  const sentCount = 2 + Math.floor(r() * 4);
  const offsets = Array.from({ length: sentCount }, (_, i) => 3 + i * (8 + Math.floor(r() * 10)) + Math.floor(r() * 4));
  // Oldest first, so an unsubscribe only affects the sends after it.
  offsets.reverse().forEach((daysAgo, i) => {
    const [name, subject, templateId] = pool[(i + Math.floor(seed % pool.length)) % pool.length]!;
    const template = findTemplate(templateId)!;
    // Mostly Everyone; sometimes a segment, if it is big enough to be worth a send.
    const pickSeg = audiences[1 + Math.floor(r() * (audiences.length - 1))]!;
    const segSize = reachOf(audienceMembers(pickSeg, contacts, now)).sendable.length;
    const audience = i % 2 === 0 || segSize < 10 ? audiences[0]! : pickSeg;
    const sentAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 9 + Math.floor(r() * 3), 0).toISOString();
    const cid = `${c.account.id}-cmp-${i}`;
    const campaign: EmailCampaign = {
      id: cid,
      accountId: c.account.id,
      name,
      subject,
      previewText: template.previewText,
      fromName: c.account.name,
      fromEmail: fromEmailFor(c),
      audienceId: audience.id,
      templateId,
      blocks: cloneBlocks(template.blocks, cid),
      status: "sent",
      sentAt,
      createdAt: new Date(new Date(sentAt).getTime() - 2 * 86400000).toISOString(),
      updatedAt: sentAt,
    };
    s.campaigns.push(campaign);

    const urls = template.blocks.filter((b): b is Extract<EmailBlock, { type: "button" }> => b.type === "button").map((b) => b.url);
    const openP = 0.28 + r() * 0.3;
    const clickP = 0.1 + r() * 0.25;
    const unsubP = 0.004 + r() * 0.012;
    const reach = reachOf(audienceMembers(audience, contacts, now).filter((ct) => new Date(ct.createdAt) < new Date(sentAt)));
    for (const ct of reach.sendable) {
      const t0 = new Date(sentAt).getTime();
      const bounced = r() < 0.012;
      const send: EmailSend = { id: `${cid}-${ct.id}`, campaignId: cid, contactId: ct.id, email: ct.email!, status: bounced ? "bounced" : "delivered", sentAt };
      if (!bounced && r() < openP) {
        // Most opens land within hours; a long tail runs for days.
        const hours = -Math.log(1 - r() * 0.98) * 14;
        const opened = Math.min(t0 + hours * 3600000, now.getTime() - 60000);
        send.openedAt = new Date(opened).toISOString();
        if (urls.length && r() < clickP) {
          send.clickedAt = new Date(opened + 60000 * (1 + r() * 20)).toISOString();
          send.clickedUrl = urls[Math.floor(r() * urls.length)];
        }
        if (r() < unsubP * 3) send.unsubscribedAt = new Date(opened + 120000).toISOString();
      }
      if (send.unsubscribedAt) updateContact(now, ct.id, { doNotContact: { ...ct.doNotContact, email: true } });
      s.sends.push(send);
    }
  });

  // Some clients have a draft in progress and some have a send queued.
  const draftT = findTemplate(c.mode === "marketing" ? "newsletter" : "appeal")!;
  const created = new Date(now.getTime() - 86400000).toISOString();
  if (r() < 0.4) s.campaigns.push({
    id: `${c.account.id}-cmp-draft`,
    accountId: c.account.id,
    name: c.mode === "marketing" ? "November newsletter" : "Year-end appeal",
    subject: draftT.subject,
    previewText: draftT.previewText,
    fromName: c.account.name,
    fromEmail: fromEmailFor(c),
    audienceId: audiences[0]!.id,
    templateId: draftT.id,
    blocks: cloneBlocks(draftT.blocks, `${c.account.id}-cmp-draft`),
    status: "draft",
    createdAt: created,
    updatedAt: created,
  });
  if (r() < 0.35) {
    const t = findTemplate(c.mode === "marketing" ? "offer" : "thanks")!;
    const when = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1 + Math.floor(r() * 4), 9, 30);
    s.campaigns.push({
      id: `${c.account.id}-cmp-sched`,
      accountId: c.account.id,
      name: c.mode === "marketing" ? "Holiday booking offer" : "Monthly donor thank you",
      subject: t.subject,
      previewText: t.previewText,
      fromName: c.account.name,
      fromEmail: fromEmailFor(c),
      audienceId: (audiences[1] ?? audiences[0])!.id,
      templateId: t.id,
      blocks: cloneBlocks(t.blocks, `${c.account.id}-cmp-sched`),
      status: "scheduled",
      scheduledFor: when.toISOString(),
      createdAt: created,
      updatedAt: created,
    });
  }
}

function store(now: Date): EmailStore {
  const key = now.toISOString().slice(0, 10);
  if (!g.__lotusEmail || g.__lotusEmail.seededFor !== key) {
    const prev = g.__lotusEmail;
    const s: EmailStore = { seededFor: key, audiences: [], campaigns: [], sends: [], transactional: prev?.transactional ?? [] };
    for (const c of listClients(now)) if (!c.account.id.startsWith("new-")) seedClient(c, now, s);
    // Keep what people made in this process across the day boundary.
    if (prev) {
      s.audiences.push(...prev.audiences.filter((a) => a.id.startsWith("new-")));
      const kept = prev.campaigns.filter((c) => c.id.startsWith("new-"));
      const keptIds = new Set(kept.map((c) => c.id));
      s.campaigns.push(...kept);
      s.sends.push(...prev.sends.filter((x) => keptIds.has(x.campaignId)));
    }
    g.__lotusEmail = s;
  }
  const s = g.__lotusEmail;
  // Scheduled campaigns whose time has come go out on the next read.
  for (const c of s.campaigns) if (c.status === "scheduled" && c.scheduledFor && c.scheduledFor <= now.toISOString()) sendCampaign(now, c.id, "Scheduler");
  return s;
}

const newId = (p: string) => `new-${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;

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
  const cur = g.__lotusEmail;
  const s = cur && cur.seededFor === now.toISOString().slice(0, 10) ? cur : store(now);
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
