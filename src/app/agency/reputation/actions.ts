"use server";

import { withWorkspace } from "@/lib/server/workspace";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { replyToReview, updateReputationSettings } from "@/lib/data/store";
import { deliverReviewRequest } from "@/lib/data/reputation-send";

export type ActionState = { ok: boolean; errors?: Record<string, string>; message?: string } | null;

export async function replyToReviewAction(reviewId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const body = String(formData.get("body") ?? "").trim();
    if (body.length < 2) return { ok: false, errors: { body: "Write a reply first." } };
    const r = replyToReview(new Date(), reviewId, body, "Afza");
    if (!r) return { ok: false, message: "Review not found." };
    revalidatePath("/agency/reputation");
    return { ok: true, message: "Reply posted" };
  });
}

const requestSchema = z.object({
  accountId: z.string().min(1),
  contactId: z.string().min(1, "Pick a contact"),
  channel: z.enum(["sms", "email"]),
});

export async function sendRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
    const parsed = requestSchema.safeParse({ accountId: formData.get("accountId"), contactId: formData.get("contactId"), channel: formData.get("channel") });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
      return { ok: false, errors };
    }
    const res = deliverReviewRequest(new Date(), { accountId: parsed.data.accountId, contactId: parsed.data.contactId, channel: parsed.data.channel, trigger: "manual", by: "Afza" });
    if (!res.ok) return { ok: false, message: res.reason === "unreachable" ? "That contact cannot be reached on that channel." : "That contact is not on this client." };
    revalidatePath("/agency/reputation");
    revalidatePath("/agency/contacts");
    revalidatePath("/agency/inbox");
    return { ok: true, message: `Request sent to ${res.request.contactName}` };
  });
}

const settingsSchema = z.object({
  channel: z.enum(["sms", "email"]),
  delayHours: z.coerce.number().int().min(0).max(168),
  googleUrl: z.union([z.literal(""), z.string().trim().url("Enter a full URL")]),
  facebookUrl: z.union([z.literal(""), z.string().trim().url("Enter a full URL")]),
  message: z.string().trim().min(10, "Write the message people will get"),
});

export async function updateSettingsAction(accountId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return withWorkspace(async () => {
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
  });
}
