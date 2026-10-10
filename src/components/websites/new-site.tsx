"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormNotice, FormSection, Input, Select, SubmitButton } from "@/components/form";
import type { SiteResult } from "@/app/agency/websites/actions";
import type { AccountMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ClientRef } from "./model";

export interface SiteTemplateLite {
  key: string;
  name: string;
  summary: string;
  modes: AccountMode[];
  pages: string[];
  color: string;
}

export function NewSiteForm({ action, clients, templates, initialClientId }: { action: (prev: SiteResult | null, fd: FormData) => Promise<SiteResult>; clients: ClientRef[]; templates: SiteTemplateLite[]; initialClientId?: string }) {
  const [state, formAction] = useActionState(action, null);
  const [accountId, setAccountId] = useState(initialClientId ?? clients[0]?.id ?? "");
  const client = clients.find((c) => c.id === accountId);
  const fits = templates.filter((t) => !client || t.modes.includes(client.mode));
  const [key, setKey] = useState(fits[0]?.key ?? "blank");
  const chosen = fits.some((t) => t.key === key) ? key : (fits[0]?.key ?? "blank");
  const [name, setName] = useState("");
  const e = state?.errors ?? {};
  const fallbackName = client ? `${client.name} website` : "";

  return (
    <form action={formAction} className="max-w-[1040px] px-5 md:px-8">
      <FormSection title="Site" description="Only your team sees the name. The site starts as a draft, so nothing is public until you publish.">
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
        <Field label="Name" htmlFor="name" error={e.name} hint={!name && fallbackName ? "Leave empty to use the client's name." : undefined}>
          <Input id="name" value={name} onChange={(ev) => setName(ev.target.value)} placeholder={fallbackName || "Main website"} aria-invalid={!!e.name} maxLength={80} />
          <input type="hidden" name="name" value={name.trim() || fallbackName} />
        </Field>
      </FormSection>
      <section className="grid gap-4 border-b border-line py-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
        <div>
          <h2 className="text-sm font-semibold">Start from</h2>
          <p className="mt-1 max-w-[36ch] text-xs leading-relaxed text-fg-3">Pages, copy, colours and navigation all stay editable. The client&apos;s name is filled in for you.</p>
        </div>
        <div role="radiogroup" aria-label="Template" className="flex flex-col overflow-hidden rounded border border-line-strong">
          {fits.map((t) => (
            <label
              key={t.key}
              className={cn(
                "flex cursor-pointer gap-3 border-b border-line px-3.5 py-3 transition-colors duration-150 last:border-b-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-brand",
                chosen === t.key ? "bg-surface-2 shadow-[inset_2px_0_0_var(--rail)]" : "bg-surface hover:bg-surface-2/50",
              )}
            >
              <input type="radio" name="template" value={t.key} checked={chosen === t.key} onChange={() => setKey(t.key)} className="mt-0.5 size-3.5 shrink-0 accent-[var(--rail)]" />
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span>
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-fg-3">{t.summary}</span>
                </span>
                {t.pages.length > 0 && (
                  <span aria-hidden className="flex flex-wrap items-center gap-1">
                    {t.pages.map((p, i) => (
                      <span key={p} className="inline-flex h-6 items-center gap-1.5 rounded-[4px] bg-surface px-2 text-2xs font-medium text-fg-2 ring-1 ring-line ring-inset">
                        {i === 0 && <span className="size-1.5 rounded-full" style={{ background: t.color }} />}
                        {p}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </section>
      <div className="flex items-center gap-4 py-6">
        <SubmitButton pendingLabel="Creating…">Create and open editor</SubmitButton>
        <Link href="/agency/websites" className="text-sm text-fg-2 hover:text-fg">
          Cancel
        </Link>
        <FormNotice state={state} />
      </div>
    </form>
  );
}
