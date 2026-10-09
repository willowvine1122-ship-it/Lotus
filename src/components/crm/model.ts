import type { AccountMode, Assignee, Contact, ContactSource, Pipeline, PipelineStage } from "@/lib/types";

/* Shared, framework-free helpers for the CRM screens. */

export interface ClientRef {
  id: string;
  name: string;
  slug: string;
  mode: AccountMode;
}

export const sourceLabel: Record<ContactSource, string> = {
  meta: "Meta ads",
  google: "Google ads",
  website: "Website",
  referral: "Referral",
  "donation-page": "Donation page",
  import: "Import",
  manual: "Added by hand",
};

export function fullName(c: Pick<Contact, "firstName" | "lastName">) {
  return `${c.firstName} ${c.lastName}`.trim();
}

export function stageOf(p: Pipeline | undefined, id: string): PipelineStage {
  return p?.stages.find((s) => s.id === id) ?? { id, name: id };
}

export function stageIndex(p: Pipeline | undefined, id: string) {
  const i = p?.stages.findIndex((s) => s.id === id) ?? -1;
  return i < 0 ? 99 : i;
}

export function isOpen(p: Pipeline | undefined, c: Contact) {
  return !stageOf(p, c.stageId).outcome;
}

export function personFor(team: Assignee[], name?: string): Assignee | null {
  if (!name) return null;
  return (
    team.find((t) => t.name === name) ?? {
      name,
      initials: name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join(""),
      tone: "ink",
    }
  );
}

export function daysBetween(aIso: string, now: Date) {
  return Math.floor((now.getTime() - new Date(aIso).getTime()) / 86400000);
}
