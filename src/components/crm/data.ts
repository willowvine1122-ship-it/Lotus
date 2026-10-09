import { getPipeline, listActivities, listClients, listContacts, teamDirectory } from "@/lib/data/store";
import type { Pipeline } from "@/lib/types";
import type { ClientRef } from "./model";

/* Server-side loaders shared by the CRM pages. */

export function crmClients(now: Date): ClientRef[] {
  return listClients(now)
    .map((c) => ({ id: c.account.id, name: c.account.name, slug: c.account.slug, mode: c.mode }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function crmPipelines(now: Date, clients: ClientRef[]): Record<string, Pipeline> {
  const out: Record<string, Pipeline> = {};
  for (const c of clients) {
    const p = getPipeline(now, c.id);
    if (p) out[c.id] = p;
  }
  return out;
}

export function crmActivities(now: Date, contactIds: string[]) {
  return contactIds.flatMap((id) => listActivities(now, id));
}

export { listContacts, teamDirectory };
