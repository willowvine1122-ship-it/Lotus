import "server-only";
import { lotusEmailHtml } from "./email-layout";
import { headers } from "next/headers";
import { db } from "./db";
import { newToken, normalEmail, sha256, type Session } from "./auth";
import { mailerLive, sendMail } from "./mailer";

/* One invite: a single-use link, emailed when email is connected, otherwise handed back to share by hand. */

export const INVITE_DAYS = 7;

export async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
}

export async function issueInvite(
  s: Pick<Session, "user"> & { agency: NonNullable<Session["agency"]> },
  input: { email: string; name?: string; role: "admin" | "member" | "client"; accountIds: string[]; clientName?: string },
): Promise<{ link: string; message: string }> {
  const addr = normalEmail(input.email);
  const token = newToken();
  await db("invite.create", {
    token_hash: sha256(token),
    agency: s.agency.id,
    email: addr,
    name: input.name ?? "",
    role: input.role,
    account_ids: input.role === "client" ? input.accountIds : [],
    invited_by: s.user.id,
    expires_at: new Date(Date.now() + INVITE_DAYS * 86400000).toISOString(),
  });
  const home = await origin();
  const link = `${home}/invite/${token}`;
  if (!mailerLive()) return { link, message: "Invite created. Email isn't connected yet, so copy the link and send it yourself." };
  const what = input.role === "client" ? `the ${input.clientName ?? "client"} dashboard` : `the ${s.agency.name} team`;
  const mail = await sendMail({
    to: addr,
    subject: `${s.user.name} invited you to ${s.agency.name} on Lotus`,
    text: `${s.user.name} invited you to ${what} on Lotus.\n\nAccept the invite: ${link}\n\nThe link works for ${INVITE_DAYS} days.`,
    html: lotusEmailHtml({
      origin: home,
      text: `${s.user.name} invited you to ${what} on Lotus.`,
      action: { label: "Accept the invite", url: link },
      note: `The link works for ${INVITE_DAYS} days.`,
    }),
    replyTo: s.user.email,
  });
  return mail.sent ? { link, message: `Invite emailed to ${addr}` } : { link, message: `Invite created, but the email didn't go out (${mail.error}). Copy the link and send it yourself.` };
}
