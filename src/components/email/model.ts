import type { AudienceFilter, CampaignStatus, Contact, EmailAudience, EmailSend, Pipeline } from "@/lib/types";
import { sourceLabel } from "@/components/crm/model";

/* Framework-free helpers shared by the email screens and the store. */

export function matchesFilter(c: Pick<Contact, "tags" | "stageId" | "source" | "createdAt">, f: AudienceFilter, now: Date) {
  if (f.tags.length && !c.tags.some((t) => f.tags.includes(t))) return false;
  if (f.stageIds.length && !f.stageIds.includes(c.stageId)) return false;
  if (f.sources.length && !f.sources.includes(c.source)) return false;
  if (f.addedWithinDays && now.getTime() - new Date(c.createdAt).getTime() > f.addedWithinDays * 86400000) return false;
  return true;
}

/** Everyone in the audience, whether or not they can be emailed. */
export function audienceMembers(a: EmailAudience, contacts: Contact[], now: Date): Contact[] {
  const inClient = contacts.filter((c) => c.accountId === a.accountId);
  if (a.kind === "list") {
    const ids = new Set(a.contactIds);
    return inClient.filter((c) => ids.has(c.id));
  }
  return inClient.filter((c) => matchesFilter(c, a.filter, now));
}

export interface Reach {
  total: number;
  sendable: Contact[];
  noEmail: number;
  optedOut: number;
}

/** Split an audience into who gets the email and why the rest don't. */
export function reachOf(members: Contact[]): Reach {
  const sendable: Contact[] = [];
  let noEmail = 0;
  let optedOut = 0;
  for (const c of members) {
    if (!c.email) noEmail++;
    else if (c.doNotContact.email) optedOut++;
    else sendable.push(c);
  }
  return { total: members.length, sendable, noEmail, optedOut };
}

export interface CampaignStats {
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  openRate: number | null;
  clickRate: number | null;
  /** Clicks as a share of opens. */
  clickToOpen: number | null;
  unsubRate: number | null;
}

export function statsOf(sends: EmailSend[]): CampaignStats {
  const sent = sends.length;
  const delivered = sends.filter((s) => s.status === "delivered").length;
  const opened = sends.filter((s) => s.openedAt).length;
  const clicked = sends.filter((s) => s.clickedAt).length;
  const unsubscribed = sends.filter((s) => s.unsubscribedAt).length;
  const rate = (n: number, d: number) => (d ? n / d : null);
  return {
    sent,
    delivered,
    bounced: sent - delivered,
    opened,
    clicked,
    unsubscribed,
    openRate: rate(opened, delivered),
    clickRate: rate(clicked, delivered),
    clickToOpen: rate(clicked, opened),
    unsubRate: rate(unsubscribed, delivered),
  };
}

export function sumStats(all: CampaignStats[]): CampaignStats {
  const s = all.reduce(
    (a, b) => ({ sent: a.sent + b.sent, delivered: a.delivered + b.delivered, opened: a.opened + b.opened, clicked: a.clicked + b.clicked, unsubscribed: a.unsubscribed + b.unsubscribed }),
    { sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0 },
  );
  const rate = (n: number, d: number) => (d ? n / d : null);
  return { ...s, bounced: s.sent - s.delivered, openRate: rate(s.opened, s.delivered), clickRate: rate(s.clicked, s.delivered), clickToOpen: rate(s.clicked, s.opened), unsubRate: rate(s.unsubscribed, s.delivered) };
}

export const statusLabel: Record<CampaignStatus, string> = { draft: "Draft", scheduled: "Scheduled", sent: "Sent" };

export const mergeTags = [
  { tag: "{{first_name}}", label: "First name" },
  { tag: "{{last_name}}", label: "Last name" },
  { tag: "{{client_name}}", label: "Client name" },
] as const;

export function renderMerge(text: string, vars: { first_name?: string; last_name?: string; client_name?: string }) {
  return text.replace(/\{\{\s*(first_name|last_name|client_name)\s*\}\}/g, (_, k: keyof typeof vars) => vars[k] || (k === "first_name" ? "there" : ""));
}

export function filterSummary(f: AudienceFilter, pipeline?: Pipeline): string {
  const parts: string[] = [];
  if (f.stageIds.length) parts.push(f.stageIds.map((id) => pipeline?.stages.find((s) => s.id === id)?.name ?? id).join(" or "));
  if (f.tags.length) parts.push(`tagged ${f.tags.join(" or ")}`);
  if (f.sources.length) parts.push(`from ${f.sources.map((s) => sourceLabel[s]).join(" or ")}`);
  if (f.addedWithinDays) parts.push(`added in the last ${f.addedWithinDays} days`);
  return parts.length ? parts.join(" · ") : "Every contact";
}

/** Engagement per day for the first `days` days after send. */
export function engagementByDay(sends: EmailSend[], sentAt: string, days = 7) {
  const start = new Date(sentAt);
  start.setHours(12, 0, 0, 0);
  const labels: string[] = [];
  const opens: number[] = [];
  const clicks: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    labels.push(d.toISOString().slice(0, 10));
    opens.push(0);
    clicks.push(0);
  }
  const index = (iso: string) => labels.indexOf(iso.slice(0, 10));
  for (const s of sends) {
    if (s.openedAt) {
      const i = index(s.openedAt);
      if (i >= 0) opens[i]!++;
    }
    if (s.clickedAt) {
      const i = index(s.clickedAt);
      if (i >= 0) clicks[i]!++;
    }
  }
  return { labels, opens, clicks };
}

export function linkClicks(sends: EmailSend[]) {
  const m = new Map<string, number>();
  for (const s of sends) if (s.clickedUrl) m.set(s.clickedUrl, (m.get(s.clickedUrl) ?? 0) + 1);
  return [...m.entries()].map(([url, clicks]) => ({ url, clicks })).sort((a, b) => b.clicks - a.clicks);
}

export function prettyUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
