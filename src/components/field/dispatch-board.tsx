"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useOptimistic, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, GripVertical, List, Plus, UserPlus } from "lucide-react";
import { Avatar } from "@/components/diagnostic/primitives";
import { FormNotice, Input, SubmitButton } from "@/components/form";
import { ButtonLink } from "@/components/page-header";
import type { ActionState } from "@/app/agency/contacts/actions";
import { addDays, formatClock, formatDay, formatDuration, jobValue, minutesOf, stampAt } from "@/lib/field";
import type { Job, Technician } from "@/lib/types";
import { cn, formatDollars } from "@/lib/utils";
import { JobPanel, type JobActions, type JobLinks } from "./job-panel";
import type { CustomerRef, FieldClientRef } from "./model";
import { InkSelect, JobTag, PanelFrame, TopBar } from "./ui";

/*
 * Dispatch: one lane per technician across the working day, the queue of
 * unscheduled jobs on the left. Drag a card into a lane to book it, drag a
 * block along a lane to move it, drag it back to the queue to unbook it.
 * Every block also opens the job panel, which has the same scheduling as a
 * form, so nothing here needs a mouse.
 */

export interface DispatchActions extends JobActions {
  move: (id: string, start: string, technicianId: string) => Promise<void>;
  addTechnician: (accountId: string, prev: ActionState, fd: FormData) => Promise<ActionState>;
}

const SNAP = 15;

type Move = { id: string; start?: string; technicianIds: string[] };

function applyMove(jobs: Job[], m: Move): Job[] {
  return jobs.map((j) =>
    j.id !== m.id
      ? j
      : {
          ...j,
          start: m.start,
          technicianIds: m.technicianIds,
          status: m.start && m.technicianIds.length ? (j.status === "unscheduled" ? "scheduled" : j.status) : "unscheduled",
        },
  );
}

/** Stack overlapping jobs into sub-rows so nothing hides behind anything. */
function stack(jobs: Job[]) {
  const rows: number[] = [];
  const placed: { job: Job; row: number }[] = [];
  for (const job of [...jobs].sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))) {
    const from = minutesOf(job.start!);
    let row = rows.findIndex((end) => end <= from);
    if (row < 0) row = rows.length;
    rows[row] = from + job.durationMin;
    placed.push({ job, row });
  }
  return { placed, rows: Math.max(1, rows.length) };
}

const blockTone: Record<Job["status"], string> = {
  unscheduled: "border-dashed border-line-strong bg-surface",
  scheduled: "border-line-strong bg-surface hover:border-fg-3",
  en_route: "border-fg-3 bg-surface",
  in_progress: "border-fg bg-surface ring-1 ring-inset ring-fg",
  completed: "border-green/25 bg-green-soft/60 text-fg-2",
  canceled: "border-line bg-surface-2 text-fg-3 line-through",
};

