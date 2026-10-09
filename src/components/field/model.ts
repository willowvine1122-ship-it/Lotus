import type { Technician } from "@/lib/types";

/* Plain shapes the field screens pass from server to client. */

export interface FieldClientRef {
  id: string;
  name: string;
  slug: string;
  industry: string;
  timeZone: string;
  /** The client's own date and wall-clock time right now. */
  today: string;
  nowStamp: string;
  taxRateBps: number;
}

export interface CustomerRef {
  id: string;
  accountId: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
}

export type Crew = Record<string, Technician>;

export function crewFor(crew: Crew, ids: string[]) {
  return ids.map((id) => crew[id]).filter((t): t is Technician => !!t);
}
