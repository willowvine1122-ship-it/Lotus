import { openWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { CalendarSettingsForm, TypesSection } from "@/components/calendars/calendar-forms";
import { BookingStatus } from "@/components/calendars/status";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { getClientRecord } from "@/lib/data/agency";
import { findCalendar, listAppointments } from "@/lib/data/calendars";
import { dayIn, formatDay, formatTime, hoursSummary, needsOutcome, tzAbbr } from "@/lib/calendars";
import { formatRate } from "@/lib/utils";
import { addTypeAction, toggleTypeAction, updateCalendarAction } from "../actions";

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  await openWorkspace();
  const now = new Date();
  const cal = findCalendar(now, id);
  if (!cal) notFound();
  const client = await getClientRecord(now, cal.accountId);
  const mine = listAppointments(now).filter((a) => a.calendarId === cal.id);
  const t = now.getTime();
  const upcoming = mine
    .filter((a) => a.status !== "cancelled" && new Date(a.endsAt).getTime() > t)
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  const month = mine.filter((a) => new Date(a.endsAt).getTime() <= t && new Date(a.endsAt).getTime() > t - 30 * 86400000);
  const showed = month.filter((a) => a.status === "showed").length;
  const noShow = month.filter((a) => a.status === "no_show").length;
  const outcome = mine.filter((a) => needsOutcome(a, now)).length;
  const next7 = upcoming.filter((a) => new Date(a.startsAt).getTime() < t + 7 * 86400000).length;

  return (
    <>
      <PageHeader
        title={cal.name}
        meta={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/agency/calendars?view=calendars" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Calendars
            </Link>
            <span aria-hidden>·</span>
            {client ? (
              <Link href={`/agency/clients/${client.account.slug}`} className="hover:text-rail-fg hover:underline">
                {client.account.name}
              </Link>
            ) : null}
            <span aria-hidden>·</span>
            <span>{cal.ownerName}</span>
            <span aria-hidden>·</span>
            <span className="num">{hoursSummary(cal.weekly)} {tzAbbr(now, cal.timeZone)}</span>
          </span>
        }
        actions={
          <a
            href={`/book/${cal.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-3 text-sm font-medium text-rail-fg hover:bg-rail-line"
          >
            Booking page
            <ExternalLink className="size-3.5" strokeWidth={2} />
          </a>
        }
      />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 bg-surface">
          <div className="max-w-[880px] px-5 md:px-8">
            <TypesSection calendar={cal} addType={addTypeAction.bind(null, cal.id)} toggleType={toggleTypeAction.bind(null, cal.id)} />
            <CalendarSettingsForm key={JSON.stringify(cal.weekly) + cal.blockedDates.join()} calendar={cal} action={updateCalendarAction.bind(null, cal.id)} today={dayIn(now, cal.timeZone)} />
          </div>
        </div>
        <aside className="flex flex-col gap-6 border-t border-line px-5 py-6 lg:border-l lg:border-t-0 lg:px-6">
          <dl className="grid grid-cols-3 gap-3">
            {[
              ["Next 7 days", String(next7), ""],
              ["Show rate", formatRate(showed + noShow ? showed / (showed + noShow) : null), "30 days"],
              ["To mark", String(outcome), "past"],
            ].map(([label, value, sub]) => (
              <div key={label}>
                <dt className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{label}</dt>
                <dd className={`num mt-0.5 text-lg font-semibold ${label === "To mark" && outcome > 0 ? "text-amber" : ""}`}>{value}</dd>
                {sub && <dd className="text-xs text-fg-3">{sub}</dd>}
              </div>
            ))}
          </dl>
          <section>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <h2 className="text-sm font-semibold">Next up</h2>
              <Link href="/agency/calendars" className="text-xs text-fg-2 hover:underline">
                All bookings
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="py-4 text-sm text-fg-3">Nothing booked yet. Share the booking page to fill it.</p>
            ) : (
              <ul>
                {upcoming.slice(0, 8).map((a) => {
                  const s = new Date(a.startsAt);
                  const type = cal.types.find((x) => x.id === a.typeId);
                  return (
                    <li key={a.id} className="flex items-center gap-3 border-b border-line py-2.5">
                      <div className="w-[72px] shrink-0">
                        <div className="num text-sm font-medium">{formatTime(s, cal.timeZone)}</div>
                        <div className="text-xs text-fg-3">{formatDay(dayIn(s, cal.timeZone), { weekday: "short", month: "short", day: "numeric" })}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{a.contact.name}</div>
                        <div className="truncate text-xs text-fg-3">{type?.name}</div>
                      </div>
                      <BookingStatus appointment={a} now={now} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

export default function CalendarPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell current="/agency/calendars">
      <Suspense fallback={<PageHeader title="Calendar" meta={<span>Loading…</span>} />}>
        <Detail params={params} />
      </Suspense>
    </Shell>
  );
}
