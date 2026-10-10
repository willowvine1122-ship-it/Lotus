"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import type { IntegrationLog } from "@/lib/types";
import { cn } from "@/lib/utils";
import { findApp } from "./catalog";

/* Small pieces shared by the integrations screens. */

/** The app's own colour on a 6px square with its initials: identity, not signal. */
export function AppMark({ appId, size = "md" }: { appId: string; size?: "sm" | "md" | "lg" }) {
  const app = findApp(appId);
  const dim = { sm: "size-5 text-[9px]", md: "size-7 text-[11px]", lg: "size-9 text-[13px]" }[size];
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-[5px] font-semibold tracking-tight text-white", dim)} style={{ backgroundColor: app?.color ?? "var(--rail)" }}>
      {app?.mark ?? "?"}
    </span>
  );
}

/** A value with a copy button; `secret` masks it until revealed. */
export function CopyField({ value, label, secret, mono = true }: { value: string; label: string; secret?: boolean; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!secret);
  return (
    <div className="flex h-9 min-w-0 items-center gap-1 rounded border border-line bg-surface-2/50 pl-3 pr-1 text-sm">
      <span className={cn("min-w-0 flex-1 truncate text-fg-2", mono && "num")} aria-label={label}>
        {shown ? value : `${value.slice(0, 8)}${"•".repeat(18)}`}
      </span>
      {secret && (
        <button type="button" aria-label={shown ? `Hide ${label}` : `Show ${label}`} onClick={() => setShown(!shown)} className="grid size-7 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface hover:text-fg">
          {shown ? <EyeOff className="size-3.5" strokeWidth={1.75} /> : <Eye className="size-3.5" strokeWidth={1.75} />}
        </button>
      )}
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="grid size-7 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface hover:text-fg"
      >
        {copied ? <Check className="size-3.5" strokeWidth={2.25} /> : <Copy className="size-3.5" strokeWidth={1.75} />}
      </button>
    </div>
  );
}

/** A code sample on paper, horizontally scrollable, with a copy button. */
export function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded border border-line bg-surface-2/60">
      <pre className="num overflow-x-auto px-3 py-2.5 pr-10 text-[12px] leading-[1.6] text-fg-2">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={() => {
          navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="absolute right-1 top-1 grid size-7 place-items-center rounded text-fg-3 hover:bg-surface hover:text-fg"
      >
        {copied ? <Check className="size-3.5" strokeWidth={2.25} /> : <Copy className="size-3.5" strokeWidth={1.75} />}
      </button>
    </div>
  );
}

/** OK is the normal state and stays quiet; a failure is the one red. */
export function LogStatus({ log }: { log: Pick<IntegrationLog, "status" | "code"> }) {
  if (log.status === "failed") return <span className="inline-flex h-5 items-center rounded-[4px] bg-red-soft px-1.5 text-2xs font-medium whitespace-nowrap text-red">{log.code ? `Failed · ${log.code}` : "Failed"}</span>;
  return <span className="num inline-flex h-5 items-center rounded-[4px] bg-surface-2 px-1.5 text-2xs font-medium whitespace-nowrap text-fg-2">{log.code ?? "OK"}</span>;
}

/** Inline result line under a button: what just happened, in the signal it deserves. */
export function Notice({ result }: { result: { ok: boolean; message?: string } | null }) {
  if (!result?.message) return null;
  return (
    <p role="status" className={cn("rounded border px-3 py-2 text-xs leading-relaxed", result.ok ? "border-line bg-surface-2/60 text-fg-2" : "border-red/25 bg-red-soft/60 text-red")}>
      {result.message}
    </p>
  );
}

export const smallButton = "inline-flex h-7 items-center gap-1.5 rounded border border-line-strong bg-surface px-2.5 text-xs font-medium text-fg transition-colors duration-150 hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50";
export const inkButton = "inline-flex h-7 items-center gap-1.5 rounded border border-rail bg-rail px-2.5 text-xs font-medium text-rail-fg transition-colors duration-150 hover:bg-rail-2 disabled:pointer-events-none disabled:opacity-60";
export const dangerButton = "inline-flex h-7 items-center gap-1.5 rounded border border-line-strong bg-surface px-2.5 text-xs font-medium text-fg transition-colors duration-150 hover:border-red/40 hover:text-red disabled:pointer-events-none disabled:opacity-50";
