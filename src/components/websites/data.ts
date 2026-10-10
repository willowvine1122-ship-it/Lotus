import type { Website } from "@/lib/types";
import { listClients } from "@/lib/data/store";
import { windowStats, type ClientRef } from "./model";

/* Server-side loaders for the websites board. */

export function websiteClients(now: Date): ClientRef[] {
  return listClients(now)
    .map((c) => ({ id: c.account.id, name: c.account.name, slug: c.account.slug, mode: c.mode }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface BoardSite {
  site: Pick<Website, "id" | "accountId" | "name" | "slug" | "status" | "domain" | "updatedAt" | "brandColor">;
  pages: { id: string; title: string; path: string; inNav: boolean; views: number }[];
  views7: number;
  viewsPrev7: number;
  leads7: number;
  views30: number;
  leads30: number;
  daily: number[];
}

export function boardSite(s: Website): BoardSite {
  const w7 = windowStats(s.days, 7);
  const w30 = windowStats(s.days, 30);
  return {
    site: { id: s.id, accountId: s.accountId, name: s.name, slug: s.slug, status: s.status, domain: s.domain, updatedAt: s.updatedAt, brandColor: s.brandColor },
    pages: s.pages.map((p) => ({ id: p.id, title: p.title, path: p.path, inNav: p.inNav, views: s.pageViews[p.id] ?? 0 })),
    views7: w7.views,
    viewsPrev7: w7.prevViews,
    leads7: w7.leads,
    views30: w30.views,
    leads30: w30.leads,
    daily: s.days.slice(-30).map((d) => d.views),
  };
}
