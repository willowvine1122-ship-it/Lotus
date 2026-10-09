"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createWorkflow, deleteWorkflow, duplicateWorkflow, findWorkflow, setWorkflowStatus, stopRun, testRun, updateWorkflow } from "@/lib/data/automations";
import { getPipeline } from "@/lib/data/store";
import type { WorkflowStep } from "@/lib/types";
import { workflowIssues } from "@/components/automations/model";

/* Automation actions. zod in, { ok, errors, message } out, like the CRM and email. */

export type AutomationActionState = { ok: boolean; errors?: Record<string, string>; message?: string; id?: string } | null;

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
  revalidatePath("/agency/automations");
  if (id) {
    revalidatePath(`/agency/automations/${id}`);
    revalidatePath(`/agency/automations/${id}/runs`);
  }
}

const newSchema = z.object({
  accountId: z.string().min(1, "Pick a client"),
  name: z.string().trim().min(2, "Name the workflow so the team can find it").max(80),
  templateId: z.string().optional(),
});

export async function createWorkflowAction(_prev: AutomationActionState, formData: FormData): Promise<AutomationActionState> {
  const parsed = newSchema.safeParse({ accountId: formData.get("accountId"), name: formData.get("name"), templateId: formData.get("templateId") || undefined });
  if (!parsed.success) return { ok: false, errors: flatten(parsed.error) };
  const wf = createWorkflow(new Date(), { ...parsed.data, templateId: parsed.data.templateId === "blank" ? undefined : parsed.data.templateId });
  if (!wf) return { ok: false, message: "That client does not exist." };
  touch();
  redirect(`/agency/automations/${wf.id}`);
}

const id = z.string().min(1).max(120);
const text = (max: number) => z.string().max(max);

const step: z.ZodType<WorkflowStep> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ id, type: z.literal("send_sms"), body: text(640) }),
    z.object({ id, type: z.literal("send_email"), subject: text(150), body: text(5000) }),
    z.object({ id, type: z.literal("add_tag"), tag: text(40) }),
    z.object({ id, type: z.literal("remove_tag"), tag: text(40) }),
    z.object({ id, type: z.literal("move_stage"), stageId: text(60) }),
    z.object({ id, type: z.literal("assign_owner"), ownerName: text(60) }),
    z.object({ id, type: z.literal("create_task"), title: text(160), assigneeName: text(60).optional(), dueInDays: z.number().int().min(0).max(90) }),
    z.object({ id, type: z.literal("notify"), to: text(60), message: text(500) }),
    z.object({ id, type: z.literal("wait"), amount: z.number().int().min(1, "Wait at least 1").max(365), unit: z.enum(["minutes", "hours", "days"]) }),
    z.object({
      id,
      type: z.literal("branch"),
      condition: z.object({ field: z.enum(["tag", "stage", "source", "has_email", "has_phone", "value", "owner"]), op: z.enum(["is", "is_not", "gte"]), value: text(80) }),
      // One level of if/else: lanes hold actions and waits, never another branch.
      yes: z.array(step).max(30),
      no: z.array(step).max(30),
    }),
  ]),
);

const draftSchema = z.object({
  name: z.string().trim().min(2, "Name the workflow").max(80),
  allowReentry: z.boolean(),
  trigger: z.object({
    type: z.enum(["contact_created", "form_submitted", "tag_added", "stage_changed", "appointment_booked", "appointment_no_show", "donation_received", "message_received", "email_opened", "email_clicked"]),
    tag: text(40).optional(),
    stageId: text(60).optional(),
    source: z.enum(["meta", "google", "website", "referral", "donation-page", "import", "manual"]).optional(),
    channel: z.enum(["sms", "email", "whatsapp", "facebook"]).optional(),
    minAmountCents: z.number().int().min(0).optional(),
  }),
  steps: z.array(step).max(60),
});

export type WorkflowDraft = z.input<typeof draftSchema>;

const nested = (steps: WorkflowStep[]) => steps.some((s) => s.type === "branch" && [...s.yes, ...s.no].some((x) => x.type === "branch"));

