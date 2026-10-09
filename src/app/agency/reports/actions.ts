"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendReportNow, updateReportConfig } from "@/lib/data/store";
import type { ReportSectionId } from "@/lib/types";

export type ActionState = { ok: boolean; errors?: Record<string, string>; message?: string } | null;

const sectionIds = ["summary", "performance", "volume", "months", "countries", "reviews", "note"] as const;

const schema = z.object({
  range: z.coerce.number().pipe(z.union([z.literal(7), z.literal(30), z.literal(90)])),
  weekday: z.coerce.number().int().min(0).max(6),
  hour: z.coerce.number().int().min(0).max(23),
  recipients: z.string().transform((s) => s.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean)),
  note: z.string().trim().max(600, "Keep the note under 600 characters"),
});

export async function saveReportConfigAction(accountId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({ range: formData.get("range"), weekday: formData.get("weekday"), hour: formData.get("hour"), recipients: formData.get("recipients") ?? "", note: formData.get("note") ?? "" });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const bad = parsed.data.recipients.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (bad) return { ok: false, errors: { recipients: `“${bad}” is not an email address` } };
  const enabled = formData.get("enabled") === "on";
  if (enabled && parsed.data.recipients.length === 0) return { ok: false, errors: { recipients: "Add at least one recipient, or turn the schedule off" } };
  const sections = formData.getAll("sections").map(String).filter((s): s is ReportSectionId => (sectionIds as readonly string[]).includes(s));
  const ordered = sectionIds.filter((s) => sections.includes(s));
  const cfg = updateReportConfig(new Date(), accountId, { enabled, range: parsed.data.range, weekday: parsed.data.weekday, hour: parsed.data.hour, recipients: parsed.data.recipients, sections: ordered, note: parsed.data.note || undefined });
  if (!cfg) return { ok: false, message: "Client not found." };
  revalidatePath("/agency/reports");
  revalidatePath("/c");
  return { ok: true, message: "Saved" };
}

export async function sendReportNowAction(accountId: string): Promise<ActionState> {
  const send = sendReportNow(new Date(), accountId);
  if (!send) return { ok: false, message: "Client not found." };
  revalidatePath("/agency/reports");
  return { ok: true, message: send.recipients.length ? `Sent to ${send.recipients.length} ${send.recipients.length === 1 ? "person" : "people"}` : "Recorded, no recipients yet" };
}
