import { stamp } from "@/lib/ids";
import { randomBytes } from "node:crypto";
import type { FormAnswer, FormDefinition, FormFile, FormQuestion, FormResponse, FormVisit } from "@/lib/types";
import { answerError, answerText, contactFields, formTemplates, isEmpty, path, pickEnding, scoreOf, slugify } from "@/components/forms/model";
import { formSubmitted } from "./automation-events";
import { upsertContact } from "./integrations";
import { defineModule } from "@/lib/server/workspace";
import { putFile, removeFile } from "@/lib/server/files";
import { addActivity, findContact, listClients,} from "./store";

/*
 * Forms: Typeform-style forms per client, their responses, the visits that
 * show where people drop off, and uploaded files. Saved per agency in the
 * "forms" module; a form's slug is its public address (/form/<slug>), and
 * uploaded file bytes live in the files table, not in the module.
 *
 * A submission creates or fills in the contact (by email, then phone), adds
 * the form's tags, logs it on the contact's timeline and fires "Form
 * submitted" for workflows.
 */

interface StoredFile extends FormFile {
  formId: string;
  at: string;
}

interface FormStore {
  forms: FormDefinition[];
  responses: FormResponse[];
  visits: FormVisit[];
  files: StoredFile[];
}

const formsModule = defineModule<FormStore>({
  key: "forms",
  init: () => ({ forms: [], responses: [], visits: [], files: [] }),
  publicKeys: (s) => s.forms.map((f) => `form:${f.slug}`),
});
// Vercel caps a request body at 4.5 MB, so uploads stop just under it.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "application/pdf", "text/plain", "text/csv", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

const uid = (p: string) => `new-${p}-${stamp()}-${randomBytes(3).toString("hex")}`;

function store(_now: Date): FormStore {
  return formsModule.get();
}

/* -------------------------------- forms ------------------------------- */

export function listForms(now: Date, accountId?: string) {
  const all = store(now).forms;
  return accountId ? all.filter((f) => f.accountId === accountId) : all;
}

export function findForm(now: Date, id: string) {
  return store(now).forms.find((f) => f.id === id);
}

export function findFormBySlug(now: Date, slug: string) {
  return store(now).forms.find((f) => f.slug === slug);
}

function uniqueSlug(now: Date, base: string, exceptId?: string) {
  const taken = new Set(store(now).forms.filter((f) => f.id !== exceptId).map((f) => f.slug));
  let slug = slugify(base);
  for (let n = 2; taken.has(slug); n++) slug = `${slugify(base).slice(0, 44)}-${n}`;
  return slug;
}

export function createForm(now: Date, accountId: string, name: string, templateKey: string): FormDefinition | undefined {
  const client = listClients(now).find((c) => c.account.id === accountId);
  const template = formTemplates.find((t) => t.key === templateKey) ?? formTemplates.find((t) => t.key === "blank")!;
  if (!client) return undefined;
  const at = now.toISOString();
  const form: FormDefinition = {
    id: uid("form"),
    accountId,
    name: name.trim(),
    slug: uniqueSlug(now, `${client.account.slug}-${name}`),
    status: "draft",
    ...template.build(client.account.name),
    template: template.key,
    createdAt: at,
    updatedAt: at,
  };
  store(now).forms.push(form);
  return form;
}

export type FormPatch = Pick<FormDefinition, "name" | "welcome" | "questions" | "endings" | "hiddenFields" | "theme" | "scoring" | "tags" | "notify"> & { slug: string };

export function saveForm(now: Date, id: string, patch: FormPatch): { form?: FormDefinition; slugTaken?: boolean } {
  const form = findForm(now, id);
  if (!form) return {};
  const slug = slugify(patch.slug);
  if (store(now).forms.some((f) => f.id !== id && f.slug === slug)) return { slugTaken: true };
  Object.assign(form, { ...patch, slug, updatedAt: now.toISOString() });
  return { form };
}

