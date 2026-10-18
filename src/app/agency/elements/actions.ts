"use server";

import { withWorkspace } from "@/lib/server/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { campaignFor, createElement, deleteElement, duplicateElement, findElement, saveElement, setElementStatus } from "@/lib/data/elements";
import { elementKinds, isHex } from "@/lib/elements";

/* Donation element actions. zod in, { ok, message } out, like the rest of Lotus. */

export type ElementResult = { ok: boolean; message?: string; errors?: Record<string, string> };

function touch(id?: string) {
  revalidatePath("/agency/elements");
  if (id) revalidatePath(`/agency/elements/${id}`);
}

const fail = (err: z.ZodError): ElementResult => {
  const errors: Record<string, string> = {};
  for (const i of err.issues) errors[i.path.join(".") || "form"] ??= i.message;
  return { ok: false, errors, message: Object.values(errors)[0] };
};

const id = z.string().min(1).max(120);
const text = (max: number) => z.string().max(max);
const cents = z.number().int().min(0).max(10_000_000);
const day = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional().transform((v) => v || undefined);
const image = z
  .union([z.string().regex(/^(https:\/\/|\/elements\/)[^\s"'<>]{1,600}$/, "Use an https image link"), z.string().regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/).max(2_000_000, "Images up to 1.5 MB"), z.literal("")])
  .optional()
  .transform((v) => v || undefined);

const level = z.object({ id, amountCents: cents.min(100, "Each amount needs at least $1"), label: text(40), description: text(240) });

const config = z.object({
  label: text(40),
  headline: text(160),
  body: text(600),
  imageUrl: image,
  frequency: z.enum(["campaign", "one_time", "monthly"]),
  amountCents: cents,
  levels: z.array(level).max(8),
  allowChange: z.boolean(),
  metric: z.enum(["raised", "donors", "gifts", "monthly_donors", "monthly_value"]),
  showDonors: z.boolean(),
  showDeadline: z.boolean(),
  deadline: day,
  offlineCents: cents,
  match: z.number().min(1).max(5),
  nameStyle: z.enum(["first_initial", "initials", "hidden"]),
  showLocation: z.boolean(),
  count: z.number().int().min(1).max(12),
  accent: z.string().refine(isHex, "Pick a colour like #e0245e"),
  theme: z.enum(["light", "dark"]),
  size: z.enum(["sm", "md", "lg"]),
  shape: z.enum(["square", "rounded", "pill"]),
  icon: z.boolean(),
  pulse: z.boolean(),
  fullWidth: z.boolean(),
  align: z.enum(["left", "center", "right"]),
  position: z.enum(["bottom_right", "bottom_left", "top", "bottom", "right_edge"]),
  trigger: z.enum(["load", "delay", "scroll", "exit"]),
  delaySeconds: z.number().int().min(0).max(120),
  scrollPercent: z.number().int().min(0).max(100),
  devices: z.enum(["all", "desktop", "mobile"]),
  startsOn: day,
  endsOn: day,
  showOn: z.array(z.string().trim().max(200)).max(20),
  hideOn: z.array(z.string().trim().max(200)).max(20),
});

const patch = z.object({
  name: z.string().trim().min(1, "Give the element a name").max(80),
  campaignId: id,
  config,
});

/** Create from the type picker, then open the builder. */
export async function createElementAction(_prev: ElementResult | null, formData: FormData): Promise<ElementResult> {
  return withWorkspace(async () => {
    const p = z
      .object({
        accountId: id,
        campaignId: id,
        name: z.string().trim().min(1, "Give the element a name").max(80),
        type: z.string().refine((t) => elementKinds.some((k) => k.type === t), "Pick a type"),
      })
      .safeParse({ accountId: formData.get("accountId"), campaignId: formData.get("campaignId"), name: formData.get("name"), type: formData.get("type") });
    if (!p.success) return fail(p.error);
    const now = new Date();
    const kind = elementKinds.find((k) => k.type === p.data.type)!;
    const e = createElement(now, { accountId: p.data.accountId, campaignId: p.data.campaignId, type: kind.type, name: p.data.name });
    if (!e) return { ok: false, errors: { campaignId: "Pick a campaign" }, message: "That client has no campaign yet." };
    touch();
    redirect(`/agency/elements/${e.id}`);
  });
}

export async function saveElementAction(elementId: string, input: unknown): Promise<ElementResult> {
  return withWorkspace(async () => {
    const p = patch.safeParse(input);
    if (!p.success) return fail(p.error);
    const now = new Date();
    const e = findElement(now, elementId);
    if (!e) return { ok: false, message: "This element was deleted." };
    if (!campaignFor(now, { accountId: e.accountId, campaignId: p.data.campaignId })) return { ok: false, errors: { campaignId: "Pick a campaign" }, message: "Pick a campaign" };
    const c = p.data.config;
    if (c.startsOn && c.endsOn && c.endsOn < c.startsOn) return { ok: false, errors: { endsOn: "The end date is before the start" }, message: "The end date is before the start" };
    if (["button_group", "donation_levels", "impact_slider"].includes(e.type) && c.levels.length < 2) return { ok: false, errors: { levels: "Add at least two amounts" }, message: "Add at least two amounts" };
    saveElement(now, elementId, p.data);
    touch(elementId);
    return { ok: true, message: "Saved. Every placement shows the change within a minute." };
  });
}

export async function setElementStatusAction(elementId: string, status: "live" | "paused"): Promise<ElementResult> {
  return withWorkspace(async () => {
    const p = z.enum(["live", "paused"]).safeParse(status);
    if (!p.success) return { ok: false, message: "Unknown status" };
    const e = setElementStatus(new Date(), elementId, p.data);
    if (!e) return { ok: false, message: "This element was deleted." };
    touch(elementId);
    return { ok: true, message: p.data === "live" ? "Live on every site it is placed on." : "Paused. It no longer shows anywhere." };
  });
}

export async function duplicateElementAction(elementId: string) {
  return withWorkspace(async () => {
    const copy = duplicateElement(new Date(), elementId);
    touch();
    if (copy) redirect(`/agency/elements/${copy.id}`);
  });
}

export async function deleteElementAction(elementId: string) {
  return withWorkspace(async () => {
    deleteElement(new Date(), elementId);
    touch();
    redirect("/agency/elements");
  });
}
