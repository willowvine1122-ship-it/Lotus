"use client";

import { useTransition } from "react";
import Link from "next/link";
import { CalendarClock, Mail, MapPin, Phone, X } from "lucide-react";
import { setStatusAction } from "@/app/agency/calendars/actions";
import { SectionTitle } from "@/components/diagnostic/primitives";
import { dayIn, formatDay, formatTime, locationLabel, needsOutcome, tzAbbr, tzLong } from "@/lib/calendars";
import type { Appointment, AppointmentStatus, Calendar } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { BookingStatus } from "./status";
import type { ClientLite } from "./workspace";

/*
 * The booking panel. Who, when, what was booked and from where, how to
 * reach them, what they wrote, the next action, and their other bookings
 * with this client.
 */

const sourceLabel: Record<Appointment["source"], string> = { booking_page: "Booking page", ads: "Ad lead form", manual: "Added by team" };

function until(start: Date, end: Date, now: Date) {
  const t = now.getTime();
  if (t >= start.getTime() && t < end.getTime()) return "happening now";
  const diff = start.getTime() - t;
  const abs = Math.abs(diff);
  const unit = abs < 3600000 ? `${Math.max(1, Math.round(abs / 60000))} min` : abs < 86400000 ? `${Math.round(abs / 3600000)} hr` : `${Math.round(abs / 86400000)} day${Math.round(abs / 86400000) === 1 ? "" : "s"}`;
  return diff > 0 ? `in ${unit}` : `${unit} ago`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="text-sm text-fg-2">{label}</dt>
      <dd className="min-w-0 text-right text-sm">{children}</dd>
    </div>
  );
}

