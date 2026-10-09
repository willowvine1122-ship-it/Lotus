import type { ReviewRequest, ReviewRequestChannel } from "@/lib/types";
import { fillTemplate } from "@/components/reputation/model";
import { startConversation } from "./inbox";
import { findClient, findContact, getReputationSettings, sendReviewRequest } from "./store";

/*
 * Review requests go out through the Inbox, so the text or email is a real
 * conversation on the contact and the request is recorded for the board.
 * Automatic requests are the same call with the triggering event.
 */

export type RequestOutcome = { ok: true; request: ReviewRequest } | { ok: false; reason: "no_contact" | "unreachable" | "off" };

export function deliverReviewRequest(
  now: Date,
  input: { accountId: string; contactId: string; channel?: ReviewRequestChannel; trigger: ReviewRequest["trigger"]; by: string },
): RequestOutcome {
  const settings = getReputationSettings(now, input.accountId);
  const contact = findContact(now, input.contactId);
  if (!settings || !contact || contact.accountId !== input.accountId) return { ok: false, reason: "no_contact" };
  const channel = input.channel ?? settings.channel;
  const reachable = channel === "sms" ? Boolean(contact.phone) && !contact.doNotContact.sms : Boolean(contact.email) && !contact.doNotContact.email;
  if (!reachable) return { ok: false, reason: "unreachable" };
  const link = settings.googleUrl ?? settings.facebookUrl ?? "";
  const body = `${fillTemplate(settings.message, contact.firstName, findClient(now, input.accountId)?.account.name ?? "us")}${link ? ` ${link}` : ""}`;
  const conv = startConversation(now, { contactId: contact.id, channel, subject: channel === "email" ? "Would you leave us a review?" : undefined, body, authorName: input.by });
  if (!conv) return { ok: false, reason: "no_contact" };
  const request = sendReviewRequest(now, input.accountId, contact.id, channel, input.by, { trigger: input.trigger, recordActivity: false });
  return request ? { ok: true, request } : { ok: false, reason: "no_contact" };
}

/** Called by the event wiring: sends only when the client has that event switched on. */
export function autoReviewRequest(now: Date, accountId: string, contactId: string, event: "job" | "appointment" | "donation"): RequestOutcome {
  const settings = getReputationSettings(now, accountId);
  if (!settings || !settings.autoAfter[event]) return { ok: false, reason: "off" };
  return deliverReviewRequest(now, { accountId, contactId, trigger: event, by: "Lotus" });
}
