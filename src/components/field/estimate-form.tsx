"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { Field, FormNotice, FormSection, Input, Select, Textarea } from "@/components/form";
import { IntentButtons } from "./intent-buttons";
import type { ActionState } from "@/app/agency/contacts/actions";
import { CustomerFields, useCustomerPicker } from "./job-form";
import { draftFrom, emptyLine, LineItemsEditor, type BookItem, type DraftLine } from "./line-items-editor";
import type { CustomerRef, FieldClientRef } from "./model";
import { depositChoices, depositLabel } from "@/components/estimates/model";
import type { EstimateTemplate } from "@/lib/types";

export type FormTemplate = Pick<EstimateTemplate, "id" | "accountId" | "name" | "title" | "message" | "options" | "addOns" | "terms" | "depositPct" | "validDays">;

/*
 * New estimate. One price, or up to three options (good, better, best) that
 * the customer chooses between on their own link. Adding an option copies
 * the one before it, since the next tier is usually the same work plus more.
 */

interface DraftOption {
  key: string;
  name: string;
  lines: DraftLine[];
}

const tierNames = ["Good", "Better", "Best"];
let n = 0;
const key = () => `o${++n}`;

function optionsFrom(t: FormTemplate): DraftOption[] {
  return t.options.map((o) => ({ key: key(), name: o.name, lines: draftFrom(o.lineItems) }));
}

