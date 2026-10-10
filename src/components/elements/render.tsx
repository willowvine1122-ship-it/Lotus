"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Heart, X } from "lucide-react";
import type {
  DonationElementConfig,
  DonationElementType,
  GiftFrequency,
} from "@/lib/types";
import { displayName, onAccent } from "@/lib/elements";
import {
  cn,
  formatCount,
  formatDollars,
  formatDollarsCompact,
  timeAgo,
} from "@/lib/utils";
import type { ElementLive, LiveGift } from "./data";

/*
 * How each element looks on a client's website. These sit on someone
 * else's page, so they carry the client's accent colour and a light or dark
 * card, never the Lotus ink frame. The same components draw the builder
 * preview, the board panel, the iframe the install script loads, and the
 * blocks on Lotus funnels and websites.
 */

export interface DonateIntent {
  amountCents?: number;
  frequency?: GiftFrequency;
}

export interface ElementViewProps {
  type: DonationElementType;
  c: DonationElementConfig;
  live: ElementLive;
  now: Date;
  onDonate: (intent: DonateIntent) => void;
  /** Overlays only: closes the bar or popup. */
  onClose?: () => void;
  /** The checkout, for the donation form; the host decides how it is wired. */
  form?: React.ReactNode;
}

const shapeRadius = { square: "2px", rounded: "8px", pill: "999px" } as const;
const cardRadius = { square: "2px", rounded: "10px", pill: "16px" } as const;

function freqOf(c: DonationElementConfig, live: ElementLive): GiftFrequency {
  return c.frequency === "campaign"
    ? live.campaign.defaultFrequency
    : c.frequency;
}