export function setFormStatus(now: Date, id: string, status: FormDefinition["status"]) {
  const form = findForm(now, id);
  if (form) {
    form.status = status;
    form.updatedAt = now.toISOString();
  }
  return form;
}

export function duplicateForm(now: Date, id: string) {
  const src = findForm(now, id);
  if (!src) return undefined;
  const at = now.toISOString();
  const copy: FormDefinition = { ...structuredClone(src), id: uid("form"), name: `${src.name} (copy)`, slug: uniqueSlug(now, `${src.slug}-copy`), status: "draft", createdAt: at, updatedAt: at };
  store(now).forms.push(copy);
  return copy;
}

export function deleteForm(now: Date, id: string) {
  const s = store(now);
  s.forms = s.forms.filter((f) => f.id !== id);
  s.responses = s.responses.filter((r) => r.formId !== id);
  s.visits = s.visits.filter((v) => v.formId !== id);
  for (const f of s.files) if (f.formId === id) void removeFile(f.id);
  s.files = s.files.filter((f) => f.formId !== id);
}

/* ------------------------------ responses ------------------------------ */

export function listResponses(now: Date, formId?: string) {
  const all = store(now).responses;
  return formId ? all.filter((r) => r.formId === formId) : all;
}

export function listVisits(now: Date, formId: string) {
  return store(now).visits.filter((v) => v.formId === formId);
}

export function deleteResponse(now: Date, id: string) {
  const s = store(now);
  const r = s.responses.find((x) => x.id === id);
  if (!r) return;
  s.responses = s.responses.filter((x) => x.id !== id);
  const fileIds = new Set(r.files.map((f) => f.id));
  s.files = s.files.filter((f) => !fileIds.has(f.id));
  for (const id of fileIds) void removeFile(id);
}

/** A visitor opened the form. The id comes back with each step so drop-off can be counted. */
export function startVisit(now: Date, formId: string): string | undefined {
  const form = findForm(now, formId);
  if (!form || form.status !== "live") return undefined;
  const v: FormVisit = { id: uid("visit"), formId, at: now.toISOString(), completed: false };
  store(now).visits.push(v);
  return v.id;
}

export function trackVisit(now: Date, visitId: string, questionId: string) {
  const v = store(now).visits.find((x) => x.id === visitId);
  if (!v || v.completed) return;
  const form = findForm(now, v.formId);
  if (form?.questions.some((q) => q.id === questionId)) v.lastQuestionId = questionId;
}

/* -------------------------------- files ------------------------------- */

export async function storeFile(now: Date, formId: string, questionId: string, file: { name: string; type: string; bytes: Buffer }): Promise<FormFile | { error: string }> {
  const form = findForm(now, formId);
  const q = form?.questions.find((x) => x.id === questionId);
  if (!form || form.status !== "live" || q?.type !== "file_upload") return { error: "This form isn't taking files." };
  if (file.bytes.length === 0) return { error: "That file is empty." };
  if (file.bytes.length > MAX_FILE_BYTES) return { error: "Files can be up to 4 MB." };
  if (!ACCEPTED_FILE_TYPES.includes(file.type)) return { error: "Images, PDFs, Word, Excel or text files only." };
  const stored: StoredFile = { id: uid("file"), formId, questionId, name: file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "file", type: file.type, size: file.bytes.length, at: now.toISOString() };
  await putFile(stored.id, stored.name, stored.type, file.bytes);
  store(now).files.push(stored);
  return { id: stored.id, questionId, name: stored.name, type: stored.type, size: stored.size };
}

export function findFile(now: Date, id: string) {
  return store(now).files.find((f) => f.id === id);
}

/* ------------------------------- submit ------------------------------- */

export interface SubmitResult {
  ok: boolean;
  errors?: Record<string, string>;
  endingId?: string;
  score?: number;
  message?: string;
}

