import { randomBytes } from "node:crypto";
import type { FormAnswer, FormDefinition, FormFile, FormQuestion, FormResponse, FormVisit } from "@/lib/types";
import { answerError, answerText, contactFields, formTemplates, isEmpty, path, pickEnding, scoreOf, slugify } from "@/components/forms/model";
import { formSubmitted } from "./automation-events";
import { upsertContact } from "./integrations";
import { addActivity, findContact, listClients, listContacts } from "./store";

/*
 * Forms: Typeform-style forms per client, their responses, the visits that
 * show where people drop off, and uploaded files. Demo store on globalThis,
 * seeded once per day like the other modules; anything made by hand ("new-"
 * ids) survives the reseed. Seeded forms keep fixed ids and slugs so links
 * stay valid from one day to the next.
 *
 * A submission creates or fills in the contact (by email, then phone), adds
 * the form's tags, logs it on the contact's timeline and fires "Form
 * submitted" for workflows.
 */

interface StoredFile extends FormFile {
  formId: string;
  bytes?: Buffer;
  at: string;
}

interface FormStore {
  seededFor: string;
  forms: FormDefinition[];
  responses: FormResponse[];
  visits: FormVisit[];
  files: StoredFile[];
}

const g = globalThis as unknown as { __lotusForms?: FormStore };
const DAY = 86400000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_STORED_BYTES = 200 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "application/pdf", "text/plain", "text/csv", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

