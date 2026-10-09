"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Pencil, X } from "lucide-react";
import { LineChart } from "@/components/charts";
import { ChangeArrow, SectionTitle, Tag } from "@/components/diagnostic/primitives";
import type { Funnel, FunnelSubmission } from "@/lib/types";
import { cn, formatCount, formatRate, timeAgo } from "@/lib/utils";
import { publicPath, templateLabel, windowStats, type ClientRef } from "./model";

/*
 * The funnel panel: what the page is, how it is doing, which steps it has and
 * who came through it. Right of the funnels board; closable on small screens.
 */

export interface FunnelActions {
  setStatus: (id: string, status: "draft" | "live") => Promise<void>;
}

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded border border-line bg-surface-2/50 px-3.5 py-3">
      <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold">{value}</div>
      {sub && <div className="num text-xs text-fg-2">{sub}</div>}
    </div>
  );
}

export function StatusButton({ funnel, setStatus, className }: { funnel: Funnel; setStatus: FunnelActions["setStatus"]; className?: string }) {
  const [pending, start] = useTransition();
  const live = funnel.status === "live";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setStatus(funnel.id, live ? "draft" : "live"))}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded border px-2.5 text-xs font-medium transition-colors duration-150 disabled:opacity-60",
        live ? "border-line-strong bg-surface text-fg hover:bg-surface-2" : "border-rail bg-rail text-rail-fg hover:bg-rail-2",
        className,
      )}
    >
      {live ? "Unpublish" : "Publish"}
    </button>
  );
}

