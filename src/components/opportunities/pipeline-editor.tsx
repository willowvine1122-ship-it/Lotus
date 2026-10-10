"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Field, FormNotice, Input, Select } from "@/components/form";
import { Button } from "@/components/page-header";
import { Tag } from "@/components/diagnostic/primitives";
import type { ClientRef } from "@/components/crm/model";
import type { OppActionState, PipelineDraft } from "@/app/agency/opportunities/actions";
import type { Pipeline } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";

/*
 * Pipelines and stages for one client: the list on the left, the selected
 * pipeline's stages on the right, lost reasons beneath. Stage colour never
 * means anything; order, name and probability do.
 */

interface DraftStage {
  key: string;
  id?: string;
  name: string;
  probability: string;
  outcome: "" | "won" | "lost";
}

const toDraft = (p?: Pipeline): DraftStage[] =>
  p
    ? p.stages.map((s) => ({ key: s.id, id: s.id, name: s.name, probability: String(s.probability ?? 0), outcome: s.outcome ?? "" }))
    : [
        { key: "a", name: "New", probability: "10", outcome: "" },
        { key: "b", name: "Qualified", probability: "30", outcome: "" },
        { key: "c", name: "Proposal", probability: "60", outcome: "" },
        { key: "d", name: "Won", probability: "100", outcome: "won" },
        { key: "e", name: "Lost", probability: "0", outcome: "lost" },
      ];

export interface EditorActions {
  save: (accountId: string, id: string | null, draft: PipelineDraft) => Promise<OppActionState & { id?: string }>;
  remove: (id: string) => Promise<OppActionState>;
  saveReasons: (accountId: string, reasons: string[]) => Promise<OppActionState>;
}

