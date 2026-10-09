"use client";

import { AlertTriangle, Mail, MapPin, X } from "lucide-react";
import { StatusDot, Tag } from "@/components/diagnostic/primitives";
import { donorStateHealth, donorStateLabel, type DonorRow } from "@/lib/fundraising";
import { cn, formatDollars, formatDollarsExact } from "@/lib/utils";

/*
 * The donor panel: who they are, what they have given, the monthly plan,
 * and every gift, newest first. A failed card or a lapse leads as a
 * diagnosis box, the same device the client panel uses for alerts.
 */

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded border border-line bg-surface-2/50 px-3.5 py-3">
      <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold">{value}</div>
      {sub && <div className="num text-xs text-fg-2">{sub}</div>}
    </div>
  );
}

const date = (iso: string, withYear = true) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });

const months = (days: number) => {
  const m = Math.round(days / 30.4);
  return m >= 24 ? `${Math.floor(m / 12)} years` : `${m} months`;
};

export function DonorPanel({
  row,
  now,
  campaignTitles,
  showClient,
  onClose,
}: {
  row: DonorRow;
  now: Date;
  campaignTitles: Record<string, string>;
  showClient: boolean;
  onClose?: () => void;
}) {
  const health = donorStateHealth[row.state];
  const plan = row.plan;
  const livePlan = plan && plan.status !== "canceled" ? plan : null;

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-[1] border-b border-line bg-surface px-5 pb-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <StatusDot health={health} className="size-2.5" />
            <h2 className="truncate text-lg font-semibold tracking-tight">{row.name}</h2>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="-mr-1.5 grid size-8 shrink-0 place-items-center rounded text-fg-2 hover:bg-surface-2 hover:text-fg">
              <X className="size-4" strokeWidth={2} />
              <span className="sr-only">Close</span>
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Tag tone={row.state === "lapsed" ? "amber" : "neutral"}>{donorStateLabel[row.state]}</Tag>
          {livePlan && <Tag tone="neutral">Monthly donor</Tag>}
          {row.major && <Tag tone="neutral">Major donor</Tag>}
          {row.anonymous && <Tag tone="neutral">Gives anonymously</Tag>}
        </div>
        <div className="mt-2.5 flex flex-col gap-1 text-xs text-fg-2">
          <a href={`mailto:${row.email}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-fg hover:underline">
            <Mail className="size-3.5 shrink-0 text-fg-3" strokeWidth={1.75} />
            <span className="truncate">{row.email}</span>
          </a>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0 text-fg-3" strokeWidth={1.75} />
            {[row.city, row.countryName].filter(Boolean).join(", ")}
          </span>
          <span className="text-fg-3">
            {showClient && <>{row.clientName} · </>}
            {row.firstGiftAt ? `Donor since ${new Date(row.firstGiftAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : "No gifts yet"}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-6 px-5 py-5">
        {row.state === "past_due" && livePlan && (
          <Diagnosis tone="red">
            <span className="font-medium text-red">Monthly card declined.</span> The {formatDollars(livePlan.amountCents)} gift on {row.history[0] ? date(row.history[0].at, false) : "the last charge"} failed.{livePlan.nextChargeOn ? ` The next retry is ${date(livePlan.nextChargeOn, false)}.` : ""} A personal note before then gives them a chance to update the card.
          </Diagnosis>
        )}
        {row.state === "lapsed" && row.daysSinceLastGift !== null && (
          <Diagnosis tone="amber">
            <span className="font-medium text-amber">No gift in {months(row.daysSinceLastGift)}.</span> Last gave {formatDollars(row.lastGiftCents)}
            {row.history[0] ? ` to ${campaignTitles[row.history[0].campaignId] ?? "a campaign"}` : ""}. A good fit for the next win-back appeal.
          </Diagnosis>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Tile label="Lifetime" value={formatDollars(row.lifetimeCents)} sub={`${row.giftCount} gift${row.giftCount === 1 ? "" : "s"}`} />
          <Tile label="Last 12 months" value={formatDollars(row.last12Cents)} sub={row.last12Cents ? "given this year" : "nothing this year"} />
          <Tile label="Average gift" value={row.avgGiftCents ? formatDollars(row.avgGiftCents) : "–"} sub={`largest ${formatDollars(row.largestCents)}`} />
          <Tile
            label="Last gift"
            value={row.lastGiftAt ? formatDollars(row.lastGiftCents) : "–"}
            sub={row.lastGiftAt ? date(row.lastGiftAt) : "never"}
          />
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Recurring</h3>
          {plan ? (
            <div className="rounded border border-line bg-surface-2/50 px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="num text-base font-semibold">
                  {formatDollars(plan.amountCents)}
                  <span className="text-sm font-normal text-fg-3"> a month</span>
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    plan.status === "past_due" ? "text-red" : plan.status === "canceled" ? "text-fg-3" : "text-fg-2",
                  )}
                >
                  {plan.status === "past_due" ? "Card declined" : plan.status === "canceled" ? "Canceled" : plan.status === "paused" ? "Paused" : "Active"}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
                <dt className="text-fg-3">Started</dt>
                <dd className="num text-right text-fg-2">{date(plan.startedAt)}</dd>
                {plan.nextChargeOn && (
                  <>
                    <dt className="text-fg-3">{plan.status === "past_due" ? "Retry" : "Next gift"}</dt>
                    <dd className="num text-right text-fg-2">{date(plan.nextChargeOn)}</dd>
                  </>
                )}
                <dt className="text-fg-3">Directed to</dt>
                <dd className="truncate text-right text-fg-2">{plan.designation}</dd>
                <dt className="text-fg-3">Campaign</dt>
                <dd className="truncate text-right text-fg-2">{campaignTitles[plan.campaignId] ?? "–"}</dd>
              </dl>
            </div>
          ) : (
            <p className="rounded border border-dashed border-line-strong px-3.5 py-3 text-xs text-fg-3">No monthly gift.{row.giftCount >= 3 ? ` Gave ${row.giftCount} times: a good candidate for a monthly ask.` : ""}</p>
          )}
        </section>

        <section className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Giving history</h3>
            <span className="num text-xs text-fg-3">
              {row.history.length < row.giftCount ? `Latest ${row.history.length} of ${row.giftCount}` : `${row.history.length} gift${row.history.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <ol>
            {row.history.map((g) => (
              <li key={g.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
                <span className="num text-xs text-fg-3">{date(g.at, g.at.slice(0, 4) !== String(now.getFullYear()))}</span>
                <span className="min-w-0">
                  <span className="block truncate">{campaignTitles[g.campaignId] ?? "Gift"}</span>
                  <span className="block truncate text-xs text-fg-3">
                    {g.frequency === "monthly" ? "Monthly" : "One-time"} · {g.designation}
                  </span>
                </span>
                <span className="text-right">
                  <span className={cn("num block font-medium", g.status === "failed" && "text-fg-3 line-through")}>{formatDollarsExact(g.amountCents)}</span>
                  {g.status === "failed" ? (
                    <span className="block text-2xs text-red">Declined</span>
                  ) : g.status === "refunded" ? (
                    <span className="block text-2xs text-fg-3">Refunded</span>
                  ) : g.feeCoveredCents > 0 ? (
                    <span className="num block text-2xs text-fg-3">+{formatDollarsExact(g.feeCoveredCents)} fees</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function Diagnosis({ tone, children }: { tone: "red" | "amber"; children: React.ReactNode }) {
  return (
    <div className={cn("flex gap-2.5 rounded border px-3.5 py-3 text-sm leading-relaxed text-fg-2", tone === "red" ? "border-red/25 bg-red-soft/50" : "border-amber/25 bg-amber-soft/50")}>
      <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", tone === "red" ? "text-red" : "text-amber")} strokeWidth={1.75} />
      <p>{children}</p>
    </div>
  );
}