export function EstimateForm({
  action,
  clients,
  customers,
  books,
  addOnBooks = {},
  templates = [],
  defaultTerms = "",
  initialClientId,
  initialContactId,
  initialTemplateId,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  clients: FieldClientRef[];
  customers: CustomerRef[];
  books: Record<string, BookItem[]>;
  addOnBooks?: Record<string, BookItem[]>;
  templates?: FormTemplate[];
  defaultTerms?: string;
  initialClientId?: string;
  initialContactId?: string;
  initialTemplateId?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const e = state?.errors ?? {};
  const picker = useCustomerPicker(clients, customers, initialClientId, initialContactId);
  const initialTemplate = templates.find((t) => t.id === initialTemplateId);
  const [templateId, setTemplateId] = useState(initialTemplate?.id ?? "");
  const [options, setOptions] = useState<DraftOption[]>(() => (initialTemplate ? optionsFrom(initialTemplate) : [{ key: key(), name: "Estimate", lines: [emptyLine()] }]));
  const [title, setTitle] = useState(initialTemplate?.title ?? "");
  const [message, setMessage] = useState(initialTemplate?.message ?? "");
  const [addOns, setAddOns] = useState<DraftLine[]>(() => (initialTemplate?.addOns.length ? draftFrom(initialTemplate.addOns) : [emptyLine()]));
  const [terms, setTerms] = useState(initialTemplate?.terms ?? defaultTerms);
  const [depositPct, setDepositPct] = useState(initialTemplate?.depositPct ?? 0);
  const [validDays, setValidDays] = useState(initialTemplate?.validDays ?? 30);
  const mineTemplates = templates.filter((t) => t.accountId === picker.accountId);
  const book = books[picker.accountId] ?? [];
  const addOnBook = addOnBooks[picker.accountId] ?? [];

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setOptions(optionsFrom(t));
    setTitle(t.title);
    setMessage(t.message ?? "");
    setAddOns(t.addOns.length ? draftFrom(t.addOns) : [emptyLine()]);
    setTerms(t.terms);
    setDepositPct(t.depositPct);
    setValidDays(t.validDays);
  };
  const city = picker.mine.find((c) => c.id === picker.contactId)?.city;

  const addOption = () =>
    setOptions((os) => {
      const renamed = os.length === 1 && os[0]!.name === "Estimate" ? [{ ...os[0]!, name: "Good" }] : os;
      const last = renamed[renamed.length - 1]!;
      return [...renamed, { key: key(), name: tierNames[renamed.length] ?? `Option ${renamed.length + 1}`, lines: last.lines.map((l) => ({ ...l, key: `${l.key}-${n}` })) }];
    });

  return (
    <form action={formAction} className="max-w-[920px] px-5 md:px-8">
      <input type="hidden" name="templateId" value={templateId} />
      {mineTemplates.length > 0 && (
        <FormSection title="Start from" description="A template fills in the options, add-ons, terms and deposit. Everything stays editable.">
          <Field label="Template" htmlFor="template" className="sm:col-span-2">
            <Select id="template" value={templateId} onChange={(ev) => applyTemplate(ev.target.value)}>
              <option value="">Blank estimate</option>
              {mineTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </FormSection>
      )}
      <FormSection title="Customer" description="Who the estimate is for and where the work is.">
        <CustomerFields clients={clients} picker={picker} errors={e} />
        <Field label="Work" htmlFor="title" error={e.title} className="sm:col-span-2">
          <Input id="title" name="title" value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="Roof replacement" aria-invalid={!!e.title} />
        </Field>
        <Field label="Address" htmlFor="address" error={e.address} hint={city ? `Customer is in ${city}.` : undefined} className="sm:col-span-2">
          <Input id="address" name="address" placeholder="1420 Maple St" aria-invalid={!!e.address} />
        </Field>
      </FormSection>

      <FormSection title="Options" description="One price, or up to three options for the customer to choose between. Most people pick the middle one.">
        <input type="hidden" name="optionCount" value={options.length} />
        <div className="flex flex-col gap-4 sm:col-span-2">
          {options.map((o, i) => (
            <fieldset key={o.key} className="flex flex-col gap-3 rounded border border-line bg-surface p-4">
              <legend className="sr-only">Option {i + 1}</legend>
              <div className="flex items-end gap-3">
                <Field label={options.length > 1 ? `Option ${i + 1}` : "Name"} htmlFor={`option${i}Name`} className="max-w-[240px] flex-1">
                  <Input id={`option${i}Name`} name={`option${i}Name`} value={o.name} onChange={(ev) => setOptions(options.map((x) => (x.key === o.key ? { ...x, name: ev.target.value } : x)))} />
                </Field>
                {options.length > 1 && (
                  <button type="button" onClick={() => setOptions(options.filter((x) => x.key !== o.key))} className="mb-2 ml-auto inline-flex items-center gap-1 text-xs text-fg-3 hover:text-red">
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                    Remove
                  </button>
                )}
              </div>
              <LineItemsEditor
                name={`option${i}Lines`}
                lines={o.lines}
                onChange={(lines) => setOptions(options.map((x) => (x.key === o.key ? { ...x, lines } : x)))}
                book={book}
                taxRateBps={picker.client?.taxRateBps}
                error={e[`option${i}`]}
              />
            </fieldset>
          ))}
          {options.length < 3 && (
            <button type="button" onClick={addOption} className="inline-flex h-9 items-center justify-center gap-1.5 rounded border border-dashed border-line-strong text-sm font-medium text-fg-2 hover:border-fg-3 hover:text-fg">
              <Copy className="size-3.5" strokeWidth={1.75} />
              {options.length === 1 ? "Offer a second option" : "Add a third option"}
            </button>
          )}
        </div>
      </FormSection>

      <FormSection title="Add-ons" description="Optional extras the customer can tick on their link, like a longer warranty. Leave empty for none.">
        <div className="sm:col-span-2">
          <LineItemsEditor name="addOns" lines={addOns} onChange={setAddOns} book={addOnBook} error={e.addOns} />
        </div>
      </FormSection>

      <FormSection title="Message and terms" description="The message shows above the options. The customer accepts the terms when they sign.">
        <Field label="Message" htmlFor="message" className="sm:col-span-2">
          <Textarea id="message" name="message" value={message} onChange={(ev) => setMessage(ev.target.value)} placeholder="Thanks for having us out. Better is what we recommend for most homes like yours." />
        </Field>
        <Field label="Terms" htmlFor="terms" error={e.terms} className="sm:col-span-2">
          <Textarea id="terms" name="terms" value={terms} onChange={(ev) => setTerms(ev.target.value)} className="min-h-[140px]" />
        </Field>
        <Field label="Deposit" htmlFor="depositPct" hint={depositPct ? "Asked for by card right after the customer signs." : "The customer signs and you invoice later."}>
          <Select id="depositPct" name="depositPct" value={depositPct} onChange={(ev) => setDepositPct(Number(ev.target.value))}>
            {depositChoices.map((p) => (
              <option key={p} value={p}>
                {depositLabel(p)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Valid for" htmlFor="validDays">
          <Select id="validDays" name="validDays" value={validDays} onChange={(ev) => setValidDays(Number(ev.target.value))}>
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 py-6">
        <IntentButtons primary="Save and send" secondary="Save draft" />
        <Link href="/agency/estimates" className="text-sm text-fg-2 hover:underline">
          Cancel
        </Link>
        <FormNotice state={state} />
      </div>
    </form>
  );
}
