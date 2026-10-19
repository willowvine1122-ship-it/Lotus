import type { Appointment, AppointmentType, Calendar, Contact } from "@/lib/types";
import { locationLabel } from "@/lib/calendars";
import { queueMail, workspaceMembers } from "@/lib/server/workspace";
import { findClient } from "./store";

/*
 * The emails Lotus sends on its own when something happens: a lead booked
 * or filled in a form, so the agency hears about it, and the lead gets a
 * confirmation. They go out through the workspace outbox once the change
 * is saved, and only when email is connected.
 */

/** Owners and admins hear about new leads; members and client logins don't get every alert. */
function alertRecipients() {
  return workspaceMembers().filter((m) => m.role === "owner" || m.role === "admin");
}

function replyToStaff() {
  return alertRecipients().find((m) => m.role === "owner")?.email ?? alertRecipients()[0]?.email;
}

function alertStaff(subject: string, text: string) {
  for (const m of alertRecipients()) queueMail({ to: m.email, subject, text, fromName: "Lotus" });
}

function lines(rows: [string, string | undefined][]) {
  return rows
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

export function bookingEmails(now: Date, cal: Calendar, type: AppointmentType, a: Appointment) {
  const business = findClient(now, cal.accountId)?.account.name ?? cal.name;
  const when = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: cal.timeZone, timeZoneName: "short" }).format(new Date(a.startsAt));
  const where = [locationLabel[type.location], type.locationDetail].filter(Boolean).join(", ");
  const first = a.contact.name.split(/\s+/)[0] ?? a.contact.name;
  if (a.contact.email) {
    queueMail({
      to: a.contact.email,
      fromName: business,
      replyTo: replyToStaff(),
      subject: `You're booked: ${type.name} on ${when}`,
      text: `Hi ${first},\n\nYou're booked for ${type.name} with ${business}.\n\n${lines([
        ["When", when],
        ["How long", `${type.durationMinutes} minutes`],
        ["Where", where],
      ])}\n\nNeed to change it? Just reply to this email.\n\n${business}`,
    });
  }
  alertStaff(
    `New booking: ${a.contact.name}, ${type.name} for ${business}`,
    `${a.contact.name} booked ${type.name} on ${cal.name}.\n\n${lines([
      ["When", when],
      ["Email", a.contact.email],
      ["Phone", a.contact.phone],
      ["Notes", a.notes],
    ])}\n\nOpen the calendar: {{app}}/agency/calendars`,
  );
}

export function formAlert(now: Date, contact: Contact, formName: string, isNew: boolean) {
  const business = findClient(now, contact.accountId)?.account.name ?? "a client";
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email || "Someone";
  alertStaff(
    `${isNew ? "New lead" : "Form filled in"}: ${name} for ${business}`,
    `${name} filled in ${formName}${isNew ? " and was added to your contacts" : ""}.\n\n${lines([
      ["Email", contact.email],
      ["Phone", contact.phone],
      ["Client", business],
    ])}\n\nOpen the contact: {{app}}/agency/contacts/${contact.id}`,
  );
}

/** A message typed in the inbox or sent by a workflow, to the contact's email. */
export function messageEmail(now: Date, contact: Contact, subject: string | undefined, body: string) {
  if (!contact.email || contact.doNotContact.email) return;
  const business = findClient(now, contact.accountId)?.account.name;
  queueMail({ to: contact.email, subject: subject?.trim() || `A message from ${business ?? "us"}`, text: body, fromName: business, replyTo: replyToStaff() });
}
