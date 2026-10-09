"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, Loader2, Plus, Settings2, Trash2 } from "lucide-react";
import { useWidth } from "@/components/charts";
import { Field, Input, Select, Textarea, controlClass } from "@/components/form";
import { Button } from "@/components/page-header";
import { Segmented, Tag } from "@/components/diagnostic/primitives";
import type { ActionState } from "@/app/agency/funnels/actions";
import type { Funnel, FunnelBlock, FunnelBlockType, FunnelStep } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { newBlock } from "@/lib/data/demo-funnels";
import { blockLabel, blockSummary, publicPath, templateLabel, type ClientRef } from "./model";
import { FunnelPage } from "./renderer";
import { StatusButton } from "./funnel-panel";

/*
 * The funnel editor: steps and blocks on the left, the live page in the
 * middle, the selected block's fields on the right. Every change shows in the
 * preview at once; Save writes the step back.
 */

export interface EditorActions {
  saveStep: (funnelId: string, stepId: string, name: string, blocksJson: string) => Promise<ActionState>;
  setStatus: (id: string, status: "draft" | "live") => Promise<void>;
  rename: (funnelId: string, name: string, brandColor: string) => Promise<ActionState>;
  addStep: (funnelId: string, name: string) => Promise<void>;
  moveStep: (funnelId: string, stepId: string, dir: -1 | 1) => Promise<void>;
  removeStep: (funnelId: string, stepId: string) => Promise<void>;
  deleteFunnel: (funnelId: string) => Promise<void>;
}

const blockTypes: FunnelBlockType[] = ["hero", "text", "features", "stats", "testimonial", "faq", "form", "cta", "footer"];
const formFields: { key: "name" | "email" | "phone" | "address" | "message" | "amount"; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "message", label: "Message" },
  { key: "amount", label: "Gift amount" },
];

function RailButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn("inline-flex h-7 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium text-rail-fg hover:bg-rail-line disabled:opacity-50", className)} {...rest}>
      {children}
    </button>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn("grid size-6 place-items-center rounded text-fg-3 transition-colors duration-100 disabled:opacity-30", danger ? "hover:bg-red-soft hover:text-red" : "hover:bg-surface-2 hover:text-fg")}
    >
      {children}
    </button>
  );
}

/* ----------------------------- inspector ----------------------------- */

function ListEditor<T extends Record<string, string>>({ items, keys, onChange, blank, noun }: { items: T[]; keys: { key: keyof T & string; label: string; long?: boolean }[]; onChange: (items: T[]) => void; blank: T; noun: string }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-2 rounded border border-line bg-surface-2/40 p-2.5">
          {keys.map((k) =>
            k.long ? (
              <Textarea key={k.key} aria-label={k.label} value={it[k.key]} placeholder={k.label} className="min-h-[64px] text-xs" onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [k.key]: e.target.value } : x)))} />
            ) : (
              <Input key={k.key} aria-label={k.label} value={it[k.key]} placeholder={k.label} className="h-8 text-xs" onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [k.key]: e.target.value } : x)))} />
            ),
          )}
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="self-end text-2xs text-fg-3 hover:text-red">
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, blank])} className="inline-flex h-8 items-center justify-center gap-1 rounded border border-dashed border-line-strong text-xs text-fg-2 hover:bg-surface-2 hover:text-fg">
        <Plus className="size-3.5" strokeWidth={2} /> Add {noun}
      </button>
    </div>
  );
}

