import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Delta, StatusChip, TrendStrip } from "./status";
import type { ClientOverview, DiagnosticMetrics } from "@/lib/types";
import { cn, formatMoney, trendDelta } from "@/lib/utils";

/*
 * The departure board. One row per client, columns aligned across every
 * row so the eye reads down a column, not across a card. Flagged rows get
 * a second line, the service notice, carrying the alert and the summary.
 */

const columns =
  "md:grid-cols-[112px_minmax(180px,1.4fr)_minmax(90px,0.8fr)_minmax(120px,0.7fr)_minmax(100px,0.9fr)_112px_minmax(160px,1.6fr)_56px]";

function cells(m: DiagnosticMetrics) {
  if (m.mode === "marketing") {
    const t = m.today;
    const cpb = t.bookedAppointments ? t.spendCents / t.bookedAppointments : null;
    return {
      money: formatMoney(t.spendCents),
      moneyLabel: "Spend",
      count: String(t.leads),
      countLabel: "Leads",
      rate: cpb === null ? "–" : formatMoney(cpb),
      rateLabel: "Cost per booking",
      trendLabel: "leads",
    };
  }
  const t = m.today;
  return {
    money: formatMoney(t.raisedCents),
    moneyLabel: "Raised",
    count: String(t.donations),
    countLabel: "Donations",
    rate: formatMoney(t.averageGiftCents),
    rateLabel: "Avg gift",
    trendLabel: "raised",
  };
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-2xs uppercase tracking-[0.06em] text-fg-3 md:hidden">{children}</span>;
}

export function Board({ rows }: { rows: ClientOverview[] }) {
  return (
    <div className="bg-surface">
      <div
        className={cn(
          "hidden items-center gap-x-4 border-b border-line px-5 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 md:grid md:px-8",
          columns,
        )}
        role="row"
      >
        <span>Status</span>
        <span>Client</span>
        <span className="text-right">Spend / raised</span>
        <span className="text-right">Leads / donations</span>
        <span className="text-right">Cost / gift</span>
        <span>7 days</span>
        <span>Latest note</span>
        <span className="text-right">Tasks</span>
      </div>

      <ol>
        {rows.map((r) => (
          <BoardRow key={r.account.id} overview={r} />
        ))}
      </ol>
    </div>
  );
}

function BoardRow({ overview }: { overview: ClientOverview }) {
  const { account, diagnostic, latestNote, openTasks } = overview;
  const href = `/agency/clients/${account.slug}`;
  const flagged = diagnostic ? diagnostic.health !== "green" : false;
  const c = diagnostic ? cells(diagnostic.metrics) : null;
  const delta = diagnostic ? trendDelta(diagnostic.metrics.trend7d) : 0;

  return (
    <li className="border-b border-line">
      <div
        className={cn(
          "grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-3.5 transition-colors duration-150 hover:bg-surface-2/70 md:grid md:items-center md:px-8",
          columns,
        )}
      >
        <div className="col-span-2 md:col-span-1">
          {diagnostic ? <StatusChip health={diagnostic.health} /> : <span className="text-xs text-fg-3">No data</span>}
        </div>

        <div className="col-span-2 min-w-0 md:col-span-1">
          <Link href={href} className="text-base font-medium hover:underline">
            {account.name}
          </Link>
          <div className="text-xs text-fg-3">
            {account.mode === "marketing" ? "Digital marketing" : "Digital fundraising"}
          </div>
        </div>

        <div className="md:text-right">
          <Label>{c?.moneyLabel ?? "Spend"}</Label>
          <div className="num text-base font-medium">{c?.money ?? "–"}</div>
        </div>
        <div className="md:text-right">
          <Label>{c?.countLabel ?? "Leads"}</Label>
          <div className="num text-base font-medium">{c?.count ?? "–"}</div>
        </div>
        <div className="md:text-right">
          <Label>{c?.rateLabel ?? "Rate"}</Label>
          <div className="num text-base font-medium">{c?.rate ?? "–"}</div>
        </div>

        <div className="flex items-center gap-2">
          {diagnostic && (
            <>
              <TrendStrip values={diagnostic.metrics.trend7d} health={diagnostic.health} />
              <Delta value={delta} />
            </>
          )}
        </div>

        <div className={cn("col-span-2 min-w-0 text-sm text-fg-2 md:col-span-1", flagged && "hidden md:block")}>
          {latestNote ? (
            <span className="block truncate" title={latestNote.body}>
              <span className="font-medium text-fg">{latestNote.authorName}</span>{" "}
              {latestNote.body}
            </span>
          ) : (
            <span className="text-fg-3">No notes</span>
          )}
        </div>

        <div className="num hidden text-right text-sm md:block">
          {openTasks || <span className="text-fg-3">0</span>}
        </div>
      </div>

      {flagged && diagnostic && (
        <div
          className={cn(
            "flex gap-3 px-5 pb-3.5 text-sm md:px-8 md:pl-[calc(2rem+112px+1rem)]",
          )}
        >
          <AlertTriangle
            className={cn(
              "mt-0.5 size-4 shrink-0",
              diagnostic.health === "red" ? "text-red" : "text-amber",
            )}
            strokeWidth={1.75}
          />
          <div className="max-w-[72ch] leading-relaxed text-fg-2">
            <p>
              {diagnostic.alerts.length > 0 && (
                <span
                  className={cn(
                    "font-medium",
                    diagnostic.health === "red" ? "text-red" : "text-amber",
                  )}
                >
                  {diagnostic.alerts.join(" · ")}.{" "}
                </span>
              )}
              {diagnostic.summary}
            </p>
            {latestNote && (
              <p className="mt-1.5">
                <span className="font-medium text-fg">{latestNote.authorName}:</span>{" "}
                {latestNote.body}
              </p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
