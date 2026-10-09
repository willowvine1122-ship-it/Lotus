import { getReputationSettings, listClients, listContacts, listReviewRequests, listReviews } from "@/lib/data/store";
import type { ReputationSettings } from "@/lib/types";
import type { ClientRef } from "./model";

/* Server-side loaders shared by the reputation pages. */

export function reputationClients(now: Date): ClientRef[] {
  return listClients(now)
    .map((c) => ({ id: c.account.id, name: c.account.name, slug: c.account.slug, mode: c.mode }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function reputationSettingsFor(now: Date, clients: ClientRef[]): Record<string, ReputationSettings> {
  const out: Record<string, ReputationSettings> = {};
  for (const c of clients) {
    const s = getReputationSettings(now, c.id);
    if (s) out[c.id] = s;
  }
  return out;
}

export { listContacts, listReviewRequests, listReviews };
