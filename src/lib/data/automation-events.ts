import type { Contact } from "@/lib/types";
import { sourceLabel } from "@/components/crm/model";
import { fireTrigger } from "./automations";
import { getPipeline } from "./store";

/*
 * The CRM's side of automations: one call per thing that happened to a
 * contact. Other modules (inbox replies, bookings, donations) call
 * fireTrigger the same way when their events land.
 */

export function contactCreated(now: Date, c: Contact) {
  fireTrigger(now, { type: "contact_created", contactId: c.id, source: c.source, label: `Added, source: ${sourceLabel[c.source]}` });
  for (const tag of c.tags) fireTrigger(now, { type: "tag_added", contactId: c.id, tag, label: `Tag added: ${tag}` });
}

export function tagsChanged(now: Date, contactId: string, before: string[], after: string[]) {
  const had = new Set(before.map((t) => t.toLowerCase()));
  for (const tag of after) if (!had.has(tag.toLowerCase())) fireTrigger(now, { type: "tag_added", contactId, tag, label: `Tag added: ${tag}` });
}

export function stageChanged(now: Date, contact: Contact, fromStageId: string) {
  if (contact.stageId === fromStageId) return;
  const name = getPipeline(now, contact.accountId)?.stages.find((s) => s.id === contact.stageId)?.name ?? contact.stageId;
  fireTrigger(now, { type: "stage_changed", contactId: contact.id, stageId: contact.stageId, label: `Moved to ${name}` });
}
