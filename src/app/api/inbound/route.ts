import { NextResponse } from "next/server";
import { z } from "zod";
import { receiveMessage } from "@/lib/data/inbox";
import { apiKeyAddress, authenticate } from "@/lib/data/integrations";
import { listContacts } from "@/lib/data/store";
import { withPublicWorkspace } from "@/lib/server/workspace";

/*
 * Inbound messages in Lotus's own shape, for a bridge such as Zapier or a
 * provider relay. Authenticate with the client's API key
 * (Authorization: Bearer lts_…); the sender is matched to one of that
 * client's contacts. Native Twilio, Resend and Meta webhooks have their own
 * signed endpoints.
 */

const schema = z.object({
  channel: z.enum(["sms", "email", "whatsapp", "facebook"]),
  /** Phone (sms, whatsapp), email, or a contact id. */
  from: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
});

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const address = apiKeyAddress(auth);
  const unauthorized = NextResponse.json({ ok: false, error: "Send a valid API key as “Authorization: Bearer lts_…”." }, { status: 401 });
  if (!address) return unauthorized;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "channel, from and body are required" }, { status: 400 });
  const res = await withPublicWorkspace(address, () => {
    const now = new Date();
    const key = authenticate(now, auth);
    if (!key) return unauthorized;
    const { channel, from, subject, body } = parsed.data;
    const digits = from.replace(/\D/g, "");
    const contact = listContacts(now, key.accountId).find((c) => c.id === from || (c.email && c.email.toLowerCase() === from.toLowerCase()) || (digits.length >= 7 && c.phone && c.phone.replace(/\D/g, "").endsWith(digits.slice(-10))));
    if (!contact) return NextResponse.json({ ok: false, error: "No contact matches that sender" }, { status: 404 });
    const conv = receiveMessage(now, { contactId: contact.id, channel, subject, body });
    return NextResponse.json({ ok: true, conversationId: conv?.id, contactId: contact.id });
  });
  return res ?? unauthorized;
}
