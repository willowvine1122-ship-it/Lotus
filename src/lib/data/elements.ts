import { randomBytes } from "node:crypto";
import type { Campaign, DonationElement, DonationElementConfig, DonationElementType, ElementDay, FundraisingClient } from "@/lib/types";
import { defaultConfig, stockImages } from "@/lib/elements";
import { accountFundraising, findCampaign, fundraisingClients, type AccountFundraising } from "./donors";

/*
 * Donation elements store. Demo data on globalThis like every other module,
 * seeded once per day from the fundraising store so an element's gifts are
 * real gifts in the donor CRM: a share of each campaign's last 30 days of
 * gifts is credited to the element the donor came through. Views and
 * checkout opens are synthetic until the install script reports real ones.
 * Elements made or edited by hand survive the daily reseed. Replaced by
 * the tables in migration 0018 once Supabase is connected.
 */

interface ElementStore {
  seededFor: string;
  elements: DonationElement[];
  days: Map<string, ElementDay[]>;
  /** donation id -> element id */
  credit: Map<string, string>;
  touched: Set<string>;
}

const g = globalThis as unknown as { __lotusElements?: ElementStore };
const DAY = 86_400_000;
const WINDOW = 30;

const uid = () => `new-el-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;

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

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function store(now: Date): ElementStore {
  const key = now.toISOString().slice(0, 10);
  if (!g.__lotusElements || g.__lotusElements.seededFor !== key) {
    const prev = g.__lotusElements;
    const s: ElementStore = { seededFor: key, elements: [], days: new Map(), credit: new Map(), touched: new Set() };
    seed(now, s);
    if (prev) {
      for (const e of prev.elements) {
        if (!prev.touched.has(e.id)) continue;
        const i = s.elements.findIndex((x) => x.id === e.id);
        if (i >= 0) s.elements[i] = e;
        else {
          s.elements.push(e);
          s.days.set(e.id, emptyDays(now));
        }
        s.touched.add(e.id);
      }
    }
    g.__lotusElements = s;
  }
  return g.__lotusElements;
}

function emptyDays(now: Date): ElementDay[] {
  return Array.from({ length: WINDOW }, (_, i) => ({ date: new Date(now.getTime() - (WINDOW - 1 - i) * DAY).toISOString().slice(0, 10), views: 0, opens: 0, gifts: 0, raisedCents: 0 }));
}

/* ------------------------------- reads ------------------------------ */

export function listElements(now: Date): DonationElement[] {
  return store(now).elements;
}

export function findElement(now: Date, id: string): DonationElement | undefined {
  return store(now).elements.find((e) => e.id === id);
}

export function elementDays(now: Date, id: string): ElementDay[] {
  return store(now).days.get(id) ?? emptyDays(now);
}

/** Which element brought in a gift, if any. */
export function creditedElement(now: Date, donationId: string): string | undefined {
  return store(now).credit.get(donationId);
}

export function clientForAccount(now: Date, accountId: string): FundraisingClient | undefined {
  return fundraisingClients(now).find((c) => c.account.id === accountId);
}

export function campaignFor(now: Date, e: Pick<DonationElement, "accountId" | "campaignId">): { campaign: Campaign; client: FundraisingClient; data: AccountFundraising } | null {
  const client = clientForAccount(now, e.accountId);
  if (!client) return null;
  const data = accountFundraising(now, client);
  const campaign = data.campaigns.find((c) => c.id === e.campaignId) ?? data.campaigns[0];
  return campaign ? { campaign, client, data } : null;
}

/** Gifts credited to an element, newest first. */
export function elementGifts(now: Date, id: string, limit = 6) {
  const s = store(now);
  const e = s.elements.find((x) => x.id === id);
  if (!e) return [];
  const found = campaignFor(now, e);
  if (!found) return [];
  const { data } = found;
  return data.donations
    .filter((d) => s.credit.get(d.id) === id && d.status === "succeeded")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((d) => {
      const donor = data.donors.find((x) => x.id === d.donorId);
      return {
        id: d.id,
        donorId: d.donorId,
        name: donor ? `${donor.contact.firstName} ${donor.contact.lastName}`.trim() : "Donor",
        amountCents: d.amountCents,
        monthly: d.frequency === "monthly",
        at: d.createdAt,
      };
    });
}

/* ------------------------------ writes ------------------------------ */

export function createElement(now: Date, input: { accountId: string; campaignId: string; type: DonationElementType; name: string }): DonationElement | null {
  const s = store(now);
  const found = campaignFor(now, input);
  if (!found) return null;
  const at = now.toISOString();
  const e: DonationElement = {
    id: uid(),
    accountId: input.accountId,
    campaignId: found.campaign.id,
    type: input.type,
    name: input.name,
    status: "live",
    config: defaultConfig(input.type, found.campaign),
    createdAt: at,
    updatedAt: at,
  };
  s.elements.unshift(e);
  s.days.set(e.id, emptyDays(now));
  s.touched.add(e.id);
  return e;
}

export function saveElement(now: Date, id: string, patch: { name: string; campaignId: string; config: DonationElementConfig }): DonationElement | null {
  const s = store(now);
  const e = s.elements.find((x) => x.id === id);
  if (!e) return null;
  const campaign = campaignFor(now, { accountId: e.accountId, campaignId: patch.campaignId });
  Object.assign(e, { name: patch.name, campaignId: campaign?.campaign.id ?? e.campaignId, config: patch.config, updatedAt: now.toISOString() });
  s.touched.add(e.id);
  return e;
}

export function setElementStatus(now: Date, id: string, status: DonationElement["status"]) {
  const s = store(now);
  const e = s.elements.find((x) => x.id === id);
  if (!e) return null;
  e.status = status;
  e.updatedAt = now.toISOString();
  s.touched.add(e.id);
  return e;
}

export function duplicateElement(now: Date, id: string): DonationElement | null {
  const s = store(now);
  const e = s.elements.find((x) => x.id === id);
  if (!e) return null;
  const at = now.toISOString();
  const copy: DonationElement = { ...structuredClone(e), id: uid(), name: `${e.name} (copy)`, status: "paused", createdAt: at, updatedAt: at };
  s.elements.unshift(copy);
  s.days.set(copy.id, emptyDays(now));
  s.touched.add(copy.id);
  return copy;
}

export function deleteElement(now: Date, id: string) {
  const s = store(now);
  s.elements = s.elements.filter((e) => e.id !== id);
  s.days.delete(id);
  s.touched.delete(id);
}

/** A view or a checkout open reported by an element on a live page. */
export function trackElement(now: Date, id: string, kind: "view" | "open") {
  const s = store(now);
  if (!s.elements.some((e) => e.id === id)) return;
  const day = today(s, now, id);
  if (kind === "view") day.views += 1;
  else day.opens += 1;
}

/** Credit a gift made through an element's checkout. */
export function creditGift(now: Date, id: string, donationId: string, amountCents: number) {
  const s = store(now);
  if (!s.elements.some((e) => e.id === id)) return;
  s.credit.set(donationId, id);
  const day = today(s, now, id);
  day.gifts += 1;
  day.raisedCents += amountCents;
  day.opens = Math.max(day.opens, day.gifts);
  day.views = Math.max(day.views, day.opens);
}

function today(s: ElementStore, now: Date, id: string) {
  const key = now.toISOString().slice(0, 10);
  let days = s.days.get(id);
  if (!days) s.days.set(id, (days = emptyDays(now)));
  let d = days.find((x) => x.date === key);
  if (!d) {
    d = { date: key, views: 0, opens: 0, gifts: 0, raisedCents: 0 };
    days.push(d);
    if (days.length > WINDOW) days.shift();
  }
  return d;
}

/* ------------------------------- seed ------------------------------- */

interface Spec {
  type: DonationElementType;
  name: string;
  /** Daily views at a mid-size client, and the share that open checkout. */
  views: number;
  openRate: number;
  /** Relative share of the campaign's credited gifts. */
  weight: number;
  status?: DonationElement["status"];
  tweak?: (c: DonationElementConfig, campaign: Campaign) => Partial<DonationElementConfig>;
}

const specs: Spec[] = [
  { type: "donation_form", name: "Homepage donation form", views: 210, openRate: 0.34, weight: 34 },
  { type: "donate_button", name: "Header donate button", views: 640, openRate: 0.045, weight: 18 },
  { type: "popup", name: "Year-end appeal popup", views: 380, openRate: 0.07, weight: 12, tweak: () => ({ trigger: "exit" }) },
  { type: "sticky_button", name: "Sticky donate button", views: 900, openRate: 0.022, weight: 9 },
  { type: "image_card", name: "Featured project card", views: 260, openRate: 0.06, weight: 8 },
  { type: "donation_levels", name: "Giving levels", views: 150, openRate: 0.09, weight: 7 },
  { type: "goal_meter", name: "Campaign goal meter", views: 520, openRate: 0, weight: 0, tweak: (_c, cp) => ({ deadline: deadlineFor(cp) }) },
  { type: "social_proof", name: "Recent gift toasts", views: 700, openRate: 0.012, weight: 4 },
  { type: "message_bar", name: "Match week bar", views: 820, openRate: 0.018, weight: 5, status: "paused" },
  { type: "recent_donations", name: "Recent gifts list", views: 180, openRate: 0, weight: 0 },
  { type: "button_group", name: "Quick amounts", views: 120, openRate: 0.08, weight: 3 },
  { type: "impact_slider", name: "Impact slider", views: 90, openRate: 0.1, weight: 2, status: "paused" },
  { type: "stat_counter", name: "Raised counter", views: 300, openRate: 0, weight: 0 },
];

function deadlineFor(cp: Campaign) {
  // Seeded campaigns run to the end of the year.
  const y = new Date(cp.createdAt).getUTCFullYear();
  return `${y}-12-31`;
}

function seed(now: Date, s: ElementStore) {
  const clients = fundraisingClients(now);
  clients.forEach((client, ci) => {
    const data = accountFundraising(now, client);
    const campaign = data.campaigns.find((c) => c.status === "live") ?? data.campaigns[0];
    if (!campaign) return;
    const r = rng(hash(client.account.id));
    // Bigger clients carry the full set; smaller ones a handful.
    const take = ci < 3 ? specs.length : 5 + Math.floor(r() * 4);
    const mine = specs.slice(0, take);
    const scale = 0.5 + r() * 1.1;
    const created = new Date(now.getTime() - (40 + Math.floor(r() * 120)) * DAY).toISOString();

    const els = mine.map((spec, i) => {
      const cfg = defaultConfig(spec.type, campaign);
      const e: DonationElement = {
        id: `el-${client.account.id}-${spec.type}`,
        accountId: client.account.id,
        campaignId: campaign.id,
        type: spec.type,
        name: spec.name,
        status: spec.status ?? "live",
        config: { ...cfg, accent: accentFor(client.account.id), imageUrl: cfg.imageUrl ? stockImages[(ci + i) % stockImages.length].url : undefined, ...(spec.tweak?.(cfg, campaign) ?? {}) },
        createdAt: created,
        updatedAt: new Date(now.getTime() - Math.floor(r() * 20 + 1) * DAY - Math.floor(r() * 20) * 3600_000).toISOString(),
      };
      s.elements.push(e);
      s.days.set(e.id, emptyDays(now));
      return { e, spec };
    });

    // Credit a share of the last 30 days of gifts on every campaign of this client.
    const givers = els.filter((x) => x.spec.weight > 0 && x.e.status === "live");
    const total = givers.reduce((a, x) => a + x.spec.weight, 0);
    const from = now.getTime() - WINDOW * DAY;
    for (const d of data.donations) {
      if (d.status !== "succeeded" || Date.parse(d.createdAt) < from) continue;
      if (r() > 0.8 || total === 0) continue;
      let pick = r() * total;
      const hit = givers.find((x) => (pick -= x.spec.weight) < 0) ?? givers[0];
      s.credit.set(d.id, hit.e.id);
      const day = s.days.get(hit.e.id)!.find((x) => x.date === d.createdAt.slice(0, 10));
      if (day) {
        day.gifts += 1;
        day.raisedCents += d.amountCents;
      }
    }

    // Views and opens around the credited gifts, with a weekly rhythm: a
    // giving element converts a share of its opens, so opens follow gifts.
    for (const { e, spec } of els) {
      const days = s.days.get(e.id)!;
      const gifts = days.reduce((a, d) => a + d.gifts, 0);
      const conv = spec.type === "donation_form" ? 0.24 : 0.14 + r() * 0.08;
      const opensTotal = spec.openRate > 0 ? Math.max(gifts, Math.round((gifts || 1) / conv)) : 0;
      const viewsTotal = spec.openRate > 0 ? Math.round(opensTotal / spec.openRate) : Math.round(spec.views * scale * 0.4 * WINDOW);
      const weights = days.map((day, i) => {
        if (e.status === "paused" && i > 12) return 0;
        const dow = new Date(day.date).getUTCDay();
        return (dow === 0 || dow === 6 ? 0.72 : 1.06) * (0.75 + r() * 0.5);
      });
      const wsum = weights.reduce((a, w) => a + w, 0) || 1;
      // Cumulative rounding keeps the daily counts adding up to the totals.
      let accO = 0;
      let accV = 0;
      let cum = 0;
      days.forEach((day, i) => {
        cum += weights[i] / wsum;
        const o = Math.round(opensTotal * cum) - accO;
        const v = Math.round(viewsTotal * cum) - accV;
        accO += o;
        accV += v;
        day.opens = Math.max(day.gifts, o);
        day.views = Math.max(day.opens, v);
      });
    }
  });
}

function accentFor(accountId: string) {
  const palette = ["#e0245e", "#0e7c86", "#d1492e", "#2f6fed", "#1f8a4c", "#4b3fd8"];
  return palette[hash(accountId) % palette.length];
}

/** Used by the public pages to find an element's campaign by slug when one is passed. */
export function campaignBySlug(now: Date, slug: string) {
  return findCampaign(now, slug);
}
