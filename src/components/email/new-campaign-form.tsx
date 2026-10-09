"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormNotice, FormSection, Input, Select, SubmitButton } from "@/components/form";
import type { EmailActionState } from "@/app/agency/email/actions";
import type { EmailBlock, EmailTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { EmailClientRef } from "./data";

/** A drawing of the template's structure, block by block, so the choice is visual. */
function Skeleton({ blocks }: { blocks: EmailBlock[] }) {
  return (
    <div aria-hidden className="flex h-[132px] flex-col gap-1.5 overflow-hidden rounded-[4px] border border-line bg-surface px-3 py-3">
      <span className="mb-1 h-1.5 w-10 rounded-[1px] bg-fg/70" />
      {blocks.slice(0, 7).map((b) => {
        switch (b.type) {
          case "heading":
            return <span key={b.id} className="h-2.5 w-3/4 shrink-0 rounded-[1px] bg-fg/80" />;
          case "text":
            return (
              <span key={b.id} className="flex shrink-0 flex-col gap-1">
                <span className="h-1 w-full rounded-[1px] bg-line-strong" />
                <span className="h-1 w-5/6 rounded-[1px] bg-line-strong" />
              </span>
            );
          case "button":
            return <span key={b.id} className="h-3.5 w-14 shrink-0 rounded-[2px] bg-fg" />;
          case "image":
            return <span key={b.id} className="h-8 w-full shrink-0 rounded-[2px] bg-surface-2" />;
          case "divider":
            return <span key={b.id} className="h-px w-full shrink-0 bg-line" />;
        }
      })}
    </div>
  );
}

export function NewCampaignForm({ action, clients, templates, initialClientId }: { action: (prev: EmailActionState, fd: FormData) => Promise<EmailActionState>; clients: EmailClientRef[]; templates: EmailTemplate[]; initialClientId?: string }) {
  const [state, formAction] = useActionState(action, null);
  const [accountId, setAccountId] = useState(initialClientId ?? clients[0]?.id ?? "");
  const client = clients.find((c) => c.id === accountId);
  const fits = templates.filter((t) => !t.mode || t.mode === client?.mode);
  const [templateId, setTemplateId] = useState(fits[0]?.id ?? "blank");
  const chosen = fits.some((t) => t.id === templateId) ? templateId : fits[0]?.id;
  const e = state?.errors ?? {};

  return (
    <form action={formAction} className="max-w-[1040px] px-5 md:px-8">
      <FormSection title="Campaign" description="Only your team sees the name. Recipients see the subject, which you write next.">
        <Field label="Client" htmlFor="accountId" error={e.accountId}>
          <Select id="accountId" name="accountId" value={accountId} onChange={(ev) => setAccountId(ev.target.value)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name" htmlFor="name" error={e.name}>
          <Input id="name" name="name" placeholder={client?.mode === "fundraising" ? "Winter appeal" : "Fall offer"} autoFocus aria-invalid={!!e.name} />
        </Field>
      </FormSection>
      <section className="grid gap-4 border-b border-line py-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
        <div>
          <h2 className="text-sm font-semibold">Start from</h2>
          <p className="mt-1 max-w-[36ch] text-xs leading-relaxed text-fg-3">
            Every template is editable block by block. {client?.mode === "fundraising" ? "Fundraising clients also get the appeal." : "Marketing clients also get the offer."}
          </p>
        </div>
        <div role="radiogroup" aria-label="Template" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {fits.map((t) => (
            <label
              key={t.id}
              className={cn(
                "flex cursor-pointer flex-col gap-2.5 rounded border p-2.5 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
                chosen === t.id ? "border-fg bg-surface-2" : "border-line-strong bg-surface hover:border-fg-3",
              )}
            >
              <input type="radio" name="templateId" value={t.id} checked={chosen === t.id} onChange={() => setTemplateId(t.id)} className="sr-only" />
              <Skeleton blocks={t.blocks} />
              <span className="px-0.5">
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-fg-3">{t.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>
      <div className="flex items-center gap-4 py-6">
        <SubmitButton pendingLabel="Creating…">Create and edit</SubmitButton>
        <Link href="/agency/email" className="text-sm text-fg-2 hover:text-fg">
          Cancel
        </Link>
        <FormNotice state={state} />
      </div>
    </form>
  );
}
