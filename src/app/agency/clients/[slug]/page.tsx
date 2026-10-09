import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { AlertTriangle, ArrowLeft, Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { Delta, StatusChip, TrendStrip, healthLabel } from "@/components/status";
import { getClientDetail } from "@/lib/data/agency";
import type { DiagnosticMetrics, Task } from "@/lib/types";
import { cn, formatMoney, trendDelta } from "@/lib/utils";

function metricRows(m: DiagnosticMetrics): { label: string; value: string; delta?: number; goodWhenUp?: boolean }[] {
  if (m.mode === "marketing") {
    const t = m.today;
    const cpl = t.leads ? t.spendCents / t.leads : null;
    const cpb = t.bookedAppointments ? t.spendCents / t.bookedAppointments : null;
    return [
      { label: "Ad spend", value: formatMoney(t.spendCents) },
      { label: "Leads", value: String(t.leads) },
      { label: "Cost per lead", value: cpl === null ? "–" : formatMoney(cpl), goodWhenUp: false },
      { label: "Booked appointments", value: String(t.bookedAppointments) },
      { label: "Cost per booking", value: cpb === null ? "–" : formatMoney(cpb), goodWhenUp: false },
      { label: "Showed", value: String(t.showed) },
      { label: "Closed", value: String(t.closed) },
    ];
  }
  const t = m.today;
  return [
    { label: "Raised", value: formatMoney(t.raisedCents) },
    { label: "Donations", value: String(t.donations) },
    { label: "Average gift", value: formatMoney(t.averageGiftCents) },
    { label: "New donors", value: String(t.newDonors) },
    { label: "New monthly donors", value: String(t.newRecurring) },
  ];
}

const taskStatus: Record<Task["status"], string> = { todo: "To do", in_progress: "In progress", done: "Done" };

function formatDue(iso: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (iso === today) return "due today";
  if (iso < today) return `overdue since ${formatDay(iso)}`;
  return `due ${formatDay(iso)}`;
}

function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line pb-2">
      <h2 className="text-sm font-semibold">{children}</h2>
      {aside && <span className="text-xs text-fg-3">{aside}</span>}
    </div>
  );
}

async function ClientDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  const detail = await getClientDetail(slug);
  if (!detail) notFound();
  const { account, diagnostics, notes, tasks } = detail;
  const today = diagnostics[0] ?? null;
  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {account.name}
            {today && <StatusChip health={today.health} />}
          </span>
        }
        meta={
          <span className="flex items-center gap-3">
            <Link href="/agency" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Daily Diagnostic
            </Link>
            <span aria-hidden>·</span>
            <span>{account.mode === "marketing" ? "Digital marketing" : "Digital fundraising"}</span>
          </span>
        }
      />

      <div className="grid gap-x-10 gap-y-8 px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-8">
          {today ? (
            <section>
              <SectionTitle aside={`Yesterday · ${healthLabel[today.health]}`}>Diagnostic</SectionTitle>

              {(today.alerts.length > 0 || today.summary) && (
                <div
                  className={cn(
                    "mt-3 flex gap-3 rounded border px-4 py-3 text-sm",
                    today.health === "red"
                      ? "border-red/20 bg-red-soft/60"
                      : today.health === "amber"
                        ? "border-amber/20 bg-amber-soft/60"
                        : "border-line bg-surface-2",
                  )}
                >
                  {today.health !== "green" && (
                    <AlertTriangle
                      className={cn("mt-0.5 size-4 shrink-0", today.health === "red" ? "text-red" : "text-amber")}
                      strokeWidth={1.75}
                    />
                  )}
                  <p className="max-w-[72ch] leading-relaxed text-fg-2">
                    {today.alerts.length > 0 && (
                      <span className={cn("font-medium", today.health === "red" ? "text-red" : "text-amber")}>
                        {today.alerts.join(" · ")}.{" "}
                      </span>
                    )}
                    {today.summary}
                  </p>
                </div>
              )}

              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 sm:gap-x-12">
                {metricRows(today.metrics).map((r) => (
                  <div
                    key={r.label}
                    className="flex items-baseline justify-between gap-4 border-b border-line py-2.5"
                  >
                    <dt className="text-sm text-fg-2">{r.label}</dt>
                    <dd className="flex items-baseline gap-2">
                      {r.delta !== undefined && <Delta value={r.delta} goodWhenUp={r.goodWhenUp} />}
                      <span className="num text-base font-medium">{r.value}</span>
                    </dd>
                  </div>
                ))}
                <div
                  className={cn(
                    "flex items-center justify-between gap-4 border-b border-line py-2.5",
                    metricRows(today.metrics).length % 2 === 0 && "sm:col-span-2",
                  )}
                >
                  <dt className="text-sm text-fg-2">
                    7-day {today.metrics.mode === "marketing" ? "leads" : "raised"}
                  </dt>
                  <dd className="flex items-center gap-3">
                    <TrendStrip values={today.metrics.trend7d} health={today.health} />
                    <Delta value={trendDelta(today.metrics.trend7d)} />
                  </dd>
                </div>
              </dl>
            </section>
          ) : (
            <section>
              <SectionTitle>Diagnostic</SectionTitle>
              <p className="mt-3 text-sm text-fg-3">No diagnostic has run for this client yet. The first one appears tomorrow morning.</p>
            </section>
          )}

          <section>
            <SectionTitle aside={`${notes.length} note${notes.length === 1 ? "" : "s"}`}>Notes</SectionTitle>
            {notes.length === 0 ? (
              <p className="mt-3 text-sm text-fg-3">No notes yet. Call notes left here show up on the Daily Diagnostic board.</p>
            ) : (
              <ol>
                {notes.map((n) => (
                  <li key={n.id} className="grid gap-x-6 gap-y-1 border-b border-line py-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                    <div className="text-xs text-fg-3">
                      <div className="font-medium text-fg">{n.authorName}</div>
                      <div className="num">
                        {new Date(n.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                      {n.internalOnly && <div>Internal</div>}
                    </div>
                    <p className="max-w-[72ch] text-sm leading-relaxed text-fg-2">{n.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside>
          <SectionTitle aside={`${open.length} open`}>Tasks</SectionTitle>
          {tasks.length === 0 ? (
            <p className="mt-3 text-sm text-fg-3">No tasks for this client.</p>
          ) : (
            <ul>
              {[...open, ...done].map((t) => (
                <li key={t.id} className="flex gap-3 border-b border-line py-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded-[3px] border",
                      t.status === "done" ? "border-green bg-green text-white" : "border-line-strong bg-surface",
                    )}
                  >
                    {t.status === "done" && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <div className="min-w-0">
                    <div className={cn("text-sm", t.status === "done" && "text-fg-3 line-through")}>{t.title}</div>
                    <div className="text-xs text-fg-3">
                      {taskStatus[t.status]}
                      {t.assigneeName && ` · ${t.assigneeName}`}
                      {t.dueOn && t.status !== "done" && ` · ${formatDue(t.dueOn)}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}

export default function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Shell current="/agency/clients">
      <Suspense fallback={<PageHeader title="Client" meta={<span className="text-fg-3">Loading…</span>} />}>
        <ClientDetail params={params} />
      </Suspense>
    </Shell>
  );
}