function BlockFields({ block, onChange }: { block: FunnelBlock; onChange: (b: FunnelBlock) => void }) {
  const set = (patch: Partial<FunnelBlock>) => onChange({ ...block, ...patch } as FunnelBlock);
  const text = (label: string, key: string, value: string | undefined, opts?: { long?: boolean; hint?: string; placeholder?: string }) => (
    <Field label={label} htmlFor={`f-${key}`} hint={opts?.hint}>
      {opts?.long ? (
        <Textarea id={`f-${key}`} value={value ?? ""} placeholder={opts?.placeholder} onChange={(e) => set({ [key]: e.target.value } as Partial<FunnelBlock>)} />
      ) : (
        <Input id={`f-${key}`} value={value ?? ""} placeholder={opts?.placeholder} onChange={(e) => set({ [key]: e.target.value } as Partial<FunnelBlock>)} />
      )}
    </Field>
  );
  switch (block.type) {
    case "hero":
      return (
        <>
          {text("Line above the headline", "eyebrow", block.eyebrow, { hint: "Optional. Who this is for, or where you are." })}
          {text("Headline", "headline", block.headline)}
          {text("Subhead", "subhead", block.subhead, { long: true })}
          {text("Button label", "buttonLabel", block.buttonLabel, { hint: "Leave empty for no button." })}
          {text("Button goes to", "buttonHref", block.buttonHref, { placeholder: "#form", hint: "#form scrolls to the form on this page." })}
          <Field label="Alignment" htmlFor="f-align">
            <Select id="f-align" value={block.align ?? "center"} onChange={(e) => set({ align: e.target.value as "left" | "center" | "split" })}>
              <option value="center">Centred</option>
              <option value="left">Left</option>
              <option value="split">Beside the form</option>
            </Select>
          </Field>
        </>
      );
    case "text":
      return (
        <>
          {text("Headline", "headline", block.headline, { hint: "Optional." })}
          {text("Body", "body", block.body, { long: true })}
        </>
      );
    case "features":
      return (
        <>
          {text("Headline", "headline", block.headline, { hint: "Optional." })}
          <Field label="Points">
            <ListEditor items={block.items} keys={[{ key: "title", label: "Title" }, { key: "body", label: "One or two sentences", long: true }]} onChange={(items) => set({ items })} blank={{ title: "", body: "" }} noun="point" />
          </Field>
        </>
      );
    case "stats":
      return (
        <Field label="Numbers" hint="Three reads best.">
          <ListEditor items={block.items} keys={[{ key: "value", label: "Value, e.g. 4.9" }, { key: "label", label: "Label, e.g. Google rating" }]} onChange={(items) => set({ items })} blank={{ value: "", label: "" }} noun="number" />
        </Field>
      );
    case "testimonial":
      return (
        <>
          {text("Quote", "quote", block.quote, { long: true })}
          {text("Name", "name", block.name)}
          {text("Detail", "detail", block.detail, { hint: "Where they are from, or what they bought. Optional." })}
        </>
      );
    case "faq":
      return (
        <Field label="Questions">
          <ListEditor items={block.items} keys={[{ key: "q", label: "Question" }, { key: "a", label: "Answer", long: true }]} onChange={(items) => set({ items })} blank={{ q: "", a: "" }} noun="question" />
        </Field>
      );
    case "cta":
      return (
        <>
          {text("Headline", "headline", block.headline)}
          {text("Body", "body", block.body, { long: true, hint: "Optional." })}
          {text("Button label", "buttonLabel", block.buttonLabel)}
          {text("Button goes to", "buttonHref", block.buttonHref, { placeholder: "#form" })}
        </>
      );
    case "form":
      return (
        <>
          {text("Headline", "headline", block.headline)}
          {text("Subhead", "subhead", block.subhead, { hint: "Optional." })}
          <Field label="Fields" hint={block.fields.includes("amount") ? "Payments arrive with the fundraising module; until then a gift amount records a pledge." : "Every submission becomes a contact on the client's pipeline."}>
            <div className="flex flex-wrap gap-1.5">
              {formFields.map((f) => {
                const on = block.fields.includes(f.key);
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ fields: on ? block.fields.filter((x) => x !== f.key) : [...block.fields, f.key] })}
                    className={cn("h-7 rounded border px-2.5 text-xs font-medium transition-colors duration-100", on ? "border-rail bg-rail text-rail-fg" : "border-line-strong bg-surface text-fg-2 hover:text-fg")}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </Field>
          {text("Button label", "buttonLabel", block.buttonLabel)}
          {text("Note under the button", "note", block.note, { hint: "Optional. A line that eases the ask." })}
        </>
      );
    case "footer":
      return text("Text", "text", block.text);
  }
}

/* ------------------------------ preview ------------------------------ */

