import Link from "next/link";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * The first-run checklist on the agency home. Each step is done when the
 * thing actually exists (a client, a teammate, a client login, contacts),
 * so it can't be ticked by hand; the owner can hide it once they're set.
 */

export interface SetupStep {
  key: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  done: boolean;
}

export function SetupChecklist({ steps, dismiss, compact }: { steps: SetupStep[]; dismiss?: () => Promise<void>; compact?: boolean }) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return (
    <section aria-labelledby="setup-title" className={cn("border-b border-line bg-surface", compact ? "px-5 py-3 md:px-6" : "px-5 py-6 md:px-6")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="setup-title" className="text-sm font-semibold">
            Set up your agency
            <span className="num ml-2 font-normal text-fg-3">
              {done} of {steps.length} done
            </span>
          </h2>
          {!compact && <p className="mt-0.5 text-xs text-fg-3">Everything you add is saved to your account. Nothing here is sample data.</p>}
        </div>
        {dismiss && (
          <form action={dismiss}>
            <button type="submit" className="inline-flex items-center gap-1 text-xs text-fg-3 hover:text-fg" aria-label="Hide the setup checklist">
              <X className="size-3.5" strokeWidth={2} />
              Hide
            </button>
          </form>
        )}
      </div>
      <div aria-hidden className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brand" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className={cn("mt-3 grid gap-x-6", compact ? "gap-y-1 sm:grid-cols-2 xl:grid-cols-3" : "gap-y-0 md:grid-cols-2")}>
        {steps.map((s) => (
          <li key={s.key} className={cn("flex items-start gap-3 border-line", compact ? "py-1.5" : "border-b py-3")}>
            <span
              aria-hidden
              className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", s.done ? "border-green bg-green text-white" : s === next ? "border-brand" : "border-line-strong")}
            >
              {s.done && <Check className="size-2.5" strokeWidth={3} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className={cn("text-sm", s.done ? "text-fg-3 line-through decoration-line-strong" : "font-medium")}>
                <span className="sr-only">{s.done ? "Done: " : "To do: "}</span>
                {s.title}
              </div>
              {!compact && !s.done && <p className="mt-0.5 text-xs leading-relaxed text-fg-3">{s.body}</p>}
            </div>
            {!s.done && (
              <Link href={s.href} className={cn("shrink-0 text-xs font-medium hover:underline", s === next ? "text-brand" : "text-fg-2")}>
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