export function BookingPanel({
  appointment: a,
  calendar,
  client,
  history,
  now,
  onClose,
}: {
  appointment: Appointment;
  calendar: Calendar;
  client?: ClientLite;
  history: Appointment[];
  now: Date;
  onClose?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const tz = calendar.timeZone;
  const start = new Date(a.startsAt);
  const end = new Date(a.endsAt);
  const type = calendar.types.find((t) => t.id === a.typeId);
  const isPast = end.getTime() <= now.getTime();
  const others = history
    .filter((h) => h.id !== a.id && h.accountId === a.accountId && h.contact.email.toLowerCase() === a.contact.email.toLowerCase())
    .sort((x, y) => (x.startsAt < y.startsAt ? 1 : -1));

  // Seeded walk-ins carry a calendar-scoped id; everyone else is a CRM contact.
  const inCrm = !a.contact.id.startsWith("cal-");
  const set = (status: AppointmentStatus) => startTransition(() => setStatusAction(a.id, status));

  const actions: { label: string; status: AppointmentStatus; strong?: boolean }[] = [];
  if (a.status === "cancelled") {
    if (!isPast) actions.push({ label: "Restore booking", status: "confirmed", strong: true });
  } else if (needsOutcome(a, now)) {
    actions.push({ label: "Showed", status: "showed", strong: true }, { label: "No-show", status: "no_show" });
  } else if (a.status === "showed") {
    actions.push({ label: "Mark no-show instead", status: "no_show" });
  } else if (a.status === "no_show") {
    actions.push({ label: "Mark showed instead", status: "showed" });
  } else if (a.status === "booked") {
    actions.push({ label: "Mark confirmed", status: "confirmed", strong: true }, { label: "Cancel booking", status: "cancelled" });
  } else {
    actions.push({ label: "Cancel booking", status: "cancelled" });
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-[1] flex flex-col gap-2 border-b border-line bg-surface px-5 pb-3.5 pt-4">
        <div className="flex items-center gap-2.5">
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{a.contact.name}</h2>
          <BookingStatus appointment={a} now={now} />
          {onClose && (
            <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg lg:hidden">
              <X className="size-4" strokeWidth={2} />
              <span className="sr-only">Close</span>
            </button>
          )}
        </div>
        <p className="truncate text-xs text-fg-2">
          {client ? (
            <Link href={`/agency/clients/${client.slug}`} className="hover:underline">
              {client.name}
            </Link>
          ) : null}
          <span className="text-fg-3"> · {calendar.name}</span>
        </p>
      </header>

      <div className="flex flex-col gap-6 px-5 py-5">
        <section className="flex flex-col gap-1">
          <p className="text-sm text-fg-2">{formatDay(dayIn(start, tz), { weekday: "long", month: "long", day: "numeric" })}</p>
          <p className={cn("num text-xl font-semibold leading-7 tracking-tight", a.status === "cancelled" && "text-fg-3 line-through")}>
            {formatTime(start, tz)} – {formatTime(end, tz)}
          </p>
          <p className="text-xs text-fg-3">
            {tzLong(start, tz)} ({tzAbbr(start, tz)}) · {until(start, end, now)}
          </p>
        </section>

        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-busy={pending}>
            {actions.map((x) => (
              <button
                key={x.label}
                type="button"
                disabled={pending}
                onClick={() => set(x.status)}
                className={cn(
                  "inline-flex h-8 items-center rounded px-3 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
                  x.strong ? "bg-rail text-rail-fg hover:bg-rail-2" : "border border-line-strong bg-surface text-fg hover:bg-surface-2",
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
        )}

        <section>
          <SectionTitle>Booking</SectionTitle>
          <dl className="mt-1">
            <Row label="Appointment">{type?.name ?? "Appointment"}</Row>
            <Row label="With">{calendar.ownerName}</Row>
            <Row label="Where">
              <span className="inline-flex items-center gap-1">
                {type ? locationLabel[type.location] : "–"}
              </span>
              {type?.locationDetail && <span className="block text-xs text-fg-3">{type.locationDetail}</span>}
            </Row>
            <Row label="Source">{sourceLabel[a.source]}</Row>
            <Row label="Booked">
              <span className="num">{timeAgo(a.createdAt, now)}</span>
            </Row>
          </dl>
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle
            aside={
              inCrm ? (
                <Link href={`/agency/contacts/${a.contact.id}`} className="text-xs text-fg-2 hover:text-fg hover:underline">
                  Open contact
                </Link>
              ) : undefined
            }
          >
            Contact
          </SectionTitle>
          <a href={`mailto:${a.contact.email}`} className="inline-flex min-w-0 items-center gap-2 text-sm hover:underline">
            <Mail className="size-4 shrink-0 text-fg-3" strokeWidth={1.75} />
            <span className="truncate">{a.contact.email}</span>
          </a>
          {a.contact.phone && (
            <a href={`tel:${a.contact.phone.replace(/[^\d+]/g, "")}`} className="num inline-flex items-center gap-2 text-sm hover:underline">
              <Phone className="size-4 shrink-0 text-fg-3" strokeWidth={1.75} />
              {a.contact.phone}
            </a>
          )}
          {type?.location === "in_person" && type.locationDetail && (
            <span className="inline-flex items-center gap-2 text-sm text-fg-2">
              <MapPin className="size-4 shrink-0 text-fg-3" strokeWidth={1.75} />
              {type.locationDetail}
            </span>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle>Their note</SectionTitle>
          {a.notes ? (
            <p className="rounded border border-line bg-surface-2/50 px-3.5 py-3 text-sm leading-relaxed text-fg-2">{a.notes}</p>
          ) : (
            <p className="text-sm text-fg-3">Nothing added on the booking form.</p>
          )}
        </section>

        <section className="flex flex-col gap-1">
          <SectionTitle sub={others.length ? `${others.length + 1} bookings with ${client?.name ?? "this client"}` : undefined}>History</SectionTitle>
          {others.length === 0 ? (
            <p className="mt-1 text-sm text-fg-3">This is their only booking.</p>
          ) : (
            <ul className="mt-1">
              {others.slice(0, 6).map((h) => {
                const hs = new Date(h.startsAt);
                return (
                  <li key={h.id} className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
                    <CalendarClock className="size-4 shrink-0 text-fg-3" strokeWidth={1.75} />
                    <span className="num min-w-0 flex-1 truncate text-sm">
                      {formatDay(dayIn(hs, tz), { month: "short", day: "numeric" })} · {formatTime(hs, tz)}
                    </span>
                    <BookingStatus appointment={h} now={now} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
