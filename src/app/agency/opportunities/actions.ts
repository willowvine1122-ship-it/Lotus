"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { opportunityChanged, opportunityCreated } from "@/lib/data/automation-events";
import {
  addOpportunityNote,
  createOpportunity,
  createPipeline,
  deleteOpportunity,
  deletePipeline,
  findOpportunity,
  findPipeline,
  moveOpportunity,
  setLostReasons,
  setOpportunityStatus,
  updateOpportunity,
  updatePipeline,
} from "@/lib/data/opportunities";
import { findClient, findContact } from "@/lib/data/store";
import type { OpportunityStatus } from "@/lib/types";

/* Server actions for opportunities and pipelines: zod in, { ok, errors } out. */

export type OppActionState = { ok: boolean; errors?: Record<string, string>; message?: string } | null;

const actor = "Afza"; // until auth lands, every write is attributed to the signed-in demo user

function flatten(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

function refresh() {
  revalidatePath("/agency/opportunities");
  revalidatePath("/agency/contacts");
}

const money = z
  .string()
  .optional()
  .transform((v) => (v ? Number(String(v).replace(/[^0-9.]/g, "")) : 0))
  .pipe(z.number().min(0, "Enter an amount").max(100_000_000, "That is more than this field holds"));

const tags = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);

const sources = ["meta", "google", "website", "referral", "donation-page", "import", "manual"] as const;
const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")]);

const newSchema = z.object({
  contactId: z.string().min(1, "Pick a contact"),
  pipelineId: z.string().min(1, "Pick a pipeline"),
  stageId: z.string().optional(),
  name: z.string().trim().min(2, "Name the opportunity").max(120),
  value: money,
  ownerName: z.string().optional(),
  source: z.enum(sources).optional(),
  closeOn: date,
});

export async function createOpportunityAction(_prev: OppActionState, fd: FormData): Promise<OppActionState> {
  const parsed = newSchema.safeParse({
    contactId: fd.get("contactId") ?? "",
    pipelineId: fd.get("pipelineId") ?? "",
    stageId: fd.get("stageId") || undefined,
    name: fd.get("name") ?? "",
    value: fd.get("value") ?? "",
    ownerName: fd.get("ownerName") || undefined,
    source: fd.get("source") || undefined,
    closeOn: fd.get("closeOn") ?? "",
  });
  if (!parsed.success) return { ok: false, errors: flatten(parsed.error), message: "Fix the highlighted fields." };
  const now = new Date();
  const d = parsed.data;
  const contact = findContact(now, d.contactId);
  const p = findPipeline(now, d.pipelineId);
  if (!contact || !p) return { ok: false, message: "That contact or pipeline no longer exists." };
  if (contact.accountId !== p.accountId) return { ok: false, errors: { contactId: "This contact belongs to another client" } };
  const o = createOpportunity(now, { contactId: d.contactId, pipelineId: d.pipelineId, stageId: d.stageId, name: d.name, valueCents: Math.round(d.value * 100), ownerName: d.ownerName, source: d.source, tags: tags(fd.get("tags")), closeOn: d.closeOn || undefined }, actor);
  if (!o) return { ok: false, message: "Could not create it. Try again." };
  opportunityCreated(now, o);
  refresh();
  const client = findClient(now, o.accountId);
  redirect(`/agency/opportunities?client=${client?.account.slug ?? ""}&pipeline=${o.pipelineId}&opp=${o.id}`);
}

const editSchema = z.object({
  name: z.string().trim().min(2, "Name the opportunity").max(120),
  value: money,
  ownerName: z.string().optional(),
  source: z.enum(sources),
  closeOn: date,
});

export async function updateOpportunityAction(id: string, _prev: OppActionState, fd: FormData): Promise<OppActionState> {
  const parsed = editSchema.safeParse({
    name: fd.get("name") ?? "",
    value: fd.get("value") ?? "",
    ownerName: fd.get("ownerName") || undefined,
    source: fd.get("source") ?? "manual",
    closeOn: fd.get("closeOn") ?? "",
  });
  if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
  const d = parsed.data;
  const o = updateOpportunity(new Date(), id, { name: d.name, valueCents: Math.round(d.value * 100), ownerName: d.ownerName, source: d.source, closeOn: d.closeOn || undefined, tags: tags(fd.get("tags")) }, actor);
  if (!o) return { ok: false, message: "That opportunity no longer exists." };
  refresh();
  return { ok: true, message: "Saved" };
}

export async function moveOpportunityAction(id: string, stageId: string): Promise<void> {
  const now = new Date();
  opportunityChanged(now, moveOpportunity(now, id, stageId, actor));
  refresh();
}

