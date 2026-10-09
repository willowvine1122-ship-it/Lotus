"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormNotice, FormSection, Input, MoneyInput, Select, SubmitButton } from "@/components/form";
import type { ActionState } from "@/app/agency/contacts/actions";
import type { Assignee, Contact, Pipeline } from "@/lib/types";
import { sourceLabel, type ClientRef } from "./model";

export function ContactForm({
  action,
  clients,
  pipelines,
  team,
  contact,
  initialClientId,
  onDelete,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  clients: ClientRef[];
  pipelines: Record<string, Pipeline>;
  team: Assignee[];
  contact?: Contact;
  initialClientId?: string;
  onDelete?: () => Promise<void>;
}) {
  const [state, formAction] = useActionState(action, null);
  const [accountId, setAccountId] = useState(contact?.accountId ?? initialClientId ?? clients[0]?.id ?? "");
  const e = state?.errors ?? {};
  const client = clients.find((c) => c.id === accountId);
  const pipeline = pipelines[accountId];

  return (
    <form action={formAction} className="max-w-[880px] px-5 md:px-8">
      <FormSection title="Who" description="Name and how to reach them. Email or phone is enough to start.">
        <Field label="Client" htmlFor="accountId" error={e.accountId} className="sm:col-span-2">
          {contact ? (
            <>
              <input type="hidden" name="accountId" value={contact.accountId} />
              <Input value={client?.name ?? ""} readOnly className="bg-surface-2 text-fg-2" />
            </>
          ) : (
            <Select id="accountId" name="accountId" value={accountId} onChange={(ev) => setAccountId(ev.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="First name" htmlFor="firstName" error={e.firstName}>
          <Input id="firstName" name="firstName" defaultValue={contact?.firstName} placeholder="Mike" autoFocus={!contact} aria-invalid={!!e.firstName} />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={e.lastName}>
          <Input id="lastName" name="lastName" defaultValue={contact?.lastName} placeholder="Summit" aria-invalid={!!e.lastName} />
        </Field>
        <Field label="Email" htmlFor="email" error={e.email}>
          <Input id="email" name="email" type="email" defaultValue={contact?.email} placeholder="mike@example.com" aria-invalid={!!e.email} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={e.phone}>
          <Input id="phone" name="phone" type="tel" defaultValue={contact?.phone} placeholder="(303) 555-0142" className="num" />
        </Field>
        <Field label="Company" htmlFor="company" hint="Optional">
          <Input id="company" name="company" defaultValue={contact?.company} placeholder="Oakridge HOA" />
        </Field>
        <Field label="City" htmlFor="city" hint="Optional">
          <Input id="city" name="city" defaultValue={contact?.city} placeholder="Denver, CO" />
        </Field>
      </FormSection>

      <FormSection title="Pipeline" description="Where they came from, who looks after them, and where they stand.">
        <Field label="Source" htmlFor="source" error={e.source}>
          <Select id="source" name="source" defaultValue={contact?.source ?? (client?.mode === "fundraising" ? "donation-page" : "manual")}>
            {(Object.keys(sourceLabel) as (keyof typeof sourceLabel)[]).map((k) => (
              <option key={k} value={k}>
                {sourceLabel[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Stage" htmlFor="stageId">
          <Select id="stageId" name="stageId" defaultValue={contact?.stageId ?? pipeline?.stages[0]?.id}>
            {pipeline?.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Owner" htmlFor="ownerName">
          <Select id="ownerName" name="ownerName" defaultValue={contact?.ownerName ?? ""}>
            <option value="">Unassigned</option>
            {team.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={client?.mode === "fundraising" ? "Lifetime giving" : "Job value"} htmlFor="value" error={e.value} hint={client?.mode === "fundraising" ? "Gifts logged later add to this." : "Estimated or won. Shows on the pipeline."}>
          <MoneyInput id="value" name="value" defaultValue={contact ? contact.valueCents / 100 : ""} placeholder="0" />
        </Field>
        <Field label="Tags" htmlFor="tags" hint="Comma separated." className="sm:col-span-2">
          <Input id="tags" name="tags" defaultValue={contact?.tags.join(", ")} placeholder="Insurance claim, Financing" />
        </Field>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 py-6">
        <SubmitButton pendingLabel={contact ? "Saving…" : "Adding…"}>{contact ? "Save changes" : "Add contact"}</SubmitButton>
        <Link href={contact ? `/agency/contacts/${contact.id}` : "/agency/contacts"} className="text-sm text-fg-2 hover:underline">
          Cancel
        </Link>
        <FormNotice state={state} />
        {onDelete && (
          <button type="button" onClick={() => void onDelete()} className="ml-auto text-sm text-fg-3 hover:text-red">
            Delete contact
          </button>
        )}
      </div>
    </form>
  );
}
