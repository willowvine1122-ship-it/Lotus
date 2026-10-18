"use server";

import { withWorkspace } from "@/lib/server/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createCampaign,
  deleteAudience,
  deleteCampaign,
  duplicateCampaign,
  findAudience,
  findCampaign,
  saveAudience,
  scheduleCampaign,
  sendCampaign,
  updateCampaign,
} from "@/lib/data/email";
import { listContacts } from "@/lib/data/store";
import { audienceMembers, reachOf } from "@/components/email/model";

/* Email marketing actions. zod in, { ok, errors, message } out, like the CRM. */

export type EmailActionState = { ok: boolean; errors?: Record<string, string>; message?: string; id?: string } | null;

const actor = "Afza"; // until auth lands, every write is attributed to the signed-in demo user

function flatten(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function touch(id?: string) {
  revalidatePath("/agency/email");
  if (id) revalidatePath(`/agency/email/${id}`);
}

/* ----------------------------- campaigns ---------------------------- */

const newCampaignSchema = z.object({
  accountId: z.string().min(1, "Pick a client"),
  name: z.string().trim().min(2, "Name the campaign so the team can find it"),
  templateId: z.string().min(1, "Pick a starting point"),
});

export async function createCampaignAction(_prev: EmailActionState, formData: FormData): Promise<EmailActionState> {
  return withWorkspace(async () => {
    const parsed = newCampaignSchema.safeParse({ accountId: formData.get("accountId"), name: formData.get("name"), templateId: formData.get("templateId") });
    if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
    const c = createCampaign(new Date(), parsed.data);
    if (!c) return { ok: false, message: "That client does not exist." };
    touch();
    redirect(`/agency/email/${c.id}`);
  });
}

const block = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("heading"), text: z.string().max(200) }),
  z.object({ id: z.string(), type: z.literal("text"), text: z.string().max(5000) }),
  z.object({ id: z.string(), type: z.literal("button"), text: z.string().max(60), url: z.string().max(2000) }),
  z.object({ id: z.string(), type: z.literal("image"), alt: z.string().max(200), caption: z.string().max(200).optional() }),
  z.object({ id: z.string(), type: z.literal("divider") }),
]);

const draftSchema = z.object({
  name: z.string().trim().min(2, "Name the campaign"),
  subject: z.string().trim().max(150, "Keep the subject under 150 characters"),
  previewText: z.string().trim().max(200),
  fromName: z.string().trim().min(1, "Add a from name"),
  fromEmail: z.string().trim().email("Enter a valid from address"),
  audienceId: z.string().optional(),
  blocks: z.array(block).max(60),
});

export type CampaignDraft = z.input<typeof draftSchema>;

function save(id: string, draft: CampaignDraft): NonNullable<EmailActionState> | z.output<typeof draftSchema> {
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, errors: flatten(parsed.error), message: "Fix the highlighted fields." };
  const c = updateCampaign(new Date(), id, { ...parsed.data, audienceId: parsed.data.audienceId || undefined });
  if (!c) return { ok: false, message: "This campaign has already been sent and can't be edited." };
  return parsed.data;
}

const isState = (v: unknown): v is NonNullable<EmailActionState> => typeof v === "object" && v !== null && "ok" in v;

export async function saveCampaignAction(id: string, draft: CampaignDraft): Promise<EmailActionState> {
  return withWorkspace(async () => {
    const r = save(id, draft);
    if (isState(r)) return r;
    touch(id);
    return { ok: true, message: "Draft saved" };
  });
}

/** Everything a send needs that a draft doesn't. */
function readyToSend(id: string, d: z.output<typeof draftSchema>): EmailActionState {
  const errors: Record<string, string> = {};
  if (!d.subject) errors.subject = "Add a subject line";
  if (!d.blocks.length) errors.blocks = "The email is empty";
  const now = new Date();
  const c = findCampaign(now, id);
  const audience = d.audienceId ? findAudience(now, d.audienceId) : undefined;
  if (!audience || audience.accountId !== c?.accountId) errors.audienceId = "Pick who gets it";
  else if (reachOf(audienceMembers(audience, listContacts(now, audience.accountId), now)).sendable.length === 0) errors.audienceId = "Nobody in this audience can be emailed";
  return Object.keys(errors).length ? { ok: false, errors, message: "Fix the highlighted fields before sending." } : null;
}

export async function scheduleCampaignAction(id: string, draft: CampaignDraft, whenIso: string | null): Promise<EmailActionState> {
  return withWorkspace(async () => {
    const r = save(id, draft);
    if (isState(r)) return r;
    if (whenIso) {
      const blocked = readyToSend(id, r);
      if (blocked) return blocked;
      const when = new Date(whenIso);
      if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 60000) return { ok: false, errors: { scheduledFor: "Pick a time in the future" }, message: "Pick a time in the future." };
      scheduleCampaign(new Date(), id, when);
    } else {
      scheduleCampaign(new Date(), id, null);
    }
    touch(id);
    return { ok: true, message: whenIso ? "Scheduled" : "Moved back to draft" };
  });
}

export async function sendCampaignAction(id: string, draft: CampaignDraft): Promise<EmailActionState> {
  return withWorkspace(async () => {
    const r = save(id, draft);
    if (isState(r)) return r;
    const blocked = readyToSend(id, r);
    if (blocked) return blocked;
    const result = sendCampaign(new Date(), id, actor);
    if (!result) return { ok: false, message: "This campaign could not be sent." };
    touch(id);
    revalidatePath("/agency/contacts");
    redirect(`/agency/email/${id}?sent=${result.sent}`);
  });
}

export async function duplicateCampaignAction(id: string): Promise<void> {
  return withWorkspace(async () => {
    const c = duplicateCampaign(new Date(), id);
    touch();
    if (c) redirect(`/agency/email/${c.id}`);
  });
}

export async function deleteCampaignAction(id: string): Promise<void> {
  return withWorkspace(async () => {
    deleteCampaign(new Date(), id);
    touch();
    redirect("/agency/email");
  });
}

/* ----------------------------- audiences ---------------------------- */

const audienceSchema = z.object({
  id: z.string().optional(),
  accountId: z.string().min(1, "Pick a client"),
  name: z.string().trim().min(2, "Name the audience"),
  kind: z.enum(["segment", "list"]),
  filter: z.object({
    tags: z.array(z.string()),
    stageIds: z.array(z.string()),
    sources: z.array(z.enum(["meta", "google", "website", "referral", "donation-page", "import", "manual"])),
    addedWithinDays: z.number().int().positive().max(3650).optional(),
  }),
  contactIds: z.array(z.string()),
});

export type AudienceInput = z.input<typeof audienceSchema>;

export async function saveAudienceAction(input: AudienceInput): Promise<EmailActionState> {
  return withWorkspace(async () => {
    const parsed = audienceSchema.safeParse(input);
    if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
    if (parsed.data.kind === "list" && parsed.data.contactIds.length === 0) return { ok: false, errors: { contactIds: "Add at least one contact" } };
    const a = saveAudience(new Date(), parsed.data);
    revalidatePath("/agency/email/audiences");
    touch();
    return { ok: true, id: a.id, message: input.id ? "Saved" : "Audience created" };
  });
}

export async function deleteAudienceAction(id: string): Promise<EmailActionState> {
  return withWorkspace(async () => {
    if (!deleteAudience(new Date(), id)) return { ok: false, message: "A draft or scheduled campaign still uses this audience." };
    revalidatePath("/agency/email/audiences");
    return { ok: true, message: "Deleted" };
  });
}
