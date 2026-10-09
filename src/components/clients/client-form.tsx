"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckboxChip, Field, FormNotice, FormSection, Input, MoneyInput, Select, SubmitButton } from "@/components/form";
import type { ActionState } from "@/app/agency/clients/actions";
import type { AccountMode, Assignee, ClientRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export const timeZones = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Arizona"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Toronto", "Toronto"],
  ["Europe/London", "London"],
  ["Asia/Dubai", "Dubai"],
  ["Asia/Karachi", "Karachi"],
] as const;

function ModePicker({ value, onChange }: { value: AccountMode; onChange: (m: AccountMode) => void }) {
  const options: { value: AccountMode; title: string; body: string }[] = [
    { value: "marketing", title: "Digital marketing", body: "Ads, leads, booked appointments, cost per lead and per appointment, budget pacing." },
    { value: "fundraising", title: "Digital fundraising", body: "Donations, donors, average gift, monthly giving, raised by country, goal pacing." },
  ];
  return (
    <div role="radiogroup" aria-label="Client mode" className="grid gap-2.5 sm:col-span-2 sm:grid-cols-2">
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "cursor-pointer rounded border px-4 py-3 transition-colors duration-150",
            value === o.value ? "border-brand bg-brand-soft/40" : "border-line-strong bg-surface hover:border-fg-3",
          )}
        >
          <input type="radio" name="mode" value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
          <span className="block text-sm font-medium">{o.title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-fg-3">{o.body}</span>
        </label>
      ))}
    </div>
  );
}

/** Create and edit share one form; `client` switches it to edit mode. */
export function ClientForm({
  action,
  team,
  client,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  team: Assignee[];
  client?: ClientRecord;
}) {
  const [state, formAction] = useActionState(action, null);
  const [mode, setMode] = useState<AccountMode>(client?.mode ?? "marketing");
  const e = state?.errors ?? {};
  const monthly = client ? (client.mode === "marketing" ? client.monthlyBudgetCents : client.monthlyGoalCents) / 100 : "";

  return (
    <form action={formAction} className="px-5 md:px-8">
      <FormSection title="About the client" description="How the client appears across Lotus and in their own view.">
        <Field label="Client name" htmlFor="name" error={e.name} className="sm:col-span-2">
          <Input id="name" name="name" defaultValue={client?.account.name} placeholder="Summit Roofing Co." autoFocus={!client} aria-invalid={!!e.name} />
        </Field>
        <Field label="Industry" htmlFor="industry" error={e.industry}>
          <Input id="industry" name="industry" defaultValue={client?.industry} placeholder="Roofing" aria-invalid={!!e.industry} />
        </Field>
        <Field label="Website" htmlFor="website" error={e.website} hint="Optional">
          <Input id="website" name="website" type="url" defaultValue={client?.website} placeholder="https://" aria-invalid={!!e.website} />
        </Field>
        <Field label="Location" htmlFor="location" error={e.location}>
          <Input id="location" name="location" defaultValue={client?.location} placeholder="Denver, CO" aria-invalid={!!e.location} />
        </Field>
        <Field label="Time zone" htmlFor="timeZone" error={e.timeZone}>
          <Select id="timeZone" name="timeZone" defaultValue={client?.timeZone ?? "America/New_York"}>
            {timeZones.map(([tz, label]) => (
              <option key={tz} value={tz}>
                {label} ({tz})
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>

      <FormSection
        title={client ? "Targets" : "Mode and targets"}
        description={client ? "The mode is fixed once a client has history." : "The mode decides which numbers the Daily Diagnostic tracks for this client."}
      >
        {!client && <ModePicker value={mode} onChange={setMode} />}
        <Field label={mode === "marketing" ? "Monthly ad budget" : "Monthly fundraising goal"} htmlFor="monthlyAmount" error={e.monthlyAmount} hint={mode === "marketing" ? "Pacing compares spend to this." : "Pacing compares raised to this."}>
          <MoneyInput id="monthlyAmount" name="monthlyAmount" defaultValue={monthly} placeholder="12,000" aria-invalid={!!e.monthlyAmount} />
        </Field>
        {mode === "marketing" && (
          <Field label="Average job value" htmlFor="avgJobValue" error={e.avgJobValue} hint="Used for estimated revenue and ROI.">
            <MoneyInput id="avgJobValue" name="avgJobValue" defaultValue={client?.mode === "marketing" && client.avgJobValueCents ? client.avgJobValueCents / 100 : ""} placeholder="9,800" />
          </Field>
        )}
        <Field label="Tags" htmlFor="tags" hint="Comma separated. Shown on the board and the client panel." className="sm:col-span-2">
          <Input id="tags" name="tags" defaultValue={client?.tags.join(", ")} placeholder="Storm season, Google Ads" />
        </Field>
        {client && (
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={client.status}>
              <option value="onboarding">Onboarding</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </Select>
          </Field>
        )}
      </FormSection>

      <FormSection title="Team" description="Who at Lotus works this account. They appear on the board and get the daily flags.">
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          {team.map((a) => (
            <CheckboxChip key={a.name} name="assignees" value={a.name} label={a.name} defaultChecked={client ? client.assignees.some((x) => x.name === a.name) : a.name === "Afza"} />
          ))}
        </div>
        {e.assignees && (
          <p className="text-xs text-red sm:col-span-2" role="alert">
            {e.assignees}
          </p>
        )}
      </FormSection>

      {!client && (
        <FormSection title="Client access" description="Optional. Invite the client's main contact to their own view: results only, no internal notes.">
          <Field label="Contact name" htmlFor="contactName" error={e.contactName}>
            <Input id="contactName" name="contactName" placeholder="Mike Summit" />
          </Field>
          <Field label="Contact email" htmlFor="contactEmail" error={e.contactEmail}>
            <Input id="contactEmail" name="contactEmail" type="email" placeholder="mike@summitroofing.com" aria-invalid={!!e.contactEmail} />
          </Field>
        </FormSection>
      )}

      <div className="flex flex-wrap items-center gap-3 py-6">
        <SubmitButton pendingLabel={client ? "Saving…" : "Creating…"}>{client ? "Save changes" : "Create client"}</SubmitButton>
        {!client && (
          <Link href="/agency/clients" className="text-sm text-fg-2 hover:underline">
            Cancel
          </Link>
        )}
        <FormNotice state={state} />
      </div>
    </form>
  );
}
