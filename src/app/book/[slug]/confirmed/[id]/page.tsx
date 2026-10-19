import { openPublicWorkspace } from "@/lib/server/workspace";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CalendarPlus, Check, Clock, Globe, MapPin, Phone, Video } from "lucide-react";
import { BookingShell } from "@/components/booking/booking-shell";
import { dayIn, formatDay, formatDuration, formatTime, locationLabel, tzLong } from "@/lib/calendars";
import { getClientRecord } from "@/lib/data/agency";
import { findAppointment, findCalendar } from "@/lib/data/calendars";

export const metadata: Metadata = { title: "You're booked", robots: { index: false } };

const icons = { in_person: MapPin, phone: Phone, video: Video } as const;

async function Confirmed({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  await connection();
  if (!(await openPublicWorkspace(`calendar:${slug}`))) notFound();
  const now = new Date();
  const cal = findCalendar(now, slug);
  const appt = findAppointment(now, id);
  if (!cal || !appt || appt.calendarId !== cal.id) notFound();
  const client = await getClientRecord(now, cal.accountId);
  const type = cal.types.find((t) => t.id === appt.typeId);
  const start = new Date(appt.startsAt);
  const end = new Date(appt.endsAt);
  const tz = cal.timeZone;
  const Loc = icons[type?.location ?? "in_person"];
  const first = appt.contact.name.split(/\s+/)[0];

  return (
    <BookingShell clientName={client?.account.name ?? cal.name}>
      <div className="w-full max-w-[560px] bg-surface px-5 py-8 sm:rounded sm:border sm:border-line sm:px-8">
        <span className="grid size-9 place-items-center rounded bg-green-soft text-green">
          <Check className="size-5" strokeWidth={2.5} />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">You&apos;re booked, {first}.</h1>
        <p className="mt-1 text-sm text-fg-2">
          {appt.status === "cancelled" ? "This booking was cancelled." : `Your time with ${cal.ownerName} is saved.`}
        </p>

        <div className="mt-6 border-y border-line py-4">
          <p className="text-sm font-medium">{type?.name ?? cal.name}</p>
          <p className="mt-1 text-sm text-fg-2">{formatDay(dayIn(start, tz), { weekday: "long", month: "long", day: "numeric" })}</p>
          <p className="num text-xl font-semibold tracking-tight">
            {formatTime(start, tz)} – {formatTime(end, tz)}
          </p>
        </div>

        <dl className="mt-4 flex flex-col gap-2.5 text-sm text-fg-2">
          <div className="flex items-start gap-2.5">
            <Clock className="mt-0.5 size-4 shrink-0 text-fg-3" strokeWidth={1.75} />
            <span className="num">{formatDuration(Math.round((end.getTime() - start.getTime()) / 60000))}</span>
          </div>
          {type && (
            <div className="flex items-start gap-2.5">
              <Loc className="mt-0.5 size-4 shrink-0 text-fg-3" strokeWidth={1.75} />
              <span>
                {locationLabel[type.location]}
                {type.locationDetail && <span className="block text-xs text-fg-3">{type.locationDetail}</span>}
              </span>
            </div>
          )}
          <div className="flex items-start gap-2.5">
            <Globe className="mt-0.5 size-4 shrink-0 text-fg-3" strokeWidth={1.75} />
            <span>{tzLong(start, tz)}</span>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={`/book/${cal.slug}/confirmed/${appt.id}/ics`}
            className="inline-flex h-9 items-center gap-1.5 rounded bg-rail px-3.5 text-sm font-medium text-rail-fg transition-colors duration-150 hover:bg-rail-2"
          >
            <CalendarPlus className="size-4" strokeWidth={1.75} />
            Add to my calendar
          </a>
          <Link href={`/book/${cal.slug}`} className="text-sm text-fg-2 hover:text-fg hover:underline">
            Book another time
          </Link>
        </div>
        <p className="mt-6 text-xs text-fg-3">Booked for {appt.contact.email}. Need to change it? Reply to the confirmation or call the office.</p>
      </div>
    </BookingShell>
  );
}

export default function ConfirmedPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <Confirmed params={params} />
    </Suspense>
  );
}
