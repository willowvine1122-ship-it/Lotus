"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, ExternalLink, FlaskConical, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import type { ActionState, FunnelSiteInput } from "@/app/agency/funnels/actions";
import { ImagePicker } from "@/components/image-picker";
import { BuilderPage } from "@/components/builder/render";
import { stepKindLabel, stepKinds, themeOf } from "@/components/builder/model";
import { CloseButton, DataTable, Kpi, KpiStrip, PanelButton, PanelFrame, StatusTag, type Column } from "@/components/field/ui";
import { Field, Input, Select, Textarea } from "@/components/form";
import type { Funnel, FunnelOrder, FunnelStep, FunnelStepKind, FunnelVariantStats } from "@/lib/types";
import { cn, formatCount, formatDollars, timeAgo } from "@/lib/utils";
import { useDetailPanel } from "@/lib/use-detail-panel";
import type { ClientRef } from "./model";

/*
 * One funnel: its steps as the table (a visitor reads down it the way they
 * move through the funnel), the funnel's four numbers above, and the selected
 * step in the panel with its page, numbers, split test and settings.
 */

export interface OverviewActions {
  setStatus: (id: string, status: "draft" | "live") => Promise<void>;
  rename: (id: string, name: string, brandColor: string, site: FunnelSiteInput) => Promise<ActionState>;
  addStep: (id: string, name: string, kind: FunnelStepKind) => Promise<string | null>;
  updateStep: (id: string, stepId: string, patch: { name?: string; path?: string; kind?: FunnelStepKind }) => Promise<ActionState>;
  duplicateStep: (id: string, stepId: string) => Promise<string | null>;
  moveStep: (id: string, stepId: string, dir: -1 | 1) => Promise<void>;
  removeStep: (id: string, stepId: string) => Promise<void>;
  deleteFunnel: (id: string) => Promise<void>;
  startSplit: (id: string, stepId: string) => Promise<void>;
  setSplit: (id: string, stepId: string, split: number) => Promise<void>;
  endSplit: (id: string, stepId: string, winner: "a" | "b") => Promise<void>;
}

const zero: FunnelVariantStats = { views: 0, conversions: 0, revenueCents: 0 };

function totals(s: FunnelStep): FunnelVariantStats {
  const a = s.stats?.a ?? zero;
  const b = s.stats?.b ?? zero;
  return { views: a.views + b.views, conversions: a.conversions + b.conversions, revenueCents: a.revenueCents + b.revenueCents };
}

const rate = (v: FunnelVariantStats) => (v.views ? v.conversions / v.views : null);
const pct = (n: number | null, d = 1) => (n === null ? "–" : `${(n * 100).toFixed(d)}%`);
const verb = (k?: FunnelStepKind) => stepKinds.find((x) => x.kind === (k ?? "custom"))!.verb;

/** Two-proportion z-test, as a plain confidence that the gap isn't chance. */
function confidence(a: FunnelVariantStats, b: FunnelVariantStats): number | null {
  if (a.views < 30 || b.views < 30) return null;
  const p1 = a.conversions / a.views;
  const p2 = b.conversions / b.views;
  const p = (a.conversions + b.conversions) / (a.views + b.views);
  const se = Math.sqrt(p * (1 - p) * (1 / a.views + 1 / b.views));
  if (!se) return null;
  const z = Math.abs(p1 - p2) / se;
  // Abramowitz-Stegun approximation of the normal CDF.
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const tail = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 1 - 2 * tail;
}

type Row = FunnelStep & { index: number; total: FunnelVariantStats };

