"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Field, FormNotice, FormSection, Input, Select, SubmitButton, Textarea } from "@/components/form";
import type { ActionState } from "@/app/agency/clients/actions";
import { formatDay, formatDuration, formatMinute, locationLabel, weekdayShort } from "@/lib/calendars";
import type { Calendar, MeetingLocation } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ClientLite } from "./workspace";

type Bound = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const durations = [15, 20, 30, 45, 60, 90, 120];
const locations: { value: MeetingLocation; body: string }[] = [
  { value: "in_person", body: "At the client's office, or the lead's home or business." },
  { value: "phone", body: "The rep calls the number the lead gives." },
  { value: "video", body: "A video link goes out with the confirmation." },
];

function LocationPicker({ value, onChange }: { value: MeetingLocation; onChange: (v: MeetingLocation) => void }) {
  return (
    <div role="radiogroup" aria-label="Where it happens" className="grid gap-2.5 sm:col-span-2 sm:grid-cols-3">
      {locations.map((o) => (
        <label
          key={o.value}
          className={cn(
            "cursor-pointer rounded border px-4 py-3 transition-colors duration-150",
            value === o.value ? "border-fg bg-surface-2" : "border-line-strong bg-surface hover:border-fg-3",
          )}
        >
          <input type="radio" name="location" value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
          <span className="block text-sm font-medium">{locationLabel[o.value]}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-fg-3">{o.body}</span>
        </label>
      ))}
    </div>
  );
}

const detailPlaceholder: Record<MeetingLocation, string> = {
  in_person: "At your home or business",
  phone: "We call the number you give",
  video: "Google Meet link sent by email",
};

/* ----------------------------- new calendar ----------------------------- */

