"use client";

import Link from "next/link";
import { useActionState, useTransition } from "react";
import { Ban, Calendar, CircleDollarSign, FileText, Mail, MessageSquare, Pencil, Phone, Sparkles, SquareArrowOutUpRight, StickyNote, X, type LucideIcon } from "lucide-react";
import { Field, FormNotice, Select, SubmitButton, Textarea } from "@/components/form";
import { Avatar, SectionTitle, Tag } from "@/components/diagnostic/primitives";
import type { ActionState } from "@/app/agency/contacts/actions";
import type { ActivityKind, Assignee, Contact, ContactActivity, Pipeline } from "@/lib/types";
import { cn, formatDollars, timeAgo } from "@/lib/utils";
import { fullName, personFor, sourceLabel, stageOf, type ClientRef } from "./model";

/*
 * The contact panel: who they are, where they are in the pipeline, what has
 * happened, and a place to log the next thing. Used on the right of the
 * contacts board and the pipeline, and at page width on the contact page.
 */

export interface ContactActions {
  moveStage: (id: string, stageId: string) => Promise<void>;
  logActivity: (id: string, prev: ActionState, fd: FormData) => Promise<ActionState>;
  toggleDnd: (id: string, channel: "email" | "sms" | "call") => Promise<void>;
}

const kindIcon: Record<ActivityKind, LucideIcon> = {
  call: Phone,
  sms: MessageSquare,
  email: Mail,
  form: FileText,
  appointment: Calendar,
  donation: CircleDollarSign,
  note: StickyNote,
  stage: Sparkles,
  task: FileText,
};