/** Renders the page at its real width (desktop or phone) and scales it to fit the column, so the preview is the page. */
function ScaledPreview({ width, children }: { width: number; children: React.ReactNode }) {
  const [outer, outerWidth] = useWidth<HTMLDivElement>();
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const scale = outerWidth > 0 ? Math.min(1, outerWidth / width) : 1;
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    setHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className="mx-auto w-full" style={{ maxWidth: width }}>
      <div className="overflow-hidden rounded-md border border-line bg-white shadow-1" style={{ height: height * scale || undefined }}>
        <div ref={inner} style={{ width, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- editor ------------------------------ */

export function FunnelEditor({ funnel, client, nowIso, actions }: { funnel: Funnel; client: ClientRef; nowIso: string; actions: EditorActions }) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [stepId, setStepId] = useState(funnel.steps[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Record<string, FunnelStep>>({});
  const [blockId, setBlockId] = useState<string | null>(funnel.steps[0]?.blocks[0]?.id ?? null);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [pane, setPane] = useState<"block" | "settings">("block");
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState(funnel.name);
  const [brandColor, setBrandColor] = useState(funnel.brandColor);
  const [newStepName, setNewStepName] = useState("");

  // The step being edited: the local draft if there is one, else the saved copy.
  const saved = funnel.steps.find((s) => s.id === stepId) ?? funnel.steps[0];
  const step = (saved && drafts[saved.id]) ?? saved;
  const dirty = Object.keys(drafts);
  const block = step?.blocks.find((b) => b.id === blockId) ?? null;

  const patchStep = useCallback(
    (fn: (s: FunnelStep) => FunnelStep) => {
      if (!step) return;
      setDrafts((d) => ({ ...d, [step.id]: fn(d[step.id] ?? step) }));
    },
    [step],
  );
  const setBlocks = (blocks: FunnelBlock[]) => patchStep((s) => ({ ...s, blocks }));
  const updateBlock = (b: FunnelBlock) => setBlocks(step!.blocks.map((x) => (x.id === b.id ? b : x)));
  const moveBlock = (id: string, dir: -1 | 1) => {
    const bs = [...step!.blocks];
    const i = bs.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= bs.length) return;
    [bs[i], bs[j]] = [bs[j]!, bs[i]!];
    setBlocks(bs);
  };
  const removeBlock = (id: string) => {
    setBlocks(step!.blocks.filter((b) => b.id !== id));
    if (blockId === id) setBlockId(null);
  };
  const addBlock = (type: FunnelBlockType) => {
    const b = newBlock(type);
    // Footers go last; everything else goes after the selected block.
    const bs = [...step!.blocks];
    const i = type === "footer" ? bs.length : blockId ? bs.findIndex((x) => x.id === blockId) + 1 : bs.length;
    bs.splice(i, 0, b);
    setBlocks(bs);
    setBlockId(b.id);
    setPane("block");
  };

  const selectStep = (id: string) => {
    setStepId(id);
    const s = drafts[id] ?? funnel.steps.find((x) => x.id === id);
    setBlockId(s?.blocks[0]?.id ?? null);
  };

  const save = () => {
    const toSave = Object.values(drafts);
    if (toSave.length === 0 && name === funnel.name && brandColor === funnel.brandColor) return;
    startSave(async () => {
      let ok = true;
      for (const s of toSave) {
        const r = await actions.saveStep(funnel.id, s.id, s.name, JSON.stringify(s.blocks));
        if (!r?.ok) {
          ok = false;
          setNotice(r?.message ?? "Could not save.");
        }
      }
      if (name !== funnel.name || brandColor !== funnel.brandColor) {
        const r = await actions.rename(funnel.id, name, brandColor);
        if (!r?.ok) {
          ok = false;
          setNotice(r?.message ?? "Could not save.");
        }
      }
      if (ok) {
        setDrafts({});
        setNotice("Saved");
        setTimeout(() => setNotice(null), 1800);
        router.refresh();
      }
    });
  };

  const unsaved = dirty.length > 0 || name !== funnel.name || brandColor !== funnel.brandColor;
  const previewFunnel = { brandColor, name };

  if (!step) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-rail px-5 py-3 text-rail-fg md:px-6">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold leading-6 tracking-tight">
            <span className="truncate">{name}</span>
            <Tag tone="neutral">{funnel.status === "live" ? "Live" : "Draft"}</Tag>
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-rail-fg-2">
            <Link href="/agency/funnels" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Funnels
            </Link>
            <span>·</span>
            <Link href={`/agency/clients/${client.slug}`} className="hover:underline">
              {client.name}
            </Link>
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">{templateLabel[funnel.template] ?? "Custom"}</span>
            <span className="hidden md:inline">·</span>
            <span className="num hidden md:inline">Updated {timeAgo(funnel.updatedAt, now)}</span>
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {notice && <span className={cn("text-xs", notice === "Saved" ? "text-rail-fg-2" : "text-amber")}>{notice}</span>}
          {funnel.status === "live" && (
            <a href={publicPath(funnel, step.path)} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium text-rail-fg hover:bg-rail-line">
              <ExternalLink className="size-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">View live</span>
            </a>
          )}
          <RailButton aria-pressed={pane === "settings"} onClick={() => setPane(pane === "settings" ? "block" : "settings")} className={cn(pane === "settings" && "bg-rail-line")}>
            <Settings2 className="size-3.5" strokeWidth={1.75} />
            <span className="hidden sm:inline">Settings</span>
          </RailButton>
          <StatusButton funnel={funnel} setStatus={actions.setStatus} className={funnel.status === "live" ? "border-rail-line bg-rail-2 text-rail-fg hover:bg-rail-line" : "border-rail-fg bg-rail-fg text-rail hover:bg-rail-fg/90"} />
          {unsaved || saving ? (
            <Button onClick={save} disabled={saving} className="h-7 px-3 text-xs">
              {saving && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
              {saving ? "Saving" : "Save"}
            </Button>
          ) : (
            <span className="px-1 text-xs text-rail-fg-2">Saved</span>
          )}
        </div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        {/* Steps and blocks */}
        <aside className="flex flex-col border-b border-line bg-surface lg:border-b-0 lg:border-r">
          <section className="border-b border-line px-4 py-4">
            <h2 className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Steps</h2>
            <ol className="mt-2 flex flex-col gap-0.5">
              {funnel.steps.map((s, i) => {
                const active = s.id === step.id;
                return (
                  <li key={s.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => selectStep(s.id)}
                      onKeyDown={(e) => e.key === "Enter" && selectStep(s.id)}
                      className={cn("group flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors duration-100", active ? "bg-rail text-rail-fg" : "hover:bg-surface-2")}
                    >
                      <span className={cn("num grid size-5 shrink-0 place-items-center rounded-full text-2xs font-semibold", active ? "bg-rail-2 text-rail-fg" : "bg-surface-2 text-fg-2")}>{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {(drafts[s.id] ?? s).name}
                        {drafts[s.id] && <span className="ml-1 text-xs opacity-60">•</span>}
                      </span>
                      <span className={cn("flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100", active && "[&_button]:text-rail-fg-2 [&_button:hover]:bg-rail-2 [&_button:hover]:text-rail-fg")}>
                        <IconButton label="Move up" disabled={i === 0 || pending} onClick={() => start(() => actions.moveStep(funnel.id, s.id, -1))}>
                          <ChevronUp className="size-3.5" strokeWidth={2} />
                        </IconButton>
                        <IconButton label="Move down" disabled={i === funnel.steps.length - 1 || pending} onClick={() => start(() => actions.moveStep(funnel.id, s.id, 1))}>
                          <ChevronDown className="size-3.5" strokeWidth={2} />
                        </IconButton>
                        <IconButton
                          label="Remove step"
                          danger
                          disabled={funnel.steps.length <= 1 || pending}
                          onClick={() => {
                            if (!confirm(`Remove the step "${s.name}"? Its page goes away.`)) return;
                            start(async () => {
                              await actions.removeStep(funnel.id, s.id);
                              if (s.id === step.id) selectStep(funnel.steps.find((x) => x.id !== s.id)?.id ?? "");
                            });
                          }}
                        >
                          <Trash2 className="size-3.5" strokeWidth={2} />
                        </IconButton>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
            <form
              className="mt-2 flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const n = newStepName.trim();
                if (!n) return;
                start(async () => {
                  await actions.addStep(funnel.id, n);
                  setNewStepName("");
                });
              }}
            >
              <input aria-label="New step name" value={newStepName} onChange={(e) => setNewStepName(e.target.value)} placeholder="Add a step" className={cn(controlClass, "h-8 text-xs")} />
              <button type="submit" disabled={!newStepName.trim() || pending} aria-label="Add step" className="grid size-8 shrink-0 place-items-center rounded border border-line-strong bg-surface text-fg-2 hover:bg-surface-2 hover:text-fg disabled:opacity-40">
                <Plus className="size-4" strokeWidth={2} />
              </button>
            </form>
          </section>

          <section className="flex-1 px-4 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Blocks on {step.name}</h2>
            </div>
            <ol className="mt-2 flex flex-col gap-0.5">
              {step.blocks.map((b, i) => {
                const active = b.id === blockId;
                return (
                  <li key={b.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setBlockId(b.id);
                        setPane("block");
                        document.querySelector(`[data-block="${b.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                      }}
                      onKeyDown={(e) => e.key === "Enter" && setBlockId(b.id)}
                      className={cn("group flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors duration-100", active ? "bg-brand-soft/60" : "hover:bg-surface-2")}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium">{blockLabel[b.type]}</span>
                        <span className="block truncate text-xs text-fg-3">{blockSummary(b) || "Empty"}</span>
                      </span>
                      <span className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <IconButton label="Move up" disabled={i === 0} onClick={() => moveBlock(b.id, -1)}>
                          <ChevronUp className="size-3.5" strokeWidth={2} />
                        </IconButton>
                        <IconButton label="Move down" disabled={i === step.blocks.length - 1} onClick={() => moveBlock(b.id, 1)}>
                          <ChevronDown className="size-3.5" strokeWidth={2} />
                        </IconButton>
                        <IconButton label="Remove block" danger onClick={() => removeBlock(b.id)}>
                          <Trash2 className="size-3.5" strokeWidth={2} />
                        </IconButton>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
            <label className="mt-2 block">
              <span className="sr-only">Add a block</span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) addBlock(e.target.value as FunnelBlockType);
                }}
                className={cn(controlClass, "h-8 text-xs")}
              >
                <option value="">Add a block…</option>
                {blockTypes.map((t) => (
                  <option key={t} value={t}>
                    {blockLabel[t]}
                  </option>
                ))}
              </select>
            </label>
          </section>
        </aside>

        {/* Preview */}
        <section className="flex min-w-0 flex-col bg-surface-2">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2">
            <p className="num min-w-0 truncate text-xs text-fg-3">{publicPath(funnel, step.path)}</p>
            <Segmented
              tone="paper"
              label="Preview width"
              value={device}
              onChange={setDevice}
              options={[
                { value: "desktop", label: "Desktop" },
                { value: "phone", label: "Phone" },
              ]}
            />
          </div>
          <div className="flex-1 overflow-auto p-4 md:p-6">
            <ScaledPreview width={device === "phone" ? 390 : 1200}>
              <FunnelPage funnel={previewFunnel} brand={client.name} step={step} preview selectedId={blockId} onSelectBlock={(id) => { setBlockId(id); setPane("block"); }} />
            </ScaledPreview>
          </div>
        </section>

        {/* Inspector */}
        <aside className="border-t border-line bg-surface lg:border-l lg:border-t-0">
          {pane === "settings" ? (
            <div className="flex flex-col gap-4 px-4 py-4">
              <div>
                <h2 className="text-sm font-semibold">Funnel settings</h2>
                <p className="text-xs text-fg-3">Name and the colour the pages use.</p>
              </div>
              <Field label="Name" htmlFor="fs-name">
                <Input id="fs-name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Brand colour" htmlFor="fs-color" hint="Buttons, links and accents on every page.">
                <div className="flex items-center gap-2">
                  <input id="fs-color" type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="size-9 shrink-0 cursor-pointer rounded border border-line-strong bg-surface p-1" />
                  <Input aria-label="Brand colour hex" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="num" />
                </div>
              </Field>
              <Field label="Step name" htmlFor="fs-step" hint="Shown in the steps list, not on the page.">
                <Input id="fs-step" value={step.name} onChange={(e) => patchStep((s) => ({ ...s, name: e.target.value }))} />
              </Field>
              <div className="mt-4 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Delete "${funnel.name}"? Its pages stop working.`)) return;
                    start(() => actions.deleteFunnel(funnel.id));
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-line-strong px-3 text-xs font-medium text-red hover:bg-red-soft"
                >
                  <Trash2 className="size-3.5" strokeWidth={2} />
                  Delete funnel
                </button>
              </div>
            </div>
          ) : block ? (
            <div className="flex flex-col gap-4 px-4 py-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">{blockLabel[block.type]}</h2>
                  <p className="text-xs text-fg-3">Changes show on the left as you type.</p>
                </div>
                <IconButton label="Remove block" danger onClick={() => removeBlock(block.id)}>
                  <Trash2 className="size-3.5" strokeWidth={2} />
                </IconButton>
              </div>
              <BlockFields key={block.id} block={block} onChange={updateBlock} />
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-fg-3">Pick a block on the page or in the list to edit it.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