function useCountUp(target: number, run = true) {
  const [v, setV] = useState(run ? 0 : target);
  useEffect(() => {
    if (
      !run ||
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const t = setTimeout(() => setV(target), 0);
      return () => clearTimeout(t);
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setV(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return v;
}

/** The card every boxed element sits in. */
function Card({
  c,
  className,
  children,
  style,
}: {
  c: DonationElementConfig;
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const dark = c.theme === "dark";
  return (
    <div
      className={cn(
        "border",
        dark
          ? "border-white/10 bg-[#16181d] text-white"
          : "border-black/[0.08] bg-white text-[#16181d]",
        className,
      )}
      style={{ borderRadius: cardRadius[c.shape], ...style }}
    >
      {children}
    </div>
  );
}

const muted = (c: DonationElementConfig) =>
  c.theme === "dark" ? "text-white/65" : "text-[#5b616b]";
const hair = (c: DonationElementConfig) =>
  c.theme === "dark" ? "border-white/10" : "border-black/[0.08]";

export function AccentButton({
  c,
  children,
  onClick,
  size,
  full,
  className,
  pulse,
}: {
  c: DonationElementConfig;
  children: React.ReactNode;
  onClick: () => void;
  size?: DonationElementConfig["size"];
  full?: boolean;
  className?: string;
  pulse?: boolean;
}) {
  const s = size ?? c.size;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "el-btn relative inline-flex items-center justify-center gap-2 font-semibold tracking-tight transition-[filter,transform] duration-150 hover:brightness-[1.06] active:translate-y-px",
        s === "sm"
          ? "h-9 px-4 text-sm"
          : s === "lg"
            ? "h-[52px] px-7 text-lg"
            : "h-11 px-5 text-base",
        full && "w-full",
        pulse && "el-pulse",
        className,
      )}
      style={{
        background: c.accent,
        color: onAccent(c.accent),
        borderRadius: shapeRadius[c.shape],
        ["--el-accent" as string]: c.accent,
      }}
    >
      {c.icon && (
        <Heart
          className={cn(
            "shrink-0 fill-current",
            s === "lg" ? "size-5" : "size-4",
          )}
          strokeWidth={0}
        />
      )}
      {children}
    </button>
  );
}

/* ------------------------------ buttons ----------------------------- */

function DonateButton({ c, live, onDonate }: ElementViewProps) {
  return (
    <div
      className={cn(
        "flex",
        c.align === "center" && "justify-center",
        c.align === "right" && "justify-end",
      )}
    >
      <AccentButton
        c={c}
        pulse={c.pulse}
        full={c.fullWidth}
        onClick={() =>
          onDonate({
            amountCents: c.amountCents || undefined,
            frequency: freqOf(c, live),
          })
        }
      >
        {c.label || "Donate"}
      </AccentButton>
    </div>
  );
}

function StickyButton({ c, live, onDonate }: ElementViewProps) {
  return (
    <AccentButton
      c={c}
      pulse={c.pulse}
      className="shadow-[0_8px_24px_-6px_rgb(16_24_40/0.35)]"
      onClick={() =>
        onDonate({
          amountCents: c.amountCents || undefined,
          frequency: freqOf(c, live),
        })
      }
    >
      {c.label || "Donate"}
    </AccentButton>
  );
}

function ButtonGroup({ c, live, onDonate }: ElementViewProps) {
  const f = freqOf(c, live);
  return (
    <Card c={c} className="p-4 @container">
      {c.headline && (
        <p className="mb-3 text-base font-semibold tracking-tight">
          {c.headline}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 @[340px]:grid-cols-3">
        {c.levels.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() =>
              onDonate({ amountCents: l.amountCents, frequency: f })
            }
            className={cn(
              "num h-12 border text-base font-semibold transition-colors duration-150 hover:border-[var(--el-accent)] hover:text-[var(--el-accent)]",
              hair(c),
            )}
            style={{
              borderRadius:
                shapeRadius[c.shape === "pill" ? "rounded" : c.shape],
              ["--el-accent" as string]: c.accent,
            }}
          >
            {formatDollars(l.amountCents)}
            {f === "monthly" && (
              <span className={cn("text-sm font-normal", muted(c))}>/mo</span>
            )}
          </button>
        ))}
      </div>
      {c.allowChange && (
        <button
          type="button"
          onClick={() => onDonate({ frequency: f })}
          className={cn(
            "mt-3 w-full text-center text-sm underline decoration-current/30 underline-offset-4 hover:decoration-current",
            muted(c),
          )}
        >
          Other amount
        </button>
      )}
    </Card>
  );
}

function ImageCard({ c, live, onDonate }: ElementViewProps) {
  const [more, setMore] = useState(false);
  const f = freqOf(c, live);
  return (
    <Card c={c} className="w-full max-w-[380px] overflow-hidden">
      {c.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={c.imageUrl}
          alt=""
          className="aspect-[16/10] w-full object-cover"
        />
      )}
      <div className="p-4">
        <button
          type="button"
          onClick={() => setMore(!more)}
          aria-expanded={more}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <span className="text-lg font-semibold leading-snug tracking-tight">
            {c.headline || live.campaign.title}
          </span>
          <ChevronDown
            className={cn(
              "mt-1 size-4 shrink-0 transition-transform duration-200",
              muted(c),
              more && "rotate-180",
            )}
            strokeWidth={2}
          />
        </button>
        <p
          className={cn(
            "mt-1.5 text-sm leading-relaxed",
            muted(c),
            !more && "line-clamp-2",
          )}
        >
          {c.body}
        </p>
        <AccentButton
          c={c}
          full
          size={c.size === "lg" ? "lg" : "md"}
          className="mt-4"
          onClick={() =>
            onDonate({ amountCents: c.amountCents || undefined, frequency: f })
          }
        >
          {c.amountCents
            ? `${c.label || "Donate"} ${formatDollars(c.amountCents)}${f === "monthly" ? "/mo" : ""}`
            : c.label || "Donate"}
        </AccentButton>
      </div>
    </Card>
  );
}

/* ------------------------------- data ------------------------------- */

function daysLeft(deadline: string | undefined, now: Date) {
  if (!deadline) return null;
  const d = Math.ceil(
    (Date.parse(`${deadline}T23:59:59`) - now.getTime()) / 86_400_000,
  );
  return d >= 0 ? d : null;
}

