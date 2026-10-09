"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Field, FormNotice, FormSection, Input, Select, SubmitButton } from "@/components/form";
import type { AutomationActionState } from "@/app/agency/automations/actions";
import type { ClientRef } from "@/components/crm/model";
import type { AccountMode, StepType, TriggerType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { triggerLabel } from "./model";
import { stepIcon } from "./ui";

export interface RecipeLite {
  id: string;
  name: string;
  description: string;
  mode?: AccountMode;
  trigger: TriggerType;
  steps: StepType[];
}

/** The recipe's shape as a row of step glyphs: what starts it, then each step in order. */
function Shape({ trigger, steps }: { trigger: TriggerType; steps: StepType[] }) {
  const T = stepIcon.trigger;
  return (
    <span aria-hidden className="flex flex-wrap items-center gap-1 text-fg-3">
      <span className="inline-flex h-6 items-center gap-1 rounded-[4px] bg-surface-2 px-1.5 text-2xs font-medium text-fg-2 ring-1 ring-line ring-inset">
        <T className="size-3" strokeWidth={1.75} />
        {triggerLabel[trigger]}
      </span>
      {steps.map((s, i) => {
        const Icon = stepIcon[s];
        return (
          <span key={i} className="flex items-center gap-1">
            <ArrowRight className="size-3 text-line-strong" strokeWidth={2} />
            <span className="grid size-6 place-items-center rounded-[4px] bg-surface ring-1 ring-line ring-inset">
              <Icon className="size-3" strokeWidth={1.75} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function NewWorkflowForm({ action, clients, recipes, initialClientId }: { action: (prev: AutomationActionState, fd: FormData) => Promise<AutomationActionState>; clients: ClientRef[]; recipes: RecipeLite[]; initialClientId?: string }) {
  const [state, formAction] = useActionState(action, null);
  const [accountId, setAccountId] = useState(initialClientId ?? clients[0]?.id ?? "");
  const client = clients.find((c) => c.id === accountId);
  const fits = recipes.filter((t) => !t.mode || t.mode === client?.mode);
  const [recipeId, setRecipeId] = useState(fits[0]?.id ?? "blank");
  const chosen = recipeId === "blank" || fits.some((t) => t.id === recipeId) ? recipeId : fits[0]?.id ?? "blank";
  const [name, setName] = useState("");
  const e = state?.errors ?? {};
  const options = [...fits.map((r) => ({ ...r, blank: false })), { id: "blank", name: "Start from scratch", description: "An empty workflow that starts when a contact is created. Pick the trigger and add steps in the builder.", trigger: "contact_created" as TriggerType, steps: [] as StepType[], blank: true }];

  return (
    <form action={formAction} className="max-w-[1040px] px-5 md:px-8">
      <FormSection title="Workflow" description="Only your team sees the name. It starts as a draft, so nothing runs until you turn it on.">
        <Field label="Client" htmlFor="accountId" error={e.accountId}>
          <Select id="accountId" name="accountId" value={accountId} onChange={(ev) => setAccountId(ev.target.value)}>
            {(["marketing", "fundraising"] as const).map((m) => (
              <optgroup key={m} label={m === "marketing" ? "Marketing" : "Fundraising"}>
                {clients
                  .filter((c) => c.mode === m)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Name" htmlFor="name" error={e.name} hint={!name && chosen !== "blank" ? "Leave empty to use the recipe's name." : undefined}>
          <Input id="name" value={name} onChange={(ev) => setName(ev.target.value)} placeholder={options.find((o) => o.id === chosen)?.blank ? "New lead follow-up" : options.find((o) => o.id === chosen)?.name} aria-invalid={!!e.name} maxLength={80} />
          <input type="hidden" name="name" value={name.trim() || (chosen === "blank" ? "" : options.find((o) => o.id === chosen)?.name ?? "")} />
        </Field>
      </FormSection>
      <section className="grid gap-4 border-b border-line py-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
        <div>
          <h2 className="text-sm font-semibold">Start from</h2>
          <p className="mt-1 max-w-[36ch] text-xs leading-relaxed text-fg-3">Recipes the agency runs for {client?.mode === "fundraising" ? "fundraising" : "marketing"} clients. Every step stays editable.</p>
        </div>
        <div role="radiogroup" aria-label="Recipe" className="flex flex-col overflow-hidden rounded border border-line-strong">
          {options.map((t) => (
            <label
              key={t.id}
              className={cn(
                "flex cursor-pointer gap-3 border-b border-line px-3.5 py-3 transition-colors duration-150 last:border-b-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-brand",
                chosen === t.id ? "bg-surface-2 shadow-[inset_2px_0_0_var(--rail)]" : "bg-surface hover:bg-surface-2/50",
              )}
            >
              <input type="radio" name="templateId" value={t.id} checked={chosen === t.id} onChange={() => setRecipeId(t.id)} className="mt-0.5 size-3.5 shrink-0 accent-[var(--rail)]" />
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span>
                  <span className="block text-sm font-medium">{t.name}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-fg-3">{t.description}</span>
                </span>
                {!t.blank && <Shape trigger={t.trigger} steps={t.steps} />}
              </span>
            </label>
          ))}
        </div>
      </section>
      <div className="flex items-center gap-4 py-6">
        <SubmitButton pendingLabel="Creating…">Create and open builder</SubmitButton>
        <Link href="/agency/automations" className="text-sm text-fg-2 hover:text-fg">
          Cancel
        </Link>
        <FormNotice state={state} />
      </div>
    </form>
  );
}
