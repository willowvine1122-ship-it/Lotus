import { resolve4, resolveCname } from "node:dns/promises";
import { randomBytes } from "node:crypto";
import type { BuilderDoc, BuilderTheme, DomainStatus, Website, WebsiteDay, WebsitePage } from "@/lib/types";
import { SITES_CNAME, siteTemplates } from "@/components/websites/model";
import { slugify } from "@/components/forms/model";
import { listClients } from "./store";

/*
 * Websites: multi-page sites per client with a header, navigation, footer,
 * SEO and an optional custom domain. Demo store on globalThis, seeded once
 * per day; sites made or edited by hand survive the reseed. Seeded sites keep
 * fixed ids and slugs so links stay valid.
 *
 * What is real: the public pages at /s/<slug>, the sitemap and robots.txt,
 * leads from contact forms, page-view counts, and the DNS lookup that checks
 * a custom domain. Serving the site on that domain switches on when the app
 * is deployed with LOTUS_APP_HOSTS (see src/proxy.ts).
 */

interface SiteStore {
  seededFor: string;
  sites: Website[];
}

const g = globalThis as unknown as { __lotusSites?: SiteStore };
const DAY = 86400000;

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

function store(now: Date): SiteStore {
  const key = now.toISOString().slice(0, 10);
  if (!g.__lotusSites || g.__lotusSites.seededFor !== key) {
    const prev = g.__lotusSites;
    const s: SiteStore = { seededFor: key, sites: [] };
    seed(now, s);
    for (const site of prev?.sites ?? []) {
      if (site.id.startsWith("new-")) s.sites.push(site);
      else {
        const i = s.sites.findIndex((x) => x.id === site.id);
        if (i !== -1 && site.updatedAt > s.sites[i]!.updatedAt) s.sites[i] = { ...site, days: s.sites[i]!.days };
      }
    }
    g.__lotusSites = s;
  }
  return g.__lotusSites;
}

const today = (now: Date) => now.toISOString().slice(0, 10);

function emptyDays(now: Date): WebsiteDay[] {
  return Array.from({ length: 60 }, (_, i) => ({ day: new Date(now.getTime() - (59 - i) * DAY).toISOString().slice(0, 10), views: 0, leads: 0 }));
}

/** Roll the day series forward so the last entry is today. */
function rollDays(now: Date, site: Website) {
  const t = today(now);
  if (site.days.at(-1)?.day === t) return;
  const last = site.days.at(-1)?.day;
  const start = last ? Date.parse(last) + DAY : now.getTime() - 59 * DAY;
  for (let d = start; d <= Date.parse(t); d += DAY) site.days.push({ day: new Date(d).toISOString().slice(0, 10), views: 0, leads: 0 });
  site.days = site.days.slice(-60);
}

/* -------------------------------- read -------------------------------- */

export function listWebsites(now: Date, accountId?: string) {
  const all = store(now).sites;
  return accountId ? all.filter((s) => s.accountId === accountId) : all;
}

export function findWebsite(now: Date, id: string) {
  return store(now).sites.find((s) => s.id === id);
}

export function findWebsiteBySlug(now: Date, slug: string) {
  return store(now).sites.find((s) => s.slug === slug);
}

export function findWebsiteByHost(now: Date, host: string) {
  const h = host.toLowerCase().replace(/:\d+$/, "");
  return store(now).sites.find((s) => s.domain?.status === "connected" && s.domain.host === h);
}

export function findPage(site: Website, segments: string[] = []): WebsitePage | undefined {
  const path = segments.map((s) => decodeURIComponent(s)).join("/");
  return site.pages.find((p) => p.path === path);
}

/* -------------------------------- write ------------------------------- */

function uniqueSlug(now: Date, base: string, exceptId?: string) {
  const taken = new Set(store(now).sites.filter((s) => s.id !== exceptId).map((s) => s.slug));
  let slug = slugify(base);
  for (let n = 2; taken.has(slug); n++) slug = `${slugify(base).slice(0, 44)}-${n}`;
  return slug;
}

