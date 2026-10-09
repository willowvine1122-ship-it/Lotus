"use client";

import { useActionState, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Globe, MapPin, Phone, Video } from "lucide-react";
import type { BookingState } from "@/app/book/[slug]/actions";
import { Field, Input, SubmitButton, Textarea } from "@/components/form";
import { addDays, dayIn, formatDay, formatDuration, formatTime, locationLabel, slotsFor, tzLong, type Busy } from "@/lib/calendars";
import type { Calendar, MeetingLocation } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * The public booking flow: pick what to book, a day, a time, then leave a
 * name and email. Times are worked out here from the calendar's rules and
 * the busy list; the server checks the slot again when the form is sent.
 */

const locationIcon: Record<MeetingLocation, typeof MapPin> = { in_person: MapPin, phone: Phone, video: Video };
const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function monthDays(month: string) {
  // month is YYYY-MM-01
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: first }, () => null);
  for (let d = 1; d <= count; d++) cells.push(`${month.slice(0, 8)}${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
};

export function BookingFlow({
  calendar,
  busy,
  nowIso,
  action,
  initialTypeId,
}: {
  calendar: Calendar;
  busy: Busy[];
  nowIso: string;
  action: (prev: BookingState, formData: FormData) => Promise<BookingState>;
  initialTypeId?: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const tz = calendar.timeZone;
  const types = calendar.types.filter((t) => t.active);
  const today = dayIn(now, tz);
  const lastDay = addDays(today, calendar.maxDaysAhead);

  const [typeId, setTypeId] = useState(types.find((t) => t.id === initialTypeId)?.id ?? types[0]?.id);
  const type = types.find((t) => t.id === typeId) ?? types[0];

  // The React Compiler memoizes these; no manual useMemo needed.
  let firstOpen: string | null = null;
  for (let i = 0; type && i <= calendar.maxDaysAhead; i++) {
    const d = addDays(today, i);
    if (slotsFor(calendar, type, busy, d, now).length) {
      firstOpen = d;
      break;
    }
  }

  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const day = pickedDay ?? firstOpen;
  const [month, setMonth] = useState(`${(day ?? today).slice(0, 7)}-01`);
  const [slot, setSlot] = useState<string | null>(null);
  const [state, formAction] = useActionState(action, null);
  const e = state?.errors ?? {};

  const cells = monthDays(month);
  const openDays = new Set<string>();
  if (type) for (const c of cells) if (c && slotsFor(calendar, type, busy, c, now).length) openDays.add(c);
  const slots = type && day ? slotsFor(calendar, type, busy, day, now) : [];

  const tzName = tzLong(now, tz);
  const minMonth = `${today.slice(0, 7)}-01`;
  const maxMonth = `${lastDay.slice(0, 7)}-01`;
  const slotDate = slot ? new Date(slot) : null;
  const slotTaken = !!state?.message;

  if (!calendar.bookingEnabled || types.length === 0 || !type) {
    return (
      <div className="w-full max-w-[560px] bg-surface px-6 py-10 text-center sm:rounded sm:border sm:border-line">
        <h1 className="text-xl font-semibold tracking-tight">{calendar.name}</h1>
        <p className="mt-2 text-sm text-fg-2">This calendar is not taking bookings online right now. Please call or email to set up a time.</p>
      </div>
    );
  }

  const LocIcon = locationIcon[type.location];

  const info = (
    <div className="flex flex-col gap-5 border-b border-line px-5 py-6 lg:border-b-0 lg:border-r lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{step(slot) === "details" ? type.name : calendar.name}</h1>
        <p className="mt-0.5 text-sm text-fg-2">with {calendar.ownerName}</p>
        {calendar.description && step(slot) === "pick" && <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-fg-2">{calendar.description}</p>}
      </div>

      {step(slot) === "pick" && types.length > 1 && (
        <div role="radiogroup" aria-label="What would you like to book?" className="flex flex-col gap-2">
          {types.map((t) => (
            <label
              key={t.id}
              className={cn(
                "cursor-pointer rounded border px-3.5 py-2.5 transition-colors duration-150",
                t.id === type.id ? "border-fg bg-surface-2" : "border-line-strong bg-surface hover:border-fg-3",
              )}
            >
              <input
                type="radio"
                name="type"
                className="sr-only"
                checked={t.id === type.id}
                onChange={() => {
                  setTypeId(t.id);
                  setPickedDay(null);
                  setSlot(null);
                }}
              />
              <span className="block text-sm font-medium">{t.name}</span>
              <span className="num block text-xs text-fg-3">
                {formatDuration(t.durationMinutes)} · {locationLabel[t.location]}
              </span>
            </label>
          ))}
        </div>
      )}

      <dl className="flex flex-col gap-2.5 text-sm text-fg-2">
        {types.length === 1 && step(slot) === "pick" && (
          <div className="font-medium text-fg">{type.name}</div>
        )}
        <div className="flex items-start gap-2.5">
          <Clock className="mt-0.5 size-4 shrink-0 text-fg-3" strokeWidth={1.75} />
          <span className="num">{formatDuration(type.durationMinutes)}</span>
        </div>
        <div className="flex items-start gap-2.5">
          <LocIcon className="mt-0.5 size-4 shrink-0 text-fg-3" strokeWidth={1.75} />
          <span>
            {locationLabel[type.location]}
            {type.locationDetail && <span className="block text-xs text-fg-3">{type.locationDetail}</span>}
          </span>
        </div>
        <div className="flex items-start gap-2.5">
          <Globe className="mt-0.5 size-4 shrink-0 text-fg-3" strokeWidth={1.75} />
          <span>{tzName}</span>
        </div>
      </dl>
      {type.description && <p className="max-w-[48ch] text-sm leading-relaxed text-fg-2">{type.description}</p>}
    </div>
  );

  if (step(slot) === "details" && slotDate && day) {
    return (
      <div className="grid w-full max-w-[960px] bg-surface sm:rounded sm:border sm:border-line lg:grid-cols-[320px_minmax(0,1fr)]">
        {info}
        <form action={formAction} className="flex flex-col gap-5 px-5 py-6 lg:px-8">
          <button type="button" onClick={() => setSlot(null)} className="inline-flex w-fit items-center gap-1 text-sm text-fg-2 hover:text-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Change time
          </button>
          <div className="border-y border-line py-3">
            <p className="text-sm text-fg-2">{formatDay(day, { weekday: "long", month: "long", day: "numeric" })}</p>
            <p className="num text-lg font-semibold tracking-tight">
              {formatTime(slotDate, tz)} – {formatTime(new Date(slotDate.getTime() + type.durationMinutes * 60000), tz)}
            </p>
            <p className="text-xs text-fg-3">{tzName}</p>
          </div>

          {slotTaken && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded border border-red/25 bg-red-soft/50 px-3.5 py-3 text-sm">
              <span className="font-medium text-red">{state?.message}</span>
              <button type="button" onClick={() => setSlot(null)} className="text-sm font-medium text-fg underline">
                Pick another time
              </button>
            </div>
          )}

          <input type="hidden" name="typeId" value={type.id} />
          <input type="hidden" name="startsAt" value={slot ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="name" error={e.name} className="sm:col-span-2">
              <Input id="name" name="name" autoComplete="name" autoFocus required aria-invalid={!!e.name} />
            </Field>
            <Field label="Email" htmlFor="email" error={e.email}>
              <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!e.email} />
            </Field>
            <Field label="Phone" htmlFor="phone" error={e.phone} hint={type.location === "phone" ? "We call this number." : "Optional. For a reminder text."}>
              <Input id="phone" name="phone" type="tel" autoComplete="tel" required={type.location === "phone"} aria-invalid={!!e.phone} />
            </Field>
            <Field label="Anything we should know?" htmlFor="notes" error={e.notes} hint="Optional" className="sm:col-span-2">
              <Textarea id="notes" name="notes" className="min-h-[88px]" />
            </Field>
          </div>
          {e.startsAt && (
            <p role="alert" className="text-sm text-red">
              {e.startsAt}
            </p>
          )}
          <div>
            <SubmitButton pendingLabel="Booking…" className="h-10 px-4">
              Book {formatTime(slotDate, tz)}
            </SubmitButton>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-[1040px] bg-surface sm:rounded sm:border sm:border-line lg:grid-cols-[320px_minmax(0,1fr)_232px]">
      {info}

      <section aria-label="Pick a day" className="border-b border-line px-5 py-6 lg:border-b-0 lg:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{new Date(`${month}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</h2>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              disabled={month <= minMonth}
              className="grid size-8 place-items-center rounded text-fg-2 hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="size-4" strokeWidth={2} />
              <span className="sr-only">Previous month</span>
            </button>
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              disabled={month >= maxMonth}
              className="grid size-8 place-items-center rounded text-fg-2 hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="size-4" strokeWidth={2} />
              <span className="sr-only">Next month</span>
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center" role="grid">
          {weekdays.map((w, i) => (
            <div key={i} role="columnheader" aria-label={weekdayNames[i]} className="pb-1 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
              {w}
            </div>
          ))}
          {cells.map((c, i) => {
            if (!c) return <div key={`e${i}`} />;
            const open = openDays.has(c);
            const selected = c === day;
            const isToday = c === today;
            return (
              <button
                key={c}
                type="button"
                role="gridcell"
                disabled={!open}
                aria-selected={selected}
                aria-label={`${formatDay(c, { weekday: "long", month: "long", day: "numeric" })}${open ? "" : ", no times"}`}
                onClick={() => {
                  setPickedDay(c);
                  setSlot(null);
                }}
                className={cn(
                  "num relative mx-auto grid aspect-square w-full max-w-11 place-items-center rounded text-sm transition-colors duration-150",
                  selected ? "bg-rail font-semibold text-rail-fg" : open ? "bg-surface-2 font-medium text-fg hover:bg-line" : "cursor-default text-fg-3/70",
                )}
              >
                {Number(c.slice(8))}
                {isToday && <span aria-hidden className={cn("absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full", selected ? "bg-rail-fg" : "bg-fg-3")} />}
              </button>
            );
          })}
        </div>
        {openDays.size === 0 && <p className="mt-4 text-sm text-fg-3">No open times this month. Try the next one.</p>}
      </section>

      <section aria-label="Pick a time" className="flex flex-col px-5 py-6 lg:border-l lg:border-line lg:px-5">
        <h2 className="text-sm font-semibold">{day ? formatDay(day, { weekday: "long", month: "short", day: "numeric" }) : "Pick a day"}</h2>
        <p className="text-xs text-fg-3">{slots.length ? `${slots.length} time${slots.length === 1 ? "" : "s"} open` : day ? "Fully booked" : ""}</p>
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:max-h-[420px] lg:grid-cols-1 lg:overflow-y-auto lg:pr-1">
          {slots.map((s) => (
            <li key={s.toISOString()}>
              <button
                type="button"
                onClick={() => {
                  setSlot(s.toISOString());
                  if (typeof window !== "undefined") window.scrollTo({ top: 0 });
                }}
                className="num h-10 w-full rounded border border-line-strong bg-surface text-sm font-medium transition-colors duration-150 hover:border-fg hover:bg-surface-2"
              >
                {formatTime(s, tz)}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function step(slot: string | null) {
  return slot ? "details" : "pick";
}
