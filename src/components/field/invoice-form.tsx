"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormNotice, FormSection, Input, Select, Textarea } from "@/components/form";
import type { ActionState } from "@/app/agency/contacts/actions";
import { IntentButtons } from "./intent-buttons";
import { CustomerFields, useCustomerPicker } from "./job-form";
import { emptyLine, LineItemsEditor, type BookItem, type DraftLine } from "./line-items-editor";
import type { CustomerRef, FieldClientRef } from "./model";

/* A one-off invoice. Most invoices come from a finished job or an approved estimate instead. */

export function InvoiceForm({
  action,
  clients,
  customers,
  books,
  initialClientId,
  initialContactId,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  clients: FieldClientRef[];
  customers: CustomerRef[];
  books: Record<string, BookItem[]>;
  initialClientId?: string;
  initialContactId?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const e = state?.errors ?? {};
  const picker = useCustomerPicker(clients, customers, initialClientId, initialContactId);
  const [lines, setLines] = useState<DraftLine[]>(() => [emptyLine()]);

  return (
    <form action={formAction} className="max-w-[920px] px-5 md:px-8">
      <FormSection title="Customer" description="Who pays. Invoices from a job carry the job's customer automatically.">
        <CustomerFields clients={clients} picker={picker} errors={e} />
        <Field label="For" htmlFor="title" error={e.title} className="sm:col-span-2">
          <Input id="title" name="title" placeholder="Annual maintenance plan" aria-invalid={!!e.title} />
        </Field>
      </FormSection>

      <FormSection title="Items" description="Tax is added at the client's local rate.">
        <div className="sm:col-span-2">
          <LineItemsEditor name="lineItems" lines={lines} onChange={setLines} book={books[picker.accountId] ?? []} taxRateBps={picker.client?.taxRateBps} error={e.lineItems} />
        </div>
      </FormSection>

      <FormSection title="Terms" description="When it is due and a note printed at the bottom.">
        <Field label="Due" htmlFor="dueDays">
          <Select id="dueDays" name="dueDays" defaultValue={15}>
            <option value={0}>On receipt</option>
            <option value={7}>In 7 days</option>
            <option value={15}>In 15 days</option>
            <option value={30}>In 30 days</option>
          </Select>
        </Field>
        <Field label="Note" htmlFor="memo" className="sm:col-span-2">
          <Textarea id="memo" name="memo" placeholder="Thank you for your business. Pay by card or bank transfer from the link." className="min-h-[72px]" />
        </Field>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 py-6">
        <IntentButtons primary="Save and send" secondary="Save draft" />
        <Link href="/agency/invoices" className="text-sm text-fg-2 hover:underline">
          Cancel
        </Link>
        <FormNotice state={state} />
      </div>
    </form>
  );
}
