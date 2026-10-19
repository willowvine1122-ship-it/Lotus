import type { ClientRecord } from "@/lib/types";
import { findClient, listClients } from "./store";

/* Client records with their daily history, for the Daily Diagnostic and the client pages. */

export async function getClientRecords(now: Date): Promise<ClientRecord[]> {
  return listClients(now);
}

export async function getClientRecord(now: Date, idOrSlug: string): Promise<ClientRecord | null> {
  return findClient(now, idOrSlug) ?? null;
}
