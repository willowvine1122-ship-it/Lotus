"use client";

import { ImageIcon } from "lucide-react";
import type { CampaignStatus, EmailBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { mergeTags, renderMerge, statusLabel } from "./model";

/* Small pieces shared by the email screens. */

export function StatusTag({ status }: { status: CampaignStatus }) {
  const cls = {
    draft: "border border-dashed border-line-strong text-fg-3",
    scheduled: "bg-brand-soft text-brand",
    sent: "bg-surface-2 text-fg-2",
  }[status];
  return <span className={cn("inline-flex h-5 items-center rounded-[4px] px-1.5 text-2xs font-medium whitespace-nowrap", cls)}>{statusLabel[status]}</span>;
}

export function Kpi({ label, value, aside, asideTone }: { label: string; value: string; aside?: React.ReactNode; asideTone?: "red" | "amber" }) {
  return (
    <div className="min-w-0 rounded border border-line bg-surface px-4 py-3">
      <div className="truncate text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{label}</div>
      <div className="mt-0.5 flex flex-col gap-x-3 sm:flex-row sm:items-baseline sm:justify-between">
        <span className="num text-xl font-semibold leading-7">{value}</span>
        {aside && <span className={cn("num min-w-0 truncate text-xs", asideTone === "red" ? "font-medium text-red" : asideTone === "amber" ? "font-medium text-amber" : "text-fg-3")}>{aside}</span>}
      </div>
    </div>
  );
}

export function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded border border-line bg-surface-2/50 px-3.5 py-3">
      <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold">{value}</div>
      {sub && <div className="num text-xs text-fg-2">{sub}</div>}
    </div>
  );
}

export function LedgerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
      <span className="shrink-0 text-xs text-fg-3">{label}</span>
      <span className="min-w-0 truncate text-right text-fg">{children}</span>
    </div>
  );
}

/** Axis ticks for counts: whole numbers stay whole, halves keep one decimal. */
export function tick(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function rate(v: number | null, digits = 1) {
  return v === null ? "–" : `${(v * 100).toFixed(digits).replace(/\.0$/, "")}%`;
}

/** A subject or line with its merge tags drawn as small tokens, as the team reads it. */
export function MergeText({ text, empty = "No subject yet" }: { text: string; empty?: string }) {
  if (!text) return <span className="text-fg-3">{empty}</span>;
  const parts = text.split(/(\{\{\s*\w+\s*\}\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\{\{\s*(\w+)\s*\}\}$/.exec(p);
        if (!m) return p;
        const label = mergeTags.find((t) => t.tag === `{{${m[1]}}}`)?.label ?? m[1];
        return (
          <span key={i} className="mx-px rounded-[3px] bg-surface-2 px-1 py-px text-[0.92em] text-fg-2 ring-1 ring-line ring-inset">
            {label}
          </span>
        );
      })}
    </>
  );
}

/** "Oct 6, 9:00 AM" in the viewer's clock. */
export function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "Tomorrow, 9:30 AM", "Fri, 9:30 AM", or a date. */
export function relativeWhen(iso: string, now: Date) {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86400000);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Tomorrow, ${time}`;
  if (diff === -1) return `Yesterday, ${time}`;
  if (diff > 1 && diff < 7) return `${d.toLocaleDateString("en-US", { weekday: "short" })}, ${time}`;
  return when(iso);
}

/* ------------------------------ preview ----------------------------- */

export interface PreviewProps {
  fromName: string;
  fromEmail: string;
  subject: string;
  previewText: string;
  blocks: EmailBlock[];
  clientName: string;
  location: string;
  firstName?: string;
  lastName?: string;
  /** Narrow phone-width frame. */
  mobile?: boolean;
  /** Drop the inbox header, for tight spaces. */
  bare?: boolean;
  className?: string;
}

/**
 * The email as a recipient sees it: the inbox line (from, subject, preview
 * text), then the message on its own white page. The message carries the
 * client's identity, not Lotus's, so buttons are near-black ink.
 */
export function EmailPreview({ fromName, fromEmail, subject, previewText, blocks, clientName, location, firstName, lastName, mobile, bare, className }: PreviewProps) {
  const vars = { first_name: firstName, last_name: lastName, client_name: clientName };
  const m = (t: string) => renderMerge(t, vars);
  return (
    <div className={cn("overflow-hidden rounded border border-line bg-surface-2/60", className)}>
      {!bare && (
        <div className="flex items-start gap-3 border-b border-line bg-surface px-4 py-3">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-rail text-xs font-semibold text-rail-fg">
            {(fromName || "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-sm font-semibold">{fromName || "From name"}</span>
              <span className="hidden truncate text-xs text-fg-3 sm:inline">{fromEmail}</span>
            </div>
            <div className={cn("truncate text-sm", subject ? "text-fg" : "text-fg-3")}>{subject ? m(subject) : "No subject yet"}</div>
            {previewText && <div className="truncate text-xs text-fg-3">{m(previewText)}</div>}
          </div>
        </div>
      )}
      <div className={cn("px-3 py-5 sm:px-6", mobile && "sm:px-3")}>
        <article className={cn("mx-auto w-full rounded-[4px] bg-surface text-base leading-relaxed text-fg-2", mobile ? "max-w-[360px] px-5 py-6" : "max-w-[560px] px-6 py-8 sm:px-9")}>
          <div className="mb-6 text-sm font-semibold tracking-tight text-fg">{clientName}</div>
          <div className="flex flex-col gap-4">
            {blocks.length === 0 && <p className="text-sm text-fg-3">Add a block to start the email.</p>}
            {blocks.map((b) => {
              switch (b.type) {
                case "heading":
                  return (
                    <h2 key={b.id} className="text-xl font-semibold leading-tight tracking-tight text-fg [text-wrap:balance]">
                      {m(b.text) || <span className="text-fg-3">Heading</span>}
                    </h2>
                  );
                case "text":
                  return (
                    <p key={b.id} className="whitespace-pre-line">
                      {m(b.text) || <span className="text-fg-3">Text</span>}
                    </p>
                  );
                case "button":
                  return (
                    <div key={b.id}>
                      <span className="inline-flex h-10 items-center rounded-[4px] bg-fg px-5 text-sm font-semibold text-surface">{m(b.text) || "Button"}</span>
                    </div>
                  );
                case "image":
                  return (
                    <figure key={b.id} className="flex flex-col gap-1.5">
                      <div className="grid aspect-[16/7] place-items-center rounded-[4px] bg-surface-2 text-fg-3">
                        <span className="flex flex-col items-center gap-1 px-4 text-center text-xs">
                          <ImageIcon className="size-5" strokeWidth={1.5} />
                          {b.alt || "Image"}
                        </span>
                      </div>
                      {b.caption && <figcaption className="text-xs text-fg-3">{m(b.caption)}</figcaption>}
                    </figure>
                  );
                case "divider":
                  return <hr key={b.id} className="border-line" />;
              }
            })}
          </div>
          <footer className="mt-8 border-t border-line pt-4 text-[11px] leading-relaxed text-fg-3">
            You&apos;re getting this because you&apos;re in touch with {clientName}. {location}.
            <br />
            <span className="underline underline-offset-2">Unsubscribe</span> · <span className="underline underline-offset-2">View in browser</span>
          </footer>
        </article>
      </div>
    </div>
  );
}
