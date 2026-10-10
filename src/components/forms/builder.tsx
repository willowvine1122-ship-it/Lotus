"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ExternalLink,
  Eye,
  GitBranch,
  Hand,
  Loader2,
  Monitor,
  Plus,
  Settings2,
  Smartphone,
  Flag,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/page-header";
import { Field, Input, Select, Textarea } from "@/components/form";
import { CodeBlock, CopyField } from "@/components/integrations/ui";
import type {
  FormChoice,
  FormContactField,
  FormDefinition,
  FormEnding,
  FormLogicRule,
  FormQuestion,
  FormQuestionType,
  FormThemeKey,
} from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import type { FormResult } from "@/app/agency/forms/actions";
import { FormHeader, inkBandButton } from "./header";
import {
  contactFieldLabel,
  eid,
  formIssues,
  formThemes,
  hasChoices,
  maxScore,
  newQuestion,
  opLabel,
  opsFor,
  questionGroups,
  questionTypeLabel,
  ruleId,
  slugify,
  type ClientRef,
} from "./model";
import { FormRunner } from "./runner";
import { questionIcon, smallButton } from "./ui";

/*
 * The form builder: an outline of screens on the left, the live form in the
 * middle (exactly what respondents see, in the form's theme), and the editor
 * for the selected screen on the right. Everything is a local draft until
 * Save; Cmd/Ctrl+S saves, and leaving with edits asks first.
 */

type Sel =
  | { kind: "welcome" }
  | { kind: "question"; id: string }
  | { kind: "ending"; id: string }
  | { kind: "settings" };

