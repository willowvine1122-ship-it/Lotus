import { listCalendars } from "@/lib/data/calendars";
import { listForms } from "@/lib/data/forms";
import type { RenderRefs } from "./render";

/* Server-side: the client's forms and calendars that builder elements can embed. */

export function builderRefs(now: Date, accountId: string, nextHref?: string): RenderRefs {
  return {
    nextHref,
    forms: listForms(now, accountId).map((f) => ({ id: f.id, slug: f.slug, name: f.name, live: f.status === "live" })),
    calendars: listCalendars(now)
      .filter((c) => c.accountId === accountId)
      .map((c) => ({ slug: c.slug, name: c.name })),
  };
}
