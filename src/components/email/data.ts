import { findAudience, listAudiences, listCampaigns, listSends } from "@/lib/data/email";
import { getPipeline, listClients, listContacts } from "@/lib/data/store";
import type { AudienceFilter, CampaignStatus, Contact, EmailAudience, EmailBlock, EmailCampaign, EmailSend, Pipeline } from "@/lib/types";
import type { ClientRef } from "@/components/crm/model";
import { audienceMembers, engagementByDay, filterSummary, linkClicks, reachOf, statsOf, type CampaignStats } from "./model";

/* Server-side loaders: everything the client components need, serialisable. */

export interface EmailClientRef extends ClientRef {
  location: string;
}

export function emailClients(now: Date): EmailClientRef[] {
  return listClients(now)
    .map((c) => ({ id: c.account.id, name: c.account.name, slug: c.account.slug, mode: c.mode, location: c.location }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface ReachSummary {
  total: number;
  sendable: number;
  noEmail: number;
  optedOut: number;
}

export interface CampaignRow {
  id: string;
  accountId: string;
  name: string;
  subject: string;
  previewText: string;
  fromName: string;
  fromEmail: string;
  blocks: EmailBlock[];
  status: CampaignStatus;
  audienceName: string;
  /** Sent: how many it went to. Draft or scheduled: how many it would go to now. */
  recipients: number;
  scheduledFor?: string;
  sentAt?: string;
  updatedAt: string;
  stats: CampaignStats | null;
  engagement: { labels: string[]; opens: number[]; clicks: number[] } | null;
  links: { url: string; clicks: number }[];
}

export function campaignRow(now: Date, c: EmailCampaign, contactsByClient: Map<string, Contact[]>, sendsByCampaign: Map<string, EmailSend[]>): CampaignRow {
  const audience = c.audienceId ? findAudience(now, c.audienceId) : undefined;
  const sends = sendsByCampaign.get(c.id) ?? [];
  const sent = c.status === "sent";
  const recipients = sent ? sends.length : audience ? reachOf(audienceMembers(audience, contactsByClient.get(c.accountId) ?? [], now)).sendable.length : 0;
  return {
    id: c.id,
    accountId: c.accountId,
    name: c.name,
    subject: c.subject,
    previewText: c.previewText,
    fromName: c.fromName,
    fromEmail: c.fromEmail,
    blocks: c.blocks,
    status: c.status,
    audienceName: audience?.name ?? "No audience",
    recipients,
    scheduledFor: c.scheduledFor,
    sentAt: c.sentAt,
    updatedAt: c.updatedAt,
    stats: sent ? statsOf(sends) : null,
    engagement: sent && c.sentAt ? engagementByDay(sends, c.sentAt) : null,
    links: sent ? linkClicks(sends) : [],
  };
}

function byClient(now: Date) {
  const m = new Map<string, Contact[]>();
  for (const c of listContacts(now)) m.set(c.accountId, [...(m.get(c.accountId) ?? []), c]);
  return m;
}

function byCampaign(now: Date) {
  const m = new Map<string, EmailSend[]>();
  for (const s of listSends(now)) {
    const xs = m.get(s.campaignId);
    if (xs) xs.push(s);
    else m.set(s.campaignId, [s]);
  }
  return m;
}

export function campaignRows(now: Date): CampaignRow[] {
  const contacts = byClient(now);
  const sends = byCampaign(now);
  return listCampaigns(now).map((c) => campaignRow(now, c, contacts, sends));
}

export interface AudienceRow {
  id: string;
  accountId: string;
  name: string;
  kind: EmailAudience["kind"];
  filter: AudienceFilter;
  contactIds: string[];
  summary: string;
  reach: ReachSummary;
  usedBy: number;
  updatedAt: string;
}

export function audienceRows(now: Date): AudienceRow[] {
  const contacts = byClient(now);
  const campaigns = listCampaigns(now);
  return listAudiences(now).map((a) => {
    const r = reachOf(audienceMembers(a, contacts.get(a.accountId) ?? [], now));
    return {
      id: a.id,
      accountId: a.accountId,
      name: a.name,
      kind: a.kind,
      filter: a.filter,
      contactIds: a.contactIds,
      summary: a.kind === "list" ? `${a.contactIds.length} hand-picked contacts` : filterSummary(a.filter, getPipeline(now, a.accountId)),
      reach: { total: r.total, sendable: r.sendable.length, noEmail: r.noEmail, optedOut: r.optedOut },
      usedBy: campaigns.filter((c) => c.audienceId === a.id).length,
      updatedAt: a.updatedAt,
    };
  });
}

export function pipelinesFor(now: Date, clients: ClientRef[]): Record<string, Pipeline> {
  const out: Record<string, Pipeline> = {};
  for (const c of clients) {
    const p = getPipeline(now, c.id);
    if (p) out[c.id] = p;
  }
  return out;
}

/** The slice of a contact the audience builder and preview need. */
export interface ContactLite {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email?: string;
  tags: string[];
  stageId: string;
  source: Contact["source"];
  createdAt: string;
  optedOut: boolean;
}

export function contactsLite(now: Date, accountId?: string): ContactLite[] {
  return listContacts(now, accountId).map((c) => ({
    id: c.id,
    accountId: c.accountId,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    tags: c.tags,
    stageId: c.stageId,
    source: c.source,
    createdAt: c.createdAt,
    optedOut: c.doNotContact.email,
  }));
}
