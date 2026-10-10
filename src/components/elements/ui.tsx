import {
  AppWindow,
  BellRing,
  CreditCard,
  Gauge,
  Hash,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  ListOrdered,
  PanelTop,
  Pin,
  Rows3,
  SlidersHorizontal,
} from "lucide-react";
import type { DonationElementStatus, DonationElementType } from "@/lib/types";
import { cn } from "@/lib/utils";

/* Small pieces shared by the elements screens. */

export const elementIcon: Record<
  DonationElementType,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  donate_button: Heart,
  button_group: LayoutGrid,
  image_card: ImageIcon,
  sticky_button: Pin,
  goal_meter: Gauge,
  stat_counter: Hash,
  donation_form: CreditCard,
  donation_levels: ListOrdered,
  impact_slider: SlidersHorizontal,
  recent_donations: Rows3,
  message_bar: PanelTop,
  popup: AppWindow,
  social_proof: BellRing,
};

/** The type's icon on a square tinted with the element's own accent: identity, not signal. */
export function ElementMark({
  type,
  accent,
  size = "md",
}: {
  type: DonationElementType;
  accent: string;
  size?: "sm" | "md";
}) {
  const Icon = elementIcon[type];
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-[5px]",
        size === "sm" ? "size-6" : "size-8",
      )}
      style={{
        background: `color-mix(in srgb, ${accent} 13%, white)`,
        color: accent,
      }}
    >
      <Icon
        className={size === "sm" ? "size-3.5" : "size-4"}
        strokeWidth={1.9}
      />
    </span>
  );
}

/** Live is the normal state: neutral with a small green dot. Paused is the dashed outline. */
export function ElementStatusTag({
  status,
}: {
  status: DonationElementStatus;
}) {
  if (status === "paused")
    return (
      <span className="inline-flex h-5 items-center rounded-[4px] border border-dashed border-line-strong px-1.5 text-2xs font-medium whitespace-nowrap text-fg-3">
        Paused
      </span>
    );
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-[4px] bg-surface-2 px-1.5 text-2xs font-medium whitespace-nowrap text-fg-2">
      <span className="size-1.5 rounded-full bg-green" aria-hidden />
      Live
    </span>
  );
}

/**
 * A stand-in for the client's website behind a preview: a soft page with a
 * nav line and a few text bars, so the element is judged in context.
 */
export function SiteBackdrop({
  dark,
  children,
  className,
  bare,
}: {
  dark?: boolean;
  children: React.ReactNode;
  className?: string;
  bare?: boolean;
}) {
  const bar = dark ? "bg-white/10" : "bg-black/[0.06]";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded border",
        dark ? "border-rail-line bg-[#0f1115]" : "border-line bg-[#fbfaf8]",
        className,
      )}
    >
      {!bare && (
        <div
          aria-hidden
          className={cn(
            "flex items-center gap-3 border-b px-4 py-2.5",
            dark ? "border-white/10" : "border-black/[0.06]",
          )}
        >
          <span className={cn("size-4 rounded-full", bar)} />
          <span className={cn("h-2 w-16 rounded-full", bar)} />
          <span className="ml-auto flex gap-2">
            <span className={cn("h-2 w-8 rounded-full", bar)} />
            <span className={cn("h-2 w-8 rounded-full", bar)} />
            <span className={cn("h-2 w-8 rounded-full", bar)} />
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

export function TextBars({
  dark,
  lines = 3,
  className,
}: {
  dark?: boolean;
  lines?: number;
  className?: string;
}) {
  const bar = dark ? "bg-white/10" : "bg-black/[0.06]";
  return (
    <div aria-hidden className={cn("flex flex-col gap-2", className)}>
      <span className={cn("h-3 w-2/5 rounded-full", bar)} />
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 rounded-full",
            bar,
            i === lines - 1 ? "w-3/5" : "w-full",
          )}
        />
      ))}
    </div>
  );
}