function GoalMeter({ c, live, now }: ElementViewProps) {
  const raised = (live.raisedCents + c.offlineCents) * Math.max(1, c.match);
  const goal = Math.max(1, live.goalCents);
  const counting = c.metric === "donors";
  const value = useCountUp(counting ? live.donors : raised);
  const target = counting ? Math.max(1, Math.round(goal / 10000)) : goal;
  const pct = (counting ? live.donors : raised) / target;
  const left = c.showDeadline ? daysLeft(c.deadline, now) : null;
  return (
    <Card c={c} className="p-4">
      {c.headline && (
        <p className="text-sm font-semibold tracking-tight">{c.headline}</p>
      )}
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <p className="num text-2xl font-semibold tracking-tight">
          {counting ? formatCount(value) : formatDollars(value)}
        </p>
        <p className={cn("num text-sm", muted(c))}>
          of{" "}
          {counting
            ? `${formatCount(target)} donors`
            : `${formatDollarsCompact(goal)} goal`}
        </p>
      </div>
      <div
        className={cn(
          "mt-2.5 h-2.5 overflow-hidden",
          c.theme === "dark" ? "bg-white/10" : "bg-black/[0.06]",
        )}
        style={{ borderRadius: shapeRadius[c.shape] }}
        role="progressbar"
        aria-label="Progress toward goal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(1, pct) * 100)}
      >
        <div
          className="h-full transition-[width] duration-700 ease-out"
          style={{
            width: `${Math.min(100, pct * 100)}%`,
            background: c.accent,
            borderRadius: shapeRadius[c.shape],
          }}
        />
      </div>
      <p className={cn("num mt-2 flex flex-wrap gap-x-2 text-xs", muted(c))}>
        <span
          className="font-medium"
          style={{ color: c.theme === "dark" ? "#fff" : "#16181d" }}
        >
          {Math.round(pct * 100)}%
        </span>
        {c.showDonors && !counting && (
          <span>· {formatCount(live.donors)} donors</span>
        )}
        {left !== null && (
          <span>· {left === 0 ? "Last day" : `${left} days left`}</span>
        )}
        {c.match > 1 && <span>· Gifts matched {c.match}x</span>}
      </p>
    </Card>
  );
}

function statValue(c: DonationElementConfig, live: ElementLive) {
  switch (c.metric) {
    case "raised":
      return { n: live.raisedCents + c.offlineCents, money: true };
    case "donors":
      return { n: live.donors, money: false };
    case "gifts":
      return { n: live.gifts, money: false };
    case "monthly_donors":
      return { n: live.monthlyDonors, money: false };
    case "monthly_value":
      return { n: live.monthlyCents, money: true };
  }
}

function StatCounter({ c, live }: ElementViewProps) {
  const { n, money } = statValue(c, live);
  const v = useCountUp(n);
  return (
    <div
      className={cn(
        "flex flex-col",
        c.align === "center" && "items-center text-center",
        c.align === "right" && "items-end text-right",
      )}
    >
      <p
        className={cn(
          "num font-semibold tracking-tight",
          c.size === "lg"
            ? "text-[44px] leading-[1.05]"
            : c.size === "sm"
              ? "text-2xl"
              : "text-[34px] leading-tight",
        )}
        style={{ color: c.accent }}
      >
        {money ? formatDollars(v) : formatCount(v)}
      </p>
      {c.headline && (
        <p className={cn("mt-1 text-sm", muted(c))}>{c.headline}</p>
      )}
    </div>
  );
}

/* ------------------------------- forms ------------------------------ */

