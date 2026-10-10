import { NextResponse } from "next/server";
import { z } from "zod";
import { receiveMessage } from "@/lib/data/inbox";
import { listContacts } from "@/lib/data/store";

/*
 * Inbound messages. Providers (Twilio for SMS and WhatsApp, Resend for email,
 * Meta for Facebook) post here; in demo mode the same shape can be posted by
 * hand to exercise the inbox and the "message received" trigger. Provider
 * signature checks arrive with the provider keys.
 */

const schema = z.object({
  channel: z.enum(["sms", "email", "whatsapp", "facebook"]),
  /** Phone (sms, whatsapp), email, or a contact id. */
  from: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "channel, from and body are required" }, { status: 400 });
  const now = new Date();
  const { channel, from, subject, body } = parsed.data;
  const digits = from.replace(/\D/g, "");
  const contact = listContacts(now).find((c) => c.id === from || (c.email && c.email.toLowerCase() === from.toLowerCase()) || (digits.length >= 7 && c.phone && c.phone.replace(/\D/g, "").endsWith(digits.slice(-10))));
  if (!contact) return NextResponse.json({ ok: false, error: "No contact matches that sender" }, { status: 404 });
  const conv = receiveMessage(now, { contactId: contact.id, channel, subject, body });
  return NextResponse.json({ ok: true, conversationId: conv?.id, contactId: contact.id });
}
