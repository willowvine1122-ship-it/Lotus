"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Copy, Trash2 } from "lucide-react";
import {
  Field,
  FormNotice,
  FormSection,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/form";
import {
  draftFrom,
  emptyLine,
  LineItemsEditor,
  type BookItem,
  type DraftLine,
} from "@/components/field/line-items-editor";
import type { ActionState } from "@/app/agency/contacts/actions";
import type { EstimateTemplate } from "@/lib/types";
import { depositChoices, depositLabel } from "./model";

/*
 * A template is an estimate without a customer: options, optional add-ons,
 * terms, deposit and how long prices hold. Same fields as a new estimate so
 * nothing needs relearning.
 */

interface DraftOption {
  key: string;
  name: string;
  lines: DraftLine[];
}

const tierNames = ["Good", "Better", "Best"];
let n = 0;
const key = () => `t${++n}`;

export function TemplateForm({
  action,
  remove,
  client,
  template,
  book,
  addOnBook,
  defaultTerms,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  remove?: () => Promise<void>;
  client: { id: string; name: string; taxRateBps: number };
  template?: EstimateTemplate;
  book: BookItem[];
  addOnBook: BookItem[];
  defaultTerms: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [deleting, startDelete] = useTransition();
  const e = state?.errors ?? {};
  const [options, setOptions] = useState<DraftOption[]>(() =>
    template
      ? template.options.map((o) => ({
          key: key(),
          name: o.name,
          lines: draftFrom(o.lineItems),
        }))
      : [{ key: key(), name: "Estimate", lines: [emptyLine()] }],
  );
  const [addOns, setAddOns] = useState<DraftLine[]>(() =>
    template?.addOns.length ? draftFrom(template.addOns) : [emptyLine()],
  );

  const addOption = () =>
    setOptions((os) => {
      const renamed =
        os.length === 1 && os[0]!.name === "Estimate"
          ? [{ ...os[0]!, name: "Good" }]
          : os;
      const last = renamed[renamed.length - 1]!;
      return [
        ...renamed,
        {
          key: key(),
          name: tierNames[renamed.length] ?? `Option ${renamed.length + 1}`,
          lines: last.lines.map((l) => ({ ...l, key: `${l.key}-${n}` })),
        },
      ];
    });

  return (
    <form action={formAction} className="max-w-[920px] px-5 md:px-8">
      <input type="hidden" name="accountId" value={client.id} />
      <FormSection
        title="Template"
        description={`For ${client.name}. Only your team sees the template's name; the work title goes on the estimate.`}
      >
        <Field label="Template name" htmlFor="name" error={e.name}>
          <Input
            id="name"
            name="name"
            defaultValue={template?.name}
            placeholder="Water heater replacement"
            aria-invalid={!!e.name}
            maxLength={80}
          />
        </Field>
        <Field label="Work" htmlFor="title" error={e.title}>
          <Input
            id="title"
            name="title"
            defaultValue={template?.title}
            placeholder="Water heater replacement"
            aria-invalid={!!e.title}
            maxLength={120}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Options"
        description="One price, or up to three for the customer to choose between."
      >
        <input type="hidden" name="optionCount" value={options.length} />
        <div className="flex flex-col gap-4 sm:col-span-2">
          {options.map((o, i) => (
            <fieldset
              key={o.key}
              className="flex flex-col gap-3 rounded border border-line bg-surface p-4"
            >
              <legend className="sr-only">Option {i + 1}</legend>
              <div className="flex items-end gap-3">
                <Field
                  label={options.length > 1 ? `Option ${i + 1}` : "Name"}
                  htmlFor={`option${i}Name`}
                  className="max-w-[240px] flex-1"
                >
                  <Input
                    id={`option${i}Name`}
                    name={`option${i}Name`}
                    value={o.name}
                    onChange={(ev) =>
                      setOptions(
                        options.map((x) =>
                          x.key === o.key ? { ...x, name: ev.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                {options.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setOptions(options.filter((x) => x.key !== o.key))
                    }
                    className="mb-2 ml-auto inline-flex items-center gap-1 text-xs text-fg-3 hover:text-red"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                    Remove
                  </button>
                )}
              </div>
              <LineItemsEditor
                name={`option${i}Lines`}
                lines={o.lines}
                onChange={(lines) =>
                  setOptions(
                    options.map((x) => (x.key === o.key ? { ...x, lines } : x)),
                  )
                }
                book={book}
                taxRateBps={client.taxRateBps}
                error={e[`option${i}`]}
              />
            </fieldset>
          ))}
          {options.length < 3 && (
            <button
              type="button"
              onClick={addOption}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded border border-dashed border-line-strong text-sm font-medium text-fg-2 hover:border-fg-3 hover:text-fg"
            >
              <Copy className="size-3.5" strokeWidth={1.75} />
              {options.length === 1
                ? "Offer a second option"
                : "Add a third option"}
            </button>
          )}
        </div>
      </FormSection>

      <FormSection
        title="Add-ons"
        description="Optional extras the customer can tick. Leave empty for none."
      >
        <div className="sm:col-span-2">
          <LineItemsEditor
            name="addOns"
            lines={addOns}
            onChange={setAddOns}
            book={addOnBook}
            error={e.addOns}
          />
        </div>
      </FormSection>

      <FormSection
        title="Message and terms"
        description="The message shows above the options. The customer accepts the terms when they sign."
      >
        <Field label="Message" htmlFor="message" className="sm:col-span-2">
          <Textarea
            id="message"
            name="message"
            defaultValue={template?.message}
            placeholder="Thanks for having us out."
          />
        </Field>
        <Field
          label="Terms"
          htmlFor="terms"
          error={e.terms}
          className="sm:col-span-2"
        >
          <Textarea
            id="terms"
            name="terms"
            defaultValue={template?.terms ?? defaultTerms}
            className="min-h-[160px]"
          />
        </Field>
        <Field label="Deposit" htmlFor="depositPct">
          <Select
            id="depositPct"
            name="depositPct"
            defaultValue={template?.depositPct ?? 0}
          >
            {depositChoices.map((p) => (
              <option key={p} value={p}>
                {depositLabel(p)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Valid for" htmlFor="validDays">
          <Select
            id="validDays"
            name="validDays"
            defaultValue={template?.validDays ?? 30}
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 py-6">
        <SubmitButton pendingLabel="Saving…">
          {template ? "Save template" : "Create template"}
        </SubmitButton>
        <Link
          href={`/agency/estimates/library?client=${client.id}&tab=templates`}
          className="text-sm text-fg-2 hover:underline"
        >
          Cancel
        </Link>
        <FormNotice state={state} />
        {remove && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (
                !confirm(
                  "Delete this template? Estimates made from it stay as they are.",
                )
              )
                return;
              startDelete(() => remove());
            }}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded border border-line-strong px-3 text-xs font-medium text-red hover:bg-red-soft"
          >
            <Trash2 className="size-3.5" strokeWidth={2} />
            Delete template
          </button>
        )}
      </div>
    </form>
  );
}
