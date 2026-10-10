import { answerText } from "@/components/forms/model";
import { contactName, findForm, listResponses } from "@/lib/data/forms";

/* Every response as CSV: one column per question, then hidden fields, score and contact. */

const cell = (v: string | number | undefined) => {
  const s = v === undefined ? "" : String(v);
  // Neutralise spreadsheet formulas, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();
  const form = findForm(now, id);
  if (!form) return new Response("Form not found.", { status: 404 });
  const questions = form.questions.filter((q) => q.type !== "statement");
  const responses = listResponses(now, id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const header = ["Submitted", "Contact", ...questions.map((q) => q.title || "Untitled"), ...form.hiddenFields, ...(form.scoring ? ["Score"] : []), "Seconds to finish"];
  const rows = responses.map((r) => [
    r.submittedAt,
    contactName(now, r.contactId) ?? "",
    ...questions.map((q) => (q.type === "file_upload" ? r.files.filter((f) => f.questionId === q.id).map((f) => f.name).join(", ") : answerText(q, r.answers[q.id]))),
    ...form.hiddenFields.map((h) => r.hidden[h] ?? ""),
    ...(form.scoring ? [r.score ?? ""] : []),
    Math.round((Date.parse(r.submittedAt) - Date.parse(r.startedAt)) / 1000),
  ]);
  const csv = [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  return new Response("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${form.slug}-responses-${now.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
