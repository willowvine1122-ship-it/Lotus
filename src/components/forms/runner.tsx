"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, ChevronUp, FileUp, Loader2, Star, X } from "lucide-react";
import type { FormAnswer, FormDefinition, FormEnding, FormQuestion } from "@/lib/types";
import { answerError, formThemes, hasChoices, isEmpty, maxScore, nextQuestionId, pickEnding, scoreOf } from "./model";

/*
 * The respondent's side: one question at a time, full screen, in the form's
 * own theme. Enter moves on, letters pick choices, the arrows go back. The
 * same component renders the builder's live preview (mode "preview"), where
 * nothing is sent and uploads are switched off.
 */

type Screen = { kind: "welcome" } | { kind: "question"; id: string } | { kind: "ending"; id?: string; score?: number };

export interface RunnerProps {
  form: Pick<FormDefinition, "id" | "slug" | "name" | "welcome" | "questions" | "endings" | "theme" | "scoring" | "hiddenFields">;
  brand?: string;
  mode: "live" | "preview";
  /** Preview: which screen to open on. */
  start?: Screen;
  hidden?: Record<string, string>;
  actions?: {
    start: (slug: string) => Promise<string | undefined>;
    track: (visitId: string, questionId: string) => Promise<void>;
    submit: (slug: string, input: unknown) => Promise<SubmitOutcome>;
  };
}

type SubmitOutcome = { ok: boolean; errors?: Record<string, string>; endingId?: string; score?: number; message?: string };

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ERROR = "#d6452f";

