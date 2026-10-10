"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formIssues, formTemplates } from "@/components/forms/model";
import { createForm, deleteForm, deleteResponse, duplicateForm, findForm, findFormBySlug, saveForm, setFormStatus, startVisit, submitResponse, trackVisit, type SubmitResult } from "@/lib/data/forms";
import { findClient } from "@/lib/data/store";

/* Forms actions. zod in, { ok, message } out, like the rest of Lotus. The public ones are marked. */

export type FormResult = { ok: boolean; message?: string; errors?: Record<string, string>; id?: string };

function touch(id?: string) {
  revalidatePath("/agency/forms");
  if (id) revalidatePath(`/agency/forms/${id}`);
  revalidatePath("/agency/automations");
}

const fail = (err: z.ZodError): FormResult => {
  const errors: Record<string, string> = {};
  for (const i of err.issues) errors[i.path.join(".") || "form"] ??= i.message;
  return { ok: false, errors, message: Object.values(errors)[0] };
};

const id = z.string().min(1).max(120);
const text = (max: number) => z.string().max(max);

const choice = z.object({ id, label: text(200), score: z.number().int().min(-100).max(100).optional() });
const rule = z.object({ id, op: z.enum(["is", "is_not", "contains", "gt", "lt", "answered"]), value: text(200), goTo: id });
const question = z.object({
  id,
  type: z.enum(["short_text", "long_text", "email", "phone", "number", "multiple_choice", "checkboxes", "dropdown", "yes_no", "rating", "opinion_scale", "date", "file_upload", "statement"]),
  title: text(300),
  description: text(1000).optional(),
  required: z.boolean(),
  choices: z.array(choice).max(30).optional(),
  steps: z.number().int().min(3).max(10).optional(),
  placeholder: text(120).optional(),
  mapTo: z.enum(["name", "firstName", "lastName", "email", "phone", "company", "city"]).optional(),
  logic: z.array(rule).max(10).optional(),
});
const ending = z.object({ id, title: text(200), body: text(1000), minScore: z.number().int().min(-1000).max(1000).optional(), buttonLabel: text(40).optional(), buttonUrl: text(500).optional() });
const patch = z.object({
  name: z.string().trim().min(1, "Give the form a name").max(80),
  slug: z
    .string()
    .trim()
    .min(3, "The link needs at least 3 characters")
    .max(48)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes"),
  welcome: z.object({ enabled: z.boolean(), title: text(200), body: text(1000), button: text(30) }),
  questions: z.array(question).max(60),
  endings: z.array(ending).min(1, "Add a closing screen").max(8),
  hiddenFields: z.array(z.string().trim().regex(/^[A-Za-z0-9_]{1,40}$/, "Hidden fields use letters, numbers and _")).max(10),
  theme: z.enum(["paper", "ink", "violet", "sand", "forest", "sky"]),
  scoring: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10),
  notify: z.union([z.email("That email doesn't look right"), z.literal("")]).optional(),
});

/** Create from a template, then open the builder. */
export async function createFormAction(_prev: FormResult | null, formData: FormData): Promise<FormResult> {
  const p = z
    .object({ accountId: id, name: z.string().trim().min(1, "Give the form a name").max(80), template: z.string().refine((k) => formTemplates.some((t) => t.key === k), "Pick a template") })
    .safeParse({ accountId: formData.get("accountId"), name: formData.get("name"), template: formData.get("template") });
  if (!p.success) return fail(p.error);
  const now = new Date();
  if (!findClient(now, p.data.accountId)) return { ok: false, errors: { accountId: "Pick a client" }, message: "Pick a client" };
  const form = createForm(now, p.data.accountId, p.data.name, p.data.template);
  if (!form) return { ok: false, message: "That client has no pipeline yet." };
  touch();
  redirect(`/agency/forms/${form.id}`);
}

export async function saveFormAction(formId: string, input: unknown): Promise<FormResult> {
  const p = patch.safeParse(input);
  if (!p.success) return fail(p.error);
  const now = new Date();
  const { form, slugTaken } = saveForm(now, formId, { ...p.data, notify: p.data.notify || undefined });
  if (slugTaken) return { ok: false, errors: { slug: "Another form already uses this link" }, message: "Another form already uses this link" };
  if (!form) return { ok: false, message: "That form was deleted." };
  // A live form that picks up a blocking problem goes back to draft rather than break for visitors.
  if (form.status === "live" && formIssues(form).some((i) => i.blocking)) {
    setFormStatus(now, form.id, "draft");
    touch(form.id);
    return { ok: true, message: "Saved. The form has unfinished questions, so it's back in draft." };
  }
  touch(form.id);
  return { ok: true, message: "Saved" };
}

export async function setFormStatusAction(formId: string, status: "draft" | "live" | "closed"): Promise<FormResult> {
  const now = new Date();
  const form = findForm(now, formId);
  if (!form) return { ok: false, message: "That form was deleted." };
  if (status === "live") {
    const blocking = formIssues(form).filter((i) => i.blocking);
    if (blocking.length) return { ok: false, message: blocking.length === 1 ? blocking[0]!.message : `${blocking.length} things to finish before publishing` };
  }
  setFormStatus(now, formId, status);
  touch(formId);
  return { ok: true, message: status === "live" ? "Published. The link is live." : status === "closed" ? "Closed. The link now says it isn't taking responses." : "Back in draft" };
}

export async function duplicateFormAction(formId: string): Promise<void> {
  const copy = duplicateForm(new Date(), formId);
  touch();
  if (copy) redirect(`/agency/forms/${copy.id}`);
}

export async function deleteFormAction(formId: string): Promise<void> {
  const form = findForm(new Date(), formId);
  deleteForm(new Date(), formId);
  touch();
  redirect(`/agency/forms${form ? `?client=${form.accountId}` : ""}`);
}

export async function deleteResponseAction(responseId: string, formId: string): Promise<FormResult> {
  deleteResponse(new Date(), z.string().max(120).parse(responseId));
  touch(formId);
  revalidatePath(`/agency/forms/${formId}/responses`);
  return { ok: true, message: "Response deleted" };
}

/* ------------------------------ public ------------------------------ */

/** Public: a visitor opened the form. */
export async function startFormAction(slug: string): Promise<string | undefined> {
  const now = new Date();
  const form = findFormBySlug(now, z.string().max(60).parse(slug));
  return form ? startVisit(now, form.id) : undefined;
}

/** Public: the visitor reached a question. Drives the drop-off chart. */
export async function trackFormAction(visitId: string, questionId: string): Promise<void> {
  const p = z.object({ visitId: z.string().max(120), questionId: z.string().max(120) }).safeParse({ visitId, questionId });
  if (p.success) trackVisit(new Date(), p.data.visitId, p.data.questionId);
}

const submission = z.object({
  answers: z.record(z.string().max(120), z.union([z.string().max(5000), z.array(z.string().max(300)).max(30)])),
  hidden: z.record(z.string().max(40), z.string().max(200)),
  startedAt: z.string().max(40).optional(),
  visitId: z.string().max(120).optional(),
});

/** Public: the visitor pressed Submit. */
export async function submitFormAction(slug: string, input: unknown): Promise<SubmitResult> {
  const p = submission.safeParse(input);
  if (!p.success) return { ok: false, message: "Something in the answers didn't come through. Please try again." };
  const now = new Date();
  const form = findFormBySlug(now, z.string().max(60).parse(slug));
  if (!form) return { ok: false, message: "This form no longer exists." };
  const result = submitResponse(now, form.id, p.data);
  if (result.ok) {
    touch(form.id);
    revalidatePath("/agency/contacts");
  }
  return result;
}
