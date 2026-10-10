import { listCalendars } from "@/lib/data/calendars";
import { listForms } from "@/lib/data/forms";
import { elementOptions } from "@/components/elements/block";
import { isOverlay } from "@/lib/elements";
import type { RenderRefs } from "./render";

/* Server-side: the client's forms, calendars and donation elements that builder elements can embed. */

export function builderRefs(now: Date, accountId: string, nextHref?: string): RenderRefs {
  return {
    nextHref,
    forms: listForms(now, accountId).map((f) => ({ id: f.id, slug: f.slug, name: f.name, live: f.status === "live" })),
    calendars: listCalendars(now)
      .filter((c) => c.accountId === accountId)
      .map((c) => ({ slug: c.slug, name: c.name })),
    elements: elementOptions(now, accountId).map((e) => ({ id: e.id, name: e.name, typeLabel: e.typeLabel, live: e.status === "live", overlay: isOverlay(e.type) })),
  };
}