export function FormRunner({ form, brand, mode, start, hidden = {}, actions }: RunnerProps) {
  const theme = formThemes[form.theme];
  const first: Screen = form.welcome.enabled ? { kind: "welcome" } : form.questions[0] ? { kind: "question", id: form.questions[0].id } : { kind: "ending", id: form.endings[0]?.id };
  const [screen, setScreen] = useState<Screen>(start ?? first);
  const [history, setHistory] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, FormAnswer>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const root = useRef<HTMLDivElement>(null);
  const visitId = useRef<string | undefined>(undefined);
  const startedAt = useRef(new Date().toISOString());

  const current = screen.kind === "question" ? form.questions.find((q) => q.id === screen.id) : undefined;
  const index = current ? form.questions.indexOf(current) : -1;
  const progress = screen.kind === "ending" ? 1 : screen.kind === "welcome" || index < 0 ? 0 : index / Math.max(1, form.questions.length);

  // Live: open a visit, then record each question reached so drop-off can be charted.
  useEffect(() => {
    if (mode !== "live" || !actions) return;
    let cancelled = false;
    actions.start(form.slug).then((v) => {
      if (!cancelled) visitId.current = v;
    });
    return () => {
      cancelled = true;
    };
  }, [mode, actions, form.slug]);
  useEffect(() => {
    if (mode === "live" && actions && current && visitId.current) actions.track(visitId.current, current.id);
  }, [mode, actions, current]);

  const set = (id: string, a: FormAnswer) => {
    setAnswers((prev) => ({ ...prev, [id]: a }));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  async function finish(final: Record<string, FormAnswer>) {
    if (mode === "preview" || !actions) {
      const score = scoreOf(form, final);
      setDirection(1);
      setScreen({ kind: "ending", id: pickEnding(form, score)?.id, score });
      return;
    }
    setBusy(true);
    setNotice(null);
    const res = await actions.submit(form.slug, { answers: final, hidden, startedAt: startedAt.current, visitId: visitId.current }).catch((): SubmitOutcome => ({ ok: false, message: "We couldn't send that. Check your connection and try again." }));
    setBusy(false);
    if (res.ok) {
      setDirection(1);
      setScreen({ kind: "ending", id: res.endingId, score: res.score });
      return;
    }
    if (res.errors && Object.keys(res.errors).length) {
      setErrors(res.errors);
      const firstBad = form.questions.find((q) => res.errors![q.id]);
      if (firstBad) {
        setDirection(-1);
        setScreen({ kind: "question", id: firstBad.id });
      }
    }
    setNotice(res.message ?? null);
  }

  function next(override?: FormAnswer) {
    if (busy) return;
    if (screen.kind === "welcome") {
      setDirection(1);
      setScreen(form.questions[0] ? { kind: "question", id: form.questions[0].id } : { kind: "ending", id: form.endings[0]?.id });
      return;
    }
    if (!current) return;
    const a = override !== undefined ? override : answers[current.id];
    const err = current.type === "file_upload" ? (current.required && isEmpty(a) ? "Please add a file" : undefined) : answerError(current, a);
    if (err) {
      setErrors((prev) => ({ ...prev, [current.id]: err }));
      return;
    }
    const final = override !== undefined ? { ...answers, [current.id]: override } : answers;
    const to = nextQuestionId(form, current, a);
    if (to === "end") {
      // Drop answers to questions the logic skipped over, so they aren't sent.
      const visited = new Set([...history, current.id]);
      const kept = Object.fromEntries(Object.entries(final).filter(([k]) => visited.has(k)));
      void finish(kept);
      return;
    }
    setHistory((h) => [...h, current.id]);
    setDirection(1);
    setScreen({ kind: "question", id: to });
  }

  function back() {
    if (busy) return;
    const prev = history.at(-1);
    if (!prev) {
      if (form.welcome.enabled && screen.kind === "question") {
        setDirection(-1);
        setScreen({ kind: "welcome" });
      }
      return;
    }
    setHistory((h) => h.slice(0, -1));
    setDirection(-1);
    setScreen({ kind: "question", id: prev });
  }

  // Auto-advance after a single pick: choices, yes/no, rating, scale.
  function pickAndGo(q: FormQuestion, a: FormAnswer) {
    set(q.id, a);
    window.setTimeout(() => next(a), 260);
  }

  // Keyboard: letters pick, Y/N answer, digits rate. Typing in a field is left alone.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      // In the builder the preview shares the page with the editor: only keys pressed inside it count.
      if (mode === "preview" && !(el && root.current?.contains(el))) return;
      const typing = el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "radio" && (el as HTMLInputElement).type !== "checkbox") || el.tagName === "SELECT");
      if (e.key === "Enter" && !(el?.tagName === "TEXTAREA" && e.shiftKey) && !(el?.tagName === "BUTTON")) {
        if (el?.tagName === "TEXTAREA" && !e.shiftKey) e.preventDefault();
        if (screen.kind !== "ending") next();
        return;
      }
      if (typing || !current) return;
      const k = e.key.toUpperCase();
      if (current.type === "yes_no" && (k === "Y" || k === "N")) pickAndGo(current, k === "Y" ? "yes" : "no");
      else if ((current.type === "multiple_choice" || current.type === "checkboxes") && current.choices) {
        const c = current.choices[LETTERS.indexOf(k)];
        if (!c) return;
        if (current.type === "multiple_choice") pickAndGo(current, c.id);
        else {
          const have = (answers[current.id] as string[] | undefined) ?? [];
          set(current.id, have.includes(c.id) ? have.filter((x) => x !== c.id) : [...have, c.id]);
        }
      } else if ((current.type === "rating" || current.type === "opinion_scale") && /^\d$/.test(e.key)) {
        const n = Number(e.key);
        const lo = current.type === "rating" ? 1 : 0;
        const hi = current.steps ?? (current.type === "rating" ? 5 : 10);
        if (n >= lo && n <= hi) pickAndGo(current, String(n));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ending: FormEnding | undefined = screen.kind === "ending" ? (form.endings.find((e) => e.id === screen.id) ?? form.endings[0]) : undefined;
  const total = useMemo(() => maxScore(form), [form]);

  const style = {
    "--f-bg": theme.bg,
    "--f-fg": theme.fg,
    "--f-fg2": theme.fg2,
    "--f-accent": theme.accent,
    "--f-accent-fg": theme.accentFg,
    "--f-line": theme.line,
    "--f-field": theme.field,
  } as React.CSSProperties;

  return (
    <div ref={root} tabIndex={mode === "preview" ? -1 : undefined} style={style} className="relative flex h-full min-h-full flex-col bg-[var(--f-bg)] [&_:focus-visible]:outline-[var(--f-accent)] text-[var(--f-fg)] [font-feature-settings:'ss01']">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[color-mix(in_srgb,var(--f-accent)_14%,transparent)]" aria-hidden>
        <div className="h-full bg-[var(--f-accent)] transition-[width] duration-300 ease-out" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      {brand && <div className="px-6 pt-6 text-sm font-semibold tracking-tight text-[var(--f-fg)] md:px-10">{brand}</div>}

      <main className="flex flex-1 items-center px-6 py-10 md:px-10">
        <div key={screen.kind === "question" ? screen.id : screen.kind} className="mx-auto w-full max-w-[640px] motion-safe:animate-[form-in_280ms_cubic-bezier(0.2,0.7,0.2,1)]" style={{ "--form-from": `${direction * 18}px` } as React.CSSProperties}>
          {screen.kind === "welcome" && (
            <div>
              <h1 className="text-[28px] font-semibold leading-tight tracking-tight md:text-[34px]">{form.welcome.title || form.name}</h1>
              {form.welcome.body && <p className="mt-3 max-w-[52ch] text-lg leading-relaxed text-[var(--f-fg2)]">{form.welcome.body}</p>}
              <div className="mt-8 flex items-center gap-3">
                <PrimaryButton onClick={() => next()}>{form.welcome.button || "Start"}</PrimaryButton>
                <EnterHint />
              </div>
            </div>
          )}

          {current && (
            <QuestionView
              q={current}
              n={index + 1}
              answer={answers[current.id]}
              error={errors[current.id]}
              busy={busy}
              isLast={nextQuestionId(form, current, answers[current.id]) === "end"}
              mode={mode}
              slug={form.slug}
              onChange={(a) => set(current.id, a)}
              onPick={(a) => pickAndGo(current, a)}
              onNext={() => next()}
            />
          )}

          {screen.kind === "ending" && (
            <div>
              {form.scoring && screen.score !== undefined && (
                <p className="num mb-4 inline-flex items-baseline gap-1.5 rounded-full border border-[var(--f-line)] px-3 py-1 text-sm text-[var(--f-fg2)]">
                  You scored <span className="text-base font-semibold text-[var(--f-fg)]">{screen.score}</span>
                  {total > 0 && <span>of {total}</span>}
                </p>
              )}
              <h1 className="text-[28px] font-semibold leading-tight tracking-tight md:text-[34px]">{ending?.title || "Thanks!"}</h1>
              {ending?.body && <p className="mt-3 max-w-[52ch] whitespace-pre-line text-lg leading-relaxed text-[var(--f-fg2)]">{ending.body}</p>}
              {ending?.buttonLabel && ending.buttonUrl && (
                <a href={ending.buttonUrl} className="mt-8 inline-flex h-11 items-center gap-2 rounded-md bg-[var(--f-accent)] px-5 text-base font-medium text-[var(--f-accent-fg)] transition-opacity hover:opacity-90">
                  {ending.buttonLabel}
                  <ArrowRight className="size-4" strokeWidth={2} />
                </a>
              )}
            </div>
          )}

          {notice && (
            <p role="alert" className="mt-6 text-sm" style={{ color: ERROR }}>
              {notice}
            </p>
          )}
        </div>
      </main>

      {screen.kind === "question" && (
        <div className="absolute bottom-5 right-5 flex overflow-hidden rounded-md border border-[var(--f-line)] md:bottom-6 md:right-8">
          <button type="button" aria-label="Previous question" onClick={back} disabled={busy || (!history.length && !form.welcome.enabled)} className="grid size-9 place-items-center bg-[var(--f-field)] text-[var(--f-fg)] transition-opacity hover:opacity-80 disabled:opacity-35">
            <ChevronUp className="size-4" strokeWidth={2} />
          </button>
          <button type="button" aria-label="Next question" onClick={() => next()} disabled={busy} className="grid size-9 place-items-center border-l border-[var(--f-line)] bg-[var(--f-field)] text-[var(--f-fg)] transition-opacity hover:opacity-80 disabled:opacity-35">
            <ChevronDown className="size-4" strokeWidth={2} />
          </button>
        </div>
      )}
      {mode === "live" && <p className="pb-5 pl-6 text-xs text-[var(--f-fg2)] md:pl-10">Made with Lotus</p>}
    </div>
  );
}