export function createWebsite(now: Date, accountId: string, name: string, templateKey: string): Website | undefined {
  const client = listClients(now).find((c) => c.account.id === accountId);
  const t = siteTemplates.find((x) => x.key === templateKey) ?? siteTemplates.find((x) => x.key === "blank")!;
  if (!client) return undefined;
  const at = now.toISOString();
  const site: Website = {
    id: `new-site-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`,
    accountId,
    name: name.trim(),
    slug: uniqueSlug(now, client.account.slug),
    status: "draft",
    template: t.key,
    logoText: client.account.name,
    analytics: {},
    ...t.build({ name: client.account.name, city: undefined }),
    days: emptyDays(now),
    pageViews: {},
    createdAt: at,
    updatedAt: at,
  };
  store(now).sites.push(site);
  return site;
}

export type WebsitePatch = Pick<Website, "name" | "slug" | "brandColor" | "logoText" | "header" | "footer" | "seo" | "analytics" | "pages">;

export function saveWebsite(now: Date, id: string, patch: WebsitePatch): { site?: Website; slugTaken?: boolean } {
  const site = findWebsite(now, id);
  if (!site) return {};
  const slug = slugify(patch.slug);
  if (store(now).sites.some((s) => s.id !== id && s.slug === slug)) return { slugTaken: true };
  // The settings editor does not carry builder pages, so keep each page's design.
  const pages = patch.pages.map((p) => {
    const doc = site.pages.find((x) => x.id === p.id)?.doc;
    return doc ? { ...p, doc } : p;
  });
  Object.assign(site, { ...patch, pages, slug, updatedAt: now.toISOString() });
  return { site };
}

/** Save a page designed in the builder, and the site-wide theme with it. */
export function savePageDoc(now: Date, id: string, pageId: string, doc: BuilderDoc, theme: BuilderTheme): Website | undefined {
  const site = findWebsite(now, id);
  const page = site?.pages.find((p) => p.id === pageId);
  if (!site || !page) return undefined;
  page.doc = doc;
  site.theme = theme;
  site.updatedAt = now.toISOString();
  return site;
}

export function setWebsiteStatus(now: Date, id: string, status: Website["status"]) {
  const site = findWebsite(now, id);
  if (site) {
    site.status = status;
    site.updatedAt = now.toISOString();
  }
  return site;
}

export function deleteWebsite(now: Date, id: string) {
  const s = store(now);
  s.sites = s.sites.filter((x) => x.id !== id);
}

/* ------------------------------- traffic ------------------------------ */

export function recordView(now: Date, siteId: string, pageId: string) {
  const site = findWebsite(now, siteId);
  if (!site) return;
  rollDays(now, site);
  site.days.at(-1)!.views++;
  site.pageViews[pageId] = (site.pageViews[pageId] ?? 0) + 1;
}

export function recordLead(now: Date, siteId: string) {
  const site = findWebsite(now, siteId);
  if (!site) return;
  rollDays(now, site);
  site.days.at(-1)!.leads++;
}

/* ------------------------------- domains ------------------------------ */

export function setDomain(now: Date, id: string, host: string | null) {
  const site = findWebsite(now, id);
  if (!site) return undefined;
  if (host && store(now).sites.some((s) => s.id !== id && s.domain?.host === host)) return { taken: true as const };
  site.domain = host ? { host, status: "pending" } : undefined;
  site.updatedAt = now.toISOString();
  return { site };
}

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), ms))]);