export function NewCalendarForm({ action, clients, defaultClientId }: { action: Bound; clients: ClientLite[]; defaultClientId?: string }) {
  const [state, formAction] = useActionState(action, null);
  const [location, setLocation] = useState<MeetingLocation>("in_person");
  const e = state?.errors ?? {};
  return (
    <form action={formAction} className="max-w-[880px] px-5 md:px-8">
      <FormSection title="Calendar" description="One calendar per person or team who takes the appointments. It books in the client's time zone.">
        <Field label="Client" htmlFor="accountId" error={e.accountId} className="sm:col-span-2">
          <Select id="accountId" name="accountId" defaultValue={defaultClientId ?? ""} aria-invalid={!!e.accountId}>
            <option value="" disabled>
              Pick a client
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Calendar name" htmlFor="name" error={e.name} hint="Leads see this on the booking page.">
          <Input id="name" name="name" placeholder="Roof inspections" autoFocus aria-invalid={!!e.name} />
        </Field>
        <Field label="Taken by" htmlFor="ownerName" error={e.ownerName} hint="The rep, doctor or team on the client's side.">
          <Input id="ownerName" name="ownerName" placeholder="Mike Alvarez" aria-invalid={!!e.ownerName} />
        </Field>
      </FormSection>

      <FormSection title="First appointment type" description="What a lead books. Add more types, and set hours and rules, on the next screen.">
        <Field label="Appointment name" htmlFor="typeName" error={e.typeName}>
          <Input id="typeName" name="typeName" placeholder="Free roof inspection" aria-invalid={!!e.typeName} />
        </Field>
        <Field label="Length" htmlFor="duration" error={e.duration}>
          <Select id="duration" name="duration" defaultValue="60">
            {durations.map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </Select>
        </Field>
        <LocationPicker value={location} onChange={setLocation} />
        <Field label="Location detail" htmlFor="locationDetail" hint="Optional. Shown on the booking page and in the confirmation." className="sm:col-span-2">
          <Input id="locationDetail" name="locationDetail" placeholder={detailPlaceholder[location]} />
        </Field>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 py-6">
        <SubmitButton pendingLabel="Creating…">Create calendar</SubmitButton>
        <Link href="/agency/calendars?view=calendars" className="text-sm text-fg-2 hover:underline">
          Cancel
        </Link>
        <FormNotice state={state} />
      </div>
    </form>
  );
}

/* -------------------------- appointment types --------------------------- */

export function TypesSection({ calendar, addType, toggleType }: { calendar: Calendar; addType: Bound; toggleType: (typeId: string, active: boolean) => Promise<void> }) {
  const [state, formAction] = useActionState(addType, null);
  const [adding, setAdding] = useState(false);
  const [location, setLocation] = useState<MeetingLocation>("in_person");
  const [pending, startTransition] = useTransition();
  const e = state?.errors ?? {};
  const open = adding && !state?.ok;

  return (
    <section className="grid gap-4 border-b border-line py-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-sm font-semibold">Appointment types</h2>
        <p className="mt-1 max-w-[36ch] text-xs leading-relaxed text-fg-3">What a lead can book. Turning a type off hides it from the booking page; existing bookings stay.</p>
      </div>
      <div className="flex flex-col">
        <ul className="border-t border-line" aria-busy={pending}>
          {calendar.types.map((t) => (
            <li key={t.id} className="flex items-center gap-4 border-b border-line py-3">
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm font-medium", !t.active && "text-fg-3")}>{t.name}</div>
                <div className="num truncate text-xs text-fg-3">
                  {formatDuration(t.durationMinutes)} · {locationLabel[t.location]}
                  {t.locationDetail && ` · ${t.locationDetail}`}
                </div>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-fg-2">
                <input
                  type="checkbox"
                  checked={t.active}
                  disabled={pending}
                  onChange={(ev) => {
                    const v = ev.target.checked;
                    startTransition(() => toggleType(t.id, v));
                  }}
                  className="size-3.5 accent-[var(--rail)]"
                />
                {t.active ? "On booking page" : "Hidden"}
              </label>
            </li>
          ))}
        </ul>

        {open ? (
          <form action={formAction} className="mt-4 grid gap-4 rounded border border-line bg-surface p-4 sm:grid-cols-2">
            <Field label="Appointment name" htmlFor="type-name" error={e.name}>
              <Input id="type-name" name="name" placeholder="Insurance claim review" autoFocus aria-invalid={!!e.name} />
            </Field>
            <Field label="Length" htmlFor="type-duration" error={e.duration}>
              <Select id="type-duration" name="duration" defaultValue="30">
                {durations.map((d) => (
                  <option key={d} value={d}>
                    {formatDuration(d)}
                  </option>
                ))}
              </Select>
            </Field>
            <LocationPicker value={location} onChange={setLocation} />
            <Field label="Location detail" htmlFor="type-detail" hint="Optional" className="sm:col-span-2">
              <Input id="type-detail" name="locationDetail" placeholder={detailPlaceholder[location]} />
            </Field>
            <Field label="Description" htmlFor="type-description" error={e.description} hint="Optional. One or two sentences on what happens." className="sm:col-span-2">
              <Textarea id="type-description" name="description" className="min-h-[72px]" />
            </Field>
            <div className="flex items-center gap-3 sm:col-span-2">
              <SubmitButton pendingLabel="Adding…">Add type</SubmitButton>
              <button type="button" onClick={() => setAdding(false)} className="text-sm text-fg-2 hover:underline">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-surface-2"
            >
              <Plus className="size-4" strokeWidth={2} />
              Add appointment type
            </button>
            {state?.ok && state.message && <span className="text-xs text-fg-2">{state.message}</span>}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------- settings ------------------------------- */

const times: string[] = [];
for (let m = 5 * 60; m <= 23 * 60; m += 30) times.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const label = (v: string) => formatMinute(Number(v.slice(0, 2)) * 60 + Number(v.slice(3)));

function WeeklyHours({ weekly, error }: { weekly: Calendar["weekly"]; error?: string }) {
  const [open, setOpen] = useState(() => weekly.map((w) => w.length > 0));
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="flex flex-col sm:col-span-2">
      <div className="border-t border-line">
        {order.map((d) => {
          const w = weekly[d]?.[0];
          return (
            <div key={d} className="flex min-h-[48px] flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-2">
              <label className="inline-flex w-20 cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name={`day${d}`}
                  checked={open[d]}
                  onChange={(ev) => setOpen((o) => o.map((x, i) => (i === d ? ev.target.checked : x)))}
                  className="size-3.5 accent-[var(--rail)]"
                />
                {weekdayShort[d]}
              </label>
              {open[d] ? (
                <span className="flex items-center gap-2 text-sm text-fg-2">
                  <Select aria-label={`${weekdayShort[d]} opens`} name={`day${d}Start`} defaultValue={toHHMM(w?.start ?? 9 * 60)} className="h-8 w-[112px]">
                    {times.map((t) => (
                      <option key={t} value={t}>
                        {label(t)}
                      </option>
                    ))}
                  </Select>
                  to
                  <Select aria-label={`${weekdayShort[d]} closes`} name={`day${d}End`} defaultValue={toHHMM(w?.end ?? 17 * 60)} className="h-8 w-[112px]">
                    {times.map((t) => (
                      <option key={t} value={t}>
                        {label(t)}
                      </option>
                    ))}
                  </Select>
                </span>
              ) : (
                <span className="text-sm text-fg-3">Closed</span>
              )}
            </div>
          );
        })}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function DaysOff({ initial, today }: { initial: string[]; today: string }) {
  const [days, setDays] = useState(initial);
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft || days.includes(draft)) return;
    setDays([...days, draft].sort());
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <span className="text-sm font-medium">Days off</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {days.map((d) => (
          <span key={d} className="num inline-flex h-7 items-center gap-1 rounded-[4px] border border-line-strong bg-surface pl-2 pr-1 text-xs">
            <input type="hidden" name="blockedDates" value={d} />
            {formatDay(d, { weekday: "short", month: "short", day: "numeric" })}
            <button type="button" onClick={() => setDays(days.filter((x) => x !== d))} className="grid size-5 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
              <X className="size-3" strokeWidth={2} />
              <span className="sr-only">Remove {d}</span>
            </button>
          </span>
        ))}
        {days.length === 0 && <span className="text-xs text-fg-3">None. Holidays and closures go here.</span>}
      </div>
      <div className="flex items-center gap-2">
        <Input type="date" aria-label="Add a day off" min={today} value={draft} onChange={(ev) => setDraft(ev.target.value)} className="h-8 w-[170px]" />
        <button type="button" onClick={add} disabled={!draft} className="inline-flex h-8 items-center rounded border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50">
          Add day off
        </button>
      </div>
    </div>
  );
}

export function CalendarSettingsForm({ calendar, action, today }: { calendar: Calendar; action: Bound; today: string }) {
  const [state, formAction] = useActionState(action, null);
  const e = state?.errors ?? {};
  return (
    <form action={formAction}>
      <FormSection title="Weekly hours" description={`When leads can book, in the client's time zone (${calendar.timeZone.replace("_", " ")}). One window per day.`}>
        <WeeklyHours weekly={calendar.weekly} error={e.weekly} />
        <DaysOff initial={calendar.blockedDates} today={today} />
      </FormSection>

      <FormSection title="Booking rules" description="Keeps the rep's day workable: time to prepare, travel between visits, and how far out leads can book.">
        <Field label="Minimum notice" htmlFor="minNoticeHours" error={e.minNoticeHours} hint="Hours between booking and the appointment.">
          <Select id="minNoticeHours" name="minNoticeHours" defaultValue={String(calendar.minNoticeHours)}>
            {[0, 1, 2, 4, 12, 24, 48].map((h) => (
              <option key={h} value={h}>
                {h === 0 ? "None" : `${h} hour${h === 1 ? "" : "s"}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Book up to" htmlFor="maxDaysAhead" error={e.maxDaysAhead} hint="Days ahead the calendar is open.">
          <Select id="maxDaysAhead" name="maxDaysAhead" defaultValue={String(calendar.maxDaysAhead)}>
            {[7, 14, 21, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Buffer between appointments" htmlFor="bufferMinutes" error={e.bufferMinutes}>
          <Select id="bufferMinutes" name="bufferMinutes" defaultValue={String(calendar.bufferMinutes)}>
            {[0, 5, 10, 15, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "None" : `${m} min`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start times every" htmlFor="slotStepMinutes" error={e.slotStepMinutes}>
          <Select id="slotStepMinutes" name="slotStepMinutes" defaultValue={String(calendar.slotStepMinutes)}>
            {[15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>

      <FormSection title="Booking page" description="The public page leads use. Share the link in ads, funnels and emails.">
        <Field label="Calendar name" htmlFor="name" error={e.name}>
          <Input id="name" name="name" defaultValue={calendar.name} aria-invalid={!!e.name} />
        </Field>
        <Field label="Taken by" htmlFor="ownerName" error={e.ownerName}>
          <Input id="ownerName" name="ownerName" defaultValue={calendar.ownerName} aria-invalid={!!e.ownerName} />
        </Field>
        <Field label="Intro" htmlFor="description" error={e.description} hint="Optional. Shown above the times." className="sm:col-span-2">
          <Textarea id="description" name="description" defaultValue={calendar.description} className="min-h-[72px]" placeholder="Pick a time that suits you. We confirm by text the day before." />
        </Field>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="bookingEnabled" defaultChecked={calendar.bookingEnabled} className="size-3.5 accent-[var(--rail)]" />
          Taking bookings
          <span className="text-xs text-fg-3">Off hides every time on the page and shows a closed message.</span>
        </label>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 py-6">
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        <FormNotice state={state} />
      </div>
    </form>
  );
}