export function PipelineSettings({ client, pipelines, counts, selectedId, reasons, actions }: { client: ClientRef; pipelines: Pipeline[]; counts: Record<string, Record<string, number>>; selectedId: string | "new"; reasons: string[]; actions: EditorActions }) {
  const selected = selectedId === "new" ? undefined : pipelines.find((p) => p.id === selectedId) ?? pipelines[0];
  const base = `/agency/opportunities/pipelines?client=${client.slug}`;
  return (
    <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav aria-label="Pipelines" className="border-b border-line px-5 py-5 lg:border-b-0 lg:border-r lg:px-6">
        <div className="flex items-baseline justify-between pb-2">
          <h2 className="text-sm font-semibold">Pipelines</h2>
          <span className="num text-xs text-fg-3">{pipelines.length}</span>
        </div>
        <ul className="flex flex-col gap-0.5">
          {pipelines.map((p) => {
            const n = Object.values(counts[p.id] ?? {}).reduce((a, b) => a + b, 0);
            const active = selected?.id === p.id;
            return (
              <li key={p.id}>
                <Link href={`${base}&pipeline=${p.id}`} aria-current={active ? "page" : undefined} className={cn("flex items-baseline gap-2 rounded px-2.5 py-2 text-sm", active ? "bg-surface-2 font-medium text-fg" : "text-fg-2 hover:bg-surface-2/60 hover:text-fg")}>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.primary && <Tag tone="neutral">Primary</Tag>}
                  <span className="num text-xs text-fg-3">{formatCount(n)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link href={`${base}&pipeline=new`} aria-current={selectedId === "new" ? "page" : undefined} className={cn("mt-2 inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-sm font-medium", selectedId === "new" ? "bg-surface-2 text-fg" : "text-fg-2 hover:bg-surface-2/60 hover:text-fg")}>
          <Plus className="size-3.5" strokeWidth={2.25} />
          New pipeline
        </Link>
      </nav>
      <div className="min-w-0 bg-surface">
        <PipelineForm key={selected?.id ?? "new"} client={client} pipeline={selected} counts={selected ? counts[selected.id] ?? {} : {}} actions={actions} />
        <LostReasons key={`reasons-${client.id}`} client={client} reasons={reasons} save={actions.saveReasons} />
      </div>
    </div>
  );
}

function PipelineForm({ client, pipeline, counts, actions }: { client: ClientRef; pipeline?: Pipeline; counts: Record<string, number>; actions: EditorActions }) {
  const router = useRouter();
  const [name, setName] = useState(pipeline?.name ?? "");
  const [staleDays, setStaleDays] = useState(String(pipeline?.staleDays ?? 14));
  const [stages, setStages] = useState<DraftStage[]>(toDraft(pipeline));
  const [moveTo, setMoveTo] = useState("");
  const [state, setState] = useState<OppActionState>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const removedInUse = (pipeline?.stages ?? []).filter((s) => !stages.some((d) => d.id === s.id) && (counts[s.id] ?? 0) > 0);
  const openTargets = stages.filter((s) => s.id && !s.outcome);
  const set = (i: number, patch: Partial<DraftStage>) => setStages((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const swap = (i: number, j: number) =>
    setStages((xs) => {
      if (j < 0 || j >= xs.length) return xs;
      const n = [...xs];
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });

  const submit = () =>
    start(async () => {
      const draft: PipelineDraft = {
        name,
        staleDays: Number(staleDays) || 0,
        moveTo: moveTo || undefined,
        stages: stages.map((s) => ({ id: s.id, name: s.name, probability: Math.max(0, Math.min(100, Math.round(Number(s.probability) || 0))), outcome: s.outcome || undefined })),
      };
      const r = await actions.save(client.id, pipeline?.id ?? null, draft);
      setState(r);
      if (r?.ok && !pipeline && r.id) router.push(`/agency/opportunities/pipelines?client=${client.slug}&pipeline=${r.id}`);
    });

  return (
    <section className="max-w-[880px] px-5 py-6 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{pipeline ? pipeline.name : "New pipeline"}</h2>
          <p className="mt-0.5 max-w-[60ch] text-xs leading-relaxed text-fg-3">
            {pipeline?.primary
              ? "The primary pipeline is where every contact's stage lives. Moving a contact on the Contacts board moves its opportunity here, and the other way round."
              : "A separate board for one kind of deal, such as commercial bids or major gifts. Contacts can have an opportunity here and in the primary pipeline at once."}
          </p>
        </div>
        {pipeline && (
          <Link href={`/agency/opportunities?client=${client.slug}&pipeline=${pipeline.id}`} className="text-xs font-medium text-fg-2 hover:text-fg hover:underline">
            Open the board
          </Link>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <Field label="Name" htmlFor="pl-name" error={state?.errors?.name}>
          <Input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Commercial bids" aria-invalid={!!state?.errors?.name} />
        </Field>
        <Field label="Flag as stalled after" htmlFor="pl-stale" error={state?.errors?.staleDays} hint="Days in one stage. Twice as long turns red.">
          <div className="relative">
            <Input id="pl-stale" inputMode="numeric" value={staleDays} onChange={(e) => setStaleDays(e.target.value.replace(/\D/g, "").slice(0, 3))} className="num pr-12" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-fg-3">days</span>
          </div>
        </Field>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line pb-2">
          <h3 className="text-sm font-semibold">Stages</h3>
          <p className="text-xs text-fg-3">Left to right on the board. Probability feeds the weighted forecast.</p>
        </div>
        <div className="hidden grid-cols-[24px_minmax(0,1fr)_96px_140px_56px_84px] gap-x-3 border-b border-line py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 sm:grid">
          <span />
          <span>Stage</span>
          <span className="text-right">Chance</span>
          <span>Type</span>
          <span className="text-right">Deals</span>
          <span />
        </div>
        <ol>
          {stages.map((s, i) => (
            <li key={s.key} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-line py-2.5 sm:grid-cols-[24px_minmax(0,1fr)_96px_140px_56px_84px]">
              <span className="num text-xs text-fg-3">{i + 1}</span>
              <label className="sr-only" htmlFor={`st-${s.key}`}>
                Stage {i + 1} name
              </label>
              <Input id={`st-${s.key}`} value={s.name} onChange={(e) => set(i, { name: e.target.value })} className="h-8" placeholder="Stage name" />
              <div className="flex items-center justify-end gap-0.5 sm:order-last">
                <button type="button" aria-label={`Move ${s.name || "stage"} up`} disabled={i === 0} onClick={() => swap(i, i - 1)} className="grid size-7 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg disabled:opacity-30">
                  <ArrowUp className="size-3.5" strokeWidth={2} />
                </button>
                <button type="button" aria-label={`Move ${s.name || "stage"} down`} disabled={i === stages.length - 1} onClick={() => swap(i, i + 1)} className="grid size-7 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg disabled:opacity-30">
                  <ArrowDown className="size-3.5" strokeWidth={2} />
                </button>
                <button type="button" aria-label={`Remove ${s.name || "stage"}`} onClick={() => setStages((xs) => xs.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded text-fg-3 hover:bg-red-soft hover:text-red">
                  <X className="size-3.5" strokeWidth={2} />
                </button>
              </div>
              <div className="col-span-2 col-start-2 flex items-center gap-3 sm:contents">
                <div className="relative w-24 shrink-0 sm:w-auto">
                  <label className="sr-only" htmlFor={`pr-${s.key}`}>
                    Chance to close
                  </label>
                  <Input id={`pr-${s.key}`} inputMode="numeric" value={s.probability} onChange={(e) => set(i, { probability: e.target.value.replace(/\D/g, "").slice(0, 3) })} className="num h-8 pr-7 text-right" disabled={!!s.outcome} />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-fg-3">%</span>
                </div>
                <Select aria-label="Stage type" value={s.outcome} onChange={(e) => { const v = e.target.value as DraftStage["outcome"]; set(i, { outcome: v, probability: v === "won" ? "100" : v === "lost" ? "0" : s.probability }); }} className="h-8 min-w-0 flex-1 text-sm">
                  <option value="">Open</option>
                  <option value="won">Closed won</option>
                  <option value="lost">Closed lost</option>
                </Select>
                <span className="num w-10 shrink-0 text-right text-sm text-fg-2 sm:w-auto">{s.id ? formatCount(counts[s.id] ?? 0) : <span className="text-fg-3">new</span>}</span>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setStages((xs) => { const at = xs.findIndex((x) => x.outcome); const n = [...xs]; n.splice(at < 0 ? xs.length : at, 0, { key: `k${Date.now()}`, name: "", probability: "50", outcome: "" }); return n; })} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded px-2 text-sm font-medium text-fg-2 hover:bg-surface-2 hover:text-fg">
          <Plus className="size-3.5" strokeWidth={2.25} />
          Add stage
        </button>
        {state?.errors?.stages && <p className="mt-1 text-xs text-red">{state.errors.stages}</p>}
      </div>

      {removedInUse.length > 0 && (
        <div className="mt-5 flex flex-col gap-2 rounded border border-amber/25 bg-amber-soft/50 px-4 py-3">
          <p className="text-sm text-fg-2">
            <span className="font-medium text-amber">{removedInUse.map((s) => s.name).join(", ")} still {removedInUse.length === 1 ? "has" : "have"} {formatCount(removedInUse.reduce((a, s) => a + (counts[s.id] ?? 0), 0))} deals.</span> They move when you save.
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="move-to" className="text-xs font-medium">
              Move them to
            </label>
            <Select id="move-to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="h-8 w-auto text-sm">
              <option value="">First open stage</option>
              {openTargets.map((s) => (
                <option key={s.key} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending} onClick={submit}>
          {pipeline ? "Save pipeline" : "Create pipeline"}
        </Button>
        <FormNotice state={state} />
        {pipeline && !pipeline.primary && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            {confirmDelete ? (
              <>
                <span className="text-fg-2">Delete it and its deals?</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await actions.remove(pipeline.id);
                      if (r?.ok) router.push(`/agency/opportunities/pipelines?client=${client.slug}`);
                      else setState(r);
                    })
                  }
                  className="inline-flex h-8 items-center rounded bg-red px-3 font-medium text-white hover:bg-red/90"
                >
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-fg-3 hover:text-fg">
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-fg-3 hover:text-red">
                <Trash2 className="size-3.5" strokeWidth={1.75} />
                Delete pipeline
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function LostReasons({ client, reasons, save }: { client: ClientRef; reasons: string[]; save: EditorActions["saveReasons"] }) {
  const [list, setList] = useState(reasons);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<OppActionState>(null);
  const [pending, start] = useTransition();
  const add = () => {
    const v = draft.trim();
    if (v && !list.some((r) => r.toLowerCase() === v.toLowerCase())) setList((l) => [...l, v]);
    setDraft("");
  };
  return (
    <section className="max-w-[880px] border-t border-line px-5 py-6 md:px-8">
      <h2 className="text-sm font-semibold">Lost reasons</h2>
      <p className="mt-0.5 max-w-[60ch] text-xs leading-relaxed text-fg-3">Asked every time a deal is marked lost, in every pipeline of {client.name}. The report counts them.</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {list.map((r) => (
          <li key={r} className="inline-flex h-7 items-center gap-1 rounded border border-line-strong bg-surface pl-2.5 pr-1 text-xs">
            {r}
            <button type="button" aria-label={`Remove ${r}`} onClick={() => setList((l) => l.filter((x) => x !== r))} className="grid size-5 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
              <X className="size-3" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="reason-new" className="sr-only">
          New reason
        </label>
        <Input
          id="reason-new"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a reason"
          className="h-8 w-56"
        />
        <button type="button" onClick={add} className="h-8 rounded px-2 text-sm font-medium text-fg-2 hover:bg-surface-2 hover:text-fg">
          Add
        </button>
        <Button
          type="button"
          variant="primary"
          disabled={pending}
          onClick={() => start(async () => setState(await save(client.id, list)))}
          className="ml-auto h-8 border border-line-strong bg-surface text-fg shadow-none hover:bg-surface-2"
        >
          Save reasons
        </Button>
      </div>
      <div className="mt-2">
        <FormNotice state={state} />
      </div>
    </section>
  );
}
