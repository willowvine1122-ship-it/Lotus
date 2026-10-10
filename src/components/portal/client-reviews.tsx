"use client";

import { BarList, LineChart } from "@/components/charts";
import { SectionTitle } from "@/components/diagnostic/primitives";
import { averageRating, distribution, rollingRating, sourceLabel, windowed } from "@/components/reputation/model";
import { Stars } from "@/components/reputation/review-panel";
import type { Review } from "@/lib/types";
import { formatCount, timeAgo } from "@/lib/utils";

/* What the client sees of their reviews: the rating, the trend, and every review with the agency's reply. */

export function ClientReviews({ reviews, nowIso }: { reviews: Review[]; nowIso: string }) {
  const now = new Date(nowIso);
  const avg = averageRating(reviews);
  const { cur } = windowed(reviews, now, 30);
  const avg30 = averageRating(cur);
  const trend = rollingRating(reviews, now);
  const dist = distribution(reviews);
  return (
    <div className="mx-auto max-w-[960px] px-5 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your reviews</h1>
          <p className="mt-1 text-sm text-fg-3">Google and Facebook · updated {now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div className="rounded border border-line bg-surface px-4 py-3">
          <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Rating</div>
          <div className="num mt-0.5 flex items-center gap-2 text-xl font-semibold leading-7">
            {avg === null ? "–" : avg.toFixed(1)}
            {avg !== null && <Stars rating={avg} />}
          </div>
          <div className="num text-xs text-fg-3">{formatCount(reviews.length)} reviews all time</div>
        </div>
        <div className="rounded border border-line bg-surface px-4 py-3">
          <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Last 30 days</div>
          <div className="num mt-0.5 text-xl font-semibold leading-7">{avg30 === null ? "–" : avg30.toFixed(1)}</div>
          <div className="num text-xs text-fg-3">{formatCount(cur.length)} new reviews</div>
        </div>
        <div className="rounded border border-line bg-surface px-4 py-3">
          <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Five stars</div>
          <div className="num mt-0.5 text-xl font-semibold leading-7">{formatCount(dist[0]!.count)}</div>
          <div className="num text-xs text-fg-3">{reviews.length ? Math.round((dist[0]!.count / reviews.length) * 100) : 0}% of all reviews</div>
        </div>
        <div className="rounded border border-line bg-surface px-4 py-3">
          <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Replied</div>
          <div className="num mt-0.5 text-xl font-semibold leading-7">{formatCount(reviews.filter((r) => r.reply).length)}</div>
          <div className="num text-xs text-fg-3">{formatCount(reviews.filter((r) => !r.reply).length)} waiting</div>
        </div>
      </div>

      <section className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-3">
          <SectionTitle sub="90-day average, by week">Rating trend</SectionTitle>
          {trend.filter((t) => t.avg !== null).length >= 4 ? (
            <LineChart labels={trend.map((t) => t.label)} format={(v) => v.toFixed(1)} height={180} series={[{ key: "avg", label: "Average rating", color: "var(--chart-1)", values: trend.map((t) => t.avg) }]} />
          ) : (
            <div className="grid h-24 place-items-center rounded border border-dashed border-line-strong text-xs text-fg-3">Not enough history yet. The trend starts after a month of reviews.</div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <SectionTitle>By stars</SectionTitle>
          <BarList items={dist.map((d) => ({ key: String(d.stars), label: `${d.stars} star${d.stars === 1 ? "" : "s"}`, value: d.count }))} color="var(--chart-1)" format={(v) => formatCount(v)} />
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <SectionTitle sub="Newest first">All reviews</SectionTitle>
        <ul className="flex flex-col divide-y divide-line rounded border border-line bg-surface">
          {reviews.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{r.author}</span>
                <Stars rating={r.rating} />
                <span className="text-xs text-fg-3">
                  {sourceLabel[r.source]} · {timeAgo(r.at, now)}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-fg-2">{r.body}</p>
              {r.reply && (
                <div className="ml-4 border-l-2 border-line-strong pl-3 text-sm">
                  <span className="block text-xs text-fg-3">{r.reply.by} replied</span>
                  <p className="leading-relaxed text-fg-2">{r.reply.body}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
