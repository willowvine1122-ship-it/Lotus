"use client";

import { useActionState, useState } from "react";
import { Check, CreditCard, Loader2, Lock } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/agency/contacts/actions";
import { optionTotal } from "@/lib/field";
import type { Estimate } from "@/lib/types";
import { cn, formatDollarsExact } from "@/lib/utils";
import { LineItems } from "./line-items";

/*
 * What the customer sees on their link: pick an option and approve it, or
 * pay the balance. One violet action per screen, as in the agency app.
 */

export function CustomerShell({ business, children }: { business: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between gap-4 bg-rail px-5 py-3 text-rail-fg md:px-8">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="grid size-7 place-items-center rounded-[5px] bg-brand text-[13px] font-semibold text-white">
            {business.slice(0, 1)}
          </span>
          <span className="text-base font-semibold tracking-tight">{business}</span>
        </div>
        <span className="text-xs text-rail-fg-2">Powered by Lotus</span>
      </header>
      <main className="mx-auto w-full max-w-[760px] flex-1 px-5 py-8 md:py-10">{children}</main>
    </div>
  );
}

function Pending({ children, label }: { children: React.ReactNode; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-brand px-4 text-sm font-medium text-white shadow-1 transition-colors duration-150 hover:bg-brand-hover disabled:opacity-60 sm:w-auto">
      {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={2} /> : null}
      {pending ? label : children}
    </button>
  );
}

export function ApproveEstimate({ e, approve, open }: { e: Estimate; approve: (id: string, optionId: string) => Promise<ActionState>; open: boolean }) {
  const recommended = e.options.find((o) => o.name === "Better")?.id ?? e.options[0]!.id;
  const [choice, setChoice] = useState(e.approvedOptionId ?? recommended);
  const [state, formAction] = useActionState(async () => approve(e.id, choice), null);
  const chosen = e.options.find((o) => o.id === choice)!;
  const done = state?.ok || e.status === "approved";
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Options" className="flex flex-col gap-3">
        {e.options.map((o) => {
          const active = o.id === choice;
          return (
            <label
              key={o.id}
              className={cn(
                "flex cursor-pointer flex-col gap-3 rounded border bg-surface p-4 transition-colors duration-150",
                active ? "border-brand bg-brand-soft/20 ring-1 ring-brand" : "border-line hover:border-line-strong",
                (!open || done) && "cursor-default",
              )}
            >
              <span className="flex items-center gap-3">
                <input type="radio" name="option" value={o.id} checked={active} disabled={!open || done} onChange={() => setChoice(o.id)} className="size-4 accent-[var(--brand)]" />
                <span className="text-base font-semibold">{o.name}</span>
                {o.id === recommended && e.options.length > 1 && <span className="rounded-[4px] bg-surface-2 px-1.5 text-2xs font-medium leading-5 text-fg-2">Most chosen</span>}
                <span className="num ml-auto text-base font-semibold">{formatDollarsExact(optionTotal(o, e.taxRateBps))}</span>
              </span>
              <LineItems items={o.lineItems} taxRateBps={e.taxRateBps} compact />
            </label>
          );
        })}
      </div>
      {done ? (
        <p role="status" className="flex items-start gap-2 rounded border border-green/25 bg-green-soft/60 px-4 py-3 text-sm text-green">
          <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
          <span>
            Approved{e.options.length > 1 ? `: ${e.options.find((o) => o.id === (e.approvedOptionId ?? choice))?.name}` : ""}. Thank you. We will call you to book a day.
          </span>
        </p>
      ) : open ? (
        <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Pending label="Approving…">
            <Check className="size-4" strokeWidth={2.25} />
            Approve {e.options.length > 1 ? chosen.name : "estimate"} · {formatDollarsExact(optionTotal(chosen, e.taxRateBps))}
          </Pending>
          <p className="text-xs text-fg-3">Approving books nothing yet. We will call to agree a day.</p>
          {state && !state.ok && <p className="text-xs text-red">{state.message}</p>}
        </form>
      ) : null}
    </div>
  );
}

export function PayInvoice({ id, balanceCents, pay }: { id: string; balanceCents: number; pay: (id: string) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(async () => pay(id), null);
  if (state?.ok || balanceCents === 0) {
    return (
      <p role="status" className="flex items-start gap-2 rounded border border-green/25 bg-green-soft/60 px-4 py-3 text-sm text-green">
        <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
        Paid in full. A receipt is on its way. Thank you.
      </p>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Pending label="Paying…">
        <CreditCard className="size-4" strokeWidth={1.75} />
        Pay {formatDollarsExact(balanceCents)}
      </Pending>
      <p className="inline-flex items-center gap-1.5 text-xs text-fg-3">
        <Lock className="size-3" strokeWidth={2} />
        Card payments are processed by Stripe. Demo mode: no card is charged.
      </p>
      {state && !state.ok && <p className="text-xs text-red">{state.message}</p>}
    </form>
  );
}