function save(wfId: string, draft: WorkflowDraft): AutomationActionState {
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, errors: flatten(parsed.error), message: "Fix the highlighted fields." };
  if (nested(parsed.data.steps)) return { ok: false, message: "An if/else can't sit inside another one." };
  const wf = findWorkflow(new Date(), wfId);
  if (!wf) return { ok: false, message: "This workflow no longer exists." };
  const stages = getPipeline(new Date(), wf.accountId)?.stages.map((s) => s.id) ?? [];
  if (parsed.data.trigger.stageId && !stages.includes(parsed.data.trigger.stageId)) return { ok: false, errors: { trigger: "Pick a stage from this client's pipeline" } };
  // Empty optional filters mean "any"; drop them so the trigger reads cleanly.
  const t = parsed.data.trigger;
  const trigger = { type: t.type, ...(t.tag?.trim() ? { tag: t.tag.trim() } : {}), ...(t.stageId ? { stageId: t.stageId } : {}), ...(t.source ? { source: t.source } : {}), ...(t.channel ? { channel: t.channel } : {}), ...(t.minAmountCents ? { minAmountCents: t.minAmountCents } : {}) };
  updateWorkflow(new Date(), wfId, { name: parsed.data.name, allowReentry: parsed.data.allowReentry, trigger, steps: parsed.data.steps });
  // An active workflow must stay runnable: saving a broken step pauses it rather than letting runs fail.
  if (wf.status === "active") {
    const issues = workflowIssues(trigger, parsed.data.steps);
    if (Object.keys(issues).length) {
      setWorkflowStatus(new Date(), wfId, "paused");
      return { ok: false, errors: issues, message: "Saved and paused: finish the highlighted steps, then turn it back on." };
    }
  }
  return null;
}

export async function saveWorkflowAction(wfId: string, draft: WorkflowDraft): Promise<AutomationActionState> {
  const r = save(wfId, draft);
  touch(wfId);
  return r ?? { ok: true, message: "Saved" };
}

export async function setWorkflowStatusAction(wfId: string, draft: WorkflowDraft, status: "active" | "paused"): Promise<AutomationActionState> {
  const r = save(wfId, draft);
  if (r) {
    touch(wfId);
    return r;
  }
  if (status === "active") {
    const wf = findWorkflow(new Date(), wfId)!;
    const issues = workflowIssues(wf.trigger, wf.steps);
    if (Object.keys(issues).length) return { ok: false, errors: issues, message: "Finish the highlighted steps before turning it on." };
  }
  setWorkflowStatus(new Date(), wfId, status);
  touch(wfId);
  return { ok: true, message: status === "active" ? "On. New contacts start from now." : "Paused. Contacts on a wait stay where they are." };
}

export async function quickStatusAction(wfId: string, status: "active" | "paused"): Promise<AutomationActionState> {
  const wf = findWorkflow(new Date(), wfId);
  if (!wf) return { ok: false, message: "This workflow no longer exists." };
  if (status === "active" && Object.keys(workflowIssues(wf.trigger, wf.steps)).length) return { ok: false, message: "Open the builder and finish its steps first." };
  setWorkflowStatus(new Date(), wfId, status);
  touch(wfId);
  return { ok: true };
}

export async function duplicateWorkflowAction(wfId: string): Promise<void> {
  const copy = duplicateWorkflow(new Date(), wfId);
  touch();
  if (copy) redirect(`/agency/automations/${copy.id}`);
}

export async function deleteWorkflowAction(wfId: string): Promise<void> {
  deleteWorkflow(new Date(), wfId);
  touch();
  redirect("/agency/automations");
}

export async function testRunAction(wfId: string, draft: WorkflowDraft, contactId: string, skipWaits: boolean): Promise<AutomationActionState> {
  const r = save(wfId, draft);
  if (r && !r.ok && r.errors && !r.message?.startsWith("Saved")) return r;
  const wf = findWorkflow(new Date(), wfId);
  if (!wf) return { ok: false, message: "This workflow no longer exists." };
  const issues = workflowIssues(wf.trigger, wf.steps);
  if (Object.keys(issues).length) return { ok: false, errors: issues, message: "Finish the highlighted steps before testing." };
  const run = testRun(new Date(), wfId, contactId, { skipWaits });
  if (!run) return { ok: false, errors: { contactId: "Pick a contact from this client" } };
  touch(wfId);
  revalidatePath("/agency/contacts");
  revalidatePath("/agency/inbox");
  return { ok: true, id: run.id, message: "Test run finished" };
}

export async function stopRunAction(runId: string): Promise<AutomationActionState> {
  const run = stopRun(new Date(), runId, actor);
  if (!run) return { ok: false, message: "That run no longer exists." };
  touch(run.workflowId);
  return { ok: true, message: "Stopped" };
}

