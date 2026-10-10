"use client";

import { useId, useRef } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Field, Input, MoneyInput, Select, controlClass } from "@/components/form";
import { mergeTags } from "@/components/email/model";
import { sourceLabel } from "@/components/crm/model";
import type { AccountMode, Channel, ConditionField, ContactSource, OpportunityStatus, Pipeline, TriggerType, WorkflowStep, WorkflowTrigger } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";
import { conditionFieldLabel, triggerGroups, triggerLabel } from "./model";
import { appEvent, apps, findApp } from "@/components/integrations/catalog";
import { useIntegrationOptions } from "./integration-options";
import Link from "next/link";

/*
 * The right-hand panel's forms: one for the trigger, one per step type.
 * Every field writes straight back into the builder's draft; nothing here
 * persists on its own.
 */

const sources = Object.keys(sourceLabel) as ContactSource[];
const channels: { value: Channel; label: string }[] = [
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "facebook", label: "Facebook" },
];

/** Tag suggestions as a datalist, so a new tag can still be typed. */
function TagInput({ id, value, onChange, tags, invalid }: { id: string; value: string; onChange: (v: string) => void; tags: string[]; invalid?: boolean }) {
  return (
    <>
      <Input id={id} list={`${id}-tags`} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Type or pick a tag" aria-invalid={invalid || undefined} maxLength={40} />
      <datalist id={`${id}-tags`}>
        {tags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </>
  );
}

/** A text field with merge-tag chips that insert at the caret. */
function MergeField({
  id,
  label,
  value,
  onChange,
  multiline,
  rows,
  hint,
  error,
  maxLength,
  placeholder,
  contactTags,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  hint?: React.ReactNode;
  error?: string;
  maxLength?: number;
  placeholder?: string;
  /** Also offer email and phone, for fields that go to other apps. */
  contactTags?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const insert = (tag: string) => {
    const el = ref.current;
    const at = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? at;
    const next = value.slice(0, at) + tag + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + tag.length, at + tag.length);
    });
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="flex gap-1">
          {[...mergeTags, ...(contactTags ? [{ tag: "{{email}}", label: "Email" }, { tag: "{{phone}}", label: "Phone" }] : [])].map((t) => (
            <button
              key={t.tag}
              type="button"
              onClick={() => insert(t.tag)}
              className="h-5 rounded-[3px] bg-surface-2 px-1.5 text-2xs text-fg-2 ring-1 ring-line ring-inset hover:text-fg hover:ring-line-strong"
              title={`Insert ${t.label.toLowerCase()}`}
            >
              {t.label}
            </button>
          ))}
        </span>
      </div>
      {multiline ? (
        <textarea id={id} ref={ref} rows={rows ?? 4} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error || undefined} maxLength={maxLength} placeholder={placeholder} className={cn(controlClass, "h-auto min-h-[96px] py-2 leading-relaxed")} />
      ) : (
        <input id={id} ref={ref} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error || undefined} maxLength={maxLength} placeholder={placeholder} className={controlClass} />
      )}
      {error ? (
        <p className="text-xs text-red" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------- trigger ----------------------------- */

export function TriggerEditor({
  trigger,
  onChange,
  allowReentry,
  onReentry,
  mode,
  pipeline,
  tags,
  started,
  error,
}: {
  trigger: WorkflowTrigger;
  onChange: (t: WorkflowTrigger) => void;
  allowReentry: boolean;
  onReentry: (v: boolean) => void;
  mode: AccountMode;
  pipeline?: Pipeline;
  tags: string[];
  started: number;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-5">
      <Field label="Starts when" htmlFor={`${id}-type`} error={error}>
        <Select id={`${id}-type`} value={trigger.type} onChange={(e) => onChange({ type: e.target.value as TriggerType })}>
          {triggerGroups(mode).map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.types.map((t) => (
                <option key={t} value={t}>
                  {triggerLabel[t]}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      {trigger.type === "contact_created" && (
        <Field label="From" htmlFor={`${id}-source`} hint="Leave on any source to catch every new contact.">
          <Select id={`${id}-source`} value={trigger.source ?? ""} onChange={(e) => onChange({ ...trigger, source: (e.target.value || undefined) as ContactSource | undefined })}>
            <option value="">Any source</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {sourceLabel[s]}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {trigger.type === "tag_added" && (
        <Field label="Tag" htmlFor={`${id}-tag`} hint="Leave empty to start on any tag.">
          <TagInput id={`${id}-tag`} value={trigger.tag ?? ""} onChange={(v) => onChange({ ...trigger, tag: v || undefined })} tags={tags} />
        </Field>
      )}
      <OpportunityTriggerFields id={id} trigger={trigger} onChange={onChange} pipeline={pipeline} />
      {trigger.type === "message_received" && (
        <Field label="Channel" htmlFor={`${id}-channel`}>
          <Select id={`${id}-channel`} value={trigger.channel ?? ""} onChange={(e) => onChange({ ...trigger, channel: (e.target.value || undefined) as Channel | undefined })}>
            <option value="">Any channel</option>
            {channels.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {trigger.type === "donation_received" && (
        <Field label="Smallest gift" htmlFor={`${id}-min`} hint="Leave empty for every gift.">
          <MoneyInput
            id={`${id}-min`}
            value={trigger.minAmountCents ? String(trigger.minAmountCents / 100) : ""}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^0-9.]/g, ""));
              onChange({ ...trigger, minAmountCents: n > 0 ? Math.round(n * 100) : undefined });
            }}
            placeholder="Any amount"
          />
        </Field>
      )}

      <IntegrationTriggerFields id={id} trigger={trigger} onChange={onChange} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Each contact can go through</legend>
        {[
          { v: false, label: "Once", hint: "A contact who already went through is not started again." },
          { v: true, label: "Every time it happens", hint: "Good for gifts and replies. Never twice at the same time." },
        ].map((o) => (
          <label key={o.label} className={cn("flex cursor-pointer gap-2.5 rounded border px-3 py-2.5", allowReentry === o.v ? "border-rail bg-surface" : "border-line-strong hover:border-fg-3")}>
            <input type="radio" name={`${id}-reentry`} checked={allowReentry === o.v} onChange={() => onReentry(o.v)} className="mt-0.5 size-3.5 accent-[var(--rail)]" />
            <span>
              <span className="block text-sm font-medium">{o.label}</span>
              <span className="block text-xs text-fg-3">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className="num text-xs text-fg-3">{started ? `${formatCount(started)} contacts started in the last 30 days.` : "No one has started yet."}</p>
    </div>
  );
}

/** Form, webhook and app-event pickers; their choices come from what the client has set up. */
function IntegrationTriggerFields({ id, trigger, onChange }: { id: string; trigger: WorkflowTrigger; onChange: (t: WorkflowTrigger) => void }) {
  const o = useIntegrationOptions();
  if (trigger.type === "form_submitted") {
    return (
      <Field label="Form" htmlFor={`${id}-form`} hint="Leave on any form to catch every form and funnel page.">
        <Select id={`${id}-form`} value={trigger.formId ?? ""} onChange={(e) => onChange({ ...trigger, formId: e.target.value || undefined })}>
          <option value="">Any form</option>
          {o.forms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </Field>
    );
  }
  if (trigger.type === "webhook_received") {
    return (
      <Field label="Webhook" htmlFor={`${id}-hook`} hint={o.hooksIn.length ? "Each post creates or updates the contact first." : undefined}>
        <Select id={`${id}-hook`} value={trigger.hookId ?? ""} onChange={(e) => onChange({ ...trigger, hookId: e.target.value || undefined })}>
          <option value="">Any incoming webhook</option>
          {o.hooksIn.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </Select>
        {!o.hooksIn.length && <NoneYet what="incoming webhooks" tab="webhooks" />}
      </Field>
    );
  }
  if (trigger.type === "app_event") {
    const current = appEvent(trigger.appEvent);
    const withTriggers = apps.filter((a) => a.triggers.length);
    return (
      <Field label="App and event" htmlFor={`${id}-app`} error={current && !o.connectedApps.includes(current.app.id) ? `${current.app.name} isn't connected for this client, so this won't start until it is.` : undefined}>
        <Select id={`${id}-app`} value={trigger.appEvent ?? ""} onChange={(e) => onChange({ ...trigger, appEvent: e.target.value || undefined })}>
          <option value="">Pick an event</option>
          {withTriggers.map((a) => (
            <optgroup key={a.id} label={`${a.name}${o.connectedApps.includes(a.id) ? "" : " (not connected)"}`}>
              {a.triggers.map((t) => (
                <option key={t.key} value={`${a.id}.${t.key}`}>
                  {a.name}: {t.label}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <NoneYet what="" tab="apps" always />
      </Field>
    );
  }
  return null;
}

function NoneYet({ what, tab, always }: { what: string; tab: string; always?: boolean }) {
  return (
    <p className="text-xs text-fg-3">
      {always ? "Connect apps in " : `No ${what} yet. Add one in `}
      <Link href={`/agency/integrations?tab=${tab}`} className="font-medium text-fg-2 underline-offset-2 hover:underline">
        Integrations
      </Link>
      .
    </p>
  );
}

/* -------------------------------- steps ------------------------------ */

const unitOptions = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
] as const;

const dueOptions = [0, 1, 2, 3, 7, 14];

function segments(body: string) {
  // GSM-7 texts split at 160, or 153 once they need more than one part.
  const n = body.length;
  return n <= 160 ? 1 : Math.ceil(n / 153);
}

export function StepEditor({
  step,
  onChange,
  mode,
  pipeline,
  tags,
  team,
  error,
}: {
  step: WorkflowStep;
  onChange: (s: WorkflowStep) => void;
  mode: AccountMode;
  pipeline?: Pipeline;
  tags: string[];
  team: string[];
  error?: string;
}) {
  const id = useId();
  switch (step.type) {
    case "send_sms":
      return (
        <MergeField
          id={`${id}-body`}
          label="Message"
          multiline
          value={step.body}
          onChange={(body) => onChange({ ...step, body })}
          error={error}
          maxLength={640}
          placeholder="Hi {{first_name}}, …"
          hint={
            <span className="num">
              {step.body.length} characters · {segments(step.body)} {segments(step.body) === 1 ? "text" : "texts"}. Skipped for contacts with no phone or who opted out.
            </span>
          }
        />
      );
    case "send_email":
      return (
        <div className="flex flex-col gap-4">
          <MergeField id={`${id}-subject`} label="Subject" value={step.subject} onChange={(subject) => onChange({ ...step, subject })} error={!step.subject.trim() ? error : undefined} maxLength={150} />
          <MergeField
            id={`${id}-body`}
            label="Email"
            multiline
            rows={8}
            value={step.body}
            onChange={(body) => onChange({ ...step, body })}
            error={step.subject.trim() ? error : undefined}
            hint="Sent from the client's address with their footer and an unsubscribe link. Lands in the inbox thread."
          />
        </div>
      );
    case "add_tag":
    case "remove_tag":
      return (
        <Field label="Tag" htmlFor={`${id}-tag`} error={error}>
          <TagInput id={`${id}-tag`} value={step.tag} onChange={(tag) => onChange({ ...step, tag })} tags={tags} invalid={!!error} />
        </Field>
      );
    case "move_stage":
      return (
        <Field label="Move to" htmlFor={`${id}-stage`} error={error} hint="Skipped when the contact is already there.">
          <Select id={`${id}-stage`} value={step.stageId} onChange={(e) => onChange({ ...step, stageId: e.target.value })} aria-invalid={!!error || undefined}>
            <option value="">Pick a stage</option>
            {pipeline?.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "assign_owner":
      return (
        <Field label="Owner" htmlFor={`${id}-owner`} error={error}>
          <Select id={`${id}-owner`} value={step.ownerName} onChange={(e) => onChange({ ...step, ownerName: e.target.value })} aria-invalid={!!error || undefined}>
            <option value="">Pick a teammate</option>
            {team.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "create_task":
      return (
        <div className="flex flex-col gap-4">
          <MergeField id={`${id}-title`} label="Task" value={step.title} onChange={(title) => onChange({ ...step, title })} error={error} maxLength={160} hint="Lands in the client's task list." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="For" htmlFor={`${id}-who`}>
              <Select id={`${id}-who`} value={step.assigneeName ?? ""} onChange={(e) => onChange({ ...step, assigneeName: e.target.value || undefined })}>
                <option value="">Anyone</option>
                {team.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due" htmlFor={`${id}-due`}>
              <Select id={`${id}-due`} value={step.dueInDays} onChange={(e) => onChange({ ...step, dueInDays: Number(e.target.value) })}>
                {dueOptions.map((d) => (
                  <option key={d} value={d}>
                    {d === 0 ? "Same day" : d === 1 ? "Next day" : `In ${d} days`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      );
    case "notify":
      return (
        <div className="flex flex-col gap-4">
          <Field label="Tell" htmlFor={`${id}-to`} error={!step.to ? error : undefined}>
            <Select id={`${id}-to`} value={step.to} onChange={(e) => onChange({ ...step, to: e.target.value })} aria-invalid={(!step.to && !!error) || undefined}>
              <option value="">Pick a teammate</option>
              {team.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <MergeField id={`${id}-msg`} label="Note" multiline rows={3} value={step.message} onChange={(message) => onChange({ ...step, message })} error={step.to ? error : undefined} maxLength={500} hint="Internal only. Logged on the contact's timeline." />
        </div>
      );
    case "wait":
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Wait for</span>
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
            <Input
              aria-label="Amount"
              type="number"
              min={1}
              max={365}
              className="num"
              value={step.amount}
              onChange={(e) => onChange({ ...step, amount: Math.max(1, Math.min(365, Math.round(Number(e.target.value) || 1))) })}
            />
            <Select aria-label="Unit" value={step.unit} onChange={(e) => onChange({ ...step, unit: e.target.value as typeof step.unit })}>
              {unitOptions.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-fg-3">Contacts park here, then carry on. Pausing the workflow holds them where they are.</p>
        </div>
      );
    case "branch":
      return <ConditionEditor step={step} onChange={onChange} mode={mode} pipeline={pipeline} tags={tags} team={team} error={error} />;
    case "send_webhook":
      return <WebhookStepEditor step={step} onChange={onChange} error={error} />;
    case "app_action":
      return <AppActionEditor step={step} onChange={onChange} error={error} />;
  }
}

function WebhookStepEditor({ step, onChange, error }: { step: Extract<WorkflowStep, { type: "send_webhook" }>; onChange: (s: WorkflowStep) => void; error?: string }) {
  const id = useId();
  const o = useIntegrationOptions();
  const hook = o.hooksOut.find((h) => h.id === step.hookId);
  return (
    <div className="flex flex-col gap-3">
      <Field label="Webhook" htmlFor={`${id}-hook`} error={error}>
        <Select id={`${id}-hook`} value={step.hookId} onChange={(e) => onChange({ ...step, hookId: e.target.value })} aria-invalid={!!error || undefined}>
          <option value="">Pick a webhook</option>
          {o.hooksOut.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </Select>
        {!o.hooksOut.length && <NoneYet what="outgoing webhooks" tab="webhooks" />}
      </Field>
      {hook && <p className="num break-all rounded border border-line bg-surface-2/50 px-3 py-2 text-xs text-fg-2">POST {hook.url}</p>}
      <p className="text-xs leading-relaxed text-fg-3">Sends the contact as JSON (name, email, phone, tags, stage, value), signed with the webhook&apos;s secret. Every delivery and its response code shows in Integrations › Activity.</p>
    </div>
  );
}

function AppActionEditor({ step, onChange, error }: { step: Extract<WorkflowStep, { type: "app_action" }>; onChange: (s: WorkflowStep) => void; error?: string }) {
  const id = useId();
  const o = useIntegrationOptions();
  const app = findApp(step.app);
  const action = app?.actions.find((a) => a.key === step.action);
  const withActions = apps.filter((a) => a.actions.length);
  const connected = app ? o.connectedApps.includes(app.id) : true;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="App" htmlFor={`${id}-app`}>
          <Select
            id={`${id}-app`}
            value={step.app}
            onChange={(e) => {
              const next = findApp(e.target.value);
              onChange({ ...step, app: e.target.value, action: next?.actions.length === 1 ? next.actions[0]!.key : "", fields: {} });
            }}
            aria-invalid={(!step.app && !!error) || undefined}
          >
            <option value="">Pick an app</option>
            {withActions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {o.connectedApps.includes(a.id) ? "" : " (not connected)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Do" htmlFor={`${id}-action`}>
          <Select id={`${id}-action`} value={step.action} disabled={!app} onChange={(e) => onChange({ ...step, action: e.target.value, fields: {} })} aria-invalid={(!!step.app && !step.action && !!error) || undefined}>
            <option value="">Pick an action</option>
            {app?.actions.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {app && !connected && (
        <p role="alert" className="rounded border border-amber/25 bg-amber-soft/60 px-3 py-2 text-xs leading-relaxed text-amber">
          {app.name} isn&apos;t connected for this client. The step will fail until it is.{" "}
          <Link href="/agency/integrations?tab=apps" className="font-medium underline underline-offset-2">
            Connect it
          </Link>
        </p>
      )}
      {action?.fields.map((f, i) => {
        const v = step.fields[f.key] ?? "";
        const set = (value: string) => onChange({ ...step, fields: { ...step.fields, [f.key]: value } });
        const missing = !!error && !v.trim() && !f.hint?.startsWith("Leave empty") && action.fields.findIndex((x) => !(step.fields[x.key] ?? "").trim() && !x.hint?.startsWith("Leave empty")) === i;
        return f.merge ? (
          <MergeField key={f.key} id={`${id}-${f.key}`} label={f.label} value={v} onChange={set} multiline={f.multiline} rows={f.multiline ? 4 : undefined} placeholder={f.placeholder} hint={f.hint} error={missing ? error : undefined} maxLength={2000} contactTags />
        ) : (
          <Field key={f.key} label={f.label} htmlFor={`${id}-${f.key}`} hint={f.hint} error={missing ? error : undefined}>
            <Input id={`${id}-${f.key}`} value={v} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} maxLength={200} aria-invalid={missing || undefined} />
          </Field>
        );
      })}
      {action && <p className="text-xs leading-relaxed text-fg-3">Recorded in Integrations › Activity with exactly what was sent. Delivery to {app!.name} starts once its sign-in is live; nothing is sent from the demo.</p>}
    </div>
  );
}

const fields: ConditionField[] = ["tag", "stage", "source", "owner", "value", "has_email", "has_phone"];

function ConditionEditor({ step, onChange, mode, pipeline, tags, team, error }: { step: Extract<WorkflowStep, { type: "branch" }>; onChange: (s: WorkflowStep) => void; mode: AccountMode; pipeline?: Pipeline; tags: string[]; team: string[]; error?: string }) {
  const id = useId();
  const c = step.condition;
  const set = (patch: Partial<typeof c>) => onChange({ ...step, condition: { ...c, ...patch } });
  const boolean = c.field === "has_email" || c.field === "has_phone";
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed text-fg-3">Contacts who match go down Yes, everyone else down No. Both lanes then carry on with the steps below.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="If" htmlFor={`${id}-field`}>
          <Select id={`${id}-field`} value={c.field} onChange={(e) => {
            const field = e.target.value as ConditionField;
            set({ field, op: field === "value" ? "gte" : "is", value: "" });
          }}>
            {fields.map((f) => (
              <option key={f} value={f}>
                {f === "value" && mode === "fundraising" ? "Lifetime giving" : conditionFieldLabel[f]}
              </option>
            ))}
          </Select>
        </Field>
        {c.field !== "value" && (
          <Field label={boolean ? "Is" : "Test"} htmlFor={`${id}-op`}>
            <Select id={`${id}-op`} value={c.op} onChange={(e) => set({ op: e.target.value as typeof c.op })}>
              <option value="is">{boolean ? "Yes" : c.field === "tag" ? "Has" : "Is"}</option>
              <option value="is_not">{boolean ? "No" : c.field === "tag" ? "Doesn't have" : "Is not"}</option>
            </Select>
          </Field>
        )}
      </div>
      {c.field === "tag" && (
        <Field label="Tag" htmlFor={`${id}-v`} error={error}>
          <TagInput id={`${id}-v`} value={c.value} onChange={(value) => set({ value })} tags={tags} invalid={!!error} />
        </Field>
      )}
      {c.field === "stage" && (
        <Field label="Stage" htmlFor={`${id}-v`} error={error}>
          <Select id={`${id}-v`} value={c.value} onChange={(e) => set({ value: e.target.value })} aria-invalid={!!error || undefined}>
            <option value="">Pick a stage</option>
            {pipeline?.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {c.field === "source" && (
        <Field label="Source" htmlFor={`${id}-v`} error={error}>
          <Select id={`${id}-v`} value={c.value} onChange={(e) => set({ value: e.target.value })} aria-invalid={!!error || undefined}>
            <option value="">Pick a source</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {sourceLabel[s]}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {c.field === "owner" && (
        <Field label="Owner" htmlFor={`${id}-v`} hint="Leave on nobody to test for contacts without an owner.">
          <Select id={`${id}-v`} value={c.value} onChange={(e) => set({ value: e.target.value })}>
            <option value="">Nobody</option>
            {team.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {c.field === "value" && (
        <Field label="At least" htmlFor={`${id}-v`} error={error}>
          <MoneyInput id={`${id}-v`} value={c.value} onChange={(e) => set({ value: e.target.value.replace(/[^0-9.]/g, "") })} aria-invalid={!!error || undefined} />
        </Field>
      )}
    </div>
  );
}

/* ------------------------------- footer ------------------------------ */

const iconButton = "inline-flex h-7 items-center gap-1.5 rounded border border-line-strong px-2 text-xs font-medium text-fg hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40";

export function StepControls({ canUp, canDown, onUp, onDown, onRemove, label }: { canUp: boolean; canDown: boolean; onUp: () => void; onDown: () => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={iconButton} disabled={!canUp} onClick={onUp} aria-label={`Move ${label} up`}>
        <ArrowUp className="size-3.5" strokeWidth={1.75} />
        Up
      </button>
      <button type="button" className={iconButton} disabled={!canDown} onClick={onDown} aria-label={`Move ${label} down`}>
        <ArrowDown className="size-3.5" strokeWidth={1.75} />
        Down
      </button>
      <button type="button" className={cn(iconButton, "ml-auto hover:border-red/40 hover:text-red")} onClick={onRemove}>
        <Trash2 className="size-3.5" strokeWidth={1.75} />
        Remove step
      </button>
    </div>
  );
}


/** Pipeline, stage and status narrowing for the opportunity triggers. */
function OpportunityTriggerFields({ id, trigger, onChange, pipeline }: { id: string; trigger: WorkflowTrigger; onChange: (t: WorkflowTrigger) => void; pipeline?: Pipeline }) {
  const o = useIntegrationOptions();
  if (trigger.type !== "stage_changed" && trigger.type !== "opportunity_created" && trigger.type !== "opportunity_status_changed") return null;
  const pipelines = o.pipelines?.length ? o.pipelines : pipeline ? [pipeline] : [];
  const chosen = pipelines.find((p) => p.id === trigger.pipelineId) ?? (trigger.type === "stage_changed" ? pipelines.find((p) => p.primary) ?? pipeline : undefined);
  return (
    <>
      {pipelines.length > 1 && (
        <Field label="Pipeline" htmlFor={`${id}-pipeline`} hint={trigger.type === "stage_changed" ? "The primary pipeline is where every contact's stage lives." : "Leave on any pipeline to catch them all."}>
          <Select
            id={`${id}-pipeline`}
            value={trigger.pipelineId ?? ""}
            onChange={(e) => onChange({ ...trigger, pipelineId: e.target.value || undefined, stageId: undefined })}
          >
            <option value="">Any pipeline</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.primary ? " (primary)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {trigger.type === "stage_changed" && (
        <Field label="Moves to" htmlFor={`${id}-stage`}>
          <Select id={`${id}-stage`} value={trigger.stageId ?? ""} onChange={(e) => onChange({ ...trigger, stageId: e.target.value || undefined })}>
            <option value="">Any stage</option>
            {chosen?.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {trigger.type === "opportunity_status_changed" && (
        <Field label="Marked" htmlFor={`${id}-status`}>
          <Select id={`${id}-status`} value={trigger.status ?? ""} onChange={(e) => onChange({ ...trigger, status: (e.target.value || undefined) as OpportunityStatus | undefined })}>
            <option value="">Any status</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="abandoned">Abandoned</option>
            <option value="open">Reopened</option>
          </Select>
        </Field>
      )}
    </>
  );
}