export function FunnelOverview({ funnel, client, orders, nowIso, origin, actions }: { funnel: Funnel; client: ClientRef; orders: FunnelOrder[]; nowIso: string; origin: string; actions: OverviewActions }) {
  const router = useRouter();
  const now = new Date(nowIso);
  const [selectedId, setSelectedId] = useState<string>(funnel.steps[0]?.id ?? "");
  const detail = useDetailPanel();
  const [settings, setSettings] = useState(false);
  const [pending, start] = useTransition();
  const theme = themeOf(funnel.theme, funnel.brandColor);

  const rows: Row[] = funnel.steps.map((s, index) => ({ ...s, index, total: totals(s) }));
  const first = rows[0]?.total ?? zero;
  const paid = rows.filter((r) => r.kind === "order" || r.kind === "upsell" || r.kind === "downsell");
  const revenue = rows.reduce((a, r) => a + r.total.revenueCents, 0);
  const sales = rows.filter((r) => r.kind === "order").reduce((a, r) => a + r.total.conversions, 0);
  const lastActive = [...rows].reverse().find((r) => r.kind !== "thankyou") ?? rows[0];
  const endRate = first.views && lastActive ? lastActive.total.conversions / first.views : null;
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];
  const maxViews = Math.max(1, ...rows.map((r) => r.total.views));

  const run = (fn: () => Promise<unknown>) => start(async () => {
    await fn();
    router.refresh();
  });

  const columns: Column<Row>[] = [
    {
      key: "step",
      label: "Step",
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("num grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", r.id === selected?.id ? "bg-rail text-rail-fg" : "bg-surface-2 text-fg-2")}>{r.index + 1}</span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium">{r.name}</span>
              {r.variant && (
                <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] bg-surface-2 px-1.5 text-2xs font-medium text-fg-2">
                  <FlaskConical className="size-3" strokeWidth={2} />
                  A/B
                </span>
              )}
            </span>
            <span className="num block truncate text-xs text-fg-3">/{funnel.slug}{r.path ? `/${r.path}` : ""}</span>
          </span>
        </div>
      ),
    },
    { key: "type", label: "Type", className: "hidden md:table-cell", cell: (r) => <span className="text-fg-2">{stepKindLabel[r.kind ?? "custom"]}</span> },
    {
      key: "views",
      label: "Views",
      align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-3">
          <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-surface-2 xl:block" aria-hidden>
            <span className="block h-full rounded-full bg-fg/70" style={{ width: `${(r.total.views / maxViews) * 100}%` }} />
          </span>
          <span className="num w-14">{formatCount(r.total.views)}</span>
        </div>
      ),
    },
    {
      key: "conv",
      label: "Converted",
      align: "right",
      cell: (r) =>
        r.kind === "thankyou" ? (
          <span className="text-fg-3">–</span>
        ) : (
          <div className="num">
            {formatCount(r.total.conversions)}
            <span className="block text-xs text-fg-3">{verb(r.kind).toLowerCase()}</span>
          </div>
        ),
    },
    { key: "rate", label: "Rate", align: "right", className: "hidden sm:table-cell", cell: (r) => <span className="num">{r.kind === "thankyou" ? "–" : pct(rate(r.total))}</span> },
    { key: "rev", label: "Revenue", align: "right", className: "hidden lg:table-cell", cell: (r) => <span className={cn("num", !r.total.revenueCents && "text-fg-3")}>{r.total.revenueCents ? formatDollars(r.total.revenueCents) : "–"}</span> },
  ];

  const builderHref = (s: FunnelStep, v: "a" | "b" = "a") => `/agency/funnels/${funnel.id}/builder/${s.id}${v === "b" ? "?v=b" : ""}`;

  const panel = (close?: () => void) =>
    settings ? (
      <FunnelSettings funnel={funnel} actions={actions} onClose={() => setSettings(false)} onDone={() => router.refresh()} />
    ) : selected ? (
      <StepPanel
        key={selected.id}
        funnel={funnel}
        step={selected}
        theme={theme}
        orders={orders.filter((o) => o.stepId === selected.id)}
        now={now}
        origin={origin}
        builderHref={builderHref}
        pending={pending}
        run={run}
        actions={actions}
        onClose={close}
        onSelect={(id) => setSelectedId(id)}
      />
    ) : null;

  return (
    <div className="flex min-h-screen">
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:flex-nowrap md:px-6">
          <div className="min-w-[min(100%,16rem)] flex-1">
            <div className="flex items-center gap-2">
              <Link href="/agency/funnels" aria-label="Back to Funnels" className="-ml-1 grid size-7 shrink-0 place-items-center rounded text-rail-fg-2 hover:bg-rail-2 hover:text-rail-fg">
                <ArrowLeft className="size-4" strokeWidth={2} />
              </Link>
              <h1 className="truncate text-lg font-semibold leading-6 tracking-tight">{funnel.name}</h1>
              {funnel.status === "live" ? <StatusTag tone="live">Live</StatusTag> : <StatusTag tone="muted" className="text-rail-fg-2 ring-rail-line">Draft</StatusTag>}
            </div>
            <p className="num truncate pl-8 text-xs text-rail-fg-2">
              {client.name} · {funnel.steps.length} {funnel.steps.length === 1 ? "step" : "steps"} · updated {timeAgo(funnel.updatedAt, now)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {funnel.status === "live" && (
              <a href={`/f/${funnel.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium text-rail-fg hover:bg-rail-line">
                <ExternalLink className="size-3.5" strokeWidth={1.75} />
                <span className="hidden xl:inline">View live</span>
              </a>
            )}
            <button type="button" onClick={() => { setSettings(true); detail.show(); }} className="inline-flex h-7 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium text-rail-fg hover:bg-rail-line">
              <Settings2 className="size-3.5" strokeWidth={1.75} />
              <span className="hidden xl:inline">Settings</span>
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => actions.setStatus(funnel.id, funnel.status === "live" ? "draft" : "live"))} className="inline-flex h-7 items-center rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium text-rail-fg hover:bg-rail-line disabled:opacity-60">
              {funnel.status === "live" ? "Unpublish" : "Publish"}
            </button>
            {selected && (
              <Link href={builderHref(selected)} className="inline-flex h-7 items-center gap-1.5 rounded bg-brand px-2.5 text-xs font-semibold text-white hover:bg-brand-hover">
                <Pencil className="size-3.5" strokeWidth={2} />
                Edit page
              </Link>
            )}
          </div>
        </header>

        <KpiStrip>
          <Kpi label="Visitors" value={formatCount(first.views)} aside="first step, all time" />
          <Kpi label={verb(rows[0]?.kind)} value={formatCount(first.conversions)} aside={`${pct(rate(first))} of visitors`} />
          <Kpi label="Revenue" value={paid.length ? formatDollars(revenue) : "–"} aside={paid.length ? `${formatCount(sales)} ${sales === 1 ? "sale" : "sales"}` : "no paid steps"} />
          <Kpi label="End to end" value={pct(endRate)} aside={lastActive ? `visitors to ${lastActive.name.toLowerCase()}` : undefined} />
        </KpiStrip>

        <DataTable
          columns={columns}
          rows={rows}
          sort={{ key: "", dir: "asc" }}
          onSort={() => {}}
          selectedId={selected?.id}
          onSelect={(r) => {
            setSelectedId(r.id);
            setSettings(false);
            detail.show();
          }}
          empty="No steps yet."
        />
        <AddStep pending={pending} onAdd={(name, kind) => run(async () => {
          const id = await actions.addStep(funnel.id, name, kind);
          if (id) setSelectedId(id);
        })} />
      </div>
      <PanelFrame label={settings ? "Funnel settings" : (selected?.name ?? "Step")} open={detail.open} docked={detail.docked} onClose={detail.close}>
        {panel}
      </PanelFrame>
    </div>
  );
}

function AddStep({ onAdd, pending }: { onAdd: (name: string, kind: FunnelStepKind) => void; pending: boolean }) {
  const [kind, setKind] = useState<FunnelStepKind>("optin");
  const [name, setName] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-3 md:px-6"
      onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim() || stepKindLabel[kind];
        onAdd(n, kind);
        setName("");
      }}
    >
      <Plus className="size-4 text-fg-3" strokeWidth={1.75} />
      <select aria-label="Step type" value={kind} onChange={(e) => setKind(e.target.value as FunnelStepKind)} className="h-8 rounded border border-line-strong bg-surface px-2 text-sm">
        {stepKinds.map((k) => (
          <option key={k.kind} value={k.kind}>
            {k.label}
          </option>
        ))}
      </select>
      <input aria-label="Step name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`Name (${stepKindLabel[kind]})`} className="h-8 min-w-0 flex-1 rounded border border-line-strong bg-surface px-2.5 text-sm placeholder:text-fg-3 focus:border-brand focus:outline-none sm:max-w-[260px]" />
      <PanelButton type="submit" disabled={pending}>
        Add step
      </PanelButton>
      <span className="hidden text-xs text-fg-3 lg:inline">{stepKinds.find((k) => k.kind === kind)?.goal}. Starts with a ready layout.</span>
    </form>
  );
}

/* ------------------------------ step panel ------------------------------ */

function Thumb({ step, theme, href, variant = "a" }: { step: FunnelStep; theme: ReturnType<typeof themeOf>; href: string; variant?: "a" | "b" }) {
  const doc = variant === "b" && step.variant ? step.variant.doc : step.doc;
  return (
    <div className="group relative h-[220px] overflow-hidden rounded border border-line bg-white">
      <div className="pointer-events-none origin-top-left" style={{ width: 1200, zoom: 0.28 }} aria-hidden inert>
        {doc && <BuilderPage doc={doc} theme={theme} editing />}
      </div>
      <Link href={href} aria-label={`Edit ${step.name}`} className="absolute inset-0 grid place-items-center bg-rail/0 opacity-0 transition-[opacity,background-color] duration-150 hover:bg-rail/55 hover:opacity-100 focus-visible:bg-rail/55 focus-visible:opacity-100">
        <span className="inline-flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white">
          <Pencil className="size-3.5" /> Edit {variant === "b" ? "version B" : "page"}
        </span>
      </Link>
    </div>
  );
}

function Tile({ label, value, aside }: { label: string; value: string; aside?: string }) {
  return (
    <div className="rounded border border-line bg-surface px-3 py-2.5">
      <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold leading-6">{value}</div>
      {aside && <div className="num text-xs text-fg-3">{aside}</div>}
    </div>
  );
}

function StepPanel({
  funnel,
  step,
  theme,
  orders,
  now,
  origin,
  builderHref,
  pending,
  run,
  actions,
  onClose,
  onSelect,
}: {
  funnel: Funnel;
  step: Row;
  theme: ReturnType<typeof themeOf>;
  orders: FunnelOrder[];
  now: Date;
  origin: string;
  builderHref: (s: FunnelStep, v?: "a" | "b") => string;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
  actions: OverviewActions;
  onClose?: () => void;
  onSelect: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(step.name);
  const [path, setPath] = useState(step.path);
  const [kind, setKind] = useState<FunnelStepKind>(step.kind ?? "custom");
  const [msg, setMsg] = useState<ActionState>(null);
  const [split, setSplitVal] = useState(step.variant?.split ?? 50);
  const url = `${origin}/f/${funnel.slug}${step.path ? `/${step.path}` : ""}`;
  const a = step.stats?.a ?? zero;
  const b = step.stats?.b ?? zero;
  const conf = step.variant ? confidence(a, b) : null;
  const ra = rate(a);
  const rb = rate(b);
  const lead = ra !== null && rb !== null && ra !== rb ? (rb > ra ? "b" : "a") : null;
  const lift = ra && rb ? (rb - ra) / ra : null;
  const isFirst = step.index === 0;
  const changed = name !== step.name || path !== step.path || kind !== (step.kind ?? "custom");

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-fg-3">
            Step {step.index + 1} of {funnel.steps.length} · {stepKindLabel[step.kind ?? "custom"]}
          </p>
          <h2 className="truncate text-base font-semibold leading-6">{step.name}</h2>
        </div>
        <div className="flex items-center">
          <IconBtn label="Move up" disabled={pending || step.index === 0} onClick={() => run(() => actions.moveStep(funnel.id, step.id, -1))} icon={ArrowUp} />
          <IconBtn label="Move down" disabled={pending || step.index === funnel.steps.length - 1} onClick={() => run(() => actions.moveStep(funnel.id, step.id, 1))} icon={ArrowDown} />
          {onClose && <CloseButton onClose={onClose} />}
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5 py-4">
        <Thumb step={step} theme={theme} href={builderHref(step)} />
        <div className="flex gap-2">
          <Link href={builderHref(step)} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded border border-rail bg-rail px-3 text-xs font-medium text-rail-fg hover:bg-rail-2">
            <Pencil className="size-3.5" /> Edit page
          </Link>
          <PanelButton disabled={pending} onClick={() => run(async () => { const id = await actions.duplicateStep(funnel.id, step.id); if (id) onSelect(id); })}>
            <Copy className="size-3.5" /> Duplicate
          </PanelButton>
        </div>
        <div className="flex items-center gap-2 rounded border border-line bg-surface-2/50 py-1 pl-3 pr-1">
          <span className="num min-w-0 flex-1 truncate text-xs text-fg-2">{url.replace(/^https?:\/\//, "")}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(url).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-fg-2 hover:bg-surface hover:text-fg"
          >
            {copied ? <Check className="size-3.5 text-green" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        {funnel.status !== "live" && <p className="-mt-3 text-xs text-amber">The funnel is a draft, so this link answers 404 until you publish.</p>}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Results</h3>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Views" value={formatCount(step.total.views)} aside="all time" />
            <Tile label={verb(step.kind)} value={step.kind === "thankyou" ? "–" : formatCount(step.total.conversions)} aside={step.kind === "thankyou" ? "end of the funnel" : `${pct(rate(step.total))} of views`} />
            {(step.kind === "order" || step.kind === "upsell" || step.kind === "downsell") && (
              <>
                <Tile label="Revenue" value={formatDollars(step.total.revenueCents)} aside="test mode until Stripe" />
                <Tile label="Per view" value={step.total.views ? formatDollars(Math.round(step.total.revenueCents / step.total.views)) : "–"} aside="earnings per visitor" />
              </>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Split test</h3>
            {step.variant && <span className="num text-xs text-fg-3">since {new Date(step.variant.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
          </div>
          {!step.variant ? (
            <div className="rounded border border-dashed border-line-strong px-3.5 py-3">
              <p className="text-xs leading-5 text-fg-2">Send part of this step&apos;s visitors to a second version and keep whichever converts better. Version B starts as a copy, so change one thing.</p>
              <PanelButton className="mt-2.5" disabled={pending} onClick={() => run(() => actions.startSplit(funnel.id, step.id))}>
                <FlaskConical className="size-3.5" /> Start a split test
              </PanelButton>
            </div>
          ) : (
            <div className="rounded border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-2xs uppercase tracking-[0.06em] text-fg-3">
                    <th className="px-3 py-1.5 text-left font-medium">Version</th>
                    <th className="px-2 py-1.5 text-right font-medium">Views</th>
                    <th className="px-2 py-1.5 text-right font-medium">Conv.</th>
                    <th className="px-3 py-1.5 text-right font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(["a", "b"] as const).map((v) => {
                    const s = v === "a" ? a : b;
                    return (
                      <tr key={v} className="border-b border-line last:border-b-0">
                        <td className="px-3 py-2">
                          <Link href={builderHref(step, v)} className="inline-flex items-center gap-1.5 font-medium hover:underline">
                            {v.toUpperCase()}
                            <span className="num text-xs font-normal text-fg-3">{v === "a" ? 100 - (step.variant?.split ?? 50) : step.variant?.split}%</span>
                          </Link>
                          {lead === v && <span className="ml-1.5 rounded-[4px] bg-green-soft px-1 py-px text-2xs font-medium text-green">Leading</span>}
                        </td>
                        <td className="num px-2 py-2 text-right">{formatCount(s.views)}</td>
                        <td className="num px-2 py-2 text-right">{formatCount(s.conversions)}</td>
                        <td className="num px-3 py-2 text-right font-medium">{pct(rate(s))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-line px-3 py-2.5 text-xs leading-5 text-fg-2">
                {conf === null ? (
                  "Too few visitors to call it yet. Keep it running until each version has at least 100 views."
                ) : (
                  <>
                    {lift !== null && <>B converts <b className={cn("num font-semibold", lift >= 0 ? "text-green" : "text-red")}>{lift >= 0 ? "+" : ""}{(lift * 100).toFixed(0)}%</b> {lift >= 0 ? "better" : "worse"} than A. </>}
                    <span className="num">{(conf * 100).toFixed(0)}%</span> confident it isn&apos;t chance{conf >= 0.95 ? ", safe to pick a winner." : ", keep it running to 95%."}
                  </>
                )}
              </div>
              <div className="flex flex-col gap-2 border-t border-line px-3 py-3">
                <label className="flex items-center gap-3 text-xs text-fg-2">
                  <span className="shrink-0">Traffic to B</span>
                  <input type="range" min={5} max={95} step={5} value={split} onChange={(e) => setSplitVal(Number(e.target.value))} className="min-w-0 flex-1 accent-[var(--rail)]" aria-label="Share of visitors sent to version B" />
                  <span className="num w-9 text-right font-medium text-fg">{split}%</span>
                </label>
                {split !== step.variant.split && (
                  <PanelButton disabled={pending} onClick={() => run(() => actions.setSplit(funnel.id, step.id, split))}>
                    Save split
                  </PanelButton>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <PanelButton disabled={pending} onClick={() => confirm("Keep version A and end the test? Version B is discarded.") && run(() => actions.endSplit(funnel.id, step.id, "a"))}>
                    Keep A
                  </PanelButton>
                  <PanelButton disabled={pending} tone={lead === "b" ? "ink" : "default"} onClick={() => confirm("Make version B the page and end the test? Version A is replaced.") && run(() => actions.endSplit(funnel.id, step.id, "b"))}>
                    Keep B
                  </PanelButton>
                </div>
              </div>
            </div>
          )}
        </section>

        {orders.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Latest orders</h3>
            <ul className="divide-y divide-line rounded border border-line">
              {orders.slice(0, 6).map((o) => (
                <li key={o.id} className="flex items-baseline gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.name}</span>
                    <span className="block truncate text-xs text-fg-3">{o.items.map((i) => i.name).join(" + ")}</span>
                  </span>
                  <span className="num text-right">
                    {formatDollars(o.totalCents)}
                    <span className="block text-xs text-fg-3">{timeAgo(o.at, now)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Step settings</h3>
          <Field label="Name" htmlFor="step-name">
            <Input id="step-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Path" htmlFor="step-path" hint={isFirst ? "The first step lives at the funnel's own address." : undefined}>
            <div className="flex items-center rounded border border-line-strong bg-surface focus-within:border-brand">
              <span className="num shrink-0 pl-2.5 text-sm text-fg-3">/{funnel.slug}/</span>
              <input id="step-path" value={isFirst ? "" : path} disabled={isFirst} onChange={(e) => setPath(e.target.value)} className="num h-9 min-w-0 flex-1 bg-transparent pr-2.5 text-sm focus:outline-none disabled:text-fg-3" />
            </div>
          </Field>
          <Field label="Type" htmlFor="step-kind" hint={stepKinds.find((k) => k.kind === kind)?.goal}>
            <Select id="step-kind" value={kind} onChange={(e) => setKind(e.target.value as FunnelStepKind)}>
              {stepKinds.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-center gap-2">
            <PanelButton tone="ink" disabled={pending || !changed} onClick={() => start()}>
              Save step
            </PanelButton>
            {msg && <span className={cn("text-xs", msg.ok ? "text-fg-3" : "text-red")}>{msg.message}</span>}
            <PanelButton tone="danger" className="ml-auto" disabled={pending || funnel.steps.length <= 1} onClick={() => confirm(`Delete the ${step.name} step and its page?`) && run(() => actions.removeStep(funnel.id, step.id))}>
              <Trash2 className="size-3.5" /> Delete
            </PanelButton>
          </div>
        </section>
      </div>
    </div>
  );

  function start() {
    run(async () => {
      const r = await actions.updateStep(funnel.id, step.id, { name, path: isFirst ? undefined : path, kind });
      setMsg(r);
    });
  }
}

function IconBtn({ label, icon: Icon, onClick, disabled }: { label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-7 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent">
      <Icon className="size-4" strokeWidth={1.75} />
    </button>
  );
}

function SettingsHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="-mb-1 mt-2 border-t border-line pt-4 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{children}</h3>;
}

function FunnelSettings({ funnel, actions, onClose, onDone }: { funnel: Funnel; actions: OverviewActions; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(funnel.name);
  const [color, setColor] = useState(funnel.brandColor);
  const [site, setSite] = useState<FunnelSiteInput>(funnel.site ?? {});
  const put = (patch: Partial<FunnelSiteInput>) => setSite((s) => ({ ...s, ...patch }));
  const [msg, setMsg] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const ok = useMemo(() => /^#[0-9a-fA-F]{6}$/.test(color), [color]);
  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-fg-3">Funnel</p>
          <h2 className="text-base font-semibold leading-6">Settings</h2>
        </div>
        <CloseButton onClose={onClose} />
      </div>
      <form
        className="flex flex-col gap-4 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await actions.rename(funnel.id, name, color, site);
            setMsg(r);
            if (r?.ok) onDone();
          });
        }}
      >
        <Field label="Name" htmlFor="f-name" hint="Internal. Visitors see each page's headline.">
          <Input id="f-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Brand colour" htmlFor="f-color" hint="The starting brand colour. Fonts and the rest of the theme are set in the page editor under Theme.">
          <div className="flex items-center gap-2">
            <input type="color" aria-label="Pick brand colour" value={ok ? color : "#000000"} onChange={(e) => setColor(e.target.value)} className="h-9 w-10 shrink-0 cursor-pointer rounded border border-line-strong bg-surface p-0.5" />
            <Input id="f-color" value={color} onChange={(e) => setColor(e.target.value)} className="num" />
          </div>
        </Field>
        <SettingsHeading>Browser tab and link previews</SettingsHeading>
        <Field label="Page title" htmlFor="f-title" hint="Shown in the browser tab and on Google. Empty uses the funnel name.">
          <Input id="f-title" value={site.title ?? ""} maxLength={70} onChange={(e) => put({ title: e.target.value })} />
        </Field>
        <Field label="Description" htmlFor="f-desc" hint="The line under the title on Google and in shared links.">
          <Textarea id="f-desc" value={site.description ?? ""} maxLength={170} onChange={(e) => put({ description: e.target.value })} className="min-h-[64px] text-sm" />
        </Field>
        <Field label="Favicon" htmlFor="f-favicon" hint="The little icon in the browser tab. A square PNG, 512 × 512.">
          <ImagePicker label="Favicon" shape="icon" value={site.favicon} onChange={(v) => put({ favicon: v })} accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml" />
        </Field>
        <Field label="Share image" htmlFor="f-share" hint="Shown when the link is shared on Facebook, WhatsApp or iMessage. 1200 × 630 works best.">
          <ImagePicker label="Share image" value={site.shareImage} onChange={(v) => put({ shareImage: v })} />
        </Field>
        <SettingsHeading>Tracking</SettingsHeading>
        <Field label="Meta Pixel ID" htmlFor="f-pixel" hint="Find it in Meta Events Manager. Page views are sent on every step.">
          <Input id="f-pixel" inputMode="numeric" value={site.metaPixelId ?? ""} onChange={(e) => put({ metaPixelId: e.target.value.replace(/\D/g, "") })} className="num" />
        </Field>
        <Field label="Google Analytics ID" htmlFor="f-ga">
          <Input id="f-ga" value={site.gaId ?? ""} placeholder="G-XXXXXXXXXX" onChange={(e) => put({ gaId: e.target.value.trim().toUpperCase() })} className="num" />
        </Field>
        <Field label="Code in the page head" htmlFor="f-head" hint="Paste tracking, verification or chat-widget code exactly as the provider gives it. Owners and admins only.">
          <Textarea id="f-head" value={site.headCode ?? ""} spellCheck={false} placeholder={"<script>…</script>"} onChange={(e) => put({ headCode: e.target.value })} className="min-h-[88px] font-mono text-xs" />
        </Field>
        <Field label="Code at the end of the page" htmlFor="f-body">
          <Textarea id="f-body" value={site.bodyCode ?? ""} spellCheck={false} onChange={(e) => put({ bodyCode: e.target.value })} className="min-h-[64px] font-mono text-xs" />
        </Field>
        <div className="sticky bottom-0 -mx-5 flex items-center gap-2 border-t border-line bg-surface px-5 py-3">
          <PanelButton type="submit" tone="ink" disabled={pending}>
            Save
          </PanelButton>
          {msg && <span className={cn("text-xs", msg.ok ? "text-fg-3" : "text-red")}>{msg.message}</span>}
        </div>
      </form>
      <div className="mt-2 border-t border-line px-5 py-4">
        <h3 className="text-sm font-semibold">Delete funnel</h3>
        <p className="mt-1 text-xs leading-5 text-fg-3">Removes every step and its public pages. Contacts and orders it created stay.</p>
        <PanelButton tone="danger" className="mt-2.5" disabled={pending} onClick={() => confirm(`Delete ${funnel.name}? This can't be undone.`) && start(() => actions.deleteFunnel(funnel.id))}>
          <Trash2 className="size-3.5" /> Delete funnel
        </PanelButton>
      </div>
    </div>
  );
}
