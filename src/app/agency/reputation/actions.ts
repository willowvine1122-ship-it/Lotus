"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { replyToReview, sendReviewRequest, updateReputationSettings } from "@/lib/data/store";

export type ActionState = { ok: boolean; errors?: Record<string, string>; message?: string } | null;

export async function replyToReviewAction(reviewId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 2) return { ok: false, errors: { body: "Write a reply first." } };
  const r = replyToReview(new Date(), reviewId, body, "Afza");
  if (!r) return { ok: false, message: "Review not found." };
  revalidatePath("/agency/reputation");
  return { ok: true, message: "Reply posted" };
}

const requestSchema = z.object({
  accountId: z.string().min(1),
  contactId: z.string().min(1, "Pick a contact"),
  channel: z.enum(["sms", "email"]),
});

export async function sendRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = requestSchema.safeParse({ accountId: formData.get("accountId"), contactId: formData.get("contactId"), channel: formData.get("channel") });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const req = sendReviewRequest(new Date(), parsed.data.accountId, parsed.data.contactId, parsed.data.channel, "Afza");
  if (!req) return { ok: false, message: "That contact is not on this client." };
  revalidatePath("/agency/reputation");
  revalidatePath("/agency/contacts");
  return { ok: true, message: `Request sent to ${req.contactName}` };
}

const settingsSchema = z.object({
  channel: z.enum(["sms", "email"]),
  delayHours: z.coerce.number().int().min(0).max(168),
  googleUrl: z.union([z.literal(""), z.string().trim().url("Enter a full URL")]),
  facebookUrl: z.union([z.literal(""), z.string().trim().url("Enter a full URL")]),
  message: z.string().trim().min(10, "Write the message people will get"),
});

export async function updateSettingsAction(accountId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = settingsSchema.safeParse({
    channel: formData.get("channel"),
    delayHours: formData.get("delayHours"),
    googleUrl: formData.get("googleUrl") ?? "",
    facebookUrl: formData.get("facebookUrl") ?? "",
    message: formData.get("message"),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const auto = formData.getAll("autoAfter").map(String);
  const s = updateReputationSettings(new Date(), accountId, {
    autoAfter: { job: auto.includes("job"), appointment: auto.includes("appointment"), donation: auto.includes("donation") },
    channel: parsed.data.channel,
    delayHours: parsed.data.delayHours,
    googleUrl: parsed.data.googleUrl || undefined,
    facebookUrl: parsed.data.facebookUrl || undefined,
    message: parsed.data.message,
  });
  if (!s) return { ok: false, message: "Client not found." };
  revalidatePath("/agency/reputation");
  return { ok: true, message: "Saved" };
}
