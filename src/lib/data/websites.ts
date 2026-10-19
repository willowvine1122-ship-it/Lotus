import { stamp } from "@/lib/ids";
import { resolve4, resolveCname } from "node:dns/promises";
import { randomBytes } from "node:crypto";
import type { BuilderDoc, BuilderTheme, DomainStatus, Website, WebsiteDay, WebsitePage } from "@/lib/types";
import { SITES_CNAME, siteTemplates } from "@/components/websites/model";
import { slugify } from "@/components/forms/model";
import { defineModule } from "@/lib/server/workspace";
import { listClients } from "./store";

/*
 * Websites: multi-page sites per client with a header, navigation, footer,
 * SEO and an optional custom domain. Saved per agency in the "websites"
 * module; a site answers publicly at /s/<slug> and, once connected, on its
 * own domain.
 *
 * What is real: the public pages at /s/<slug>, the sitemap and robots.txt,
 * leads from contact forms, page-view counts, and the DNS lookup that checks
 * a custom domain. Serving the site on that domain switches on when the app
 * is deployed with LOTUS_APP_HOSTS (see src/proxy.ts).
 */

interface SiteStore {
  sites: Website[];
}

const DAY = 86400000;

const sitesModule = defineModule<SiteStore>({
  key: "websites",
  init: () => ({ sites: [] }),
  publicKeys: (s) => s.sites.flatMap((x) => [`site:${x.slug}`, `site-id:${x.id}`, ...(x.domain?.host ? [`host:${x.domain.host}`] : [])]),
});

function store(_now: Date): SiteStore {
  return sitesModule.get();
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
    id: `new-site-${stamp()}-${randomBytes(3).toString("hex")}`,
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

export type WebsitePatch = Pick<Website, "name" | "slug" | "brandColor" | "logoText" | "logoImage" | "favicon" | "header" | "footer" | "seo" | "analytics" | "pages">;

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