export interface BuilderActions {
  save: (id: string, input: unknown) => Promise<FormResult>;
  setStatus: (
    id: string,
    status: "draft" | "live" | "closed",
  ) => Promise<FormResult>;
  duplicate: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const draftOf = (f: FormDefinition) => ({
  name: f.name,
  slug: f.slug,
  welcome: f.welcome,
  questions: f.questions,
  endings: f.endings,
  hiddenFields: f.hiddenFields,
  theme: f.theme,
  scoring: f.scoring,
  tags: f.tags,
  notify: f.notify ?? "",
});

export function FormBuilder({
  initial,
  client,
  responses,
  origin,
  nowIso,
  actions,
}: {
  initial: FormDefinition;
  client: ClientRef;
  responses: number;
  origin: string;
  nowIso: string;
  actions: BuilderActions;
}) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [form, setForm] = useState<FormDefinition>(initial);
  const [savedJson, setSavedJson] = useState(() =>
    JSON.stringify(draftOf(initial)),
  );
  const [sel, setSel] = useState<Sel>(
    initial.questions[0]
      ? { kind: "question", id: initial.questions[0].id }
      : { kind: "settings" },
  );
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [showIssues, setShowIssues] = useState(false);
  const [notice, setNotice] = useState<{
    ok: boolean;
    message?: string;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(draftOf(form)) !== savedJson;
  const issues = useMemo(() => formIssues(form), [form]);
  const blocking = issues.filter((i) => i.blocking);
  const badIds = new Set(
    showIssues ? blocking.map((i) => i.questionId).filter(Boolean) : [],
  );

  const patch = (p: Partial<FormDefinition>) =>
    setForm((f) => ({ ...f, ...p }));
  const patchQ = (id: string, p: Partial<FormQuestion>) =>
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q) => (q.id === id ? { ...q, ...p } : q)),
    }));
  const patchEnding = (id: string, p: Partial<FormEnding>) =>
    setForm((f) => ({
      ...f,
      endings: f.endings.map((e) => (e.id === id ? { ...e, ...p } : e)),
    }));

  function save(then?: () => void) {
    start(async () => {
      const res = await actions.save(form.id, draftOf(form));
      setErrors(res.errors ?? {});
      setNotice(res);
      if (res.ok) {
        setSavedJson(JSON.stringify(draftOf(form)));
        setForm((f) => ({
          ...f,
          updatedAt: new Date().toISOString(),
          status: res.message?.includes("back in draft") ? "draft" : f.status,
        }));
        router.refresh();
        then?.();
      } else if (
        res.errors?.slug ||
        res.errors?.name ||
        res.errors?.notify ||
        Object.keys(res.errors ?? {}).some(
          (k) => k.startsWith("hiddenFields") || k.startsWith("tags"),
        )
      )
        setSel({ kind: "settings" });
    });
  }

  function setStatus(status: "draft" | "live" | "closed") {
    if (status === "live") {
      setShowIssues(true);
      if (blocking.length) {
        setNotice({
          ok: false,
          message:
            blocking.length === 1
              ? blocking[0]!.message
              : `${blocking.length} things to finish before publishing`,
        });
        const q = blocking.find((i) => i.questionId);
        if (q?.questionId) setSel({ kind: "question", id: q.questionId });
        return;
      }
    }
    const go = () =>
      start(async () => {
        const res = await actions.setStatus(form.id, status);
        setNotice(res);
        if (res.ok) {
          setForm((f) => ({ ...f, status }));
          router.refresh();
        }
      });
    if (dirty) save(go);
    else go();
  }

  // Cmd/Ctrl+S saves; leaving with edits asks first.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [dirty]);

  function addQuestion(type: FormQuestionType) {
    const q = newQuestion(type);
    const at =
      sel.kind === "question"
        ? form.questions.findIndex((x) => x.id === sel.id) + 1
        : form.questions.length;
    // Don't map a second question to a contact field that's already taken.
    if (q.mapTo && form.questions.some((x) => x.mapTo === q.mapTo))
      delete q.mapTo;
    setForm((f) => ({
      ...f,
      questions: [...f.questions.slice(0, at), q, ...f.questions.slice(at)],
    }));
    setSel({ kind: "question", id: q.id });
    setAdding(false);
  }

  function move(id: string, by: -1 | 1) {
    setForm((f) => {
      const i = f.questions.findIndex((q) => q.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= f.questions.length) return f;
      const qs = [...f.questions];
      [qs[i], qs[j]] = [qs[j]!, qs[i]!];
      return { ...f, questions: qs };
    });
  }

  function removeQuestion(id: string) {
    const i = form.questions.findIndex((q) => q.id === id);
    setForm((f) => ({
      ...f,
      // Jumps to the removed question fall through to the next one.
      questions: f.questions
        .filter((q) => q.id !== id)
        .map((q) =>
          q.logic?.some((r) => r.goTo === id)
            ? { ...q, logic: q.logic.filter((r) => r.goTo !== id) }
            : q,
        ),
    }));
    const next = form.questions[i + 1] ?? form.questions[i - 1];
    setSel(
      next && next.id !== id
        ? { kind: "question", id: next.id }
        : { kind: "settings" },
    );
  }

  function duplicateQuestion(id: string) {
    const q = form.questions.find((x) => x.id === id);
    if (!q) return;
    const copy: FormQuestion = {
      ...structuredClone(q),
      id: newQuestion(q.type).id,
      title: `${q.title} (copy)`,
      mapTo: undefined,
      logic: [],
    };
    copy.choices = copy.choices?.map((c) => ({
      ...c,
      id: `c-${Math.random().toString(36).slice(2, 9)}`,
    }));
    const i = form.questions.findIndex((x) => x.id === id);
    setForm((f) => ({
      ...f,
      questions: [
        ...f.questions.slice(0, i + 1),
        copy,
        ...f.questions.slice(i + 1),
      ],
    }));
    setSel({ kind: "question", id: copy.id });
  }

  const selectedQ =
    sel.kind === "question"
      ? form.questions.find((q) => q.id === sel.id)
      : undefined;
  const selectedEnding =
    sel.kind === "ending"
      ? form.endings.find((e) => e.id === sel.id)
      : undefined;
  const previewStart =
    sel.kind === "welcome" && form.welcome.enabled
      ? ({ kind: "welcome" } as const)
      : selectedQ
        ? ({ kind: "question", id: selectedQ.id } as const)
        : selectedEnding
          ? ({
              kind: "ending",
              id: selectedEnding.id,
              score: form.scoring ? (selectedEnding.minScore ?? 0) : undefined,
            } as const)
          : undefined;
  const previewKey = `${sel.kind}:${"id" in sel ? sel.id : ""}:${device}:${form.theme}`;
  const url = `${origin}/form/${form.slug}`;

  const primary = dirty ? (
    <Button onClick={() => save()} disabled={pending} className="h-8">
      {pending && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
      Save
    </Button>
  ) : form.status !== "live" ? (
    <Button
      onClick={() => setStatus("live")}
      disabled={pending}
      className="h-8"
    >
      {pending && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
      {form.status === "closed" ? "Reopen" : "Publish"}
    </Button>
  ) : null;

  const preview = (
    <div
      className={cn(
        "mx-auto h-full overflow-hidden rounded-md border border-line-strong bg-surface shadow-1 transition-[max-width] duration-200",
        device === "phone" ? "max-w-[390px]" : "max-w-[1000px]",
      )}
    >
      <FormRunner
        key={previewKey}
        form={form}
        brand={client.name}
        mode="preview"
        start={previewStart}
      />
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <FormHeader
        id={form.id}
        name={form.name}
        status={form.status}
        client={client}
        tab="build"
        responses={responses}
        meta={
          <span className="num">
            {form.questions.filter((q) => q.type !== "statement").length}{" "}
            questions ·{" "}
            {dirty ? (
              <span className="font-medium text-rail-fg">Unsaved changes</span>
            ) : (
              `Saved ${timeAgo(form.updatedAt, now)}`
            )}
          </span>
        }
        actions={
          <>
            {notice?.message && (
              <span
                role="status"
                className={cn(
                  "max-w-[34ch] truncate text-xs",
                  notice.ok ? "text-rail-fg-2" : "font-medium text-[#ff9b8a]",
                )}
              >
                {notice.message}
              </span>
            )}
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className={cn(inkBandButton, "xl:hidden")}
            >
              <Eye className="size-3.5" strokeWidth={2} />
              Preview
            </button>
            {form.status === "live" && (
              <a
                href={`/form/${form.slug}`}
                target="_blank"
                rel="noreferrer"
                className={inkBandButton}
              >
                <ExternalLink className="size-3.5" strokeWidth={2} />
                Open live
              </a>
            )}
            {form.status === "live" && !dirty && (
              <button
                type="button"
                onClick={() => setStatus("closed")}
                disabled={pending}
                className={inkBandButton}
              >
                Close form
              </button>
            )}
            {dirty && form.status !== "live" && (
              <button
                type="button"
                onClick={() => setStatus("live")}
                disabled={pending}
                className={inkBandButton}
              >
                Save and publish
              </button>
            )}
            {primary}
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Outline */}
        <nav
          aria-label="Form outline"
          className="shrink-0 border-b border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-[264px] lg:overflow-y-auto lg:border-b-0 lg:border-r"
        >
          <div className="px-3 py-3">
            <OutlineItem
              active={sel.kind === "welcome"}
              onClick={() => setSel({ kind: "welcome" })}
              icon={Hand}
              label="Welcome screen"
              muted={!form.welcome.enabled}
              aside={form.welcome.enabled ? undefined : "Off"}
            />
          </div>
          <div className="border-t border-line px-3 py-3">
            <div className="mb-1.5 flex items-center justify-between px-2">
              <h2 className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
                Questions
              </h2>
              <span className="num text-2xs text-fg-3">
                {form.questions.length}
              </span>
            </div>
            <ol className="flex flex-col gap-0.5">
              {form.questions.map((q, i) => {
                const Icon = questionIcon[q.type];
                return (
                  <li key={q.id}>
                    <OutlineItem
                      active={sel.kind === "question" && sel.id === q.id}
                      onClick={() => setSel({ kind: "question", id: q.id })}
                      icon={Icon}
                      n={i + 1}
                      label={q.title || "Untitled question"}
                      muted={!q.title}
                      bad={badIds.has(q.id)}
                      aside={
                        q.logic?.length ? (
                          <GitBranch
                            className="size-3.5 text-fg-3"
                            strokeWidth={1.75}
                            aria-label="Has jumps"
                          />
                        ) : undefined
                      }
                    />
                  </li>
                );
              })}
            </ol>
            <div className="relative mt-2">
              <button
                type="button"
                onClick={() => setAdding((a) => !a)}
                aria-expanded={adding}
                className="flex h-8 w-full items-center gap-2 rounded border border-dashed border-line-strong px-2.5 text-sm text-fg-2 transition-colors hover:border-fg-3 hover:bg-surface-2/60 hover:text-fg"
              >
                <Plus className="size-4" strokeWidth={2} />
                Add question
              </button>
              {adding && (
                <AddMenu
                  onPick={addQuestion}
                  onClose={() => setAdding(false)}
                />
              )}
            </div>
          </div>
          <div className="border-t border-line px-3 py-3">
            <div className="mb-1.5 flex items-center justify-between px-2">
              <h2 className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
                Closing screens
              </h2>
              <button
                type="button"
                aria-label="Add closing screen"
                onClick={() => {
                  const e: FormEnding = {
                    id: eid(),
                    title: "Thanks!",
                    body: "",
                    minScore: form.scoring ? 0 : undefined,
                  };
                  patch({ endings: [...form.endings, e] });
                  setSel({ kind: "ending", id: e.id });
                }}
                className="grid size-6 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg"
              >
                <Plus className="size-3.5" strokeWidth={2} />
              </button>
            </div>
            {form.endings.map((e) => (
              <OutlineItem
                key={e.id}
                active={sel.kind === "ending" && sel.id === e.id}
                onClick={() => setSel({ kind: "ending", id: e.id })}
                icon={Flag}
                label={e.title || "Untitled ending"}
                aside={
                  form.scoring && form.endings.length > 1 ? (
                    <span className="num text-2xs text-fg-3">
                      {e.minScore ?? 0}+
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
          <div className="border-t border-line px-3 py-3">
            <OutlineItem
              active={sel.kind === "settings"}
              onClick={() => setSel({ kind: "settings" })}
              icon={Settings2}
              label="Settings and sharing"
              bad={showIssues && (!!errors.slug || !!errors.name)}
            />
          </div>
        </nav>

        {/* Live preview */}
        <section
          aria-label="Preview"
          className="hidden min-w-0 flex-1 flex-col bg-surface-2/60 xl:flex"
        >
          <div className="sticky top-0 flex h-screen flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-fg-3">
                Preview. Click through it; nothing is sent.
              </p>
              <div
                className="inline-flex rounded border border-line-strong bg-surface p-0.5"
                role="radiogroup"
                aria-label="Device"
              >
                {(["desktop", "phone"] as const).map((d) => {
                  const Icon = d === "desktop" ? Monitor : Smartphone;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={device === d}
                      aria-label={d === "desktop" ? "Desktop" : "Phone"}
                      onClick={() => setDevice(d)}
                      className={cn(
                        "grid h-6 w-8 place-items-center rounded-[3px] transition-colors",
                        device === d
                          ? "bg-rail text-rail-fg"
                          : "text-fg-3 hover:text-fg",
                      )}
                    >
                      <Icon className="size-3.5" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="min-h-0 flex-1">{preview}</div>
          </div>
        </section>

        {/* Editor */}
        <aside
          aria-label="Editor"
          className="min-w-0 border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:flex-1 lg:overflow-y-auto lg:border-l xl:w-[384px] xl:flex-none 2xl:w-[420px]"
        >
          {showIssues && blocking.length > 0 && (
            <div
              className="border-b border-line bg-red-soft/40 px-5 py-3 text-xs text-red"
              role="alert"
            >
              <p className="font-medium">
                {blocking.length === 1
                  ? "1 thing to finish before publishing"
                  : `${blocking.length} things to finish before publishing`}
              </p>
              <ul className="mt-1 list-disc pl-4">
                {blocking.slice(0, 4).map((i, k) => (
                  <li key={k}>
                    {i.questionId ? (
                      <button
                        type="button"
                        className="underline-offset-2 hover:underline"
                        onClick={() =>
                          setSel({ kind: "question", id: i.questionId! })
                        }
                      >
                        Question{" "}
                        {form.questions.findIndex(
                          (q) => q.id === i.questionId,
                        ) + 1}
                        : {i.message.toLowerCase()}
                      </button>
                    ) : (
                      i.message
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sel.kind === "welcome" && (
            <WelcomeEditor
              form={form}
              onChange={(w) => patch({ welcome: { ...form.welcome, ...w } })}
            />
          )}
          {selectedQ && (
            <QuestionEditor
              key={selectedQ.id}
              q={selectedQ}
              n={form.questions.indexOf(selectedQ) + 1}
              form={form}
              onChange={(p) => patchQ(selectedQ.id, p)}
              onMove={(by) => move(selectedQ.id, by)}
              onDuplicate={() => duplicateQuestion(selectedQ.id)}
              onRemove={() => removeQuestion(selectedQ.id)}
              issues={
                showIssues
                  ? blocking
                      .filter((i) => i.questionId === selectedQ.id)
                      .map((i) => i.message)
                  : []
              }
            />
          )}
          {selectedEnding && (
            <EndingEditor
              key={selectedEnding.id}
              ending={selectedEnding}
              scoring={form.scoring}
              maxScore={maxScore(form)}
              canRemove={form.endings.length > 1}
              onChange={(p) => patchEnding(selectedEnding.id, p)}
              onRemove={() => {
                const rest = form.endings.filter(
                  (e) => e.id !== selectedEnding.id,
                );
                patch({ endings: rest });
                setSel({ kind: "ending", id: rest[0]!.id });
              }}
            />
          )}
          {sel.kind === "settings" && (
            <SettingsEditor
              form={form}
              url={url}
              errors={errors}
              warnings={issues.filter((i) => !i.blocking).map((i) => i.message)}
              onChange={patch}
              actions={actions}
              pending={pending}
            />
          )}
        </aside>
      </div>

      {previewOpen && (
        <div
          className="fixed inset-0 z-30 flex flex-col bg-surface-2 xl:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Preview"
        >
          <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2.5">
            <p className="text-sm font-medium">Preview</p>
            <button
              type="button"
              aria-label="Close preview"
              onClick={() => setPreviewOpen(false)}
              className="grid size-8 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
          <div className="min-h-0 flex-1 p-3">{preview}</div>
        </div>
      )}
    </div>
  );
}

function OutlineItem({
  active,
  onClick,
  icon: Icon,
  n,
  label,
  muted,
  bad,
  aside,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  n?: number;
  label: string;
  muted?: boolean;
  bad?: boolean;
  aside?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm transition-colors duration-100",
        active
          ? "bg-surface-2 text-fg shadow-[inset_2px_0_0_var(--rail)]"
          : "text-fg-2 hover:bg-surface-2/60 hover:text-fg",
      )}
    >
      <Icon className="size-3.5 shrink-0 text-fg-3" strokeWidth={1.75} />
      {n !== undefined && (
        <span className="num w-4 shrink-0 text-xs text-fg-3">{n}</span>
      )}
      <span className={cn("min-w-0 flex-1 truncate", muted && "text-fg-3")}>
        {label}
      </span>
      {bad && (
        <span
          className="size-1.5 shrink-0 rounded-full bg-red"
          aria-label="Needs finishing"
        />
      )}
      {aside}
    </button>
  );
}

function AddMenu({
  onPick,
  onClose,
}: {
  onPick: (t: FormQuestionType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="menu"
      className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[60vh] overflow-y-auto rounded border border-line-strong bg-surface py-1 shadow-2 lg:left-0 lg:right-auto lg:w-[240px]"
    >
      {questionGroups.map((g) => (
        <div key={g.label} className="py-1">
          <p className="px-3 pb-1 pt-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
            {g.label}
          </p>
          {g.types.map((t) => {
            const Icon = questionIcon[t];
            return (
              <button
                key={t}
                type="button"
                role="menuitem"
                onClick={() => onPick(t)}
                className="flex h-8 w-full items-center gap-2.5 px-3 text-left text-sm hover:bg-surface-2"
              >
                <Icon className="size-3.5 text-fg-3" strokeWidth={1.75} />
                {questionTypeLabel[t]}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PanelHead({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold leading-6">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-fg-3">{sub}</p>}
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-1">{children}</div>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-5 w-9 rounded-full bg-line-strong transition-colors peer-checked:bg-rail peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand" />
        <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-surface shadow-1 transition-transform peer-checked:translate-x-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-xs leading-relaxed text-fg-3">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

const iconButton =
  "grid size-8 place-items-center rounded text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-40";

function WelcomeEditor({
  form,
  onChange,
}: {
  form: FormDefinition;
  onChange: (w: Partial<FormDefinition["welcome"]>) => void;
}) {
  const w = form.welcome;
  return (
    <div>
      <PanelHead
        title="Welcome screen"
        sub="The first thing people see, before question 1."
      />
      <div className="flex flex-col gap-4 px-5 py-5">
        <Toggle
          checked={w.enabled}
          onChange={(enabled) => onChange({ enabled })}
          label="Show a welcome screen"
          hint="Worth it for longer forms: say what it's for and how long it takes."
        />
        {w.enabled && (
          <>
            <Field label="Headline" htmlFor="w-title">
              <Input
                id="w-title"
                value={w.title}
                onChange={(e) => onChange({ title: e.target.value })}
                maxLength={200}
                placeholder={form.name}
              />
            </Field>
            <Field label="Text" htmlFor="w-body">
              <Textarea
                id="w-body"
                value={w.body}
                onChange={(e) => onChange({ body: e.target.value })}
                maxLength={1000}
                rows={3}
                placeholder="Two minutes, and a real person reads every answer."
              />
            </Field>
            <Field label="Button" htmlFor="w-button">
              <Input
                id="w-button"
                value={w.button}
                onChange={(e) => onChange({ button: e.target.value })}
                maxLength={30}
                placeholder="Start"
              />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

function QuestionEditor({
  q,
  n,
  form,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  issues,
}: {
  q: FormQuestion;
  n: number;
  form: FormDefinition;
  onChange: (p: Partial<FormQuestion>) => void;
  onMove: (by: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  issues: string[];
}) {
  const [confirm, setConfirm] = useState(false);
  const Icon = questionIcon[q.type];
  const mappable =
    q.type === "short_text" || q.type === "email" || q.type === "phone";
  const takenMaps = new Set(
    form.questions.filter((x) => x.id !== q.id && x.mapTo).map((x) => x.mapTo!),
  );

  function changeType(type: FormQuestionType) {
    const fresh = newQuestion(type);
    onChange({
      type,
      choices: hasChoices(type)
        ? q.choices?.length
          ? q.choices
          : fresh.choices
        : undefined,
      steps:
        type === "rating" || type === "opinion_scale" ? fresh.steps : undefined,
      mapTo:
        type === "email"
          ? takenMaps.has("email")
            ? undefined
            : "email"
          : type === "phone"
            ? takenMaps.has("phone")
              ? undefined
              : "phone"
            : type === "short_text"
              ? q.mapTo
              : undefined,
      required: type === "statement" ? false : q.required,
      logic: [],
    });
  }

  return (
    <div>
      <PanelHead title={`Question ${n}`} sub={questionTypeLabel[q.type]}>
        <button
          type="button"
          aria-label="Move up"
          onClick={() => onMove(-1)}
          disabled={n === 1}
          className={iconButton}
        >
          <ArrowUp className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="Move down"
          onClick={() => onMove(1)}
          disabled={n === form.questions.length}
          className={iconButton}
        >
          <ArrowDown className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="Duplicate question"
          onClick={onDuplicate}
          className={iconButton}
        >
          <Copy className="size-4" strokeWidth={1.75} />
        </button>
      </PanelHead>
      {issues.length > 0 && (
        <ul
          className="border-b border-line px-5 py-2.5 text-xs text-red"
          role="alert"
        >
          {issues.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-4 px-5 py-5">
        <Field label="Type" htmlFor="q-type">
          <div className="relative">
            <Icon
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-3"
              strokeWidth={1.75}
            />
            <Select
              id="q-type"
              value={q.type}
              onChange={(e) => changeType(e.target.value as FormQuestionType)}
              className="pl-8"
            >
              {questionGroups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.types.map((t) => (
                    <option key={t} value={t}>
                      {questionTypeLabel[t]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
        </Field>
        <Field
          label={q.type === "statement" ? "Text" : "Question"}
          htmlFor="q-title"
        >
          <Textarea
            id="q-title"
            value={q.title}
            onChange={(e) => onChange({ title: e.target.value })}
            maxLength={300}
            rows={2}
            className="min-h-[64px]"
            placeholder="What's your question?"
            aria-invalid={!q.title.trim() && issues.length > 0}
            autoFocus={!q.title}
          />
        </Field>
        <Field
          label="Description"
          htmlFor="q-desc"
          hint="Optional. Shown under the question in smaller text."
        >
          <Input
            id="q-desc"
            value={q.description ?? ""}
            onChange={(e) =>
              onChange({ description: e.target.value || undefined })
            }
            maxLength={1000}
          />
        </Field>
        {q.type !== "statement" && (
          <Toggle
            checked={q.required}
            onChange={(required) => onChange({ required })}
            label="Required"
            hint={q.required ? "People can't skip it." : "People can skip it."}
          />
        )}

        {hasChoices(q.type) && (
          <ChoicesEditor
            q={q}
            scoring={form.scoring}
            onChange={(choices) => onChange({ choices })}
          />
        )}
        {q.type === "rating" && (
          <Field label="Stars" htmlFor="q-steps">
            <Select
              id="q-steps"
              value={q.steps ?? 5}
              onChange={(e) => onChange({ steps: Number(e.target.value) })}
            >
              {[3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {q.type === "opinion_scale" && (
          <Field label="Scale" htmlFor="q-steps">
            <Select
              id="q-steps"
              value={q.steps ?? 10}
              onChange={(e) => onChange({ steps: Number(e.target.value) })}
            >
              <option value={5}>0 to 5</option>
              <option value={10}>0 to 10 (NPS)</option>
            </Select>
          </Field>
        )}
        {(q.type === "short_text" ||
          q.type === "long_text" ||
          q.type === "email" ||
          q.type === "phone" ||
          q.type === "number") && (
          <Field label="Placeholder" htmlFor="q-ph">
            <Input
              id="q-ph"
              value={q.placeholder ?? ""}
              onChange={(e) =>
                onChange({ placeholder: e.target.value || undefined })
              }
              maxLength={120}
              placeholder="Type your answer here…"
            />
          </Field>
        )}
        {mappable && (
          <Field
            label="Save the answer to the contact as"
            htmlFor="q-map"
            hint="Answers to email and phone find the existing contact, so nobody is added twice."
          >
            <Select
              id="q-map"
              value={q.mapTo ?? ""}
              onChange={(e) =>
                onChange({
                  mapTo: (e.target.value || undefined) as
                    | FormContactField
                    | undefined,
                })
              }
            >
              <option value="">Don&apos;t save to the contact</option>
              {(Object.keys(contactFieldLabel) as FormContactField[]).map(
                (f) => (
                  <option key={f} value={f} disabled={takenMaps.has(f)}>
                    {contactFieldLabel[f]}
                    {takenMaps.has(f) ? " (used)" : ""}
                  </option>
                ),
              )}
            </Select>
          </Field>
        )}
        {q.type === "file_upload" && (
          <p className="rounded border border-line bg-surface-2/60 px-3 py-2 text-xs leading-relaxed text-fg-2">
            Up to 5 files per answer, 10 MB each: images, PDF, Word, Excel or
            text. Files open from the response.
          </p>
        )}
      </div>

      {q.type !== "statement" && (
        <LogicEditor
          q={q}
          form={form}
          onChange={(logic) => onChange({ logic })}
        />
      )}

      <div className="border-t border-line px-5 py-4">
        {confirm ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-fg-2">Delete this question?</span>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex h-7 items-center rounded border border-red/40 bg-surface px-2.5 text-xs font-medium text-red hover:bg-red-soft"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className={smallButton}
            >
              Keep it
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-red"
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
            Delete question
          </button>
        )}
      </div>
    </div>
  );
}

function ChoicesEditor({
  q,
  scoring,
  onChange,
}: {
  q: FormQuestion;
  scoring: boolean;
  onChange: (c: FormChoice[]) => void;
}) {
  const list = q.choices ?? [];
  const set = (id: string, p: Partial<FormChoice>) =>
    onChange(list.map((c) => (c.id === id ? { ...c, ...p } : c)));
  return (
    <fieldset>
      <legend className="mb-1.5 flex w-full items-center justify-between text-sm font-medium">
        Choices
        {scoring && (
          <span className="text-xs font-normal text-fg-3">Points</span>
        )}
      </legend>
      <ol className="flex flex-col gap-1.5">
        {list.map((c, i) => (
          <li key={c.id} className="flex items-center gap-1.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-[4px] bg-surface-2 text-2xs font-semibold text-fg-2">
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[i]}
            </span>
            <Input
              aria-label={`Choice ${i + 1}`}
              value={c.label}
              onChange={(e) => set(c.id, { label: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (list.length < 30)
                    onChange([
                      ...list.slice(0, i + 1),
                      {
                        id: `c-${Math.random().toString(36).slice(2, 9)}`,
                        label: "",
                      },
                      ...list.slice(i + 1),
                    ]);
                }
              }}
              maxLength={200}
              className="h-8"
              placeholder={`Choice ${i + 1}`}
            />
            {scoring && (
              <Input
                aria-label={`Points for choice ${i + 1}`}
                type="number"
                value={c.score ?? 0}
                onChange={(e) =>
                  set(c.id, {
                    score: Math.max(
                      -100,
                      Math.min(100, Math.round(Number(e.target.value) || 0)),
                    ),
                  })
                }
                className="num h-8 w-16 shrink-0 px-2 text-right"
              />
            )}
            <button
              type="button"
              aria-label={`Remove choice ${i + 1}`}
              onClick={() => onChange(list.filter((x) => x.id !== c.id))}
              disabled={list.length <= 1}
              className={cn(iconButton, "size-7 shrink-0")}
            >
              <X className="size-3.5" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() =>
          onChange([
            ...list,
            { id: `c-${Math.random().toString(36).slice(2, 9)}`, label: "" },
          ])
        }
        disabled={list.length >= 30}
        className={cn(smallButton, "mt-2")}
      >
        <Plus className="size-3.5" strokeWidth={2} />
        Add choice
      </button>
    </fieldset>
  );
}

function LogicEditor({
  q,
  form,
  onChange,
}: {
  q: FormQuestion;
  form: FormDefinition;
  onChange: (r: FormLogicRule[]) => void;
}) {
  const rules = q.logic ?? [];
  const i = form.questions.findIndex((x) => x.id === q.id);
  const later = form.questions.slice(i + 1);
  const ops = opsFor(q.type);
  const set = (id: string, p: Partial<FormLogicRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const valueInput = (r: FormLogicRule) => {
    if (r.op === "answered") return null;
    if (q.choices && hasChoices(q.type))
      return (
        <Select
          aria-label="Answer"
          value={r.value}
          onChange={(e) => set(r.id, { value: e.target.value })}
          className="h-8"
        >
          <option value="">Pick a choice</option>
          {q.choices.map((c, k) => (
            <option key={c.id} value={c.id}>
              {c.label || `Choice ${k + 1}`}
            </option>
          ))}
        </Select>
      );
    if (q.type === "yes_no")
      return (
        <Select
          aria-label="Answer"
          value={r.value}
          onChange={(e) => set(r.id, { value: e.target.value })}
          className="h-8"
        >
          <option value="">Pick one</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </Select>
      );
    const numeric =
      q.type === "number" || q.type === "rating" || q.type === "opinion_scale";
    return (
      <Input
        aria-label="Value"
        type={numeric ? "number" : "text"}
        value={r.value}
        onChange={(e) => set(r.id, { value: e.target.value })}
        className={cn("h-8", numeric && "num")}
        maxLength={200}
        placeholder={numeric ? "0" : "text"}
      />
    );
  };

  return (
    <section className="border-t border-line px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Jumps</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-fg-3">
            Send people to a later question, or finish, based on this answer.
            The first matching jump wins.
          </p>
        </div>
      </div>
      {rules.length > 0 && (
        <ol className="mt-3 flex flex-col gap-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="rounded border border-line bg-surface-2/40 p-2.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-6 shrink-0 text-xs font-medium text-fg-3">
                  If
                </span>
                <Select
                  aria-label="Comparison"
                  value={r.op}
                  onChange={(e) =>
                    set(r.id, {
                      op: e.target.value as FormLogicRule["op"],
                      value: "",
                    })
                  }
                  className="h-8"
                >
                  {ops.map((o) => (
                    <option key={o} value={o}>
                      the answer {opLabel[o]}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  aria-label="Remove jump"
                  onClick={() => onChange(rules.filter((x) => x.id !== r.id))}
                  className={cn(iconButton, "size-7 shrink-0")}
                >
                  <X className="size-3.5" strokeWidth={2} />
                </button>
              </div>
              {r.op !== "answered" && (
                <div className="mt-1.5 pl-[30px] pr-[34px]">
                  {valueInput(r)}
                </div>
              )}
              <div className="mt-1.5 flex items-center gap-1.5 pr-[34px]">
                <span className="w-6 shrink-0 text-xs font-medium text-fg-3">
                  go to
                </span>
                <Select
                  aria-label="Go to"
                  value={r.goTo}
                  onChange={(e) => set(r.id, { goTo: e.target.value })}
                  className="h-8"
                >
                  {later.map((x) => (
                    <option key={x.id} value={x.id}>
                      {form.questions.indexOf(x) + 1}.{" "}
                      {x.title || "Untitled question"}
                    </option>
                  ))}
                  <option value="end">The end (submit)</option>
                </Select>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-xs text-fg-3">
        {rules.length ? "Otherwise, " : ""}People go on to{" "}
        {later[0] ? `question ${i + 2}` : "the end"}
        {rules.length ? "." : " unless you add a jump."}
      </p>
      <button
        type="button"
        onClick={() =>
          onChange([
            ...rules,
            {
              id: ruleId(),
              op: ops[0]!,
              value: "",
              goTo: later[1]?.id ?? later[0]?.id ?? "end",
            },
          ])
        }
        disabled={rules.length >= 10}
        className={cn(smallButton, "mt-2.5")}
      >
        <GitBranch className="size-3.5" strokeWidth={1.75} />
        Add a jump
      </button>
    </section>
  );
}

function EndingEditor({
  ending,
  scoring,
  maxScore: max,
  canRemove,
  onChange,
  onRemove,
}: {
  ending: FormEnding;
  scoring: boolean;
  maxScore: number;
  canRemove: boolean;
  onChange: (p: Partial<FormEnding>) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <PanelHead
        title="Closing screen"
        sub={
          scoring
            ? "Shown when the score reaches its minimum. The highest one reached wins."
            : "Shown after the last answer is sent."
        }
      />
      <div className="flex flex-col gap-4 px-5 py-5">
        <Field label="Headline" htmlFor="e-title">
          <Input
            id="e-title"
            value={ending.title}
            onChange={(e) => onChange({ title: e.target.value })}
            maxLength={200}
          />
        </Field>
        <Field label="Text" htmlFor="e-body">
          <Textarea
            id="e-body"
            value={ending.body}
            onChange={(e) => onChange({ body: e.target.value })}
            maxLength={1000}
            rows={3}
          />
        </Field>
        {scoring && (
          <Field
            label="Show from a score of"
            htmlFor="e-min"
            hint={
              max
                ? `The highest possible score is ${max}.`
                : "Give the choices points first."
            }
          >
            <Input
              id="e-min"
              type="number"
              value={ending.minScore ?? 0}
              onChange={(e) =>
                onChange({ minScore: Math.round(Number(e.target.value) || 0) })
              }
              className="num w-28"
            />
          </Field>
        )}
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
          <Field label="Button" htmlFor="e-btn" hint="Optional">
            <Input
              id="e-btn"
              value={ending.buttonLabel ?? ""}
              onChange={(e) =>
                onChange({ buttonLabel: e.target.value || undefined })
              }
              maxLength={40}
              placeholder="Book a call"
            />
          </Field>
          <Field label="Button link" htmlFor="e-url">
            <Input
              id="e-url"
              value={ending.buttonUrl ?? ""}
              onChange={(e) =>
                onChange({ buttonUrl: e.target.value || undefined })
              }
              maxLength={500}
              placeholder="https://…"
            />
          </Field>
        </div>
      </div>
      {canRemove && (
        <div className="border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-red"
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
            Delete closing screen
          </button>
        </div>
      )}
    </div>
  );
}

function ListInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [text, setText] = useState(value.join(", "));
  return (
    <Input
      id={id}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }}
      placeholder={placeholder}
    />
  );
}

function SettingsEditor({
  form,
  url,
  errors,
  warnings,
  onChange,
  actions,
  pending,
}: {
  form: FormDefinition;
  url: string;
  errors: Record<string, string>;
  warnings: string[];
  onChange: (p: Partial<FormDefinition>) => void;
  actions: BuilderActions;
  pending: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, start] = useTransition();
  const hiddenErr = Object.entries(errors).find(([k]) =>
    k.startsWith("hiddenFields"),
  )?.[1];
  const tagErr = Object.entries(errors).find(([k]) =>
    k.startsWith("tags"),
  )?.[1];
  const sample = form.hiddenFields.length
    ? `${url}?${form.hiddenFields.map((h) => `${h}=…`).join("&")}`
    : url;
  const embed = `<iframe src="${url}?embed=1" title="${form.name.replace(/"/g, "&quot;")}" style="width:100%;height:600px;border:0" loading="lazy"></iframe>`;
  return (
    <div>
      <PanelHead title="Settings and sharing" />
      {warnings.length > 0 && (
        <div className="border-b border-line bg-amber-soft/50 px-5 py-2.5 text-xs text-amber">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-4 px-5 py-5">
        <Field
          label="Name"
          htmlFor="s-name"
          error={errors.name}
          hint="Only your team sees it."
        >
          <Input
            id="s-name"
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            maxLength={80}
            aria-invalid={!!errors.name}
          />
        </Field>
        <Field label="Link" htmlFor="s-slug" error={errors.slug}>
          <div className="flex items-stretch">
            <span className="num inline-flex shrink-0 items-center rounded-l border border-r-0 border-line-strong bg-surface-2 px-2.5 text-xs text-fg-3">
              /form/
            </span>
            <Input
              id="s-slug"
              value={form.slug}
              onChange={(e) =>
                onChange({
                  slug: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-"),
                })
              }
              onBlur={(e) => onChange({ slug: slugify(e.target.value) })}
              maxLength={48}
              className="num rounded-l-none"
              aria-invalid={!!errors.slug}
            />
          </div>
        </Field>
      </div>

      <section className="border-t border-line px-5 py-5">
        <h3 className="text-sm font-semibold">Look</h3>
        <div
          role="radiogroup"
          aria-label="Theme"
          className="mt-3 grid grid-cols-3 gap-2"
        >
          {(Object.keys(formThemes) as FormThemeKey[]).map((k) => {
            const t = formThemes[k];
            const on = form.theme === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange({ theme: k })}
                className={cn(
                  "overflow-hidden rounded border text-left transition-shadow",
                  on
                    ? "border-rail ring-1 ring-rail"
                    : "border-line-strong hover:border-fg-3",
                )}
              >
                <span
                  className="flex h-12 flex-col justify-center gap-1 px-2.5"
                  style={{ backgroundColor: t.bg }}
                >
                  <span
                    className="block h-1.5 w-12 rounded-full"
                    style={{ backgroundColor: t.fg }}
                  />
                  <span
                    className="block h-2.5 w-7 rounded-[3px]"
                    style={{ backgroundColor: t.accent }}
                  />
                </span>
                <span className="block border-t border-line px-2.5 py-1.5 text-xs font-medium">
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-line px-5 py-5">
        <h3 className="text-sm font-semibold">Answers</h3>
        <Toggle
          checked={form.scoring}
          onChange={(scoring) =>
            onChange({
              scoring,
              endings: scoring
                ? form.endings.map((e) => ({ ...e, minScore: e.minScore ?? 0 }))
                : form.endings,
            })
          }
          label="Score it as a quiz"
          hint="Give each choice points; the total picks the closing screen and is saved on the response."
        />
        <Field
          label="Tags to add to the contact"
          htmlFor="s-tags"
          error={tagErr}
          hint="Comma separated. Workflows can start on these."
        >
          <ListInput
            id="s-tags"
            value={form.tags}
            onChange={(tags) => onChange({ tags })}
            placeholder="Form lead, Spring promo"
          />
        </Field>
        <Field
          label="Hidden fields"
          htmlFor="s-hidden"
          error={hiddenErr}
          hint="Read from the link and saved with each response, e.g. utm_source."
        >
          <ListInput
            id="s-hidden"
            value={form.hiddenFields}
            onChange={(hiddenFields) => onChange({ hiddenFields })}
            placeholder="utm_source, utm_campaign"
          />
        </Field>
        <Field
          label="Email the team on each response"
          htmlFor="s-notify"
          error={errors.notify}
          hint="Optional. Sends once email is connected."
        >
          <Input
            id="s-notify"
            type="email"
            value={form.notify ?? ""}
            onChange={(e) => onChange({ notify: e.target.value })}
            placeholder="frontdesk@example.com"
            aria-invalid={!!errors.notify}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-3 border-t border-line px-5 py-5">
        <h3 className="text-sm font-semibold">Share</h3>
        <CopyField value={sample} label="Form link" />
        <p className="-mt-1 text-xs text-fg-3">
          {form.status === "live"
            ? "Live now."
            : "The link switches on when you publish."}
        </p>
        <p className="mt-1 text-xs font-medium text-fg-2">Embed on a website</p>
        <CodeBlock code={embed} label="embed code" />
      </section>

      <section className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4">
        <button
          type="button"
          onClick={() => start(() => actions.duplicate(form.id))}
          disabled={busy || pending}
          className={smallButton}
        >
          <Copy className="size-3.5" strokeWidth={1.75} />
          Duplicate form
        </button>
        {confirm ? (
          <>
            <span className="text-sm text-fg-2">
              Delete the form and its responses?
            </span>
            <button
              type="button"
              onClick={() => start(() => actions.remove(form.id))}
              disabled={busy}
              className="inline-flex h-7 items-center rounded border border-red/40 bg-surface px-2.5 text-xs font-medium text-red hover:bg-red-soft"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className={smallButton}
            >
              Keep it
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="inline-flex h-7 items-center gap-1.5 px-1 text-xs font-medium text-fg-2 hover:text-red"
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
            Delete form
          </button>
        )}
      </section>
    </div>
  );
}
