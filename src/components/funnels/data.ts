import { listClients, listFunnels, listSubmissions } from "@/lib/data/store";
import type { ClientRef } from "./model";

/* Server-side loaders shared by the funnels pages. */

export function funnelClients(now: Date): ClientRef[] {
  return listClients(now)
    .map((c) => ({ id: c.account.id, name: c.account.name, slug: c.account.slug, mode: c.mode }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export { listFunnels, listSubmissions };
