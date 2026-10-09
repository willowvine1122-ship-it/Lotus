"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { CalendarClock, Check, ChevronDown, FileText, MapPin, Phone, Play, Receipt, SquareArrowOutUpRight, Truck } from "lucide-react";
import { Field, FormNotice, Input, Select, SubmitButton } from "@/components/form";
import { Avatar } from "@/components/diagnostic/primitives";
import type { ActionState } from "@/app/agency/contacts/actions";
import { formatDuration, formatWhen, jobValue, type InvoiceDisplay } from "@/lib/field";
import type { Job, JobStatus, Technician } from "@/lib/types";
import { cn, formatDollarsExact } from "@/lib/utils";
import { LineItems } from "./line-items";
import type { CustomerRef, FieldClientRef } from "./model";
import { CloseButton, InvoiceTag, JobTag, Ledger, LedgerRow, PanelButton, PanelLink, PanelSection } from "./ui";

/*
 * The job panel: where and when, who is going, what it is worth, and the one
 * next step (start, finish, invoice). Used beside the jobs table, over the
 * dispatch board, and at page width on the job page.
 */

export interface JobActions {
  schedule: (id: string, prev: ActionState, fd: FormData) => Promise<ActionState>;
  setStatus: (id: string, status: JobStatus) => Promise<void>;
  invoice: (id: string) => Promise<void>;
  unschedule: (id: string) => Promise<void>;
}

export interface JobLinks {
  estimate?: { id: string; number: string };
  invoice?: { id: string; number: string; status: InvoiceDisplay; balanceCents: number };
}

export const durations = [30, 45, 60, 90, 120, 180, 240, 300, 360, 480];