export function StageSelect({ contact, pipeline, moveStage, className }: { contact: Contact; pipeline: Pipeline; moveStage: ContactActions["moveStage"]; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Pipeline stage"
      value={contact.stageId}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        start(() => moveStage(contact.id, v));
      }}
      className={cn("h-7 rounded border border-line-strong bg-surface px-2 text-xs font-medium text-fg focus:border-fg focus:outline-none disabled:opacity-60", className)}
    >
      {pipeline.stages.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

export function PanelHeader({ contact, client, pipeline, now, actions, onClose, link = true }: { contact: Contact; client: ClientRef; pipeline: Pipeline; now: Date; actions: ContactActions; onClose?: () => void; link?: boolean }) {
  const stage = stageOf(pipeline, contact.stageId);
  return (
    <header className="sticky top-0 z-10 flex flex-col gap-2.5 border-b border-line bg-surface px-5 pb-4 pt-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 tracking-tight">
            <span className="truncate">{fullName(contact)}</span>
            {link && (
              <Link href={`/agency/contacts/${contact.id}`} aria-label="Open contact" className="text-fg-3 hover:text-fg">
                <SquareArrowOutUpRight className="size-4" strokeWidth={1.75} />
              </Link>
            )}
          </h2>
          <p className="truncate text-xs text-fg-3">
            {[contact.company, contact.city].filter(Boolean).join(" · ") || "No company or city"}
            {" · "}
            <Link href={`/agency/clients/${client.slug}`} className="hover:underline">
              {client.name}
            </Link>
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
            <X className="size-4" strokeWidth={2} />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <StageSelect contact={contact} pipeline={pipeline} moveStage={actions.moveStage} />
        {stage.outcome === "won" && <Tag tone="neutral">{client.mode === "marketing" ? "Customer" : "Recurring"}</Tag>}
        {contact.tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
        <span className="num ml-auto text-2xs text-fg-3">Added {timeAgo(contact.createdAt, now)}</span>
      </div>
    </header>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
      <span className="shrink-0 text-xs text-fg-3">{label}</span>
      <span className="min-w-0 truncate text-right text-fg">{children}</span>
    </div>
  );
}

export function ContactDetails({ contact, client, team, actions }: { contact: Contact; client: ClientRef; team: Assignee[]; actions: ContactActions }) {
  const owner = personFor(team, contact.ownerName);
  const [, start] = useTransition();
  const channels: { key: "email" | "sms" | "call"; label: string }[] = [
    { key: "email", label: "Email" },
    { key: "sms", label: "Text" },
    { key: "call", label: "Call" },
  ];
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle
        aside={
          <Link href={`/agency/contacts/${contact.id}/edit`} className="inline-flex items-center gap-1 text-xs text-fg-2 hover:text-fg">
            <Pencil className="size-3.5" strokeWidth={1.75} />
            Edit
          </Link>
        }
      >
        Details
      </SectionTitle>
      <div className="rounded border border-line bg-surface-2/40 px-3.5">
        <Row label="Email">{contact.email ? <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a> : <span className="text-fg-3">–</span>}</Row>
        <Row label="Phone">{contact.phone ? <a href={`tel:${contact.phone}`} className="num hover:underline">{contact.phone}</a> : <span className="text-fg-3">–</span>}</Row>
        <Row label="Source">{sourceLabel[contact.source]}</Row>
        <Row label={client.mode === "marketing" ? "Job value" : "Lifetime giving"}>
          <span className="num">{contact.valueCents ? formatDollars(contact.valueCents) : <span className="text-fg-3">–</span>}</span>
        </Row>
        {client.mode === "fundraising" && <Row label="Monthly giving">{contact.recurring ? "Active" : <span className="text-fg-3">No</span>}</Row>}
        <Row label="Owner">
          {owner ? (
            <span className="inline-flex items-center gap-1.5">
              <Avatar person={owner} /> {owner.name}
            </span>
          ) : (
            <span className="text-fg-3">Unassigned</span>
          )}
        </Row>
      </div>
      <div className="flex items-center gap-1.5 pt-1">
        <span className="mr-1 text-xs text-fg-3">Do not</span>
        {channels.map((ch) => {
          const on = contact.doNotContact[ch.key];
          return (
            <button
              key={ch.key}
              type="button"
              aria-pressed={on}
              onClick={() => start(() => actions.toggleDnd(contact.id, ch.key))}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-[4px] border px-2 text-2xs font-medium transition-colors duration-150",
                on ? "border-rail bg-rail text-rail-fg" : "border-line-strong bg-surface text-fg-2 hover:border-fg-3",
              )}
            >
              {on && <Ban className="size-3" strokeWidth={2} />}
              {ch.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function LogActivityForm({ contact, logActivity }: { contact: Contact; logActivity: ContactActions["logActivity"] }) {
  const [state, formAction] = useActionState(logActivity.bind(null, contact.id), null);
  return (
    <form action={formAction} className="flex flex-col gap-3 rounded border border-line bg-surface p-3.5">
      <div className="grid grid-cols-[120px_minmax(0,1fr)] items-end gap-3">
        <Field label="Log" htmlFor={`kind-${contact.id}`} error={state?.errors?.kind}>
          <Select id={`kind-${contact.id}`} name="kind" defaultValue="note" className="h-8 text-xs">
            <option value="note">Note</option>
            <option value="call">Call</option>
            <option value="sms">Text</option>
            <option value="email">Email</option>
          </Select>
        </Field>
        <div className="pb-1 text-xs text-fg-3">Sending from here arrives with the Inbox. For now, log what happened.</div>
      </div>
      <Field label="What happened" htmlFor={`body-${contact.id}`} error={state?.errors?.body}>
        <Textarea id={`body-${contact.id}`} name="body" placeholder="Spoke with Mike, wants the estimate by Friday." className="min-h-[72px]" aria-invalid={!!state?.errors?.body} />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…" className="h-7 px-2.5 text-xs">
          Save
        </SubmitButton>
        <FormNotice state={state} />
      </div>
    </form>
  );
}

export function ActivityTimeline({ activities, now }: { activities: ContactActivity[]; now: Date }) {
  const groups = new Map<string, ContactActivity[]>();
  for (const a of activities) {
    const key = a.at.slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  if (activities.length === 0) {
    return <p className="rounded border border-dashed border-line-strong px-3.5 py-4 text-center text-xs text-fg-3">Nothing logged yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {[...groups.entries()].map(([day, as]) => (
        <li key={day} className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
            <span className="h-px flex-1 bg-line" />
            {new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            <span className="h-px flex-1 bg-line" />
          </div>
          {as.map((a) => {
            const Icon = kindIcon[a.kind];
            return (
              <article key={a.id} className="flex gap-3 rounded border border-line bg-surface-2/40 p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface text-fg-2 ring-1 ring-line">
                  <Icon className="size-3.5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">{a.title}</span>
                    {a.amountCents ? <span className="num text-sm">{formatDollars(a.amountCents)}</span> : null}
                    <time dateTime={a.at} className="ml-auto shrink-0 text-2xs text-fg-3">
                      {a.by ? `${a.by} · ` : ""}
                      {timeAgo(a.at, now)}
                    </time>
                  </div>
                  {a.body && <p className="mt-1 text-sm leading-relaxed text-fg-2">{a.body}</p>}
                </div>
              </article>
            );
          })}
        </li>
      ))}
    </ol>
  );
}

export function ContactPanel({ contact, client, pipeline, activities, team, now, actions, onClose }: { contact: Contact; client: ClientRef; pipeline: Pipeline; activities: ContactActivity[]; team: Assignee[]; now: Date; actions: ContactActions; onClose?: () => void }) {
  return (
    <div className="flex min-h-full flex-col">
      <PanelHeader contact={contact} client={client} pipeline={pipeline} now={now} actions={actions} onClose={onClose} />
      <div className="flex flex-col gap-6 px-5 py-5">
        <ContactDetails contact={contact} client={client} team={team} actions={actions} />
        <section className="flex flex-col gap-3">
          <SectionTitle sub="Everything that has happened, newest first.">Activity</SectionTitle>
          <LogActivityForm contact={contact} logActivity={actions.logActivity} />
          <ActivityTimeline activities={activities} now={now} />
        </section>
      </div>
    </div>
  );
}