export function DispatchBoard({
  clients,
  client,
  day,
  technicians,
  jobs,
  customers,
  links,
  actions,
}: {
  clients: FieldClientRef[];
  client: FieldClientRef;
  day: string;
  technicians: Technician[];
  jobs: Job[];
  customers: Record<string, CustomerRef>;
  links: Record<string, JobLinks>;
  actions: DispatchActions;
}) {
  const router = useRouter();
  const [optimistic, applyOptimistic] = useOptimistic(jobs, applyMove);
  const [, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; grab: number; duration: number } | null>(null);
  const [ghost, setGhost] = useState<{ tech: string; from: number } | null>(null);
  const [trayHot, setTrayHot] = useState(false);

  const isToday = day === client.today;
  const nowMin = minutesOf(client.nowStamp);
  const ofDay = optimistic.filter((j) => j.start?.slice(0, 10) === day && j.status !== "canceled" && j.technicianIds.length > 0);
  const queue = optimistic
    .filter((j) => j.status === "unscheduled")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Working window: 7am to 7pm, widened to fit anything booked outside it.
  const startHour = Math.max(5, Math.min(7, ...ofDay.map((j) => Math.floor(minutesOf(j.start!) / 60))));
  const endHour = Math.min(23, Math.max(19, ...ofDay.map((j) => Math.ceil((minutesOf(j.start!) + j.durationMin) / 60))));
  const from = startHour * 60;
  const span = (endHour - startHour) * 60;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const pct = (m: number) => `${((m - from) / span) * 100}%`;

  const lanes = technicians.map((t) => {
    const mine = ofDay.filter((j) => j.technicianIds.includes(t.id));
    return { tech: t, booked: mine.reduce((a, j) => a + j.durationMin, 0), ...stack(mine) };
  });

  const weekStart = addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const countOn = (d: string) => optimistic.filter((j) => j.start?.slice(0, 10) === d && j.status !== "canceled" && j.technicianIds.length > 0).length;

  const selected = optimistic.find((j) => j.id === selectedId) ?? null;
  const go = (params: { client?: string; day?: string }) => {
    const q = new URLSearchParams({ client: params.client ?? client.slug, day: params.day ?? day });
    router.push(`/agency/jobs/dispatch?${q.toString()}`);
  };

  const commit = (m: Move, server: () => Promise<void>) =>
    startTransition(async () => {
      applyOptimistic(m);
      await server();
    });

  const dropAt = (e: React.DragEvent<HTMLDivElement>, techId: string) => {
    if (!drag) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = from + ((e.clientX - rect.left) / rect.width) * span - drag.grab;
    const snapped = Math.round(raw / SNAP) * SNAP;
    const clamped = Math.max(from, Math.min(from + span - Math.min(drag.duration, span), snapped));
    return { tech: techId, from: clamped };
  };

  const startDrag = (e: React.DragEvent, job: Job, grab: number) => {
    e.dataTransfer.setData("text/plain", job.id);
    e.dataTransfer.effectAllowed = "move";
    setDrag({ id: job.id, grab, duration: job.durationMin });
  };
  const endDrag = () => {
    setDrag(null);
    setGhost(null);
    setTrayHot(false);
  };

  const booked = ofDay.length;
  const value = ofDay.reduce((a, j) => a + jobValue(j), 0);

  return (
    <div className="flex min-h-screen min-w-0 flex-col">
      <TopBar
        title="Dispatch"
        meta={
          <>
            {formatDay(day, { weekday: "long", month: "short", day: "numeric" })} · {booked} booked · {formatDollars(value)}
            {queue.length > 0 && <span className="font-medium text-amber-soft"> · {queue.length} to schedule</span>}
          </>
        }
      >
        <InkSelect label="Client" value={client.slug} onChange={(v) => go({ client: v, day: clients.find((c) => c.slug === v)?.today })} options={clients.map((c) => ({ value: c.slug, label: c.name }))} />
        <div className="flex items-center rounded border border-rail-line bg-rail-2">
          <button type="button" onClick={() => go({ day: addDays(day, -1) })} aria-label="Previous day" className="grid h-7 w-7 place-items-center text-rail-fg-2 hover:text-rail-fg">
            <ChevronLeft className="size-4" strokeWidth={2} />
          </button>
          <button type="button" onClick={() => go({ day: client.today })} disabled={isToday} className="h-7 border-x border-rail-line px-2.5 text-xs font-medium text-rail-fg disabled:text-rail-fg-2">
            Today
          </button>
          <button type="button" onClick={() => go({ day: addDays(day, 1) })} aria-label="Next day" className="grid h-7 w-7 place-items-center text-rail-fg-2 hover:text-rail-fg">
            <ChevronRight className="size-4" strokeWidth={2} />
          </button>
        </div>
        <Link href={`/agency/jobs?client=${client.slug}`} className="hidden h-7 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium text-rail-fg hover:bg-rail-line sm:inline-flex">
          <List className="size-3.5" strokeWidth={1.75} />
          <span className="hidden xl:inline">Jobs</span>
          <span className="sr-only xl:hidden">Jobs list</span>
        </Link>
        <ButtonLink href={`/agency/jobs/new?client=${client.slug}`} className="h-7 whitespace-nowrap px-2.5 text-xs">
          <Plus className="size-3.5" strokeWidth={2.25} />
          <span className="hidden xl:inline">New job</span>
          <span className="sr-only xl:hidden">New job</span>
        </ButtonLink>
      </TopBar>

      {/* Week strip */}
      <nav aria-label="Days" className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-b border-line px-5 py-3 md:px-6">
        {week.map((d) => {
          const active = d === day;
          const n = countOn(d);
          return (
            <Link
              key={d}
              href={`/agency/jobs/dispatch?client=${client.slug}&day=${d}`}
              aria-current={active ? "date" : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-2 rounded border px-2.5 text-xs transition-colors duration-150",
                active ? "border-rail bg-rail text-rail-fg" : "border-line-strong bg-surface text-fg-2 hover:border-fg-3 hover:text-fg",
              )}
            >
              <span className="font-medium">{formatDay(d, { weekday: "short", day: "numeric" })}</span>
              <span className={cn("num", active ? "text-rail-fg-2" : n ? "text-fg-3" : "text-line-strong")}>{n}</span>
              {d === client.today && <span className={cn("size-1.5 rounded-full", active ? "bg-rail-fg" : "bg-fg")} aria-label="today" />}
            </Link>
          );
        })}
        <div className="ml-auto hidden shrink-0 items-center gap-3 pl-4 text-2xs text-fg-3 lg:flex">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-[2px] border border-line-strong bg-surface" /> Booked</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-[2px] border border-fg bg-surface ring-1 ring-inset ring-fg" /> Under way</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-[2px] border border-green/25 bg-green-soft" /> Done</span>
        </div>
      </nav>

      {/* Desktop: queue + lanes */}
      <div className="hidden flex-1 md:grid md:grid-cols-[240px_minmax(0,1fr)]">
        <section
          aria-label="To schedule"
          onDragOver={(e) => {
            if (!drag || !optimistic.find((j) => j.id === drag.id)?.start) return;
            e.preventDefault();
            setTrayHot(true);
          }}
          onDragLeave={() => setTrayHot(false)}
          onDrop={(e) => {
            e.preventDefault();
            const id = drag?.id;
            endDrag();
            if (id) commit({ id, start: undefined, technicianIds: [] }, () => actions.unschedule(id));
          }}
          className={cn("flex flex-col gap-2 border-r border-line bg-bg px-4 py-4 transition-colors duration-150", trayHot && "bg-amber-soft/40")}
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">To schedule</h2>
            <span className="num text-xs text-fg-3">{queue.length}</span>
          </div>
          <p className="text-xs leading-relaxed text-fg-3">{trayHot ? "Drop to take it off the board." : "Drag a job onto a technician's lane."}</p>
          <ul className="flex flex-col gap-2">
            {queue.map((j) => (
              <li key={j.id}>
                <div
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => startDrag(e, j, 0)}
                  onDragEnd={endDrag}
                  onClick={() => setSelectedId(j.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelectedId(j.id))}
                  className={cn(
                    "group flex cursor-grab gap-2 rounded border border-dashed border-line-strong bg-surface p-2.5 transition-colors duration-150 hover:border-fg-3 active:cursor-grabbing",
                    drag?.id === j.id && "opacity-40",
                    selectedId === j.id && "border-solid border-brand bg-brand-soft/40",
                  )}
                >
                  <GripVertical className="mt-0.5 size-3.5 shrink-0 text-line-strong group-hover:text-fg-3" strokeWidth={2} />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{j.title}</span>
                    <span className="block truncate text-xs text-fg-3">{customers[j.contactId]?.name}</span>
                    <span className="num mt-1 flex justify-between text-2xs text-fg-3">
                      <span>{formatDuration(j.durationMin)}</span>
                      <span className="text-fg-2">{formatDollars(jobValue(j))}</span>
                    </span>
                  </div>
                </div>
              </li>
            ))}
            {queue.length === 0 && <li className="rounded border border-dashed border-line px-3 py-6 text-center text-xs text-fg-3">Every job has a slot.</li>}
          </ul>
        </section>

        <div className="min-w-0 overflow-x-auto bg-surface">
          <div className="min-w-[760px]">
            {/* Hour ruler */}
            <div className="sticky top-0 z-10 grid grid-cols-[176px_minmax(0,1fr)] border-b border-line bg-surface">
              <div className="px-4 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Technician</div>
              <div className="relative h-8">
                {hours.map((h, i) => (
                  <span
                    key={h}
                    className={cn("num absolute top-2 text-2xs text-fg-3", i === 0 ? "translate-x-1" : i === hours.length - 1 ? "-translate-x-full -ml-1" : "-translate-x-1/2")}
                    style={{ left: pct(h * 60) }}
                  >
                    {formatClock(h * 60)}
                  </span>
                ))}
                {isToday && nowMin >= from && nowMin <= from + span && (
                  <span className="absolute bottom-0 -translate-x-1/2 rounded-[3px] bg-fg px-1 text-[10px] font-medium leading-4 text-surface" style={{ left: pct(nowMin) }}>
                    {formatClock(nowMin - (nowMin % 5))}
                  </span>
                )}
              </div>
            </div>

            {lanes.map(({ tech, placed, rows, booked: mins }) => (
              <div key={tech.id} className="grid grid-cols-[176px_minmax(0,1fr)] border-b border-line">
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <Avatar person={tech} size="md" />
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium">{tech.name}</span>
                    <span className="num block truncate text-2xs text-fg-3" title={tech.role}>
                      {mins ? `${formatDuration(mins)} booked` : "Free all day"}
                    </span>
                  </div>
                </div>
                <div
                  className={cn("relative transition-colors duration-100", ghost?.tech === tech.id && "bg-surface-2/50")}
                  style={{ height: 16 + rows * 52 }}
                  onDragOver={(e) => {
                    if (!drag) return;
                    e.preventDefault();
                    setGhost(dropAt(e, tech.id));
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setGhost(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const spot = dropAt(e, tech.id);
                    const d = drag;
                    endDrag();
                    if (!d || !spot) return;
                    const job = optimistic.find((j) => j.id === d.id);
                    if (!job) return;
                    const start = stampAt(day, spot.from);
                    const kept = job.technicianIds.includes(tech.id) ? job.technicianIds : job.technicianIds.slice(1);
                    commit({ id: d.id, start, technicianIds: [tech.id, ...kept.filter((t) => t !== tech.id)] }, () => actions.move(d.id, start, tech.id));
                  }}
                >
                  {hours.map((h) => (
                    <span key={h} aria-hidden className="absolute inset-y-0 w-px bg-line" style={{ left: pct(h * 60) }} />
                  ))}
                  {isToday && nowMin >= from && nowMin <= from + span && <span aria-hidden className="absolute inset-y-0 z-[5] w-px bg-fg" style={{ left: pct(nowMin) }} />}
                  {ghost?.tech === tech.id && drag && (
                    <span
                      aria-hidden
                      className="absolute top-2 z-[4] flex h-12 items-start rounded border border-dashed border-fg-3 bg-surface-2 px-2 py-1"
                      style={{ left: pct(ghost.from), width: `calc(${(Math.min(drag.duration, from + span - ghost.from) / span) * 100}% - 3px)` }}
                    >
                      <span className="num text-2xs font-medium text-fg-2">{formatClock(ghost.from)}</span>
                    </span>
                  )}
                  {placed.map(({ job, row }) => {
                    const m = minutesOf(job.start!);
                    const width = (Math.min(job.durationMin, from + span - m) / span) * 100;
                    const customer = customers[job.contactId];
                    return (
                      <button
                        key={job.id}
                        type="button"
                        draggable={job.status !== "completed"}
                        onDragStart={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          const grab = Math.round((((e.clientX - r.left) / r.width) * job.durationMin) / SNAP) * SNAP;
                          startDrag(e, job, Math.min(grab, job.durationMin));
                        }}
                        onDragEnd={endDrag}
                        onClick={() => setSelectedId(job.id)}
                        title={`${job.title} · ${customer?.name ?? ""} · ${formatClock(m)}–${formatClock(m + job.durationMin)}`}
                        className={cn(
                          "absolute z-[6] flex h-12 flex-col justify-center overflow-hidden rounded border px-2 text-left transition-[box-shadow,border-color,opacity] duration-150",
                          job.status !== "completed" && "cursor-grab active:cursor-grabbing",
                          blockTone[job.status],
                          drag?.id === job.id && "opacity-40",
                          selectedId === job.id && "border-brand ring-2 ring-brand/30",
                        )}
                        style={{ left: pct(m), width: `calc(${width}% - 3px)`, top: 8 + row * 52 }}
                      >
                        <span className="flex items-center gap-1.5 truncate text-xs font-medium">
                          {(job.status === "in_progress" || job.status === "en_route") && (
                            <span aria-hidden className="relative inline-flex size-1.5 shrink-0">
                              <span className="absolute inset-0 rounded-full bg-fg motion-safe:animate-ping motion-safe:opacity-40" />
                              <span className="relative size-1.5 rounded-full bg-fg" />
                            </span>
                          )}
                          <span className="truncate">{job.title}</span>
                        </span>
                        <span className="num truncate text-2xs text-fg-3">
                          {formatClock(m)} · {customer?.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {technicians.length === 0 && <p className="px-6 py-10 text-center text-sm text-fg-3">No technicians yet. Add the first one below.</p>}
            <AddTechnician accountId={client.id} add={actions.addTechnician} />
          </div>
        </div>
      </div>

      {/* Mobile: agenda by technician */}
      <div className="flex flex-col gap-6 px-5 py-5 md:hidden">
        {queue.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="flex items-baseline justify-between text-sm font-semibold">
              To schedule <span className="num text-xs font-normal text-fg-3">{queue.length}</span>
            </h2>
            <ul className="overflow-hidden rounded border border-line bg-surface">
              {queue.map((j) => (
                <AgendaRow key={j.id} job={j} customer={customers[j.contactId]} onOpen={() => setSelectedId(j.id)} />
              ))}
            </ul>
          </section>
        )}
        {lanes.map(({ tech, placed, booked: mins }) => (
          <section key={tech.id} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Avatar person={tech} />
              {tech.name}
              <span className="num ml-auto text-xs font-normal text-fg-3">{mins ? `${formatDuration(mins)} booked` : "Free"}</span>
            </h2>
            {placed.length ? (
              <ul className="overflow-hidden rounded border border-line bg-surface">
                {placed
                  .map((p) => p.job)
                  .sort((a, b) => a.start!.localeCompare(b.start!))
                  .map((j) => (
                    <AgendaRow key={j.id} job={j} customer={customers[j.contactId]} onOpen={() => setSelectedId(j.id)} />
                  ))}
              </ul>
            ) : (
              <p className="rounded border border-dashed border-line-strong px-3 py-4 text-center text-xs text-fg-3">Nothing booked.</p>
            )}
          </section>
        ))}
      </div>

      {selected && (
        <PanelFrame label={selected.title} open sheet onClose={() => setSelectedId(null)}>
          {(close) => (
            <JobPanel
              key={selected.id}
              job={selected}
              client={client}
              customer={customers[selected.contactId]}
              crew={technicians}
              links={links[selected.id] ?? {}}
              actions={actions}
              onClose={close}
            />
          )}
        </PanelFrame>
      )}
    </div>
  );
}

function AgendaRow({ job, customer, onOpen }: { job: Job; customer?: CustomerRef; onOpen: () => void }) {
  const m = job.start ? minutesOf(job.start) : null;
  return (
    <li className="border-b border-line last:border-b-0">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-surface-2/60">
        <span className="num w-14 shrink-0 text-xs font-medium text-fg-2">{m === null ? formatDuration(job.durationMin) : formatClock(m)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{job.title}</span>
          <span className="block truncate text-xs text-fg-3">{customer?.name}</span>
        </span>
        <JobTag status={job.status} />
      </button>
    </li>
  );
}

function AddTechnician({ accountId, add }: { accountId: string; add: DispatchActions["addTechnician"] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(add.bind(null, accountId), null);
  if (!open) {
    return (
      <div className="px-4 py-3">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-2 hover:text-fg">
          <UserPlus className="size-3.5" strokeWidth={1.75} />
          Add technician
        </button>
      </div>
    );
  }
  return (
    <form
      action={formAction}
      className="flex flex-wrap items-start gap-2 px-4 py-3"
    >
      <Input name="name" aria-label="Name" placeholder="Full name" className="h-8 w-44 text-xs" aria-invalid={!!state?.errors?.name} />
      <Input name="role" aria-label="Role" placeholder="Role, e.g. Installer" className="h-8 w-40 text-xs" />
      <Input name="phone" aria-label="Phone" placeholder="Phone" className="num h-8 w-36 text-xs" />
      <SubmitButton variant="secondary" pendingLabel="Adding…" className="h-8 px-2.5 text-xs">
        Add
      </SubmitButton>
      <button type="button" onClick={() => setOpen(false)} className="h-8 px-1 text-xs text-fg-3 hover:text-fg">
        Done
      </button>
      {state?.errors?.name ? <p className="w-full text-xs text-red">{state.errors.name}</p> : <FormNotice state={state} />}
    </form>
  );
}