export function ScheduleForm({ job, client, crew, schedule }: { job: Job; client: FieldClientRef; crew: Technician[]; schedule: JobActions["schedule"] }) {
  const [state, formAction] = useActionState(schedule.bind(null, job.id), null);
  const e = state?.errors ?? {};
  const options = durations.includes(job.durationMin) ? durations : [...durations, job.durationMin].sort((a, b) => a - b);
  return (
    <form action={formAction} className="flex flex-col gap-3 rounded border border-line bg-surface p-3.5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor={`date-${job.id}`} error={e.date}>
          <Input id={`date-${job.id}`} name="date" type="date" defaultValue={job.start?.slice(0, 10) ?? client.today} className="num h-8 text-xs" />
        </Field>
        <Field label="Start" htmlFor={`time-${job.id}`} error={e.time}>
          <Input id={`time-${job.id}`} name="time" type="time" step={900} defaultValue={job.start?.slice(11, 16) ?? "09:00"} className="num h-8 text-xs" />
        </Field>
      </div>
      <Field label="Length" htmlFor={`dur-${job.id}`}>
        <Select id={`dur-${job.id}`} name="durationMin" defaultValue={job.durationMin} className="h-8 text-xs">
          {options.map((d) => (
            <option key={d} value={d}>
              {formatDuration(d)}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Who is going</legend>
        {crew.length === 0 ? (
          <p className="text-xs text-fg-3">No technicians yet. Add the crew from the dispatch board.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {crew.map((t) => (
              <label key={t.id} className="inline-flex h-8 cursor-pointer items-center gap-2 rounded border border-line-strong bg-surface pl-1 pr-2.5 text-xs has-[:checked]:border-rail has-[:checked]:bg-rail has-[:checked]:text-rail-fg">
                <input type="checkbox" name="technicianIds" value={t.id} defaultChecked={job.technicianIds.includes(t.id)} className="sr-only" />
                <Avatar person={t} />
                {t.name.split(" ")[0]}
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
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…" variant="secondary" className="h-7 px-2.5 text-xs">
          {job.status === "unscheduled" ? "Schedule" : "Save schedule"}
        </SubmitButton>
        <FormNotice state={state} />
      </div>
    </form>
  );
}

export function NextStep({ job, links, actions }: { job: Job; links: JobLinks; actions: JobActions }) {
  const [pending, start] = useTransition();
  const go = (s: JobStatus) => start(() => actions.setStatus(job.id, s));
  const buttons: React.ReactNode[] = [];
  switch (job.status) {
    case "scheduled":
      buttons.push(
        <PanelButton key="start" tone="ink" disabled={pending} onClick={() => go("in_progress")}>
          <Play className="size-3.5" strokeWidth={2} /> Start job
        </PanelButton>,
        <PanelButton key="otw" disabled={pending} onClick={() => go("en_route")}>
          <Truck className="size-3.5" strokeWidth={1.75} /> On the way
        </PanelButton>,
      );
      break;
    case "en_route":
      buttons.push(
        <PanelButton key="start" tone="ink" disabled={pending} onClick={() => go("in_progress")}>
          <Play className="size-3.5" strokeWidth={2} /> Start job
        </PanelButton>,
      );
      break;
    case "in_progress":
      buttons.push(
        <PanelButton key="done" tone="ink" disabled={pending} onClick={() => go("completed")}>
          <Check className="size-3.5" strokeWidth={2.25} /> Mark complete
        </PanelButton>,
      );
      break;
    case "completed":
      buttons.push(
        links.invoice ? (
          <PanelLink key="inv" href={`/agency/invoices/${links.invoice.id}`}>
            <Receipt className="size-3.5" strokeWidth={1.75} /> Open {links.invoice.number}
          </PanelLink>
        ) : (
          <PanelButton key="inv" tone="ink" disabled={pending} onClick={() => start(() => actions.invoice(job.id))}>
            <Receipt className="size-3.5" strokeWidth={1.75} /> Create invoice
          </PanelButton>
        ),
      );
      break;
    case "canceled":
      buttons.push(
        <PanelButton key="reopen" disabled={pending} onClick={() => go(job.start && job.technicianIds.length ? "scheduled" : "unscheduled")}>
          Reopen job
        </PanelButton>,
      );
      break;
  }
  if (buttons.length === 0) return null;
  return <div className="flex flex-wrap items-center gap-2">{buttons}</div>;
}

export function CancelJob({ job, actions }: { job: Job; actions: JobActions }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  if (job.status === "completed" || job.status === "canceled") return null;
  return (
    <div className="flex items-center gap-3 border-t border-line pt-4 text-xs">
      {confirming ? (
        <>
          <span className="text-fg-2">Cancel {job.number}? The customer&apos;s timeline will show it.</span>
          <button type="button" disabled={pending} onClick={() => start(() => actions.setStatus(job.id, "canceled"))} className="font-medium text-red hover:underline disabled:opacity-50">
            Cancel job
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="text-fg-3 hover:text-fg">
            Keep it
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="text-fg-3 hover:text-red">
          Cancel job
        </button>
      )}
    </div>
  );
}

export function JobHeader({ job, client, customer, onClose, link = true }: { job: Job; client: FieldClientRef; customer?: CustomerRef; onClose?: () => void; link?: boolean }) {
  return (
    <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-line bg-surface px-5 pb-4 pt-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="num text-xs text-fg-3">{job.number}</span>
            <JobTag status={job.status} />
          </div>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold leading-6 tracking-tight">
            <span className="truncate">{job.title}</span>
            {link && (
              <Link href={`/agency/jobs/${job.id}`} aria-label="Open job" className="text-fg-3 hover:text-fg">
                <SquareArrowOutUpRight className="size-4" strokeWidth={1.75} />
              </Link>
            )}
          </h2>
          <p className="truncate text-xs text-fg-3">
            {customer ? (
              <Link href={`/agency/contacts/${customer.id}`} className="font-medium text-fg-2 hover:underline">
                {customer.name}
              </Link>
            ) : (
              "Unknown customer"
            )}
            {" · "}
            <Link href={`/agency/clients/${client.slug}`} className="hover:underline">
              {client.name}
            </Link>
          </p>
        </div>
        {onClose && <CloseButton onClose={onClose} />}
      </div>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 self-start text-xs text-fg-2 hover:text-fg hover:underline"
      >
        <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
        {job.address}
      </a>
    </header>
  );
}

export function JobSchedule({ job, client, crew, actions, defaultOpen }: { job: Job; client: FieldClientRef; crew: Technician[]; actions: JobActions; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? job.status === "unscheduled");
  const going = crew.filter((t) => job.technicianIds.includes(t.id));
  const editable = job.status !== "completed" && job.status !== "canceled";
  return (
    <PanelSection
      title="Schedule"
      aside={
        editable && (
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-xs text-fg-2 hover:text-fg">
            <CalendarClock className="size-3.5" strokeWidth={1.75} />
            {job.status === "unscheduled" ? "Schedule" : "Reschedule"}
            <ChevronDown className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")} strokeWidth={2} />
          </button>
        )
      }
    >
      <Ledger>
        <LedgerRow label="When">
          <span className={cn("num", !job.start && "font-medium text-amber")}>{formatWhen(job.start, job.durationMin, client.today)}</span>
        </LedgerRow>
        <LedgerRow label="Length">
          <span className="num">{formatDuration(job.durationMin)}</span>
        </LedgerRow>
        <LedgerRow label="Crew">
          {going.length ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="flex -space-x-1.5">
                {going.map((t) => (
                  <Avatar key={t.id} person={t} />
                ))}
              </span>
              <span className="truncate">{going.map((t) => t.name.split(" ")[0]).join(", ")}</span>
            </span>
          ) : (
            <span className="text-fg-3">Nobody yet</span>
          )}
        </LedgerRow>
      </Ledger>
      {editable && open && <ScheduleForm key={`${job.id}-${job.start}-${job.technicianIds.join()}`} job={job} client={client} crew={crew} schedule={actions.schedule} />}
    </PanelSection>
  );
}

export function JobLinksSection({ job, links }: { job: Job; links: JobLinks }) {
  if (!links.estimate && !links.invoice) return null;
  return (
    <PanelSection title="Paperwork">
      <Ledger>
        {links.estimate && (
          <LedgerRow label="Estimate">
            <Link href={`/agency/estimates/${links.estimate.id}`} className="num inline-flex items-center gap-1.5 hover:underline">
              <FileText className="size-3.5 text-fg-3" strokeWidth={1.75} />
              {links.estimate.number}
            </Link>
          </LedgerRow>
        )}
        {links.invoice && (
          <LedgerRow label="Invoice">
            <Link href={`/agency/invoices/${links.invoice.id}`} className="num inline-flex items-center gap-2 hover:underline">
              {links.invoice.number}
              <InvoiceTag status={links.invoice.status} />
              {links.invoice.balanceCents > 0 && <span className="text-xs text-fg-3">{formatDollarsExact(links.invoice.balanceCents)} due</span>}
            </Link>
          </LedgerRow>
        )}
      </Ledger>
      {job.status === "completed" && !links.invoice && <p className="text-xs text-fg-3">Not invoiced yet.</p>}
    </PanelSection>
  );
}

export function CustomerSection({ customer }: { customer?: CustomerRef }) {
  if (!customer) return null;
  return (
    <PanelSection
      title="Customer"
      aside={
        <Link href={`/agency/contacts/${customer.id}`} className="text-xs text-fg-2 hover:text-fg">
          Timeline
        </Link>
      }
    >
      <Ledger>
        <LedgerRow label="Name">{customer.name}</LedgerRow>
        <LedgerRow label="Phone">
          {customer.phone ? (
            <a href={`tel:${customer.phone}`} className="num inline-flex items-center gap-1 hover:underline">
              <Phone className="size-3 text-fg-3" strokeWidth={1.75} />
              {customer.phone}
            </a>
          ) : (
            <span className="text-fg-3">–</span>
          )}
        </LedgerRow>
        <LedgerRow label="Email">{customer.email ? <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a> : <span className="text-fg-3">–</span>}</LedgerRow>
      </Ledger>
    </PanelSection>
  );
}

export function JobPanel({ job, client, customer, crew, links, actions, onClose }: { job: Job; client: FieldClientRef; customer?: CustomerRef; crew: Technician[]; links: JobLinks; actions: JobActions; onClose?: () => void }) {
  return (
    <div className="flex min-h-full flex-col">
      <JobHeader job={job} client={client} customer={customer} onClose={onClose} />
      <div className="flex flex-col gap-6 px-5 py-5">
        <NextStep job={job} links={links} actions={actions} />
        <JobSchedule key={job.id} job={job} client={client} crew={crew} actions={actions} />
        <PanelSection title="Work" aside={<span className="num text-xs text-fg-3">{formatDollarsExact(jobValue(job))} before tax</span>}>
          <LineItems items={job.lineItems} compact />
        </PanelSection>
        {job.notes && (
          <PanelSection title="Notes for the crew">
            <p className="rounded border border-line bg-surface-2/40 px-3.5 py-2.5 text-sm leading-relaxed text-fg-2">{job.notes}</p>
          </PanelSection>
        )}
        <JobLinksSection job={job} links={links} />
        <CustomerSection customer={customer} />
        <CancelJob job={job} actions={actions} />
      </div>
    </div>
  );
}

export function JobNotesForm({ job, save }: { job: Job; save: (id: string, prev: ActionState, fd: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(save.bind(null, job.id), null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label htmlFor={`notes-${job.id}`} className="sr-only">
        Notes for the crew
      </label>
      <textarea
        id={`notes-${job.id}`}
        name="notes"
        defaultValue={job.notes}
        placeholder="Gate codes, pets, parking, parts to bring."
        className="min-h-[88px] w-full rounded border border-line-strong bg-surface px-3 py-2 text-sm leading-relaxed text-fg placeholder:text-fg-3 hover:border-fg-3 focus:border-brand focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <SubmitButton variant="secondary" pendingLabel="Saving…" className="h-7 px-2.5 text-xs">
          Save notes
        </SubmitButton>
        <FormNotice state={state} />
      </div>
    </form>
  );
}
