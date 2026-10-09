"use client";

import type { Row } from "@/components/diagnostic/model";
import { ReportBody } from "@/components/reports/report-body";
import { scheduleLabel } from "@/components/reports/model";
import type { ReportConfig, ReportSend, Review } from "@/lib/types";
import { formatCount } from "@/lib/utils";

/* The weekly report, as the client reads it on the web, plus the ones already sent. */

export function ClientReportPage({ row, config, reviews, sends, nowIso }: { row: Row; config: ReportConfig; reviews: Review[]; sends: ReportSend[]; nowIso: string }) {
  const now = new Date(nowIso);
  return (
    <div className="mx-auto max-w-[960px] px-5 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your weekly report</h1>
          <p className="mt-1 text-sm text-fg-3">
            Last {config.range} days · prepared {now.toLocaleDateString("en-US", { month: "long", day: "numeric" })} by your Lotus team
            {config.enabled && ` · emailed ${scheduleLabel(config)}`}
          </p>
        </div>
      </div>
      <ReportBody row={row} config={config} reviews={reviews} now={now} className="mt-6" />
      {sends.length > 0 && (
        <section className="mt-10 flex flex-col gap-2 border-t border-line pt-6">
          <h2 className="text-sm font-semibold">Past reports</h2>
          <ul className="flex flex-col divide-y divide-line rounded border border-line bg-surface text-sm">
            {sends.slice(0, 6).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span>{new Date(s.at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                <span className="num text-xs text-fg-3">Last {s.range} days · {formatCount(s.recipients.length)} {s.recipients.length === 1 ? "recipient" : "recipients"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
