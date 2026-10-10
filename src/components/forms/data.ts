import type { FormDefinition, FormResponse, FormVisit } from "@/lib/types";
import { contactName, listResponses, listVisits } from "@/lib/data/forms";
import { listClients } from "@/lib/data/store";
import { answerText, isEmpty, type ClientRef } from "./model";

/* Server-side loaders shared by the forms pages. */

const DAY = 86400000;

export function formClients(now: Date): ClientRef[] {
  return listClients(now)
    .map((c) => ({ id: c.account.id, name: c.account.name, slug: c.account.slug, mode: c.mode }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface FormStats {
  responses7: number;
  responsesPrev7: number;
  responses30: number;
  visits30: number;
  completed30: number;
  /** Median seconds from start to submit, last 30 days. */
  medianSeconds: number | null;
  lastAt?: string;
  daily: number[];
  /** Share of visitors who reached each question, last 30 days. */
  reach: { id: string; title: string; reached: number }[];
  recent: { id: string; name: string; at: string; headline: string; score?: number }[];
}

export function formStats(now: Date, form: FormDefinition, responses = listResponses(now, form.id), visits = listVisits(now, form.id)): FormStats {
  const t = now.getTime();
  const within = (iso: string, from: number, to = 0) => {
    const age = t - Date.parse(iso);
    return age >= to * DAY && age < from * DAY;
  };
  const r30 = responses.filter((r) => within(r.submittedAt, 30));
  const v30 = visits.filter((v) => within(v.at, 30));
  const secs = r30.map((r) => (Date.parse(r.submittedAt) - Date.parse(r.startedAt)) / 1000).filter((s) => s > 0).sort((a, b) => a - b);
  const daily = Array.from({ length: 30 }, (_, i) => r30.filter((r) => Math.floor((t - Date.parse(r.submittedAt)) / DAY) === 29 - i).length);
  return {
    responses7: responses.filter((r) => within(r.submittedAt, 7)).length,
    responsesPrev7: responses.filter((r) => within(r.submittedAt, 14, 7)).length,
    responses30: r30.length,
    visits30: v30.length,
    completed30: v30.filter((v) => v.completed).length,
    medianSeconds: secs.length ? secs[Math.floor(secs.length / 2)]! : null,
    lastAt: responses.reduce<string | undefined>((a, r) => (!a || r.submittedAt > a ? r.submittedAt : a), undefined),
    daily,
    reach: reach(form, v30),
    recent: [...responses]
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .slice(0, 5)
      .map((r) => ({ id: r.id, name: contactName(now, r.contactId) ?? "No contact", at: r.submittedAt, headline: headline(form, r), score: r.score })),
  };
}

/** How many visitors got as far as each question. A visit that stopped at question 3 reached 1, 2 and 3. */
function reach(form: FormDefinition, visits: FormVisit[]) {
  const order = new Map(form.questions.map((q, i) => [q.id, i]));
  const furthest = visits.map((v) => (v.completed ? form.questions.length - 1 : v.lastQuestionId ? (order.get(v.lastQuestionId) ?? -1) : -1));
  return form.questions
    .filter((q) => q.type !== "statement")
    .map((q) => {
      const i = order.get(q.id)!;
      return { id: q.id, title: q.title || "Untitled", reached: furthest.filter((f) => f >= i).length };
    });
}

/** The answer that best describes a response at a glance: the first choice answer, else the first text. */
export function headline(form: FormDefinition, r: FormResponse) {
  const pick = form.questions.find((q) => !q.mapTo && q.type !== "statement" && q.type !== "file_upload" && !isEmpty(r.answers[q.id]) && (q.choices || q.type === "opinion_scale" || q.type === "rating" || q.type === "yes_no")) ?? form.questions.find((q) => !q.mapTo && q.type !== "statement" && q.type !== "file_upload" && !isEmpty(r.answers[q.id]));
  return pick ? answerText(pick, r.answers[pick.id]) : "";
}