export function submitResponse(
  now: Date,
  formId: string,
  input: { answers: Record<string, FormAnswer>; hidden: Record<string, string>; startedAt?: string; visitId?: string },
): SubmitResult {
  const form = findForm(now, formId);
  if (!form || form.status !== "live") return { ok: false, message: "This form isn't taking responses right now." };
  const s = store(now);

  // Only the questions on the respondent's path count; anything else is dropped.
  const seen = path(form, input.answers);
  const answers: Record<string, FormAnswer> = {};
  const errors: Record<string, string> = {};
  const files: FormFile[] = [];
  for (const q of seen) {
    const a = input.answers[q.id];
    if (q.type === "file_upload" && !isEmpty(a)) {
      const ids = (Array.isArray(a) ? a : [a!]).slice(0, 5);
      const found = ids.map((id) => s.files.find((f) => f.id === id && f.formId === form.id && f.questionId === q.id));
      if (found.some((f) => !f)) errors[q.id] = "That upload didn't finish. Please add the file again.";
      else for (const f of found) files.push({ id: f!.id, questionId: q.id, name: f!.name, type: f!.type, size: f!.size });
      answers[q.id] = ids;
      continue;
    }
    const err = answerError(q, a);
    if (err) errors[q.id] = err;
    else if (!isEmpty(a)) answers[q.id] = Array.isArray(a) ? a.map((x) => x.slice(0, 300)) : a!.trim().slice(0, 5000);
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  const hidden: Record<string, string> = {};
  for (const key of form.hiddenFields) {
    const v = input.hidden[key];
    if (typeof v === "string" && v.trim()) hidden[key] = v.trim().slice(0, 200);
  }

  const score = scoreOf(form, answers);
  const ending = pickEnding(form, score);
  const fields = contactFields(form, answers);
  const { contact, created } = upsertContact(now, form.accountId, fields, "website", form.tags);

  const started = input.startedAt && !Number.isNaN(Date.parse(input.startedAt)) && input.startedAt <= now.toISOString() ? input.startedAt : now.toISOString();
  const response: FormResponse = { id: uid("resp"), formId: form.id, accountId: form.accountId, contactId: contact?.id, answers, hidden, files, score, endingId: ending?.id, startedAt: started, submittedAt: now.toISOString() };
  s.responses.push(response);
  const visit = input.visitId ? s.visits.find((v) => v.id === input.visitId && v.formId === form.id) : undefined;
  if (visit) {
    visit.completed = true;
    visit.lastQuestionId = seen.at(-1)?.id;
  } else s.visits.push({ id: uid("visit"), formId: form.id, at: started, completed: true, lastQuestionId: seen.at(-1)?.id });

  if (contact) {
    addActivity(now, contact.id, { kind: "form", title: `Filled in ${form.name}`, body: summary(form.questions, answers, score), by: "System" });
    formSubmitted(now, contact, form.name, created, form.id);
  }
  return { ok: true, endingId: ending?.id, score };
}

/** The answers as a few readable lines for the contact's timeline. */
function summary(questions: FormQuestion[], answers: Record<string, FormAnswer>, score?: number) {
  const lines = questions
    .filter((q) => q.type !== "statement" && !isEmpty(answers[q.id]) && q.type !== "file_upload")
    .slice(0, 8)
    .map((q) => `${q.title}: ${answerText(q, answers[q.id])}`);
  if (score !== undefined) lines.push(`Score: ${score}`);
  return lines.join("\n");
}

/* --------------------------------- seed -------------------------------- */

/** For a contact's timeline and the client page: this client's forms with a contact's responses. */
export function responsesForContact(now: Date, contactId: string) {
  return store(now).responses.filter((r) => r.contactId === contactId);
}

export function contactName(now: Date, id?: string) {
  const c = id ? findContact(now, id) : undefined;
  return c ? `${c.firstName} ${c.lastName}`.trim() : undefined;
}
