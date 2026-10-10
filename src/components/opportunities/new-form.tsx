"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState } from "react";
import { Field, FormNotice, FormSection, Input, MoneyInput, Select, SubmitButton } from "@/components/form";
import { sourceLabel, type ClientRef } from "@/components/crm/model";
import type { OppActionState } from "@/app/agency/opportunities/actions";
import type { Assignee, ContactSource, Pipeline } from "@/lib/types";

export interface ContactOption {
  id: string;
  name: string;
  detail: string;
  source: ContactSource;
  ownerName?: string;
  valueCents: number;
}

/*
 * Add an opportunity: who it is for, which pipeline and stage, what it is
 * worth. The client is chosen by URL so the contact list stays that client's.
 */
export function NewOpportunityForm({
  action,
  client,
  clients,
  pipelines,
  contacts,
  team,
  initialPipelineId,
  initialContactId,
}: {
  action: (prev: OppActionState, fd: FormData) => Promise<OppActionState>;
  client: ClientRef;
  clients: ClientRef[];
  pipelines: Pipeline[];
  contacts: ContactOption[];
  team: Assignee[];
  initialPipelineId?: string;
  initialContactId?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, null);
  const [pipelineId, setPipelineId] = useState(initialPipelineId ?? pipelines[0]?.id ?? "");
  const [contactId, setContactId] = useState(initialContactId ?? "");
  const [filter, setFilter] = useState("");
  const pipeline = pipelines.find((p) => p.id === pipelineId);
  const contact = contacts.find((c) => c.id === contactId);
  const e = state?.errors ?? {};
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? contacts.filter((c) => c.id === contactId || `${c.name} ${c.detail}`.toLowerCase().includes(q)) : contacts;
  }, [contacts, filter, contactId]);
  const back = `/agency/opportunities?client=${client.slug}&pipeline=${pipelineId}`;

  return (
    <form action={formAction} className="max-w-[880px] px-5 md:px-8">
      <FormSection title="Who it is for" description="Every opportunity belongs to one contact. A contact can have several, in any pipeline.">
        <Field label="Client" htmlFor="client" className="sm:col-span-2">
          <Select id="client" value={client.id} onChange={(ev) => router.push(`/agency/opportunities/new?client=${clients.find((c) => c.id === ev.target.value)?.slug ?? client.slug}`)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Find a contact" htmlFor="contact-filter" hint={`${contacts.length} contacts at ${client.name}.`}>
          <Input id="contact-filter" type="search" value={filter} onChange={(ev) => setFilter(ev.target.value)} placeholder="Name, email, phone" />
        </Field>
        <Field label="Contact" htmlFor="contactId" error={e.contactId} hint={contacts.length ? undefined : "Add a contact to this client first."}>
          <Select id="contactId" name="contactId" value={contactId} onChange={(ev) => setContactId(ev.target.value)} aria-invalid={!!e.contactId}>
            <option value="">{shown.length ? "Pick a contact" : "No contact matches"}</option>
            {shown.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.detail ? ` · ${c.detail}` : ""}
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>

      <FormSection title="The deal" description="Name it the way the team talks about it. Value and stage drive the forecast.">
        <Field label="Name" htmlFor="name" error={e.name} className="sm:col-span-2">
          <Input key={contactId} id="name" name="name" defaultValue={contact ? `${contact.name} · ` : ""} placeholder={client.mode === "fundraising" ? "Dana Kim · leadership gift" : "Mike Summit · roof replacement"} aria-invalid={!!e.name} />
        </Field>
        <Field label="Pipeline" htmlFor="pipelineId" error={e.pipelineId}>
          <Select id="pipelineId" name="pipelineId" value={pipelineId} onChange={(ev) => setPipelineId(ev.target.value)}>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Stage" htmlFor="stageId" hint={pipeline?.primary ? "Also moves the contact to this stage." : undefined}>
          <Select key={pipelineId} id="stageId" name="stageId" defaultValue={pipeline?.stages[0]?.id}>
            {pipeline?.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.outcome ? "" : ` · ${s.probability ?? 0}%`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={client.mode === "fundraising" ? "Gift amount" : "Value"} htmlFor="value" error={e.value}>
          <MoneyInput key={contactId} id="value" name="value" defaultValue={contact?.valueCents ? String(Math.round(contact.valueCents / 100)) : ""} placeholder="0" />
        </Field>
        <Field label="Expected close" htmlFor="closeOn" error={e.closeOn} hint="Optional. Feeds the close-by-month forecast.">
          <Input id="closeOn" name="closeOn" type="date" className="num" />
        </Field>
        <Field label="Owner" htmlFor="ownerName" hint="Defaults to the contact's owner.">
          <Select key={contactId} id="ownerName" name="ownerName" defaultValue={contact?.ownerName ?? ""}>
            <option value="">{contact?.ownerName ? `Same as contact (${contact.ownerName})` : "Unassigned"}</option>
            {team.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source" htmlFor="source">
          <Select key={contactId} id="source" name="source" defaultValue={contact?.source ?? "manual"}>
            {(Object.keys(sourceLabel) as ContactSource[]).map((k) => (
              <option key={k} value={k}>
                {sourceLabel[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tags" htmlFor="tags" hint="Comma separated." className="sm:col-span-2">
          <Input id="tags" name="tags" placeholder={client.mode === "fundraising" ? "Board, Year-end" : "Financing, Insurance claim"} />
        </Field>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 py-6">
        <SubmitButton pendingLabel="Adding…">Add opportunity</SubmitButton>
        <Link href={back} className="text-sm text-fg-2 hover:underline">
          Cancel
        </Link>
        <FormNotice state={state} />
      </div>
    </form>
  );
}
