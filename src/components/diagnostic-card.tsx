import Link from "next/link";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { HealthBadge } from "./health-badge";
import { Sparkline } from "./sparkline";
import type { ClientOverview, DiagnosticMetrics } from "@/lib/types";
import { formatMoney, formatPercent, trendDelta } from "@/lib/utils";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function stats(m: DiagnosticMetrics) {
  if (m.mode === "marketing") {
    const t = m.today;
    const cpl = t.leads ? t.spendCents / t.leads : 0;
    const cpa = t.bookedAppointments ? t.spendCents / t.bookedAppointments : 0;
    return [
      { label: "Spend", value: formatMoney(t.spendCents) },
      { label: "Leads", value: String(t.leads) },
      { label: "Cost / lead", value: cpl ? formatMoney(cpl) : "–" },
      { label: "Booked", value: String(t.bookedAppointments) },
      { label: "Cost / booking", value: cpa ? formatMoney(cpa) : "–" },
    ];
  }
  const t = m.today;
  return [
    { label: "Raised", value: formatMoney(t.raisedCents) },
    { label: "Donations", value: String(t.donations) },
    { label: "Avg gift", value: formatMoney(t.averageGiftCents) },
    { label: "New donors", value: String(t.newDonors) },
    { label: "New monthly", value: String(t.newRecurring) },
  ];
}

export function DiagnosticCard({ overview }: { overview: ClientOverview }) {
  const { account, diagnostic, latestNote, openTasks } = overview;
  const delta = diagnostic ? trendDelta(diagnostic.metrics.trend7d) : 0;
  const trendLabel = account.mode === "marketing" ? "leads" : "raised";

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/agency/clients/${account.slug}`}
            className="text-base font-semibold hover:underline"
          >
            {account.name}
          </Link>
          <div className="mt-0.5 text-xs uppercase tracking-wide text-muted">
            {account.mode === "marketing" ? "Digital marketing" : "Digital fundraising"}
          </div>
        </div>
        {diagnostic && <HealthBadge health={diagnostic.health} />}
      </header>

      {diagnostic ? (
        <>
          <div className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-5">
            {stats(diagnostic.metrics).map((s) => (
              <Stat key={s.label} {...s} />
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
            <div className="text-xs text-muted">
              7-day {trendLabel}{" "}
              <span
                className={
                  delta >= 0 ? "font-medium text-green" : "font-medium text-red"
                }
              >
                {formatPercent(delta)}
              </span>
            </div>
            <Sparkline values={diagnostic.metrics.trend7d} health={diagnostic.health} />
          </div>

          {diagnostic.alerts.length > 0 && (
            <ul className="flex flex-col gap-1">
              {diagnostic.alerts.map((a) => (
                <li key={a} className="flex items-center gap-2 text-sm text-red">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          )}

          {diagnostic.summary && (
            <p className="text-sm leading-relaxed text-foreground/90">{diagnostic.summary}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">No diagnostic yet for today.</p>
      )}

      <footer className="mt-auto flex items-start justify-between gap-3 border-t border-border pt-3 text-xs text-muted">
        {latestNote ? (
          <div className="flex min-w-0 items-start gap-2">
            <MessageSquare className="mt-0.5 size-3.5 shrink-0" />
            <span className="truncate">
              <span className="font-medium text-foreground">{latestNote.authorName}:</span>{" "}
              {latestNote.body}
            </span>
          </div>
        ) : (
          <span>No notes yet</span>
        )}
        <span className="shrink-0">{openTasks} open task{openTasks === 1 ? "" : "s"}</span>
      </footer>
    </article>
  );
}