/** Look the domain up in public DNS and record what it points to. */
export async function checkDomain(now: Date, id: string) {
  const site = findWebsite(now, id);
  if (!site?.domain) return undefined;
  const host = site.domain.host;
  let status: DomainStatus = "pending";
  let found: string;
  try {
    const cnames = await withTimeout(resolveCname(host), 5000);
    if (cnames.some((c) => c.replace(/\.$/, "").toLowerCase() === SITES_CNAME)) {
      status = "connected";
      found = `${host} points to ${SITES_CNAME}.`;
    } else {
      status = "failed";
      found = `${host} points to ${cnames.join(", ")}, not ${SITES_CNAME}.`;
    }
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENODATA") {
      const ips = await withTimeout(resolve4(host), 5000).catch(() => [] as string[]);
      status = "failed";
      found = ips.length ? `${host} has an A record (${ips.slice(0, 3).join(", ")}) instead of a CNAME to ${SITES_CNAME}.` : `${host} has no CNAME record yet.`;
    } else if (code === "ENOTFOUND") found = `No DNS record for ${host} yet. New records can take up to an hour to show.`;
    else found = "Couldn't reach DNS just now. Try again in a minute.";
  }
  site.domain = { host, status, found, checkedAt: now.toISOString() };
  return site.domain;
}

/* --------------------------------- seed -------------------------------- */

const cities = ["Denver", "Austin", "Portland", "Raleigh", "Phoenix", "Columbus", "Tampa", "Boise"];

function seed(now: Date, s: SiteStore) {
  for (const [ci, client] of listClients(now).entries()) {
    const rand = rng((ci + 3) * 2654435761);
    const key = client.mode === "fundraising" ? "nonprofit" : ci % 4 === 3 ? "onepage" : "local";
    const t = siteTemplates.find((x) => x.key === key)!;
    const built = t.build({ name: client.account.name, city: cities[ci % cities.length] });
    const id = `site-${client.account.id}`;
    // Fixed page and block ids so edits made yesterday still line up with today's seed.
    for (const [pi, p] of built.pages.entries()) {
      p.id = `${id}-p${pi + 1}`;
      for (const [bi, blk] of p.blocks.entries()) blk.id = `${p.id}-b${bi + 1}`;
    }
    const created = new Date(now.getTime() - (70 + ci * 3) * DAY).toISOString();
    const live = ci % 5 !== 4;
    const base = 40 + rand() * 160;
    const days: WebsiteDay[] = emptyDays(now).map((d, i) => {
      const dow = new Date(d.day).getUTCDay();
      const views = live ? Math.round(base * (dow === 0 || dow === 6 ? 0.7 : 1) * (0.8 + rand() * 0.4) * (0.85 + (i / 60) * 0.3)) : 0;
      return { ...d, views, leads: Math.round(views * (0.02 + rand() * 0.025)) };
    });
    const total30 = days.slice(-30).reduce((a, d) => a + d.views, 0);
    const weights = built.pages.map((_, i) => (i === 0 ? 5 : 1 + rand()));
    const sum = weights.reduce((a, b) => a + b, 0);
    const pageViews = Object.fromEntries(built.pages.map((p, i) => [p.id, Math.round((total30 * weights[i]!) / sum)]));
    const slug = client.account.slug;
    const domain =
      ci % 3 === 0 && live
        ? { host: `www.${slug.replace(/-/g, "")}.com`, status: "connected" as const, checkedAt: new Date(now.getTime() - 9 * DAY).toISOString(), found: `www.${slug.replace(/-/g, "")}.com points to ${SITES_CNAME}.` }
        : ci % 3 === 1 && live
          ? { host: `www.${slug.replace(/-/g, "")}.com`, status: "pending" as const }
          : undefined;
    s.sites.push({
      id,
      accountId: client.account.id,
      name: `${client.account.name} website`,
      slug,
      status: live ? "live" : "draft",
      template: key,
      logoText: client.account.name,
      analytics: ci % 2 === 0 ? { gaId: `G-${(1000000 + ci * 7919).toString(36).toUpperCase().slice(0, 8)}` } : {},
      ...built,
      domain,
      days,
      pageViews,
      createdAt: created,
      updatedAt: created,
    });
  }
}