export async function setOpportunityStatusAction(id: string, status: OpportunityStatus, lostReason?: string): Promise<OppActionState> {
  if (status === "lost" && !lostReason?.trim()) return { ok: false, errors: { lostReason: "Pick a reason" } };
  const now = new Date();
  const move = setOpportunityStatus(now, id, status, actor, lostReason?.trim().slice(0, 80));
  if (!move) return { ok: false, message: "That opportunity no longer exists." };
  opportunityChanged(now, move);
  refresh();
  return { ok: true };
}

export async function addOpportunityNoteAction(id: string, _prev: OppActionState, fd: FormData): Promise<OppActionState> {
  const body = String(fd.get("body") ?? "").trim();
  if (body.length < 2) return { ok: false, errors: { body: "Write the note" } };
  if (!addOpportunityNote(new Date(), id, body.slice(0, 2000), actor)) return { ok: false, message: "That opportunity no longer exists." };
  refresh();
  return { ok: true };
}

export async function deleteOpportunityAction(id: string): Promise<void> {
  deleteOpportunity(new Date(), id);
  refresh();
}

export type BulkOp = { type: "stage"; stageId: string } | { type: "status"; status: OpportunityStatus; lostReason?: string } | { type: "owner"; ownerName: string } | { type: "delete" };

/** One change across many selected opportunities. Returns how many it touched. */
export async function bulkOpportunityAction(ids: string[], op: BulkOp): Promise<{ ok: boolean; count: number; message?: string }> {
  const now = new Date();
  if (op.type === "status" && op.status === "lost" && !op.lostReason) return { ok: false, count: 0, message: "Pick a reason for marking them lost." };
  let count = 0;
  for (const id of ids.slice(0, 500)) {
    const o = findOpportunity(now, id);
    if (!o) continue;
    switch (op.type) {
      case "stage":
        if (o.stageId !== op.stageId && findPipeline(now, o.pipelineId)?.stages.some((s) => s.id === op.stageId)) {
          opportunityChanged(now, moveOpportunity(now, id, op.stageId, actor));
          count++;
        }
        break;
      case "status":
        if (o.status !== op.status) {
          opportunityChanged(now, setOpportunityStatus(now, id, op.status, actor, op.lostReason));
          count++;
        }
        break;
      case "owner": {
        const owner = op.ownerName || undefined;
        if (o.ownerName !== owner) {
          updateOpportunity(now, id, { ownerName: owner }, actor);
          count++;
        }
        break;
      }
      case "delete":
        deleteOpportunity(now, id);
        count++;
        break;
    }
  }
  refresh();
  return { ok: true, count };
}

/* ------------------------------ pipelines ----------------------------- */

const stageSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name every stage").max(40),
  probability: z.number().int().min(0).max(100),
  outcome: z.enum(["won", "lost"]).optional(),
});

const pipelineSchema = z
  .object({
    name: z.string().trim().min(2, "Name the pipeline").max(60),
    staleDays: z.number().int().min(1, "At least one day").max(365),
    stages: z.array(stageSchema).min(2, "A pipeline needs at least two stages").max(15, "Fifteen stages at most"),
    moveTo: z.string().optional(),
  })
  .refine((p) => p.stages.some((s) => !s.outcome), { message: "Keep at least one open stage", path: ["stages"] })
  .refine((p) => p.stages.filter((s) => s.outcome === "won").length <= 1 && p.stages.filter((s) => s.outcome === "lost").length <= 1, { message: "One won stage and one lost stage at most", path: ["stages"] });

export type PipelineDraft = z.input<typeof pipelineSchema>;

export async function savePipelineAction(accountId: string, id: string | null, draft: PipelineDraft): Promise<OppActionState & { id?: string }> {
  const parsed = pipelineSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, errors: flatten(parsed.error), message: parsed.error.issues[0]?.message };
  const now = new Date();
  if (!findClient(now, accountId)) return { ok: false, message: "That client no longer exists." };
  if (id) {
    const r = updatePipeline(now, id, parsed.data, actor);
    if (!r.ok) return { ok: false, message: r.message };
    refresh();
    return { ok: true, message: "Saved", id };
  }
  const p = createPipeline(now, accountId, parsed.data.name, parsed.data.stages, parsed.data.staleDays);
  if (!p) return { ok: false, message: "Could not create it." };
  refresh();
  return { ok: true, message: "Pipeline created", id: p.id };
}

export async function deletePipelineAction(id: string): Promise<OppActionState> {
  const r = deletePipeline(new Date(), id);
  if (!r.ok) return { ok: false, message: r.message };
  refresh();
  return { ok: true, message: "Pipeline deleted" };
}

export async function saveLostReasonsAction(accountId: string, reasons: string[]): Promise<OppActionState> {
  const clean = [...new Set(reasons.map((r) => r.trim().slice(0, 40)).filter(Boolean))].slice(0, 20);
  if (!clean.length) return { ok: false, message: "Keep at least one reason." };
  setLostReasons(new Date(), accountId, clean);
  refresh();
  return { ok: true, message: "Saved" };
}
