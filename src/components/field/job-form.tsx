"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Avatar } from "@/components/diagnostic/primitives";
import { Field, FormNotice, FormSection, Input, Select, SubmitButton, Textarea } from "@/components/form";
import type { ActionState } from "@/app/agency/contacts/actions";
import { formatDuration } from "@/lib/field";
import type { Technician } from "@/lib/types";
import { durations } from "./job-panel";
import { emptyLine, LineItemsEditor, type BookItem, type DraftLine } from "./line-items-editor";
import type { CustomerRef, FieldClientRef } from "./model";

/*
 * Shared customer picker: client, then one of that client's contacts, with
 * the address following the customer until it is typed over.
 */
export function useCustomerPicker(clients: FieldClientRef[], customers: CustomerRef[], initialClientId?: string, initialContactId?: string) {
  const initialContact = customers.find((c) => c.id === initialContactId);
  const [accountId, setAccountId] = useState(initialContact?.accountId ?? initialClientId ?? clients[0]?.id ?? "");
  const mine = customers.filter((c) => c.accountId === accountId).sort((a, b) => a.name.localeCompare(b.name));
  const [contactId, setContactId] = useState(initialContact?.id ?? "");
  const client = clients.find((c) => c.id === accountId);
  return { accountId, setAccountId, contactId, setContactId, mine, client };
}

export function CustomerFields({ clients, picker, errors }: { clients: FieldClientRef[]; picker: ReturnType<typeof useCustomerPicker>; errors: Record<string, string> }) {
  return (
    <>
      <Field label="Client" htmlFor="accountId" error={errors.accountId}>
        <Select
          id="accountId"
          name="accountId"
          value={picker.accountId}
          onChange={(e) => {
            picker.setAccountId(e.target.value);
            picker.setContactId("");
          }}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Customer" htmlFor="contactId" error={errors.contactId} hint="From the client's contacts.">
        <Select id="contactId" name="contactId" value={picker.contactId} onChange={(e) => picker.setContactId(e.target.value)} aria-invalid={!!errors.contactId}>
          <option value="">Pick a customer</option>
          {picker.mine.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.city ? ` · ${c.city}` : ""}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

export function JobForm({
  action,
  clients,
  customers,
  crew,
  books,
  initialClientId,
  initialContactId,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  clients: FieldClientRef[];
  customers: CustomerRef[];
  crew: Technician[];
  books: Record<string, BookItem[]>;
  initialClientId?: string;
  initialContactId?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const e = state?.errors ?? {};
  const picker = useCustomerPicker(clients, customers, initialClientId, initialContactId);
  const [lines, setLines] = useState<DraftLine[]>(() => [emptyLine()]);
  const team = crew.filter((t) => t.accountId === picker.accountId);
  const city = picker.mine.find((c) => c.id === picker.contactId)?.city;

  return (
    <form action={formAction} className="max-w-[920px] px-5 md:px-8">
      <FormSection title="Customer" description="Who the job is for and where the crew is going.">
        <CustomerFields clients={clients} picker={picker} errors={e} />
        <Field label="Job" htmlFor="title" error={e.title} className="sm:col-span-2">
          <Input id="title" name="title" placeholder="AC not cooling" aria-invalid={!!e.title} />
        </Field>
        <Field label="Address" htmlFor="address" error={e.address} hint={city ? `Customer is in ${city}.` : undefined} className="sm:col-span-2">
          <Input id="address" name="address" placeholder={`1420 Maple St, ${city ?? picker.client?.name ?? ""}`.replace(/, $/, "")} aria-invalid={!!e.address} />
        </Field>
      </FormSection>

      <FormSection title="Work" description="What the crew will do and what it costs. Prices fill in from the client's price book.">
        <div className="sm:col-span-2">
          <LineItemsEditor name="lineItems" lines={lines} onChange={setLines} book={books[picker.accountId] ?? []} error={e.lineItems} />
        </div>
      </FormSection>

      <FormSection title="Schedule" description="Leave the date empty to put the job in the dispatch queue.">
        <Field label="Date" htmlFor="date" error={e.date}>
          <Input id="date" name="date" type="date" min={picker.client?.today} className="num" />
        </Field>
        <Field label="Start" htmlFor="time" error={e.time}>
          <Input id="time" name="time" type="time" step={900} defaultValue="09:00" className="num" />
        </Field>
        <Field label="Length" htmlFor="durationMin">
          <Select id="durationMin" name="durationMin" defaultValue={120}>
            {durations.map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </Select>
        </Field>
        <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">Who is going</legend>
          {team.length === 0 ? (
            <p className="text-xs text-fg-3">This client has no technicians yet. The job goes to the dispatch queue.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {team.map((t) => (
                <label key={t.id} className="inline-flex h-8 cursor-pointer items-center gap-2 rounded border border-line-strong bg-surface pl-1 pr-2.5 text-sm has-[:checked]:border-rail has-[:checked]:bg-rail has-[:checked]:text-rail-fg">
                  <input type="checkbox" name="technicianIds" value={t.id} className="sr-only" />
                  <Avatar person={t} />
                  {t.name}
                  <span className="text-xs opacity-70">{t.role}</span>
                </label>
              ))}
            </div>
          )}
          {e.technicianIds && (
            <p className="text-xs text-red" role="alert">
              {e.technicianIds}
            </p>
          )}
        </fieldset>
      </FormSection>

      <FormSection title="Notes" description="For the crew: gate codes, pets, parking, parts to bring.">
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" placeholder="Gate code 4412. Dog in the yard, friendly." />
        </Field>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 py-6">
        <SubmitButton pendingLabel="Creating…">Create job</SubmitButton>
        <Link href="/agency/jobs" className="text-sm text-fg-2 hover:underline">
          Cancel
        </Link>
        <FormNotice state={state} />
      </div>
    </form>
  );
}
