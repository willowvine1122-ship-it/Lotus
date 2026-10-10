"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { CheckboxChip, Field, FormNotice, Select, SubmitButton, Textarea } from "@/components/form";
import type { Row } from "@/components/diagnostic/model";
import type { ActionState } from "@/app/agency/reports/actions";
import type { ReportConfig, ReportRange, ReportSectionId, Review } from "@/lib/types";
import { formatCount } from "@/lib/utils";
import { allSections, hourLabel, nextSend, sectionLabel, weekdayLabel } from "./model";
import { ReportBody } from "./report-body";

/*
 * Report builder: the settings on the left, the report itself on the right,
 * live. Whatever the preview shows is exactly what the client sees at /c/slug
 * and what the weekly email carries.
 */

export function ReportBuilder({
  client,
  row,
  reviews,
  config,
  nowIso,
  save,
}: {
  client: { id: string; name: string; slug: string; mode: "marketing" | "fundraising" };
  row: Row;
  reviews: Review[];
  config: ReportConfig;
  nowIso: string;
  save: (accountId: string, prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [state, formAction] = useActionState(save.bind(null, client.id), null);
  const [enabled, setEnabled] = useState(config.enabled);
  const [range, setRange] = useState<ReportRange>(config.range);
  const [sections, setSections] = useState<ReportSectionId[]>(config.sections);
  const [note, setNote] = useState(config.note ?? "");
  const [weekday, setWeekday] = useState(config.weekday);
  const [hour, setHour] = useState(config.hour);
  const e = state?.errors ?? {};
  const available = allSections.filter((s) => (s === "countries" ? client.mode === "fundraising" : true));
  const toggle = (s: ReportSectionId, on: boolean) => setSections((cur) => (on ? allSections.filter((x) => x === s || cur.includes(x)) : cur.filter((x) => x !== s)));
  const preview = { range, sections, note };
  const next = nextSend({ ...config, weekday, hour }, now);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-rail px-5 py-3 text-rail-fg md:px-6">
        <Link href="/agency/reports" className="inline-flex size-7 shrink-0 items-center justify-center rounded border border-rail-line bg-rail-2 text-rail-fg hover:bg-rail-line" aria-label="Back to reports">
          <ArrowLeft className="size-4" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-6 tracking-tight">{client.name} report</h1>
          <p className="num text-xs text-rail-fg-2">
            {enabled ? `${weekdayLabel[weekday]}s at ${hourLabel(hour)} · next ${next.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Schedule off"} · {formatCount(sections.length)} sections · the preview is what the client gets
          </p>
        </div>
        <Link href={`/c/${client.slug}`} target="_blank" className="hidden h-7 items-center rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium text-rail-fg hover:bg-rail-line sm:inline-flex">
          Open client view
        </Link>
      </header>

      <div className="grid flex-1 gap-0 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
        <form action={formAction} className="flex flex-col gap-5 border-b border-line bg-surface px-5 py-5 md:px-6 lg:border-b-0 lg:border-r">
          <label className="flex items-center justify-between gap-3 rounded border border-line bg-surface-2/50 px-3.5 py-3">
            <span>
              <span className="block text-sm font-medium">Weekly report email</span>
              <span className="block text-xs text-fg-3">Sends on its own every week</span>
            </span>
            <input type="checkbox" name="enabled" checked={enabled} onChange={(ev) => setEnabled(ev.target.checked)} className="size-4 accent-brand" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Send on" htmlFor="rb-weekday">
              <Select id="rb-weekday" name="weekday" value={weekday} onChange={(ev) => setWeekday(Number(ev.target.value))}>
                {weekdayLabel.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="At" htmlFor="rb-hour">
              <Select id="rb-hour" name="hour" value={hour} onChange={(ev) => setHour(Number(ev.target.value))}>
                {[6, 7, 8, 9, 10, 12, 14, 16, 17].map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Recipients" htmlFor="rb-recipients" error={e.recipients} hint="One email per line. The client's logins are filled in to start.">
            <Textarea id="rb-recipients" name="recipients" defaultValue={config.recipients.join("\n")} rows={3} className="num" aria-invalid={!!e.recipients} />
          </Field>

          <Field label="Covers" htmlFor="rb-range">
            <Select id="rb-range" name="range" value={range} onChange={(ev) => setRange(Number(ev.target.value) as ReportRange)}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </Select>
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Sections</legend>
            <div className="flex flex-wrap gap-1.5">
              {available.map((s) => (
                <CheckboxChip key={s} name="sections" value={s} label={sectionLabel[s]} checked={sections.includes(s)} onChange={(ev) => toggle(s, ev.target.checked)} />
              ))}
            </div>
          </fieldset>

          <Field label="Note from the account manager" htmlFor="rb-note" error={e.note} hint="Shows at the end of the report when it is not empty.">
            <Textarea id="rb-note" name="note" value={note} onChange={(ev) => setNote(ev.target.value)} rows={4} placeholder="Spend is being held flat this month while the new creative settles in." aria-invalid={!!e.note} />
          </Field>

          <div className="sticky bottom-0 -mx-5 flex items-center gap-3 border-t border-line bg-surface px-5 py-3 md:-mx-6 md:px-6">
            <SubmitButton pendingLabel="Saving…">Save report</SubmitButton>
            <FormNotice state={state} />
          </div>
        </form>

        <div className="min-w-0 bg-surface-2/40 px-5 py-6 md:px-8">
          <div className="mx-auto max-w-[880px] rounded border border-line bg-surface px-5 py-6 md:px-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
              <div>
                <h2 className="mt-0.5 text-xl font-semibold tracking-tight">{client.name}: your results</h2>
                <p className="mt-1 text-sm text-fg-3">
                  Last {range} days · prepared {now.toLocaleDateString("en-US", { month: "long", day: "numeric" })} by your Lotus team
                </p>
              </div>
            </div>
            <ReportBody row={row} config={preview} reviews={reviews} now={now} />
          </div>
        </div>
      </div>
    </div>
  );
}
