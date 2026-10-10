"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ExternalLink, Pencil, Plus, Search, X } from "lucide-react";
import { Sparkline } from "@/components/charts";
import { ButtonLink } from "@/components/page-header";
import { ChangeArrow } from "@/components/diagnostic/primitives";
import { CopyField } from "@/components/integrations/ui";
import type { FormDefinition } from "@/lib/types";
import { cn, formatCount, formatRate, timeAgo } from "@/lib/utils";
import type { FormStats } from "./data";
import type { ClientRef } from "./model";
import { FormStatusTag, formatDuration, inkButton, smallButton } from "./ui";

/*
 * Forms board: ink top bar, KPI strip, the table and a form panel, on the
 * same grammar as Funnels and Contacts.
 */

export interface BoardForm {
  form: Pick<FormDefinition, "id" | "accountId" | "name" | "slug" | "status" | "scoring" | "updatedAt"> & { questionCount: number };
  stats: FormStats;
}

const th = "whitespace-nowrap px-3 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6";
const td = "px-3 py-1.5 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6";

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

const rate = (s: Pick<FormStats, "visits30" | "completed30">) => (s.visits30 ? s.completed30 / s.visits30 : null);

export function FormsBoard({ forms, clients, origin, nowIso, initialClientId }: { forms: BoardForm[]; clients: ClientRef[]; origin: string; nowIso: string; initialClientId?: string }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [clientId, setClientId] = useState(initialClientId ?? "all");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "live" | "draft" | "closed">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const inClient = forms.filter((f) => clientId === "all" || f.form.accountId === clientId);
  const q = query.trim().toLowerCase();
  const rows = inClient
    .filter((f) => scope === "all" || f.form.status === scope)
    .filter((f) => !q || [f.form.name, f.form.slug, clientById.get(f.form.accountId)?.name ?? ""].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => Number(a.form.status !== "live") - Number(b.form.status !== "live") || b.stats.responses7 - a.stats.responses7 || a.form.name.localeCompare(b.form.name));
  const selected = rows.find((f) => f.form.id === selectedId) ?? rows[0] ?? null;

  const live = inClient.filter((f) => f.form.status === "live").length;
  const r7 = inClient.reduce((a, f) => a + f.stats.responses7, 0);
  const prev7 = inClient.reduce((a, f) => a + f.stats.responsesPrev7, 0);
  const visits = inClient.reduce((a, f) => a + f.stats.visits30, 0);
  const completed = inClient.reduce((a, f) => a + f.stats.completed30, 0);
  const medians = inClient.map((f) => f.stats.medianSeconds).filter((s): s is number => s !== null).sort((a, b) => a - b);
  const clientName = clientId === "all" ? undefined : clientById.get(clientId)?.name;
  const newHref = `/agency/forms/new${clientId !== "all" ? `?client=${clientId}` : ""}`;

  const select = (id: string) => {
    setSelectedId(id);
    setPanelOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:flex-nowrap md:px-6">
          <div className="min-w-0 md:shrink-0">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">Forms</h1>
            <p className="num text-xs text-rail-fg-2 md:whitespace-nowrap">
              {clientName ?? "All clients"} · {formatCount(inClient.length)} forms · {formatCount(live)} live
            </p>
          </div>
          <label className="relative order-last w-full md:order-none md:ml-2 md:w-auto md:min-w-[160px] md:max-w-[280px] md:flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2" strokeWidth={1.75} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search forms" className="h-8 w-full rounded border border-rail-line bg-rail-2 pl-8 pr-3 text-sm text-rail-fg placeholder:text-rail-fg-2/80 focus:border-rail-fg-2 focus:outline-none" />
          </label>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <select aria-label="Status" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="hidden h-7 rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none sm:block">
              <option value="all">Every status</option>
              <option value="live">Live</option>
              <option value="draft">Draft</option>
              <option value="closed">Closed</option>
            </select>
            <select
              aria-label="Client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setSelectedId(null);
              }}
              className="h-7 max-w-[160px] rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none"
            >
              <option value="all">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ButtonLink href={newHref} className="h-7 whitespace-nowrap px-2.5 text-xs">
              <Plus className="size-3.5" strokeWidth={2.25} />
              <span className="hidden sm:inline">New form</span>
              <span className="sr-only sm:hidden">New form</span>
            </ButtonLink>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6 xl:grid-cols-4">
          <Kpi label="Live forms" value={formatCount(live)} aside={`of ${formatCount(inClient.length)}`} />
          <Kpi
            label="Responses · 7 days"
            value={formatCount(r7)}
            aside={
              <span className="inline-flex items-center gap-1">
                <ChangeArrow value={prev7 ? (r7 - prev7) / prev7 : null} />
                was {formatCount(prev7)}
              </span>
            }
          />
          <Kpi label="Completion · 30 days" value={formatRate(visits ? completed / visits : null)} aside={`${formatCount(completed)} of ${formatCount(visits)} visits`} />
          <Kpi label="Time to finish" value={formatDuration(medians.length ? medians[Math.floor(medians.length / 2)]! : null)} aside="median" />
        </div>

        <div className="overflow-x-auto border-y border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={th}>Form</th>
                <th scope="col" className={cn(th, "hidden md:table-cell")}>Client</th>
                <th scope="col" className={cn(th, "hidden sm:table-cell")}>Status</th>
                <th scope="col" className={cn(th, "hidden text-right 2xl:table-cell")}>Questions</th>
                <th scope="col" className={cn(th, "text-right")}>7 days</th>
                <th scope="col" className={cn(th, "hidden text-right xl:table-cell")}>Completion</th>
                <th scope="col" className={cn(th, "hidden xl:table-cell")}>Last response</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ form, stats }) => {
                const on = selected?.form.id === form.id;
                return (
                  <tr
                    key={form.id}
                    aria-selected={on}
                    tabIndex={0}
                    onClick={() => select(form.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        select(form.id);
                      }
                    }}
                    className={cn("h-[52px] cursor-pointer border-b border-line transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand", on ? "bg-brand-soft/40 shadow-[inset_2px_0_0_var(--brand)]" : "hover:bg-surface-2/60")}
                  >
                    <td className={td}>
                      <span className="block max-w-[34ch] truncate font-medium">{form.name}</span>
                      <span className="num block max-w-[34ch] truncate text-xs text-fg-3">/form/{form.slug}</span>
                    </td>
                    <td className={cn(td, "hidden whitespace-nowrap text-fg-2 md:table-cell")}>{clientById.get(form.accountId)?.name}</td>
                    <td className={cn(td, "hidden sm:table-cell")}>
                      <span className="inline-flex items-center gap-1.5">
                        <FormStatusTag status={form.status} />
                        {form.scoring && <span className="text-2xs text-fg-3">Quiz</span>}
                      </span>
                    </td>
                    <td className={cn(td, "num hidden text-right text-fg-2 2xl:table-cell")}>{form.questionCount}</td>
                    <td className={cn(td, "text-right")}>
                      <span className="inline-flex items-center justify-end gap-3">
                        <span className="hidden lg:block">{stats.responses30 > 0 && <Sparkline values={stats.daily.slice(-14)} color="var(--chart-1)" width={56} height={18} />}</span>
                        <span className="num min-w-[2ch]">{stats.responses7 ? formatCount(stats.responses7) : <span className="text-fg-3">–</span>}</span>
                      </span>
                    </td>
                    <td className={cn(td, "num hidden text-right text-fg-2 xl:table-cell")}>{formatRate(rate(stats))}</td>
                    <td className={cn(td, "hidden whitespace-nowrap text-fg-2 xl:table-cell")}>{stats.lastAt ? timeAgo(stats.lastAt, now) : <span className="text-fg-3">Never</span>}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-fg-3">
                    {inClient.length === 0 ? (
                      <>
                        No forms yet.{" "}
                        <Link href={newHref} className="font-medium text-fg underline-offset-2 hover:underline">
                          Make the first one
                        </Link>
                      </>
                    ) : (
                      "Nothing matches."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <>
          <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[400px] 2xl:w-[440px]">
            <FormPanel item={selected} client={clientById.get(selected.form.accountId)} origin={origin} now={now} />
          </aside>
          {panelOpen && (
            <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label={selected.form.name}>
              <button type="button" aria-label="Close panel" onClick={() => setPanelOpen(false)} className="flex-1 bg-rail/40" />
              <aside className="h-full w-[min(100%,420px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                <FormPanel item={selected} client={clientById.get(selected.form.accountId)} origin={origin} now={now} onClose={() => setPanelOpen(false)} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FormPanel({ item, client, origin, now, onClose }: { item: BoardForm; client?: ClientRef; origin: string; now: Date; onClose?: () => void }) {
  const { form, stats } = item;
  const url = `${origin}/form/${form.slug}`;
  const top = stats.reach[0]?.reached || 1;
  return (
    <div>
      <div className="sticky top-0 z-[1] border-b border-line bg-surface px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold leading-6 tracking-tight">{form.name}</h2>
            <p className="mt-0.5 truncate text-xs text-fg-3">
              {client?.name} · {form.questionCount} questions{form.scoring ? " · scored quiz" : ""}
            </p>
          </div>
          {onClose && (
            <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
              <X className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <FormStatusTag status={form.status} />
          <span className="text-xs text-fg-3">Edited {timeAgo(form.updatedAt, now)}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/agency/forms/${form.id}`} className={inkButton}>
            <Pencil className="size-3.5" strokeWidth={2} />
            Edit form
          </Link>
          <Link href={`/agency/forms/${form.id}/responses`} className={smallButton}>
            Responses
            <span className="num text-fg-3">{formatCount(stats.responses30)}</span>
          </Link>
          {form.status === "live" && (
            <a href={`/form/${form.slug}`} target="_blank" rel="noreferrer" className={smallButton}>
              <ExternalLink className="size-3.5" strokeWidth={2} />
              Open
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 px-5 py-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold">Share</h3>
          <CopyField value={url} label="Form link" />
          <p className="mt-1.5 text-xs leading-relaxed text-fg-3">
            {form.status === "live" ? "Add ?utm_source=… to the link and the value is saved with each response." : form.status === "draft" ? "Publish the form from the builder to switch the link on." : "The link says the form is closed."}
          </p>
        </section>

        <section>
          <h3 className="text-sm font-semibold">Last 30 days</h3>
          <div className="mt-2 grid grid-cols-3 divide-x divide-line rounded border border-line">
            {[
              { label: "Responses", value: formatCount(stats.responses30) },
              { label: "Completion", value: formatRate(rate(stats)) },
              { label: "Median time", value: formatDuration(stats.medianSeconds) },
            ].map((t) => (
              <div key={t.label} className="px-3 py-2.5">
                <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{t.label}</div>
                <div className="num mt-0.5 text-base font-semibold">{t.value}</div>
              </div>
            ))}
          </div>
          {stats.responses30 > 0 && (
            <div className="mt-3 flex items-end justify-between gap-3">
              <Sparkline values={stats.daily} color="var(--chart-1)" width={260} height={36} />
              <span className="num shrink-0 text-xs text-fg-3">per day</span>
            </div>
          )}
        </section>

        {stats.visits30 > 0 && (
          <section>
            <h3 className="text-sm font-semibold">Where people stop</h3>
            <p className="mt-0.5 text-xs text-fg-3">Share of the {formatCount(stats.visits30)} visitors who reached each question.</p>
            <ol className="mt-3 flex flex-col gap-2">
              {stats.reach.map((r, i) => {
                const share = r.reached / top;
                const drop = i > 0 ? (stats.reach[i - 1]!.reached - r.reached) / top : 0;
                return (
                  <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs">
                    <span className="truncate text-fg-2">
                      <span className="num mr-1.5 text-fg-3">{i + 1}</span>
                      {r.title}
                    </span>
                    <span className="num text-fg">
                      {formatRate(share)}
                      {drop >= 0.15 && <span className="ml-1.5 font-medium text-amber">−{formatRate(drop)}</span>}
                    </span>
                    <span className="col-span-2 block h-1.5 rounded-[2px] bg-surface-2" aria-hidden>
                      <span className="block h-full rounded-[2px] bg-[var(--chart-1)]" style={{ width: `${share * 100}%` }} />
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">Latest responses</h3>
            {stats.recent.length > 0 && (
              <Link href={`/agency/forms/${form.id}/responses`} className="inline-flex items-center gap-1 text-xs font-medium text-fg-2 hover:text-fg">
                All responses
                <ArrowUpRight className="size-3.5" strokeWidth={2} />
              </Link>
            )}
          </div>
          {stats.recent.length === 0 ? (
            <p className="mt-2 text-xs text-fg-3">No responses yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {stats.recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/agency/forms/${form.id}/responses?r=${r.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-2/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-fg-3">{r.headline || "No answer shown"}</span>
                    </span>
                    {r.score !== undefined && <span className="num rounded-[4px] bg-surface-2 px-1.5 text-2xs font-medium text-fg-2">{r.score} pts</span>}
                    <span className="num shrink-0 text-xs text-fg-3">{timeAgo(r.at, now)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