function PrimaryButton({ children, onClick, busy }: { children: React.ReactNode; onClick: () => void; busy?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-md bg-[var(--f-accent)] px-5 text-base font-medium text-[var(--f-accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-60">
      {busy && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
      {children}
    </button>
  );
}

function EnterHint() {
  return (
    <span className="hidden text-xs text-[var(--f-fg2)] sm:inline">
      press <strong className="font-semibold">Enter ↵</strong>
    </span>
  );
}

const fieldClass = "w-full border-0 border-b-2 border-[color-mix(in_srgb,var(--f-accent)_35%,transparent)] bg-transparent pb-2 text-2xl text-[var(--f-fg)] placeholder:text-[color-mix(in_srgb,var(--f-fg2)_60%,transparent)] focus:border-[var(--f-accent)] focus:outline-none focus-visible:outline-none";

function QuestionView({
  q,
  n,
  answer,
  error,
  busy,
  isLast,
  mode,
  slug,
  onChange,
  onPick,
  onNext,
}: {
  q: FormQuestion;
  n: number;
  answer: FormAnswer | undefined;
  error?: string;
  busy: boolean;
  isLast: boolean;
  mode: "live" | "preview";
  slug: string;
  onChange: (a: FormAnswer) => void;
  onPick: (a: FormAnswer) => void;
  onNext: () => void;
}) {
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    if (mode === "live") inputRef.current?.focus({ preventScroll: true });
  }, [mode]);
  const value = typeof answer === "string" ? answer : "";
  const picked = Array.isArray(answer) ? answer : answer ? [answer] : [];
  const errId = `err-${q.id}`;

  return (
    <fieldset aria-describedby={error ? errId : undefined}>
      <legend className="flex gap-3 text-[22px] font-medium leading-snug tracking-tight md:text-[26px]">
        <span className="num mt-[3px] inline-flex shrink-0 items-center gap-1 text-base text-[var(--f-accent)]">
          {n}
          <ArrowRight className="size-3.5" strokeWidth={2.25} />
        </span>
        <span>
          {q.title || <span className="text-[var(--f-fg2)]">Your question here</span>}
          {q.required && q.type !== "statement" && <span className="text-[var(--f-accent)]"> *</span>}
        </span>
      </legend>
      {q.description && <p className="mt-2 pl-[30px] text-base leading-relaxed text-[var(--f-fg2)]">{q.description}</p>}

      <div className="mt-7 pl-0 md:pl-[30px]">
        {(q.type === "short_text" || q.type === "email" || q.type === "phone" || q.type === "number") && (
          <input
            ref={inputRef}
            type={q.type === "email" ? "email" : q.type === "phone" ? "tel" : q.type === "number" ? "number" : "text"}
            inputMode={q.type === "number" ? "decimal" : q.type === "phone" ? "tel" : undefined}
            autoComplete={q.mapTo === "name" ? "name" : q.mapTo === "email" ? "email" : q.mapTo === "phone" ? "tel" : q.mapTo === "city" ? "address-level2" : q.mapTo === "company" ? "organization" : "off"}
            aria-label={q.title}
            aria-invalid={!!error || undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={q.placeholder || "Type your answer here…"}
            className={fieldClass}
          />
        )}
        {q.type === "long_text" && (
          <>
            <textarea ref={inputRef} aria-label={q.title} aria-invalid={!!error || undefined} value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={q.placeholder || "Type your answer here…"} className={`${fieldClass} resize-none text-xl leading-relaxed`} />
            <p className="mt-2 text-xs text-[var(--f-fg2)]">
              <strong className="font-semibold">Shift ⇧ + Enter ↵</strong> for a new line
            </p>
          </>
        )}
        {q.type === "date" && <input ref={inputRef} type="date" aria-label={q.title} aria-invalid={!!error || undefined} value={value} onChange={(e) => onChange(e.target.value)} className={`${fieldClass} max-w-[280px] [color-scheme:light_dark]`} />}

        {(q.type === "multiple_choice" || q.type === "checkboxes") && (
          <div role={q.type === "multiple_choice" ? "radiogroup" : "group"} aria-label={q.title} className="flex max-w-[420px] flex-col gap-2">
            {q.type === "checkboxes" && <p className="-mt-3 mb-1 text-sm text-[var(--f-fg2)]">Choose as many as you like</p>}
            {(q.choices ?? []).map((c, i) => {
              const on = picked.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  role={q.type === "multiple_choice" ? "radio" : "checkbox"}
                  aria-checked={on}
                  onClick={() => (q.type === "multiple_choice" ? onPick(c.id) : onChange(on ? picked.filter((x) => x !== c.id) : [...picked, c.id]))}
                  className={`flex min-h-11 items-center gap-3 rounded-md border px-2.5 py-2 text-left text-lg transition-colors duration-150 ${on ? "border-[var(--f-accent)] bg-[color-mix(in_srgb,var(--f-accent)_14%,var(--f-field))]" : "border-[color-mix(in_srgb,var(--f-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--f-accent)_5%,var(--f-field))] hover:bg-[color-mix(in_srgb,var(--f-accent)_10%,var(--f-field))]"}`}
                >
                  <span className={`grid size-6 shrink-0 place-items-center rounded border text-xs font-semibold ${on ? "border-[var(--f-accent)] bg-[var(--f-accent)] text-[var(--f-accent-fg)]" : "border-[color-mix(in_srgb,var(--f-accent)_40%,transparent)] bg-[var(--f-field)]"}`}>{LETTERS[i]}</span>
                  <span className="min-w-0 flex-1">{c.label || <span className="text-[var(--f-fg2)]">Choice {i + 1}</span>}</span>
                  {on && <Check className="size-4 shrink-0 text-[var(--f-accent)]" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        )}

        {q.type === "dropdown" && (
          <select aria-label={q.title} aria-invalid={!!error || undefined} value={value} onChange={(e) => onChange(e.target.value)} className={`${fieldClass} max-w-[420px] cursor-pointer appearance-none bg-[length:16px] bg-[right_4px_center] bg-no-repeat text-xl`}>
            <option value="">Pick one…</option>
            {(q.choices ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        )}

        {q.type === "yes_no" && (
          <div role="radiogroup" aria-label={q.title} className="flex max-w-[260px] flex-col gap-2">
            {(["yes", "no"] as const).map((v) => {
              const on = value === v;
              return (
                <button key={v} type="button" role="radio" aria-checked={on} onClick={() => onPick(v)} className={`flex h-11 items-center gap-3 rounded-md border px-2.5 text-left text-lg transition-colors duration-150 ${on ? "border-[var(--f-accent)] bg-[color-mix(in_srgb,var(--f-accent)_14%,var(--f-field))]" : "border-[color-mix(in_srgb,var(--f-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--f-accent)_5%,var(--f-field))] hover:bg-[color-mix(in_srgb,var(--f-accent)_10%,var(--f-field))]"}`}>
                  <span className={`grid size-6 place-items-center rounded border text-xs font-semibold ${on ? "border-[var(--f-accent)] bg-[var(--f-accent)] text-[var(--f-accent-fg)]" : "border-[color-mix(in_srgb,var(--f-accent)_40%,transparent)] bg-[var(--f-field)]"}`}>{v === "yes" ? "Y" : "N"}</span>
                  {v === "yes" ? "Yes" : "No"}
                </button>
              );
            })}
          </div>
        )}

        {q.type === "rating" && (
          <div role="radiogroup" aria-label={q.title} className="flex flex-wrap gap-1.5">
            {Array.from({ length: q.steps ?? 5 }, (_, i) => {
              const n = i + 1;
              const on = Number(value) >= n;
              return (
                <button key={n} type="button" role="radio" aria-checked={Number(value) === n} aria-label={`${n} of ${q.steps ?? 5}`} onClick={() => onPick(String(n))} className="grid size-12 place-items-center rounded-md transition-transform duration-150 hover:scale-105">
                  <Star className="size-9" strokeWidth={1.25} style={{ color: "var(--f-accent)", fill: on ? "var(--f-accent)" : "transparent" }} />
                </button>
              );
            })}
          </div>
        )}

        {q.type === "opinion_scale" && (
          <div>
            <div role="radiogroup" aria-label={q.title} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${(q.steps ?? 10) + 1}, minmax(0, 1fr))` }}>
              {Array.from({ length: (q.steps ?? 10) + 1 }, (_, n) => {
                const on = value === String(n);
                return (
                  <button key={n} type="button" role="radio" aria-checked={on} onClick={() => onPick(String(n))} className={`num h-12 rounded-md border text-base font-medium transition-colors duration-150 ${on ? "border-[var(--f-accent)] bg-[var(--f-accent)] text-[var(--f-accent-fg)]" : "border-[color-mix(in_srgb,var(--f-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--f-accent)_5%,var(--f-field))] hover:bg-[color-mix(in_srgb,var(--f-accent)_12%,var(--f-field))]"}`}>
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-sm text-[var(--f-fg2)]">
              <span>Not likely</span>
              <span>Very likely</span>
            </div>
          </div>
        )}

        {q.type === "file_upload" && <Upload q={q} slug={slug} mode={mode} value={picked} onChange={onChange} />}

        {error && (
          <p id={errId} role="alert" className="mt-3 inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium" style={{ color: ERROR, backgroundColor: `color-mix(in srgb, ${ERROR} 10%, transparent)` }}>
            {error}
          </p>
        )}

        {(!hasChoices(q.type) || q.type === "checkboxes" || q.type === "dropdown") && q.type !== "yes_no" && q.type !== "rating" && q.type !== "opinion_scale" && (
          <div className="mt-7 flex items-center gap-3">
            <PrimaryButton onClick={onNext} busy={busy}>
              {isLast ? "Submit" : q.type === "statement" ? "Continue" : "OK"}
              {!isLast && <Check className="size-4" strokeWidth={2.5} />}
            </PrimaryButton>
            <EnterHint />
          </div>
        )}
        {(q.type === "multiple_choice" || q.type === "yes_no" || q.type === "rating" || q.type === "opinion_scale") && isLast && !isEmpty(answer) && (
          <div className="mt-7">
            <PrimaryButton onClick={onNext} busy={busy}>
              Submit
            </PrimaryButton>
          </div>
        )}
      </div>
    </fieldset>
  );
}

function Upload({ q, slug, mode, value, onChange }: { q: FormQuestion; slug: string; mode: "live" | "preview"; value: string[]; onChange: (a: FormAnswer) => void }) {
  const [files, setFiles] = useState<{ id: string; name: string; size: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = files.filter((f) => value.includes(f.id));

  async function upload(list: FileList | null) {
    if (!list?.length || mode === "preview") return;
    setBusy(true);
    setError(null);
    const added: typeof files = [];
    for (const file of Array.from(list).slice(0, 5 - shown.length)) {
      const body = new FormData();
      body.set("file", file);
      body.set("questionId", q.id);
      const res = await fetch(`/api/forms/${slug}/upload`, { method: "POST", body }).catch(() => null);
      const json = res ? await res.json().catch(() => null) : null;
      if (!res?.ok || !json?.id) {
        setError(json?.error ?? "That upload didn't go through. Try again.");
        continue;
      }
      added.push({ id: json.id, name: json.name, size: json.size });
    }
    setBusy(false);
    if (added.length) {
      setFiles((f) => [...f, ...added]);
      onChange([...value.filter((id) => files.some((f) => f.id === id)), ...added.map((a) => a.id)]);
    }
  }

  return (
    <div className="max-w-[460px]">
      <label className={`flex h-36 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-[color-mix(in_srgb,var(--f-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--f-accent)_4%,var(--f-field))] text-center transition-colors ${mode === "preview" ? "cursor-default" : "cursor-pointer hover:bg-[color-mix(in_srgb,var(--f-accent)_9%,var(--f-field))]"}`}>
        {busy ? <Loader2 className="size-6 animate-spin text-[var(--f-accent)]" strokeWidth={1.75} /> : <FileUp className="size-6 text-[var(--f-accent)]" strokeWidth={1.5} />}
        <span className="text-base">
          <strong className="font-semibold">Choose a file</strong> or drag it here
        </span>
        <span className="text-xs text-[var(--f-fg2)]">Images, PDF, Word or Excel · up to 10 MB</span>
        <input type="file" multiple disabled={mode === "preview" || busy} className="sr-only" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={(e) => upload(e.target.files)} />
      </label>
      {mode === "preview" && <p className="mt-2 text-xs text-[var(--f-fg2)]">Uploads work on the live form.</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm" style={{ color: ERROR }}>
          {error}
        </p>
      )}
      {shown.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {shown.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-md border border-[var(--f-line)] bg-[var(--f-field)] px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="num text-xs text-[var(--f-fg2)]">{f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(value.filter((id) => id !== f.id))} className="grid size-6 place-items-center rounded hover:bg-[color-mix(in_srgb,var(--f-fg)_8%,transparent)]">
                <X className="size-3.5" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The screen shown when a form is closed or in draft. */
export function FormUnavailable({ theme, brand, title, body }: { theme: FormDefinition["theme"]; brand?: string; title: string; body: string }) {
  const t = formThemes[theme];
  return (
    <div className="flex min-h-dvh flex-col px-6 py-6 md:px-10" style={{ backgroundColor: t.bg, color: t.fg }}>
      {brand && <div className="text-sm font-semibold tracking-tight">{brand}</div>}
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
        <p className="mt-3 text-lg" style={{ color: t.fg2 }}>
          {body}
        </p>
      </div>
    </div>
  );
}
