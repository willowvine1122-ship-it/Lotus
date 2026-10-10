"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Download, FileText, Search, Trash2, X } from "lucide-react";
import { BarList } from "@/components/charts";
import { Segmented } from "@/components/diagnostic/primitives";
import type { FormDefinition, FormResponse } from "@/lib/types";
import { cn, formatCount, formatRate, timeAgo } from "@/lib/utils";
import type { FormResult } from "@/app/agency/forms/actions";
import type { FormStats } from "./data";
import { FormHeader, inkBandButton } from "./header";
import { answerText, isEmpty, maxScore, questionTypeLabel, type ClientRef } from "./model";
import { formatDuration, questionIcon, smallButton } from "./ui";

/*
 * Responses: a ledger of every submission with the full answer sheet in the
 * right panel, and a Summary view that charts each question. CSV export
 * downloads everything, whatever the filter.
 */

const DAY = 86400000;
const th = "whitespace-nowrap px-3 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6";
const td = "px-3 py-1.5 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6";

export interface ResponseRow extends FormResponse {
  contactName?: string;
}

function Kpi({ label, value, aside }: { label: string; value: string; aside?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded border border-line bg-surface px-4 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-3">
      <div className="min-w-0">
        <div className="whitespace-nowrap text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{label}</div>
        <div className="num mt-0.5 text-xl font-semibold leading-7">{value}</div>
      </div>
      {aside && <div className="num whitespace-nowrap text-xs text-fg-3 sm:ml-auto sm:text-right">{aside}</div>}
    </div>
  );
}

const fmtSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function ResponsesView({ form, client, responses, stats, nowIso, initialId, remove }: { form: FormDefinition; client: ClientRef; responses: ResponseRow[]; stats: FormStats; nowIso: string; initialId?: string; remove: (id: string, formId: string) => Promise<FormResult> }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [view, setView] = useState<"responses" | "summary">("responses");
  const [range, setRange] = useState<"7" | "30" | "90" | "all">("30");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  const [panelOpen, setPanelOpen] = useState(!!initialId);

  const questions = form.questions.filter((q) => q.type !== "statement");
  const columns = questions.filter((q) => !q.mapTo && q.type !== "file_upload" && q.type !== "long_text").slice(0, 3);
  const q = query.trim().toLowerCase();
  const inRange = responses.filter((r) => range === "all" || now.getTime() - Date.parse(r.submittedAt) < Number(range) * DAY);
  const rows = inRange
    .filter((r) => !q || [r.contactName ?? "", ...questions.map((x) => answerText(x, r.answers[x.id])), ...Object.values(r.hidden)].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;
  const scores = inRange.map((r) => r.score).filter((s): s is number => s !== undefined);
  const top = maxScore(form);

  const select = (id: string) => {
    setSelectedId(id);
    setPanelOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <FormHeader
        id={form.id}
        name={form.name}
        status={form.status}
        client={client}
        tab="responses"
        responses={responses.length}
        meta={<span className="num">{stats.lastAt ? `Last response ${timeAgo(stats.lastAt, now)}` : "No responses yet"}</span>}
        actions={
          <a href={`/agency/forms/${form.id}/export`} className={inkBandButton} download>
            <Download className="size-3.5" strokeWidth={2} />
            Export CSV
          </a>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className={cn("grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6", form.scoring ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
            <Kpi label="Responses" value={formatCount(inRange.length)} aside={range === "all" ? "all time" : `last ${range} days`} />
            <Kpi label="Completion · 30 days" value={formatRate(stats.visits30 ? stats.completed30 / stats.visits30 : null)} aside={`${formatCount(stats.visits30)} visits`} />
            <Kpi label="Time to finish" value={formatDuration(stats.medianSeconds)} aside="median" />
            {form.scoring && <Kpi label="Average score" value={scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "–"} aside={top ? `of ${top}` : undefined} />}
          </div>

          <div className="flex flex-wrap items-center gap-2 px-5 pb-3 md:px-6">
            <Segmented
              label="View"
              tone="paper"
              value={view}
              onChange={setView}
              options={[
                { value: "responses", label: "Responses" },
                { value: "summary", label: "Summary" },
              ]}
            />
            <Segmented
              label="Range"
              tone="paper"
              value={range}
              onChange={setRange}
              options={[
                { value: "7", label: "7d" },
                { value: "30", label: "30d" },
                { value: "90", label: "90d" },
                { value: "all", label: "All" },
              ]}
            />
            {view === "responses" && (
              <label className="relative ml-auto w-full sm:w-[240px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-3" strokeWidth={1.75} />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search answers" className="h-8 w-full rounded border border-line-strong bg-surface pl-8 pr-3 text-sm placeholder:text-fg-3 focus:border-brand focus:outline-none" />
              </label>
            )}
          </div>

          {view === "responses" ? (
            <div className="overflow-x-auto border-y border-line bg-surface">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>Contact</th>
                    {columns.map((c, i) => (
                      <th key={c.id} scope="col" className={cn(th, "max-w-[220px] truncate", i === 0 ? "hidden md:table-cell" : i === 1 ? "hidden xl:table-cell" : "hidden 2xl:table-cell")} title={c.title}>
                        {c.title}
                      </th>
                    ))}
                    {form.scoring && <th scope="col" className={cn(th, "text-right")}>Score</th>}
                    {form.hiddenFields.includes("utm_source") && <th scope="col" className={cn(th, "hidden sm:table-cell")}>Source</th>}
                    <th scope="col" className={th}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const on = selected?.id === r.id;
                    return (
                      <tr
                        key={r.id}
                        aria-selected={on}
                        tabIndex={0}
                        onClick={() => select(r.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            select(r.id);
                          }
                        }}
                        className={cn("h-[52px] cursor-pointer border-b border-line transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand", on ? "bg-brand-soft/40 shadow-[inset_2px_0_0_var(--brand)]" : "hover:bg-surface-2/60")}
                      >
                        <td className={td}>
                          <span className="block max-w-[26ch] truncate font-medium">{r.contactName ?? <span className="text-fg-3">No contact</span>}</span>
                          <span className="block max-w-[26ch] truncate text-xs text-fg-3">{answerText(form.questions.find((x) => x.mapTo === "email") ?? form.questions[0]!, r.answers[(form.questions.find((x) => x.mapTo === "email") ?? form.questions[0]!).id]) || "–"}</span>
                        </td>
                        {columns.map((c, i) => (
                          <td key={c.id} className={cn(td, "max-w-[220px] truncate text-fg-2", i === 0 ? "hidden md:table-cell" : i === 1 ? "hidden xl:table-cell" : "hidden 2xl:table-cell")}>
                            {answerText(c, r.answers[c.id]) || <span className="text-fg-3">–</span>}
                          </td>
                        ))}
                        {form.scoring && <td className={cn(td, "num text-right")}>{r.score ?? "–"}</td>}
                        {form.hiddenFields.includes("utm_source") && <td className={cn(td, "hidden whitespace-nowrap text-fg-2 sm:table-cell")}>{r.hidden.utm_source ?? <span className="text-fg-3">–</span>}</td>}
                        <td className={cn(td, "whitespace-nowrap text-fg-2")}>{timeAgo(r.submittedAt, now)}</td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-sm text-fg-3">
                        {responses.length === 0 ? (form.status === "live" ? "No responses yet. Share the link to get the first one." : "No responses yet. Publish the form to switch the link on.") : "Nothing in this range matches."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <Summary form={form} responses={inRange} />
          )}
        </div>

        {view === "responses" && selected && (
          <>
            <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[384px] 2xl:w-[420px]">
              <ResponsePanel key={selected.id} form={form} r={selected} now={now} remove={remove} />
            </aside>
            {panelOpen && (
              <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Response">
                <button type="button" aria-label="Close panel" onClick={() => setPanelOpen(false)} className="flex-1 bg-rail/40" />
                <aside className="h-full w-[min(100%,420px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                  <ResponsePanel key={selected.id} form={form} r={selected} now={now} remove={remove} onClose={() => setPanelOpen(false)} />
                </aside>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ResponsePanel({ form, r, now, remove, onClose }: { form: FormDefinition; r: ResponseRow; now: Date; remove: (id: string, formId: string) => Promise<FormResult>; onClose?: () => void }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const ending = form.endings.find((e) => e.id === r.endingId);
  const seconds = (Date.parse(r.submittedAt) - Date.parse(r.startedAt)) / 1000;
  const answered = form.questions.filter((q) => q.type !== "statement");
  return (
    <div>
      <div className="sticky top-0 z-[1] border-b border-line bg-surface px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold leading-6 tracking-tight">{r.contactName ?? "No contact"}</h2>
            <p className="num mt-0.5 text-xs text-fg-3">
              {new Date(r.submittedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {timeAgo(r.submittedAt, now)} · took {formatDuration(seconds)}
            </p>
          </div>
          {onClose && (
            <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
              <X className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {r.contactId && (
            <Link href={`/agency/contacts/${r.contactId}`} className={smallButton}>
              <ArrowUpRight className="size-3.5" strokeWidth={2} />
              Open contact
            </Link>
          )}
          {r.score !== undefined && (
            <span className="num inline-flex h-7 items-center rounded border border-line bg-surface-2/60 px-2.5 text-xs text-fg-2">
              Score <strong className="ml-1 font-semibold text-fg">{r.score}</strong>
              {ending && <span className="ml-1.5 text-fg-3">· {ending.title}</span>}
            </span>
          )}
        </div>
      </div>

      <ol className="divide-y divide-line">
        {answered.map((q) => {
          const Icon = questionIcon[q.type];
          const n = form.questions.indexOf(q) + 1;
          const a = r.answers[q.id];
          const files = r.files.filter((f) => f.questionId === q.id);
          return (
            <li key={q.id} className="px-5 py-3.5">
              <p className="flex items-start gap-2 text-xs text-fg-3">
                <span className="num mt-px w-4 shrink-0">{n}</span>
                <Icon className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-label={questionTypeLabel[q.type]} />
                <span className="min-w-0">{q.title}</span>
              </p>
              <div className="mt-1 pl-6 text-sm">
                {q.type === "file_upload" ? (
                  files.length ? (
                    <ul className="flex flex-col gap-1">
                      {files.map((f) => (
                        <li key={f.id}>
                          <a href={`/agency/forms/files/${f.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline">
                            <FileText className="size-3.5 text-fg-3" strokeWidth={1.75} />
                            {f.name}
                            <span className="num text-xs font-normal text-fg-3">{fmtSize(f.size)}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-fg-3">No file</span>
                  )
                ) : isEmpty(a) ? (
                  <span className="text-fg-3">Skipped</span>
                ) : (
                  <span className="whitespace-pre-line break-words">{answerText(q, a)}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {Object.keys(r.hidden).length > 0 && (
        <section className="border-t border-line px-5 py-4">
          <h3 className="text-xs font-medium uppercase tracking-[0.06em] text-fg-3">Hidden fields</h3>
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
            {Object.entries(r.hidden).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="num text-fg-3">{k}</dt>
                <dd className="truncate">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="border-t border-line px-5 py-4">
        {confirm ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-fg-2">Delete this response? The contact stays.</span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await remove(r.id, form.id);
                  router.refresh();
                })
              }
              className="inline-flex h-7 items-center rounded border border-red/40 bg-surface px-2.5 text-xs font-medium text-red hover:bg-red-soft"
            >
              Delete
            </button>
            <button type="button" onClick={() => setConfirm(false)} className={smallButton}>
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-red">
            <Trash2 className="size-3.5" strokeWidth={1.75} />
            Delete response
          </button>
        )}
      </div>
    </div>
  );
}

/** One card per question: choice counts as bars, ratings as an average, NPS as a score, text as the latest answers. */
function Summary({ form, responses }: { form: FormDefinition; responses: ResponseRow[] }) {
  const questions = form.questions.filter((q) => q.type !== "statement" && !q.mapTo);
  return (
    <div className="grid gap-3 px-5 pb-8 md:px-6 xl:grid-cols-2">
      {questions.map((q) => {
        const answers = responses.map((r) => r.answers[q.id]).filter((a) => !isEmpty(a));
        const n = form.questions.indexOf(q) + 1;
        let body: React.ReactNode = null;
        if (q.choices && (q.type === "multiple_choice" || q.type === "dropdown" || q.type === "checkboxes")) {
          const counts = q.choices.map((c) => ({ key: c.id, label: c.label, value: answers.filter((a) => (Array.isArray(a) ? a.includes(c.id) : a === c.id)).length }));
          body = <BarList items={counts} color="var(--chart-1)" format={formatCount} />;
        } else if (q.type === "yes_no") {
          body = (
            <BarList
              items={[
                { key: "yes", label: "Yes", value: answers.filter((a) => a === "yes").length },
                { key: "no", label: "No", value: answers.filter((a) => a === "no").length },
              ]}
              color="var(--chart-1)"
              format={formatCount}
            />
          );
        } else if (q.type === "rating" || q.type === "opinion_scale" || q.type === "number") {
          const nums = answers.map((a) => Number(a)).filter((x) => Number.isFinite(x));
          const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
          const nps = q.type === "opinion_scale" && (q.steps ?? 10) === 10 && nums.length ? Math.round(((nums.filter((x) => x >= 9).length - nums.filter((x) => x <= 6).length) / nums.length) * 100) : null;
          const top = q.type === "rating" ? (q.steps ?? 5) : q.type === "opinion_scale" ? (q.steps ?? 10) : null;
          body = (
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline gap-6">
                <div>
                  <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Average</div>
                  <div className="num text-xl font-semibold">
                    {avg === null ? "–" : avg.toFixed(1)}
                    {top && <span className="ml-1 text-sm font-normal text-fg-3">of {top}</span>}
                  </div>
                </div>
                {nps !== null && (
                  <div>
                    <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">NPS</div>
                    <div className="num text-xl font-semibold">{nps > 0 ? `+${nps}` : nps}</div>
                  </div>
                )}
              </div>
              {top !== null && (
                <BarList
                  items={Array.from({ length: q.type === "rating" ? top : top + 1 }, (_, i) => (q.type === "rating" ? top - i : top - i)).map((v) => ({ key: String(v), label: q.type === "rating" ? `${v} stars` : String(v), value: nums.filter((x) => x === v).length }))}
                  color="var(--chart-1)"
                  format={formatCount}
                />
              )}
            </div>
          );
        } else {
          const latest = responses
            .filter((r) => !isEmpty(r.answers[q.id]))
            .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
            .slice(0, 4);
          body = latest.length ? (
            <ul className="flex flex-col gap-2">
              {latest.map((r) => (
                <li key={r.id} className="border-l-2 border-line pl-3 text-sm leading-relaxed text-fg-2">
                  {q.type === "file_upload" ? r.files.filter((f) => f.questionId === q.id).map((f) => f.name).join(", ") : answerText(q, r.answers[q.id])}
                </li>
              ))}
            </ul>
          ) : null;
        }
        return (
          <section key={q.id} className="rounded border border-line bg-surface p-4">
            <header className="mb-3 flex items-start gap-3">
              <span className="num mt-px w-5 shrink-0 text-xs text-fg-3">{n}</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium leading-snug">{q.title}</h3>
                <p className="num mt-0.5 text-xs text-fg-3">
                  {formatCount(answers.length)} answered{responses.length ? ` · ${formatRate(answers.length / responses.length)} of responses` : ""}
                </p>
              </div>
            </header>
            {answers.length ? body : <p className="text-xs text-fg-3">No answers in this range.</p>}
          </section>
        );
      })}
    </div>
  );
}
