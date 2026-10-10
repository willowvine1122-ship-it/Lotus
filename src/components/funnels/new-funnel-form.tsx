"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormNotice, FormSection, Input, Select, SubmitButton } from "@/components/form";
import type { ActionState } from "@/app/agency/funnels/actions";
import { cn } from "@/lib/utils";
import type { ClientRef } from "./model";

export interface TemplateOption {
  id: string;
  name: string;
  description: string;
  mode: "marketing" | "fundraising" | "both";
  steps?: string[];
  kinds?: string[];
}

export function NewFunnelForm({ action, clients, templates, initialClientId }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState>; clients: ClientRef[]; templates: TemplateOption[]; initialClientId?: string }) {
  const [state, formAction] = useActionState(action, null);
  const [accountId, setAccountId] = useState(initialClientId ?? clients[0]?.id ?? "");
  const client = clients.find((c) => c.id === accountId);
  const fits = templates.filter((t) => t.mode === "both" || t.mode === client?.mode);
  const [template, setTemplate] = useState(fits[0]?.id ?? "blank");
  const chosen = fits.some((t) => t.id === template) ? template : (fits[0]?.id ?? "blank");
  const e = state?.errors ?? {};

  return (
    <form action={formAction} className="max-w-[880px] px-5 md:px-8">
      <FormSection title="Who it is for" description="The funnel lives under this client and every form on it feeds their contacts.">
        <Field label="Client" htmlFor="accountId" error={e.accountId}>
          <Select id="accountId" name="accountId" value={accountId} onChange={(ev) => setAccountId(ev.target.value)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Funnel name" htmlFor="name" error={e.name} hint="Internal. Visitors see the page headline, not this.">
          <Input id="name" name="name" placeholder={client?.mode === "fundraising" ? "Winter appeal" : "Spring quote offer"} autoFocus aria-invalid={!!e.name} />
        </Field>
      </FormSection>

      <FormSection title="Start from" description="Each template is a finished page with a form that already works. Change anything after.">
        <input type="hidden" name="template" value={chosen} />
        <div className="grid gap-2.5 sm:col-span-2 sm:grid-cols-2">
          {fits.map((t) => {
            const active = t.id === chosen;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTemplate(t.id)}
                className={cn(
                  "flex flex-col gap-1 rounded border px-3.5 py-3 text-left transition-colors duration-150",
                  active ? "border-rail bg-rail text-rail-fg" : "border-line-strong bg-surface hover:bg-surface-2",
                )}
              >
                <span className="text-sm font-semibold">{t.name}</span>
                <span className={cn("text-xs leading-relaxed", active ? "text-rail-fg-2" : "text-fg-3")}>{t.description}</span>
                {t.steps && t.steps.length > 0 && (
                  <span className="mt-1.5 flex flex-wrap items-center gap-1">
                    {t.steps.map((st, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span aria-hidden className={cn("text-[10px]", active ? "text-rail-fg-2" : "text-fg-3")}>→</span>}
                        <span className={cn("rounded-[4px] px-1.5 py-px text-[11px] font-medium", active ? "bg-rail-2 text-rail-fg" : "bg-surface-2 text-fg-2")}>{st}</span>
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {e.template && (
          <p className="text-xs text-red sm:col-span-2" role="alert">
            {e.template}
          </p>
        )}
      </FormSection>

      <div className="flex items-center gap-3 py-6">
        <SubmitButton pendingLabel="Creating…">Create funnel</SubmitButton>
        <Link href="/agency/funnels" className="text-sm text-fg-2 hover:text-fg">
          Cancel
        </Link>
        <FormNotice state={state} />
      </div>
    </form>
  );
}
