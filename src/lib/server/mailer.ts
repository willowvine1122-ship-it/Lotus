import "server-only";

/*
 * Transactional email through Resend. Needs RESEND_API_KEY and
 * LOTUS_EMAIL_FROM (an address on a domain verified in Resend, e.g.
 * "Lotus <team@mail.youragency.com>"). Without them nothing is sent and the
 * caller shows the link to share by hand instead.
 */

export function mailerLive() {
  return Boolean(process.env.RESEND_API_KEY && process.env.LOTUS_EMAIL_FROM);
}

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /** Shown as the sender's name, e.g. the client's business; the address stays Lotus's verified one. */
  fromName?: string;
}

/** LOTUS_EMAIL_FROM with its display name swapped, keeping the verified address. */
function fromWith(name: string | undefined) {
  const from = process.env.LOTUS_EMAIL_FROM!;
  if (!name) return from;
  const address = from.match(/<([^>]+)>/)?.[1] ?? from.trim();
  return `${name.replace(/["<>\r\n]/g, "").trim()} <${address}>`;
}

export async function sendMail(input: OutgoingMail): Promise<{ sent: boolean; error?: string }> {
  if (!mailerLive()) return { sent: false, error: "Email is not connected." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: fromWith(input.fromName), to: [input.to], subject: input.subject, text: input.text, html: input.html, reply_to: input.replyTo }),
    });
    if (res.ok) return { sent: true };
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return { sent: false, error: body?.message ?? `Resend answered ${res.status}.` };
  } catch {
    return { sent: false, error: "Couldn't reach Resend." };
  }
}
