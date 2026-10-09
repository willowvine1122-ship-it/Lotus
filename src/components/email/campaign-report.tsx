"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy } from "lucide-react";
import { LineChart } from "@/components/charts";
import { SectionTitle } from "@/components/diagnostic/primitives";
import { cn, formatCount, timeAgo } from "@/lib/utils";
import type { CampaignRow, EmailClientRef } from "./data";
import { prettyUrl } from "./model";
import { EmailPreview, Kpi, StatusTag, rate, tick, when } from "./ui";

/*
 * A sent campaign: four numbers, engagement over the first week, which links
 * got clicked, and every recipient with what they did. The email itself sits
 * on the right exactly as it went out.
 */

export interface RecipientRow {
  contactId: string;
  name: string;
  email: string;
  bounced: boolean;
  openedAt?: string;
  clickedAt?: string;
  clickedUrl?: string;
  unsubscribedAt?: string;
}

type Filter = "all" | "opened" | "clicked" | "unopened" | "bounced" | "unsubscribed";

function outcome(r: RecipientRow) {
  if (r.bounced) return "Bounced";
  if (r.unsubscribedAt) return "Unsubscribed";
  if (r.clickedAt) return "Clicked";
  if (r.openedAt) return "Opened";
  return "Delivered";
}

export function CampaignReport({ row, client, recipients, nowIso, justSent, duplicate }: { row: CampaignRow; client: EmailClientRef; recipients: RecipientRow[]; nowIso: string; justSent?: number; duplicate: (id: string) => Promise<void> }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [filter, setFilter] = useState<Filter>("all");
  const s = row.stats!;
  const counts: Record<Filter, number> = {
    all: recipients.length,
    opened: recipients.filter((r) => r.openedAt).length,
    clicked: recipients.filter((r) => r.clickedAt).length,
    unopened: recipients.filter((r) => !r.bounced && !r.openedAt).length,
    bounced: recipients.filter((r) => r.bounced).length,
    unsubscribed: recipients.filter((r) => r.unsubscribedAt).length,
  };
  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "Everyone" },
    { value: "opened", label: "Opened" },
    { value: "clicked", label: "Clicked" },
    { value: "unopened", label: "Didn't open" },
    { value: "bounced", label: "Bounced" },
    { value: "unsubscribed", label: "Unsubscribed" },
  ];
  const shown = recipients
    .filter((r) =>
      filter === "all" ? true : filter === "opened" ? r.openedAt : filter === "clicked" ? r.clickedAt : filter === "unopened" ? !r.bounced && !r.openedAt : filter === "bounced" ? r.bounced : r.unsubscribedAt,
    )
    .sort((a, b) => (b.clickedAt ?? b.openedAt ?? "").localeCompare(a.clickedAt ?? a.openedAt ?? "") || a.name.localeCompare(b.name));
  const totalClicks = row.links.reduce((a, l) => a + l.clicks, 0);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 bg-rail px-5 pb-5 pt-6 text-rail-fg md:px-8">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            <span className="truncate">{row.name}</span>
            <StatusTag status="sent" />
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-rail-fg-2">
            <Link href="/agency/email" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Email
            </Link>
            <span aria-hidden>·</span>
            <Link href={`/agency/clients/${client.slug}`} className="hover:underline">
              {client.name}
            </Link>
            <span aria-hidden>·</span>
            <span className="num">
              Sent {row.sentAt ? when(row.sentAt) : ""} to {row.audienceName}
            </span>
          </p>
        </div>
        <form action={duplicate.bind(null, row.id)}>
          <button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-3 text-sm font-medium text-rail-fg transition-colors duration-150 hover:bg-rail-line">
            <Copy className="size-3.5" strokeWidth={1.75} />
            Duplicate
          </button>
        </form>
      </header>

      {justSent !== undefined && (
        <p role="status" className="mx-5 mt-4 flex items-start gap-2 rounded border border-green/25 bg-green-soft/60 px-3.5 py-2.5 text-sm text-fg-2 md:mx-8">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green" strokeWidth={2} />
          <span>
            <span className="font-medium text-green">Sent to {formatCount(justSent)} {justSent === 1 ? "person" : "people"}.</span> Each one has it on their contact timeline. Opens and clicks show here as the email provider reports them.
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-8 xl:grid-cols-4">
        <Kpi label="Delivered" value={formatCount(s.delivered)} aside={s.bounced ? `${s.bounced} bounced` : "No bounces"} asideTone={s.sent && s.bounced / s.sent > 0.02 ? "amber" : undefined} />
        <Kpi label="Open rate" value={rate(s.openRate)} aside={`${formatCount(s.opened)} opened`} />
        <Kpi label="Click rate" value={rate(s.clickRate)} aside={s.clickToOpen === null ? `${formatCount(s.clicked)} clicked` : `${formatCount(s.clicked)} clicked · ${rate(s.clickToOpen, 0)} of opens`} />
        <Kpi label="Unsubscribed" value={formatCount(s.unsubscribed)} aside={rate(s.unsubRate)} asideTone={s.unsubRate !== null && s.unsubRate > 0.01 ? "amber" : undefined} />
      </div>

      <div className="grid gap-x-10 gap-y-8 px-5 pb-8 pt-2 md:px-8 lg:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="flex min-w-0 flex-col gap-8">
          {row.engagement && (
            <section className="flex flex-col gap-3">
              <SectionTitle sub="Unique opens and clicks per day, first seven days">Engagement</SectionTitle>
              {s.opened === 0 ? (
                <div className="grid h-[150px] place-items-center rounded border border-dashed border-line-strong px-4 text-center text-xs text-fg-3">No opens reported yet. They appear here as people read it.</div>
              ) : (
                <LineChart
                  labels={row.engagement.labels}
                  series={[
                    { key: "opens", label: "Opens", color: "var(--chart-1)", values: row.engagement.opens },
                    { key: "clicks", label: "Clicks", color: "var(--chart-2)", values: row.engagement.clicks },
                  ]}
                  format={tick}
                />
              )}
            </section>
          )}

          <section className="flex flex-col gap-3">
            <SectionTitle sub="First click per recipient">Links</SectionTitle>
            <div className="overflow-hidden rounded border border-line">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-surface-2/70">
                  <tr>
                    <th scope="col" className="px-3.5 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Link</th>
                    <th scope="col" className="w-20 px-3.5 py-2 text-right text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Clicks</th>
                    <th scope="col" className="w-20 px-3.5 py-2 text-right text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {row.links.map((l) => (
                    <tr key={l.url} className="border-t border-line">
                      <td className="max-w-0 truncate px-3.5 py-2.5 text-fg-2">{prettyUrl(l.url)}</td>
                      <td className="num px-3.5 py-2.5 text-right font-medium">{formatCount(l.clicks)}</td>
                      <td className="num px-3.5 py-2.5 text-right text-fg-2">{totalClicks ? Math.round((l.clicks / totalClicks) * 100) : 0}%</td>
                    </tr>
                  ))}
                  {row.links.length === 0 && (
                    <tr className="border-t border-line">
                      <td colSpan={3} className="px-3.5 py-4 text-center text-xs text-fg-3">
                        No clicks yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle sub={`${formatCount(recipients.length)} people`}>Recipients</SectionTitle>
            <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-1.5">
              {filters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "inline-flex h-6 items-center gap-1.5 rounded-[4px] border px-2 text-2xs font-medium transition-colors duration-150",
                    filter === f.value ? "border-rail bg-rail text-rail-fg" : "border-line-strong bg-surface text-fg-2 hover:border-fg-3",
                  )}
                >
                  {f.label}
                  <span className={cn("num", filter === f.value ? "text-rail-fg-2" : "text-fg-3")}>{formatCount(counts[f.value])}</span>
                </button>
              ))}
            </div>
            <div className="overflow-x-auto rounded border border-line">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-surface-2/70">
                  <tr>
                    <th scope="col" className="px-3.5 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Contact</th>
                    <th scope="col" className="px-3.5 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Result</th>
                    <th scope="col" className="hidden px-3.5 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 sm:table-cell">Clicked</th>
                    <th scope="col" className="whitespace-nowrap px-3.5 py-2 text-right text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, 200).map((r) => {
                    const o = outcome(r);
                    const last = r.unsubscribedAt ?? r.clickedAt ?? r.openedAt;
                    return (
                      <tr key={r.contactId} className="border-t border-line hover:bg-surface-2/60">
                        <td className="max-w-[240px] px-3.5 py-2">
                          <Link href={`/agency/contacts/${r.contactId}`} className="block truncate font-medium hover:underline">
                            {r.name}
                          </Link>
                          <span className="block truncate text-xs text-fg-3">{r.email}</span>
                        </td>
                        <td className="px-3.5 py-2">
                          <span className={cn("inline-flex h-5 items-center rounded-[4px] px-1.5 text-2xs font-medium", o === "Delivered" ? "text-fg-3" : "bg-surface-2 text-fg-2")}>{o}</span>
                        </td>
                        <td className="hidden max-w-[220px] truncate px-3.5 py-2 text-xs text-fg-2 sm:table-cell">{r.clickedUrl ? prettyUrl(r.clickedUrl) : <span className="text-fg-3">–</span>}</td>
                        <td className="num whitespace-nowrap px-3.5 py-2 text-right text-xs text-fg-2">{last ? timeAgo(last, now) : <span className="text-fg-3">–</span>}</td>
                      </tr>
                    );
                  })}
                  {shown.length === 0 && (
                    <tr className="border-t border-line">
                      <td colSpan={4} className="px-3.5 py-6 text-center text-xs text-fg-3">
                        Nobody here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {shown.length > 200 && <p className="text-xs text-fg-3">Showing the first 200 of {formatCount(shown.length)}.</p>}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-0 lg:max-h-screen lg:self-start lg:overflow-y-auto lg:py-0">
          <SectionTitle sub={`From ${row.fromName} <${row.fromEmail}>`}>The email</SectionTitle>
          <EmailPreview {...row} clientName={client.name} location={client.location} firstName={recipients[0]?.name.split(" ")[0]} lastName={recipients[0]?.name.split(" ").slice(1).join(" ")} mobile />
        </aside>
      </div>
    </>
  );
}
