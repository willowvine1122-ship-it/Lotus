"use server";

import { actorName, withWorkspace } from "@/lib/server/workspace";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assignConversation,
  findConversation,
  setConversationRead,
  setConversationStatus,
  sendMessage,
  startConversation,
} from "@/lib/data/inbox";
import { findContact, teamDirectory } from "@/lib/data/store";

/*
 * Server actions for the inbox. Inputs are validated with zod; the composer
 * actions return { ok, errors } for useActionState. Messages are signed
 * with the name of whoever is signed in.
 */


export type InboxActionState = { ok: boolean; errors?: Record<string, string>; message?: string; conversationId?: string; at?: number } | null;

const channel = z.enum(["sms", "email", "whatsapp", "facebook"]);

const SMS_MAX = 1600;

const replySchema = z
  .object({
    conversationId: z.string().min(1),
    kind: z.enum(["message", "note"]),
    channel,
    subject: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1, "Write a message first").max(5000, "Keep it under 5,000 characters"),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "message" && v.channel === "email" && !v.subject) ctx.addIssue({ code: "custom", path: ["subject"], message: "Add a subject" });
    if (v.kind === "message" && v.channel !== "email" && v.body.length > SMS_MAX)
      ctx.addIssue({ code: "custom", path: ["body"], message: `Text messages stop at ${SMS_MAX.toLocaleString()} characters` });
  });

function flatten(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Contact details that block a channel: no phone, no email, or opted out. */
function channelProblem(now: Date, contactId: string, ch: z.infer<typeof channel>): string | null {
  const c = findContact(now, contactId);
  if (!c) return null;
  if ((ch === "sms" || ch === "whatsapp") && !c.phone) return "This contact has no phone number";
  if (ch === "sms" && c.doNotContact.sms) return "This contact opted out of texts";
  if (ch === "email" && !c.email) return "This contact has no email address";
  if (ch === "email" && c.doNotContact.email) return "This contact opted out of email";
  return null;
}

export async function replyAction(_prev: InboxActionState, formData: FormData): Promise<InboxActionState> {
  return withWorkspace(async () => {
    const parsed = replySchema.safeParse({
      conversationId: formData.get("conversationId"),
      kind: formData.get("kind"),
      channel: formData.get("channel"),
      subject: formData.get("subject") ?? undefined,
      body: formData.get("body"),
    });
    if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
    const d = parsed.data;
    const now = new Date();
    const conv = findConversation(now, d.conversationId);
    if (!conv) return { ok: false, message: "This conversation no longer exists" };
    if (d.kind === "message") {
      const problem = channelProblem(now, conv.contactId, d.channel);
      if (problem) return { ok: false, errors: { channel: problem } };
    }
    sendMessage(now, d.conversationId, { channel: d.channel, body: d.body, subject: d.subject, authorName: actorName(), kind: d.kind });
    revalidatePath("/agency/inbox");
    return { ok: true, conversationId: d.conversationId, at: Date.now() };
  });
}

const startSchema = z
  .object({
    contactId: z.string().min(1, "Pick a contact"),
    channel,
    subject: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1, "Write a message first").max(5000, "Keep it under 5,000 characters"),
  })
  .superRefine((v, ctx) => {
    if (v.channel === "email" && !v.subject) ctx.addIssue({ code: "custom", path: ["subject"], message: "Add a subject" });
  });

export async function startConversationAction(_prev: InboxActionState, formData: FormData): Promise<InboxActionState> {
  return withWorkspace(async () => {
    const parsed = startSchema.safeParse({
      contactId: formData.get("contactId") ?? "",
      channel: formData.get("channel"),
      subject: formData.get("subject") ?? undefined,
      body: formData.get("body"),
    });
    if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
    const d = parsed.data;
    const now = new Date();
    const problem = channelProblem(now, d.contactId, d.channel);
    if (problem) return { ok: false, errors: { channel: problem } };
    const conv = startConversation(now, { ...d, authorName: actorName() });
    if (!conv) return { ok: false, errors: { contactId: "That contact was not found" } };
    revalidatePath("/agency/inbox");
    return { ok: true, conversationId: conv.id, at: Date.now() };
  });
}

const idSchema = z.string().min(1);

export async function assignAction(conversationId: string, assigneeName: string) {
  return withWorkspace(async () => {
    const id = idSchema.parse(conversationId);
    const name = z.union([z.literal(""), z.enum(teamDirectory().map((t) => t.name) as [string, ...string[]])]).parse(assigneeName);
    assignConversation(new Date(), id, name || undefined);
    revalidatePath("/agency/inbox");
  });
}

export async function setReadAction(conversationId: string, read: boolean) {
  return withWorkspace(async () => {
    setConversationRead(new Date(), idSchema.parse(conversationId), z.boolean().parse(read));
    revalidatePath("/agency/inbox");
  });
}

export async function setStatusAction(conversationId: string, status: "open" | "closed") {
  return withWorkspace(async () => {
    setConversationStatus(new Date(), idSchema.parse(conversationId), z.enum(["open", "closed"]).parse(status));
    revalidatePath("/agency/inbox");
  });
}
