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
  const p = getPipeline(now, contact.accountId);
  const name = p?.stages.find((s) => s.id === contact.stageId)?.name ?? contact.stageId;
  fireTrigger(now, { type: "stage_changed", contactId: contact.id, stageId: contact.stageId, pipelineId: p?.id, label: `Moved to ${name}` });
}

/* --------------------------- opportunities --------------------------- */

import type { Opportunity } from "@/lib/types";
import { findPipeline, type StageMove } from "./opportunities";

export function opportunityCreated(now: Date, o: Opportunity) {
  const p = findPipeline(now, o.pipelineId);
  fireTrigger(now, { type: "opportunity_created", contactId: o.contactId, pipelineId: o.pipelineId, stageId: o.stageId, opportunityId: o.id, label: `Opportunity “${o.name}” created${p ? ` in ${p.name}` : ""}` });
}

/**
 * A stage move or a status change on an opportunity. A move in the primary
 * pipeline also moves the contact; it still fires stage_changed once, here,
 * and the caller does not call stageChanged for the contact as well.
 */
export function opportunityChanged(now: Date, move: StageMove | undefined) {
  if (!move) return;
  const o = move.opportunity;
  const p = findPipeline(now, o.pipelineId);
  if (o.stageId !== move.fromStageId) {
    const stage = p?.stages.find((s) => s.id === o.stageId);
    fireTrigger(now, { type: "stage_changed", contactId: o.contactId, pipelineId: o.pipelineId, stageId: o.stageId, opportunityId: o.id, label: `Moved to ${stage?.name ?? "a stage"}${p && !p.primary ? ` in ${p.name}` : ""}` });
  }
  if (o.status !== move.fromStatus) {
    const word = o.status === "open" ? "Reopened" : `Marked ${o.status}`;
    fireTrigger(now, { type: "opportunity_status_changed", contactId: o.contactId, pipelineId: o.pipelineId, status: o.status, opportunityId: o.id, label: `${word}: ${o.name}` });
  }
}

/* ------------------- events from the other modules ------------------- */

import type { Channel, Contact as CrmContact } from "@/lib/types";
import { formatDollars } from "@/lib/utils";
import { autoReviewRequest } from "./reputation-send";

/** A visitor booked through a booking page. The contact may be new. */
export function appointmentBooked(now: Date, contactId: string, typeName: string) {
  fireTrigger(now, { type: "appointment_booked", contactId, label: `Booked ${typeName}` });
}

/** The agency marked an appointment showed or no-show; a show may ask for a review. */
export function appointmentOutcome(now: Date, accountId: string, contactId: string, outcome: "showed" | "no_show", typeName: string) {
  if (outcome === "no_show") fireTrigger(now, { type: "appointment_no_show", contactId, label: `Missed ${typeName}` });
  else autoReviewRequest(now, accountId, contactId, "appointment");
}

/** A gift was recorded. Fires the trigger and, when switched on, a review request. */
export function donationReceived(now: Date, accountId: string, contactId: string, amountCents: number, campaignTitle: string) {
  fireTrigger(now, { type: "donation_received", contactId, amountCents, label: `Gift of ${formatDollars(amountCents)} to ${campaignTitle}` });
  autoReviewRequest(now, accountId, contactId, "donation");
}

/** A contact wrote in on a channel (inbound message on a conversation). */
export function messageReceived(now: Date, contactId: string, channel: Channel, preview: string) {
  fireTrigger(now, { type: "message_received", contactId, channel, label: `Wrote in by ${channel === "sms" ? "text" : channel}: ${preview.slice(0, 60)}` });
}

/** A funnel or website form was filled in. */
export function formSubmitted(now: Date, contact: CrmContact, formName: string, isNew: boolean, formId?: string) {
  if (isNew) contactCreated(now, contact);
  fireTrigger(now, { type: "form_submitted", contactId: contact.id, source: contact.source, formId, label: `Filled in ${formName}` });
}

/** A job was marked completed. Fires the trigger and, when switched on, a review request. */
export function jobCompleted(now: Date, accountId: string, contactId: string, jobNumber: string) {
  fireTrigger(now, { type: "job_completed", contactId, label: `Job ${jobNumber} completed` });
  autoReviewRequest(now, accountId, contactId, "job");
}

/* ------------------------- integrations ------------------------- */

/** Something posted to one of the client's incoming webhooks. */
export function webhookReceived(now: Date, contactId: string, hookId: string, label: string) {
  return fireTrigger(now, { type: "webhook_received", contactId, hookId, label });
}

/** A connected app sent an event ("meta_lead_ads.new_lead"). */
export function appEventReceived(now: Date, contactId: string, appEvent: string, label: string) {
  return fireTrigger(now, { type: "app_event", contactId, appEvent, label });
}