const uid = (p: string) => `new-${p}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function store(now: Date): FormStore {
  const key = now.toISOString().slice(0, 10);
  if (!g.__lotusForms || g.__lotusForms.seededFor !== key) {
    const prev = g.__lotusForms;
    const mine = <T extends { id: string }>(xs: T[] | undefined) => xs?.filter((x) => x.id.startsWith("new-")) ?? [];
    const s: FormStore = { seededFor: key, forms: [], responses: [], visits: [], files: [] };
    seed(now, s);
    // Edits to seeded forms survive too: keep the edited copy over the fresh seed.
    for (const f of prev?.forms ?? []) {
      if (f.id.startsWith("new-")) continue;
      const i = s.forms.findIndex((x) => x.id === f.id);
      if (i !== -1 && f.updatedAt > s.forms[i]!.updatedAt) s.forms[i] = f;
    }
    s.forms.push(...mine(prev?.forms));
    s.responses.push(...mine(prev?.responses));
    s.visits.push(...mine(prev?.visits));
    s.files.push(...mine(prev?.files));
    g.__lotusForms = s;
  }
  return g.__lotusForms;
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

export function storeFile(now: Date, formId: string, questionId: string, file: { name: string; type: string; bytes: Buffer }): FormFile | { error: string } {
  const form = findForm(now, formId);
  const q = form?.questions.find((x) => x.id === questionId);
  if (!form || form.status !== "live" || q?.type !== "file_upload") return { error: "This form isn't taking files." };
  if (file.bytes.length === 0) return { error: "That file is empty." };
  if (file.bytes.length > MAX_FILE_BYTES) return { error: "Files can be up to 10 MB." };
  if (!ACCEPTED_FILE_TYPES.includes(file.type)) return { error: "Images, PDFs, Word, Excel or text files only." };
  const s = store(now);
  // Keep the demo store bounded: drop the oldest unclaimed uploads first, then the oldest files.
  let total = s.files.reduce((a, f) => a + (f.bytes?.length ?? 0), 0) + file.bytes.length;
  const claimed = new Set(s.responses.flatMap((r) => r.files.map((f) => f.id)));
  for (const pass of [false, true]) {
    for (const f of [...s.files]) {
      if (total <= MAX_STORED_BYTES) break;
      if (!pass && claimed.has(f.id)) continue;
      total -= f.bytes?.length ?? 0;
      f.bytes = undefined;
    }
  }
  const stored: StoredFile = { id: uid("file"), formId, questionId, name: file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "file", type: file.type, size: file.bytes.length, bytes: file.bytes, at: now.toISOString() };
  s.files.push(stored);
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

const notes = [
  "The back unit is making a rattling noise when it starts.",
  "Looking to get this done before the holidays if possible.",
  "We had someone out last year, but the problem came back.",
  "Please call after 5pm on weekdays.",
  "Two of us work from home so mornings are easiest.",
  "Saw your ad on Instagram. Do you offer financing?",
  "Not urgent, just comparing a few quotes.",
  "",
];
const praise = ["Quick, friendly and on time.", "The reminder texts were really helpful.", "Great communication from start to finish.", "", "Clear pricing, no surprises."];
const gripes = ["Had to wait longer than I was told.", "Nobody called me back the first time.", "The price went up from the quote."];
const sources = ["facebook", "google", "instagram", "newsletter", "direct"];
const campaigns = ["spring-promo", "retargeting", "brand", "lookalike-1"];

function seed(now: Date, s: FormStore) {
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
  for (const [ci, client] of listClients(now).entries()) {
    const keys = client.mode === "fundraising" ? ["donor", "quiz"] : ci % 3 === 0 ? ["lead", "quote", "feedback"] : ci % 3 === 1 ? ["quote", "feedback"] : ["lead", "quiz"];
    const contacts = listContacts(now, client.account.id);
    for (const [ki, key] of keys.entries()) {
      const t = formTemplates.find((x) => x.key === key)!;
      const rand = rng((ci + 1) * 7919 + ki * 104729);
      const built = t.build(client.account.name);
      // Fixed question, choice and ending ids so a form edited yesterday still matches today's responses.
      let n = 0;
      const fid = `form-${client.account.id}-${key}`;
      for (const q of built.questions) {
        const old = q.id;
        q.id = `${fid}-q${++n}`;
        for (const other of built.questions) for (const r of other.logic ?? []) if (r.goTo === old) r.goTo = q.id;
        for (const [k, c] of (q.choices ?? []).entries()) {
          const oldC = c.id;
          c.id = `${q.id}-c${k + 1}`;
          for (const r of q.logic ?? []) if (r.value === oldC) r.value = c.id;
        }
        for (const [k, r] of (q.logic ?? []).entries()) r.id = `${q.id}-r${k + 1}`;
      }
      for (const [k, e] of built.endings.entries()) e.id = `${fid}-e${k + 1}`;
      const status = key === "feedback" && ci % 2 === 0 ? "draft" : key === "quiz" && client.mode === "fundraising" ? "draft" : "live";
      const created = new Date(today.getTime() - (40 + ki * 9) * DAY).toISOString();
      const form: FormDefinition = { id: fid, accountId: client.account.id, name: t.name === "Scored quiz" ? "Readiness quiz" : t.name, slug: `${client.account.slug}-${key}`, status, ...built, template: key, createdAt: created, updatedAt: created };
      if (key === "quiz") form.endings[0]!.buttonUrl = `/book/${client.account.slug}`;
      s.forms.push(form);
      if (status !== "live" || contacts.length === 0) continue;

      const perDay = key === "feedback" ? 0.8 : key === "quiz" ? 1.6 : 2.4;
      for (let d = 29; d >= 0; d--) {
        const count = Math.floor(perDay * (0.5 + rand()) + (rand() < 0.3 ? 1 : 0));
        for (let i = 0; i < count; i++) {
          const startedAt = new Date(today.getTime() - d * DAY + (8 + rand() * 13) * 3600000);
          if (startedAt > now) continue;
          const contact = contacts[Math.floor(rand() * contacts.length)]!;
          const answers: Record<string, FormAnswer> = {};
          for (const q of form.questions) answers[q.id] = fake(q, contact, rand);
          const seen = path(form, answers);
          const keep: Record<string, FormAnswer> = {};
          for (const q of seen) if (!isEmpty(answers[q.id])) keep[q.id] = answers[q.id]!;
          const score = scoreOf(form, keep);
          const submittedAt = new Date(startedAt.getTime() + (40 + rand() * 220) * 1000);
          const files: FormFile[] = seen.filter((q) => q.type === "file_upload" && !isEmpty(keep[q.id])).map((q) => ({ id: `demo-file-${fid}-${d}-${i}`, questionId: q.id, name: `IMG_${4000 + Math.floor(rand() * 5000)}.jpg`, type: "image/jpeg", size: Math.floor(800000 + rand() * 2400000) }));
          for (const f of files) keep[f.questionId] = [f.id];
          const hidden: Record<string, string> = {};
          if (form.hiddenFields.includes("utm_source")) hidden.utm_source = sources[Math.floor(rand() * sources.length)]!;
          if (form.hiddenFields.includes("utm_campaign") && hidden.utm_source !== "direct") hidden.utm_campaign = campaigns[Math.floor(rand() * campaigns.length)]!;
          s.responses.push({ id: `resp-${fid}-${d}-${i}`, formId: fid, accountId: form.accountId, contactId: contact.id, answers: keep, hidden, files, score, endingId: pickEnding(form, score)?.id, startedAt: startedAt.toISOString(), submittedAt: submittedAt.toISOString() });
          s.visits.push({ id: `visit-${fid}-${d}-${i}`, formId: fid, at: startedAt.toISOString(), completed: true, lastQuestionId: seen.at(-1)?.id });
        }
        // People who opened the form and left, weighted toward the first questions.
        const left = Math.floor(count * (0.5 + rand() * 0.9));
        for (let i = 0; i < left; i++) {
          const at = new Date(today.getTime() - d * DAY + (8 + rand() * 13) * 3600000);
          if (at > now) continue;
          const stop = Math.min(form.questions.length - 1, Math.floor(Math.pow(rand(), 2) * form.questions.length));
          s.visits.push({ id: `visit-${fid}-${d}-x${i}`, formId: fid, at: at.toISOString(), completed: false, lastQuestionId: rand() < 0.25 ? undefined : form.questions[stop]!.id });
        }
      }
    }
  }
}

function fake(q: FormQuestion, c: { firstName: string; lastName: string; email?: string; phone?: string; city?: string }, rand: () => number): FormAnswer {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  if (!q.required && rand() < 0.35) return "";
  switch (q.mapTo) {
    case "name":
      return `${c.firstName} ${c.lastName}`.trim();
    case "firstName":
      return c.firstName;
    case "lastName":
      return c.lastName;
    case "email":
      return c.email ?? `${c.firstName.toLowerCase()}@example.com`;
    case "phone":
      return c.phone ?? "";
    case "city":
      return c.city ?? "";
  }
  switch (q.type) {
    case "multiple_choice":
    case "dropdown":
      return pick(q.choices ?? []).id;
    case "checkboxes":
      return (q.choices ?? []).filter(() => rand() < 0.45).map((x) => x.id);
    case "yes_no":
      return rand() < 0.4 ? "yes" : "no";
    case "rating":
      return String(Math.max(1, Math.round((q.steps ?? 5) * (0.55 + rand() * 0.45))));
    case "opinion_scale":
      return String(Math.min(q.steps ?? 10, Math.max(0, Math.round((q.steps ?? 10) * Math.pow(rand(), 0.45)))));
    case "long_text":
      return /wrong/i.test(q.title) ? pick(gripes) : /well/i.test(q.title) ? pick(praise) : pick(notes);
    case "file_upload":
      return rand() < 0.4 ? ["pending"] : "";
    case "number":
      return String(1 + Math.floor(rand() * 6));
    case "date":
      return new Date(Date.now() + Math.floor(rand() * 20) * DAY).toISOString().slice(0, 10);
    case "statement":
      return "";
    default:
      return "";
  }
}

/** For a contact's timeline and the client page: this client's forms with a contact's responses. */
export function responsesForContact(now: Date, contactId: string) {
  return store(now).responses.filter((r) => r.contactId === contactId);
}

export function contactName(now: Date, id?: string) {
  const c = id ? findContact(now, id) : undefined;
  return c ? `${c.firstName} ${c.lastName}`.trim() : undefined;
}
