import type { Appointment } from "@/lib/types";
import { needsOutcome, statusLabel } from "@/lib/calendars";
import { cn } from "@/lib/utils";

/*
 * Booking status in the three signals. Red: no-show. Amber: the lead has
 * not confirmed, or the time has passed and nobody marked the outcome.
 * Green: showed. Confirmed and cancelled are neutral; nothing to do.
 */

type Tone = "red" | "amber" | "green" | "neutral" | "muted";

const toneClass: Record<Tone, string> = {
  red: "bg-red-soft text-red",
  amber: "bg-amber-soft text-amber",
  green: "bg-green-soft text-green",
  neutral: "bg-surface-2 text-fg-2",
  muted: "bg-transparent text-fg-3 ring-1 ring-inset ring-line",
};

export function bookingState(a: Appointment, now: Date): { label: string; tone: Tone } {
  if (needsOutcome(a, now)) return { label: "Needs outcome", tone: "amber" };
  switch (a.status) {
    case "booked":
      return { label: statusLabel.booked, tone: "amber" };
    case "confirmed":
      return { label: statusLabel.confirmed, tone: "neutral" };
    case "showed":
      return { label: statusLabel.showed, tone: "green" };
    case "no_show":
      return { label: statusLabel.no_show, tone: "red" };
    case "cancelled":
      return { label: statusLabel.cancelled, tone: "muted" };
  }
}

export function BookingStatus({ appointment, now }: { appointment: Appointment; now: Date }) {
  const { label, tone } = bookingState(appointment, now);
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-[4px] px-2 text-xs font-medium", toneClass[tone])}>
      <span aria-hidden className="size-1.5 rounded-[1px] bg-current" />
      {label}
    </span>
  );
}