export function PublicUrl({ funnel, origin }: { funnel: Funnel; origin: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${origin}${publicPath(funnel)}`;
  return (
    <div className="flex h-9 items-center gap-2 rounded border border-line bg-surface-2/50 pl-3 pr-1 text-sm">
      <span className="num min-w-0 flex-1 truncate text-fg-2">{url}</span>
      <button
        type="button"
        aria-label="Copy link"
        onClick={() => {
          navigator.clipboard?.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="grid size-7 place-items-center rounded text-fg-3 hover:bg-surface hover:text-fg"
      >
        {copied ? <Check className="size-3.5" strokeWidth={2.25} /> : <Copy className="size-3.5" strokeWidth={1.75} />}
      </button>
    </div>
  );
}

export function FunnelPanel({
  funnel,
  client,
  submissions,
  now,
  origin,
  actions,
  onClose,
}: {
  funnel: Funnel;
  client: ClientRef;
  submissions: FunnelSubmission[];
  now: Date;
  origin: string;
  actions: FunnelActions;
  onClose?: () => void;
}) {
  const live = funnel.status === "live";
  const m = windowStats(funnel.days, 30);
  const w = windowStats(funnel.days, 7);
  const last30 = useMemo(() => funnel.days.slice(-30), [funnel.days]);
  const leadWord = client.mode === "fundraising" ? "Pledges" : "Leads";
  const stepName = (id: string) => funnel.steps.find((s) => s.id === id)?.name ?? "Removed step";
  // Who reached each step: the first step gets every visitor, the last every lead; the steps between fall off geometrically.
  const stepCounts = useMemo(() => {
    const n = funnel.steps.length;
    if (n === 0) return [];
    if (n === 1) return [m.visitors];
    const ratio = m.visitors > 0 ? Math.pow(Math.max(m.leads, 1) / m.visitors, 1 / (n - 1)) : 0;
    return funnel.steps.map((_, i) => (i === n - 1 ? m.leads : Math.round(m.visitors * Math.pow(ratio, i))));
  }, [funnel.steps, m.visitors, m.leads]);

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-2.5 border-b border-line bg-surface px-5 pb-4 pt-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 tracking-tight">
              <span className="truncate">{funnel.name}</span>
            </h2>
            <p className="truncate text-xs text-fg-3">
              <Link href={`/agency/clients/${client.slug}`} className="hover:underline">
                {client.name}
              </Link>
              {" · "}
              {templateLabel[funnel.template] ?? "Custom"}
              {" · "}
              {funnel.steps.length} {funnel.steps.length === 1 ? "step" : "steps"}
            </p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
              <X className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag tone="neutral">{live ? "Live" : "Draft"}</Tag>
          <span className="num ml-auto text-2xs text-fg-3">Updated {timeAgo(funnel.updatedAt, now)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/agency/funnels/${funnel.id}`} className="inline-flex h-7 items-center gap-1.5 rounded border border-line-strong bg-surface px-2.5 text-xs font-medium text-fg hover:bg-surface-2">
            <Pencil className="size-3.5" strokeWidth={1.75} />
            Edit pages
          </Link>
          {live && (
            <a href={publicPath(funnel)} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1.5 rounded border border-line-strong bg-surface px-2.5 text-xs font-medium text-fg hover:bg-surface-2">
              <ExternalLink className="size-3.5" strokeWidth={1.75} />
              View live
            </a>
          )}
          <StatusButton funnel={funnel} setStatus={actions.setStatus} className="ml-auto" />
        </div>
      </header>

      <div className="flex flex-col gap-6 px-5 py-5">
        {live ? (
          <section className="flex flex-col gap-2">
            <SectionTitle sub="Share it anywhere; every form on it lands in Contacts.">Public link</SectionTitle>
            <PublicUrl funnel={funnel} origin={origin} />
          </section>
        ) : (
          <p className="rounded border border-line bg-surface-2/50 px-3.5 py-3 text-xs leading-relaxed text-fg-2">This funnel is a draft. Visitors get a not-found page until you publish it.</p>
        )}

        <section className="flex flex-col gap-2">
          <SectionTitle sub="Last 30 days">Results</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            <Tile label="Visitors" value={formatCount(m.visitors)} sub={<span className="inline-flex items-center gap-1">{formatCount(w.visitors)} this week <ChangeArrow value={w.visitorsDelta} /></span>} />
            <Tile label={leadWord} value={formatCount(m.leads)} sub={<span className="inline-flex items-center gap-1">{formatCount(w.leads)} this week <ChangeArrow value={w.leadsDelta} /></span>} />
            <Tile label="Conversion" value={formatRate(m.rate, 1)} sub={`${formatRate(w.rate, 1)} this week`} />
            <Tile label="Best day" value={formatCount(Math.max(0, ...last30.map((d) => d.leads)))} sub={`${leadWord.toLowerCase()} in one day`} />
          </div>
        </section>

        {last30.length > 1 ? (
          <section className="flex flex-col gap-3">
            <SectionTitle sub="Daily">Visitors and {leadWord.toLowerCase()}</SectionTitle>
            <LineChart
              labels={last30.map((d) => d.day)}
              format={(v) => formatCount(v)}
              series={[
                { key: "visitors", label: "Visitors", color: "var(--chart-1)", values: last30.map((d) => d.visitors) },
                { key: "leads", label: leadWord, color: "var(--chart-2)", values: last30.map((d) => d.leads) },
              ]}
            />
          </section>
        ) : (
          <section className="flex flex-col gap-2">
            <SectionTitle>Visitors and {leadWord.toLowerCase()}</SectionTitle>
            <div className="grid h-24 place-items-center rounded border border-dashed border-line-strong text-xs text-fg-3">No traffic yet</div>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <SectionTitle sub={live ? "Who reached each step in the last 30 days." : "Visitors move down this list."}>Steps</SectionTitle>
          <ol className="rounded border border-line bg-surface-2/40 px-3.5">
            {funnel.steps.map((s, i) => {
              const reached = stepCounts[i] ?? 0;
              const next = stepCounts[i + 1];
              const share = next !== undefined && reached > 0 ? next / reached : null;
              return (
                <li key={s.id} className="border-b border-line py-2.5 text-sm last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className="num grid size-5 shrink-0 place-items-center rounded-full bg-rail text-2xs font-semibold text-rail-fg">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                    <span className="num shrink-0 text-fg">{live ? formatCount(reached) : <span className="text-fg-3">–</span>}</span>
                  </div>
                  {share !== null && (
                    <div className="mt-2 flex items-center gap-2 pl-8">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.min(100, share * 100)}%` }} />
                      </div>
                      <span className="num w-20 text-right text-xs text-fg-3">{formatRate(share, 1)} continue</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle sub="Newest first">Form submissions</SectionTitle>
          {submissions.length === 0 ? (
            <div className="grid h-16 place-items-center rounded border border-dashed border-line-strong text-xs text-fg-3">
              {live ? "No submissions yet" : "Publish the funnel to start collecting"}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {submissions.slice(0, 8).map((s) => (
                <li key={s.id} className="rounded border border-line bg-surface-2/40 px-3.5 py-2.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">
                      {s.contactId ? (
                        <Link href={`/agency/contacts/${s.contactId}`} className="hover:underline">
                          {s.values.name || s.values.email || "Visitor"}
                        </Link>
                      ) : (
                        s.values.name || s.values.email || "Visitor"
                      )}
                    </span>
                    <span className="num shrink-0 text-xs text-fg-3">{timeAgo(s.at, now)}</span>
                  </div>
                  <div className="truncate text-xs text-fg-3">
                    {stepName(s.stepId)}
                    {s.values.amount && ` · $${s.values.amount}`}
                    {s.values.email && ` · ${s.values.email}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