function DonationLevels({ c, live, onDonate }: ElementViewProps) {
  const f = freqOf(c, live);
  return (
    <div className="@container">
      {c.headline && (
        <p className="mb-3 text-base font-semibold tracking-tight">
          {c.headline}
        </p>
      )}
      <div className="grid gap-2.5 @[560px]:grid-cols-3">
        {c.levels.map((l, i) => (
          <Card
            key={l.id}
            c={c}
            className={cn("flex flex-col p-4", i === 1 && "ring-2")}
            style={
              i === 1 ? { ["--tw-ring-color" as string]: c.accent } : undefined
            }
          >
            <div className="flex items-baseline justify-between gap-3 @[560px]:flex-col @[560px]:items-start @[560px]:gap-0.5">
              <p
                className="text-xs font-semibold uppercase tracking-[0.08em]"
                style={{ color: c.accent }}
              >
                {l.label}
              </p>
              <p className="num text-2xl font-semibold tracking-tight">
                {formatDollars(l.amountCents)}
                {f === "monthly" && (
                  <span className={cn("text-sm font-normal", muted(c))}>
                    /mo
                  </span>
                )}
              </p>
            </div>
            <p
              className={cn("mt-1.5 flex-1 text-sm leading-relaxed", muted(c))}
            >
              {l.description}
            </p>
            <AccentButton
              c={c}
              size="sm"
              full
              className="mt-3"
              onClick={() =>
                onDonate({ amountCents: l.amountCents, frequency: f })
              }
            >
              Give {formatDollars(l.amountCents)}
            </AccentButton>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ImpactSlider({ c, live, onDonate }: ElementViewProps) {
  const f = freqOf(c, live);
  const [i, setI] = useState(Math.min(1, c.levels.length - 1));
  const l = c.levels[Math.max(0, Math.min(i, c.levels.length - 1))];
  if (!l) return null;
  const pct = c.levels.length > 1 ? (i / (c.levels.length - 1)) * 100 : 0;
  return (
    <Card c={c} className="p-4">
      {c.headline && (
        <p className="text-sm font-semibold tracking-tight">{c.headline}</p>
      )}
      <p className="num mt-2 text-[34px] font-semibold leading-tight tracking-tight">
        {formatDollars(l.amountCents)}
        {f === "monthly" && (
          <span className={cn("text-base font-normal", muted(c))}>/mo</span>
        )}
      </p>
      <p
        className={cn("mt-1 min-h-[40px] text-sm leading-relaxed", muted(c))}
        aria-live="polite"
      >
        {l.description || "Every gift goes straight to work."}
      </p>
      <input
        type="range"
        min={0}
        max={Math.max(0, c.levels.length - 1)}
        step={1}
        value={i}
        onChange={(e) => setI(Number(e.target.value))}
        aria-label="Gift amount"
        aria-valuetext={formatDollars(l.amountCents)}
        className="el-range mt-3 w-full"
        style={{
          ["--el-accent" as string]: c.accent,
          ["--el-fill" as string]: `${pct}%`,
        }}
      />
      <div className={cn("num mt-1 flex justify-between text-xs", muted(c))}>
        {c.levels.map((x) => (
          <span key={x.id}>{formatDollars(x.amountCents)}</span>
        ))}
      </div>
      <AccentButton
        c={c}
        full
        className="mt-4"
        onClick={() => onDonate({ amountCents: l.amountCents, frequency: f })}
      >
        Give {formatDollars(l.amountCents)}
        {f === "monthly" ? " monthly" : ""}
      </AccentButton>
    </Card>
  );
}

/* ------------------------------- lists ------------------------------ */

function Initials({
  g,
  c,
  size = "md",
}: {
  g: LiveGift;
  c: DonationElementConfig;
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        size === "sm" ? "size-8 text-xs" : "size-9 text-sm",
      )}
      style={{
        background: `color-mix(in srgb, ${c.accent} 14%, transparent)`,
        color: c.accent,
      }}
    >
      {c.nameStyle === "hidden" ? (
        <Heart className="size-3.5 fill-current" strokeWidth={0} />
      ) : (
        `${g.first.slice(0, 1)}${g.last.slice(0, 1)}`
      )}
    </span>
  );
}

function RecentDonations({ c, live, now, onDonate }: ElementViewProps) {
  const rows = live.recent.slice(0, c.count);
  return (
    <Card c={c} className="p-4">
      {c.headline && (
        <p className="text-sm font-semibold tracking-tight">{c.headline}</p>
      )}
      {rows.length === 0 ? (
        <p className={cn("py-4 text-sm", muted(c))}>
          The first gifts will show here.
        </p>
      ) : (
        <ul
          className={cn(
            "mt-2 divide-y",
            c.theme === "dark" ? "divide-white/10" : "divide-black/[0.06]",
          )}
        >
          {rows.map((g) => (
            <li key={g.id} className="flex items-center gap-3 py-2.5">
              <Initials g={g} c={c} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {displayName(g.first, g.last, c.nameStyle)}
                </span>
                <span className={cn("block truncate text-xs", muted(c))}>
                  {c.showLocation && g.place ? `${g.place} · ` : ""}
                  {timeAgo(g.at, now)}
                </span>
              </span>
              <span className="num shrink-0 text-sm font-semibold">
                {formatDollars(g.amountCents)}
                {g.monthly && (
                  <span className={cn("font-normal", muted(c))}>/mo</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {c.label && (
        <AccentButton
          c={c}
          size="sm"
          full
          className="mt-3"
          onClick={() => onDonate({ frequency: freqOf(c, live) })}
        >
          {c.label}
        </AccentButton>
      )}
    </Card>
  );
}

/* ------------------------------ overlays ---------------------------- */

function MessageBar({ c, live, onDonate, onClose }: ElementViewProps) {
  const dark = c.theme === "dark";
  const bg = dark ? "#16181d" : c.accent;
  const fg = dark ? "#ffffff" : onAccent(c.accent);
  return (
    <div
      className="relative flex w-full items-center justify-center gap-x-4 gap-y-2 px-10 py-2.5 text-center max-sm:flex-col max-sm:px-4 max-sm:pr-10"
      style={{ background: bg, color: fg }}
    >
      <p className="text-sm font-medium leading-snug">{c.headline}</p>
      <button
        type="button"
        onClick={() =>
          onDonate({
            amountCents: c.amountCents || undefined,
            frequency: freqOf(c, live),
          })
        }
        className="inline-flex h-8 shrink-0 items-center gap-1.5 px-3.5 text-sm font-semibold transition-[filter] hover:brightness-95"
        style={{
          background: dark ? c.accent : fg,
          color: dark ? onAccent(c.accent) : bg,
          borderRadius: shapeRadius[c.shape],
        }}
      >
        {c.icon && <Heart className="size-3.5 fill-current" strokeWidth={0} />}
        {c.label || "Donate"}
      </button>
      {onClose && (
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded opacity-80 hover:opacity-100"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

function Popup({ c, live, onDonate, onClose }: ElementViewProps) {
  return (
    <Card
      c={c}
      className="relative w-[440px] max-w-full overflow-hidden shadow-[0_24px_60px_-12px_rgb(16_24_40/0.45)]"
    >
      {c.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={c.imageUrl}
          alt=""
          className="aspect-[16/9] w-full object-cover"
        />
      )}
      {onClose && (
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      )}
      <div className="p-5">
        <p className="text-xl font-semibold leading-snug tracking-tight text-balance">
          {c.headline || live.campaign.title}
        </p>
        {c.body && (
          <p className={cn("mt-2 text-sm leading-relaxed", muted(c))}>
            {c.body}
          </p>
        )}
        <AccentButton
          c={c}
          full
          className="mt-5"
          onClick={() =>
            onDonate({
              amountCents: c.amountCents || undefined,
              frequency: freqOf(c, live),
            })
          }
        >
          {c.label || "Donate"}
        </AccentButton>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn("mt-2.5 w-full text-center text-sm", muted(c))}
          >
            Not now
          </button>
        )}
      </div>
    </Card>
  );
}

function SocialProof({ c, live, now, onDonate, onClose }: ElementViewProps) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(true);
  const rows = live.recent;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (rows.length < 2) return;
    const cycle = () => {
      setShown(false);
      timer.current = setTimeout(() => {
        setI((x) => (x + 1) % rows.length);
        setShown(true);
      }, 450);
    };
    const t = setInterval(cycle, 6500);
    return () => {
      clearInterval(t);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [rows.length]);
  const g = rows[i % Math.max(1, rows.length)];
  if (!g) return null;
  return (
    <Card
      c={c}
      className={cn(
        "relative flex w-[340px] max-w-full items-center gap-3 p-3 pr-9 shadow-[0_12px_32px_-8px_rgb(16_24_40/0.3)] transition-[opacity,transform] duration-300",
        shown ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
      )}
    >
      <Initials g={g} c={c} />
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="truncate text-sm">
          <span className="font-semibold">
            {displayName(g.first, g.last, c.nameStyle)}
          </span>{" "}
          gave{" "}
          <span className="num font-semibold">
            {formatDollars(g.amountCents)}
            {g.monthly ? "/mo" : ""}
          </span>
        </p>
        <p className={cn("truncate text-xs", muted(c))}>
          {c.showLocation && g.place ? `${g.place} · ` : ""}
          {timeAgo(g.at, now)} ·{" "}
          <button
            type="button"
            onClick={() => onDonate({ frequency: freqOf(c, live) })}
            className="font-semibold underline-offset-2 hover:underline"
            style={{ color: c.accent }}
          >
            {c.label || "Donate"}
          </button>
        </p>
      </div>
      {onClose && (
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={cn(
            "absolute right-1.5 top-1.5 grid size-6 place-items-center rounded",
            muted(c),
          )}
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>
      )}
    </Card>
  );
}

function DonationForm({ form, live, c }: ElementViewProps) {
  return (
    <div
      className="w-full max-w-[420px]"
      style={{
        ["--brand" as string]: c.accent,
        ["--brand-hover" as string]: `color-mix(in srgb, ${c.accent} 88%, black)`,
      }}
    >
      {form ?? (
        <div className="rounded border border-line bg-surface p-5 text-sm text-fg-2">
          The {live.campaign.title} checkout appears here.
        </div>
      )}
    </div>
  );
}

const views: Record<
  DonationElementType,
  (p: ElementViewProps) => React.ReactNode
> = {
  donate_button: DonateButton,
  button_group: ButtonGroup,
  image_card: ImageCard,
  sticky_button: StickyButton,
  goal_meter: GoalMeter,
  stat_counter: StatCounter,
  donation_form: DonationForm,
  donation_levels: DonationLevels,
  impact_slider: ImpactSlider,
  recent_donations: RecentDonations,
  message_bar: MessageBar,
  popup: Popup,
  social_proof: SocialProof,
};

export function ElementView(props: ElementViewProps) {
  const View = views[props.type];
  return <View {...props} />;
}
