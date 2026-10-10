"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  ArrowRightLeft,
  CircleDollarSign,
  Flag,
  Pencil,
  Sparkles,
  SquareArrowOutUpRight,
  StickyNote,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Field,
  FormNotice,
  Input,
  MoneyInput,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/form";
import { Avatar, SectionTitle, Tag } from "@/components/diagnostic/primitives";
import { personFor, sourceLabel, type ClientRef } from "@/components/crm/model";
import type { OppActionState } from "@/app/agency/opportunities/actions";
import type {
  Assignee,
  ContactSource,
  Opportunity,
  OpportunityEvent,
  OpportunityStatus,
  Pipeline,
} from "@/lib/types";
import { cn, formatDollars, timeAgo } from "@/lib/utils";
import {
  daysBetween,
  daysIn,
  probabilityOf,
  stageDurations,
  stageFor,
  staleTone,
  statusLabel,
  type ContactRef,
} from "./model";

/*
 * The opportunity panel: the deal, where it sits, what moves it next, and
 * how it got here. Right of the board and list; a sheet on small screens.
 * The caller keys it by opportunity id, so switching deals resets the edit
 * and confirm states.
 */

export interface OpportunityActions {
  move: (id: string, stageId: string) => Promise<void>;
  setStatus: (
    id: string,
    status: OpportunityStatus,
    lostReason?: string,
  ) => Promise<OppActionState>;
  update: (
    id: string,
    prev: OppActionState,
    fd: FormData,
  ) => Promise<OppActionState>;
  addNote: (
    id: string,
    prev: OppActionState,
    fd: FormData,
  ) => Promise<OppActionState>;
  remove: (id: string) => Promise<void>;
}

const eventIcon: Record<OpportunityEvent["kind"], LucideIcon> = {
  created: Sparkles,
  stage: ArrowRightLeft,
  status: Flag,
  value: CircleDollarSign,
  owner: UserRound,
  note: StickyNote,
};

const sources: ContactSource[] = [
  "meta",
  "google",
  "website",
  "referral",
  "donation-page",
  "import",
  "manual",
];

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "red" | "amber" | null;
}) {
  return (
    <div className="min-w-0 rounded border border-line bg-surface-2/50 px-3 py-2.5">
      <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
        {label}
      </div>
      <div
        className={cn(
          "num mt-0.5 truncate text-lg font-semibold leading-6",
          tone === "red" && "text-red",
          tone === "amber" && "text-amber",
        )}
      >
        {value}
      </div>
      {sub && <div className="num truncate text-xs text-fg-3">{sub}</div>}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
      <span className="shrink-0 text-xs text-fg-3">{label}</span>
      <span className="min-w-0 truncate text-right text-fg">{children}</span>
    </div>
  );
}

const quiet =
  "inline-flex h-7 items-center gap-1.5 rounded border border-line-strong bg-surface px-2.5 text-xs font-medium text-fg transition-colors duration-150 hover:border-fg-3 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";

/** Won, Lost (with a reason), Abandon; or Reopen once it is closed. */
function StatusActions({
  o,
  reasons,
  setStatus,
}: {
  o: Opportunity;
  reasons: string[];
  setStatus: OpportunityActions["setStatus"];
}) {
  const [pending, start] = useTransition();
  const [losing, setLosing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = (status: OpportunityStatus, why?: string) =>
    start(async () => {
      const r = await setStatus(o.id, status, why);
      if (r && !r.ok)
        setError(r.errors?.lostReason ?? r.message ?? "Could not save");
      else setLosing(false);
    });

  if (o.status !== "open") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-fg-2">
          {statusLabel[o.status]}
          {o.lostReason ? `: ${o.lostReason}` : ""}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("open")}
          className={cn(quiet, "ml-auto")}
        >
          Reopen
        </button>
      </div>
    );
  }
  if (losing) {
    return (
      <div className="flex flex-col gap-2 rounded border border-line bg-surface-2/50 p-2.5">
        <label htmlFor={`reason-${o.id}`} className="text-xs font-medium">
          Why was it lost?
        </label>
        <div className="flex gap-2">
          <Select
            id={`reason-${o.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-8 flex-1 text-xs"
            aria-invalid={!!error}
          >
            <option value="">Pick a reason</option>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <button
            type="button"
            disabled={pending || !reason}
            onClick={() => run("lost", reason)}
            className="inline-flex h-8 items-center rounded bg-rail px-3 text-xs font-medium text-rail-fg hover:bg-rail-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark lost
          </button>
          <button
            type="button"
            onClick={() => setLosing(false)}
            className="h-8 px-1 text-xs text-fg-3 hover:text-fg"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red">{error}</p>}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => run("won")}
        className="inline-flex h-7 items-center justify-center rounded bg-rail px-2.5 text-xs font-medium text-rail-fg transition-colors duration-150 hover:bg-rail-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Won
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setLosing(true)}
        className={cn(quiet, "justify-center")}
      >
        Lost
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run("abandoned")}
        className={cn(quiet, "justify-center")}
      >
        Abandon
      </button>
    </div>
  );
}

/** The stage path: every stage of the pipeline, the time spent in each, the current one in ink. */
function StagePath({
  o,
  pipeline,
  now,
}: {
  o: Opportunity;
  pipeline: Pipeline;
  now: Date;
}) {
  const spent = stageDurations(o, now);
  const open = pipeline.stages.filter((s) => !s.outcome);
  const curIndex = open.findIndex((s) => s.id === o.stageId);
  const closed = stageFor(pipeline, o.stageId).outcome;
  return (
    <ol
      className="grid gap-px overflow-hidden rounded border border-line bg-line"
      style={{ gridTemplateColumns: `repeat(${open.length}, minmax(0, 1fr))` }}
      aria-label="Stage path"
    >
      {open.map((s, i) => {
        const current = s.id === o.stageId;
        const passed = closed ? spent.has(s.id) : i < curIndex;
        const d = spent.get(s.id);
        return (
          <li
            key={s.id}
            aria-current={current ? "step" : undefined}
            className={cn(
              "min-w-0 px-1.5 py-1.5",
              current
                ? "bg-rail text-rail-fg"
                : passed
                  ? "bg-surface-2"
                  : "bg-surface",
            )}
          >
            <span
              className={cn(
                "block truncate text-2xs font-medium",
                current ? "text-rail-fg" : passed ? "text-fg-2" : "text-fg-3",
              )}
              title={s.name}
            >
              {s.name}
            </span>
            <span
              className={cn(
                "num block text-2xs",
                current ? "text-rail-fg-2" : "text-fg-3",
              )}
            >
              {d === undefined ? "–" : d < 1 ? "<1d" : `${Math.round(d)}d`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function EditForm({
  o,
  team,
  update,
  onDone,
}: {
  o: Opportunity;
  team: Assignee[];
  update: OpportunityActions["update"];
  onDone: () => void;
}) {
  const [state, action] = useActionState(
    async (prev: OppActionState, fd: FormData) => {
      const r = await update(o.id, prev, fd);
      if (r?.ok) onDone();
      return r;
    },
    null,
  );
  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded border border-line bg-surface p-3.5"
    >
      <Field label="Name" htmlFor={`name-${o.id}`} error={state?.errors?.name}>
        <Input
          id={`name-${o.id}`}
          name="name"
          defaultValue={o.name}
          className="h-8 text-sm"
          aria-invalid={!!state?.errors?.name}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Value"
          htmlFor={`value-${o.id}`}
          error={state?.errors?.value}
        >
          <MoneyInput
            id={`value-${o.id}`}
            name="value"
            defaultValue={
              o.valueCents ? String(Math.round(o.valueCents / 100)) : ""
            }
            className="h-8 text-sm"
          />
        </Field>
        <Field
          label="Expected close"
          htmlFor={`close-${o.id}`}
          error={state?.errors?.closeOn}
        >
          <Input
            id={`close-${o.id}`}
            name="closeOn"
            type="date"
            defaultValue={o.closeOn ?? ""}
            className="num h-8 text-sm"
          />
        </Field>
        <Field label="Owner" htmlFor={`owner-${o.id}`}>
          <Select
            id={`owner-${o.id}`}
            name="ownerName"
            defaultValue={o.ownerName ?? ""}
            className="h-8 text-sm"
          >
            <option value="">Unassigned</option>
            {team.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source" htmlFor={`source-${o.id}`}>
          <Select
            id={`source-${o.id}`}
            name="source"
            defaultValue={o.source}
            className="h-8 text-sm"
          >
            {sources.map((s) => (
              <option key={s} value={s}>
                {sourceLabel[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Tags" htmlFor={`tags-${o.id}`} hint="Separate with commas.">
        <Input
          id={`tags-${o.id}`}
          name="tags"
          defaultValue={o.tags.join(", ")}
          className="h-8 text-sm"
        />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…" className="h-7 px-2.5 text-xs">
          Save
        </SubmitButton>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-fg-2 hover:text-fg"
        >
          Cancel
        </button>
        <FormNotice state={state && !state.ok ? state : null} />
      </div>
    </form>
  );
}

function NoteForm({
  o,
  addNote,
}: {
  o: Opportunity;
  addNote: OpportunityActions["addNote"];
}) {
  // React resets the uncontrolled form after the action, so the note clears on save.
  const [state, action] = useActionState(addNote.bind(null, o.id), null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor={`note-${o.id}`} className="sr-only">
        Note
      </label>
      <Textarea
        id={`note-${o.id}`}
        name="body"
        placeholder="What was agreed, what happens next"
        className="min-h-[64px]"
        aria-invalid={!!state?.errors?.body}
      />
      {state?.errors?.body && (
        <p className="text-xs text-red">{state.errors.body}</p>
      )}
      <div>
        <SubmitButton
          variant="secondary"
          pendingLabel="Saving…"
          className="h-7 px-2.5 text-xs"
        >
          Add note
        </SubmitButton>
      </div>
    </form>
  );
}

function History({
  events,
  pipeline,
  now,
}: {
  events: OpportunityEvent[];
  pipeline: Pipeline;
  now: Date;
}) {
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <ol className="relative flex flex-col">
      {sorted.map((e, i) => {
        const Icon = eventIcon[e.kind];
        const stage = e.stageId ? stageFor(pipeline, e.stageId) : null;
        return (
          <li
            key={`${e.at}-${i}`}
            className="relative flex gap-3 pb-3 last:pb-0"
          >
            {i < sorted.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[13px] top-7 h-[calc(100%-24px)] w-px bg-line"
              />
            )}
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface text-fg-2 ring-1 ring-line">
              <Icon className="size-3.5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium">
                  {e.kind === "note" ? "Note" : e.label}
                </span>
                <time
                  dateTime={e.at}
                  className="ml-auto shrink-0 text-2xs text-fg-3"
                >
                  {e.by ? `${e.by} · ` : ""}
                  {timeAgo(e.at, now)}
                </time>
              </div>
              {e.body && (
                <p className="mt-0.5 text-sm leading-relaxed text-fg-2">
                  {e.body}
                </p>
              )}
              {stage &&
                stage.probability !== undefined &&
                e.kind !== "note" && (
                  <p className="num text-2xs text-fg-3">
                    {stage.probability}% likely to close
                  </p>
                )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function OpportunityPanel({
  o,
  pipeline,
  contact,
  client,
  related,
  pipelines,
  reasons,
  team,
  now,
  actions,
  onSelect,
  onClose,
}: {
  o: Opportunity;
  pipeline: Pipeline;
  contact?: ContactRef;
  client: ClientRef;
  related: Opportunity[];
  pipelines: Pipeline[];
  reasons: string[];
  team: Assignee[];
  now: Date;
  actions: OpportunityActions;
  onSelect: (o: Opportunity) => void;
  onClose?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stage = stageFor(pipeline, o.stageId);
  const tone = staleTone(o, pipeline, now);
  const owner = personFor(team, o.ownerName);
  const prob = probabilityOf(pipeline, o);
  const d = daysIn(o, now);
  const age = daysBetween(o.createdAt, o.closedAt ?? now.toISOString());
  const closeLate =
    o.status === "open" &&
    o.closeOn &&
    o.closeOn < now.toISOString().slice(0, 10);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-2.5 border-b border-line bg-surface px-5 pb-4 pt-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-6 tracking-tight [text-wrap:balance]">
              {o.name}
            </h2>
            <p className="truncate text-xs text-fg-3">
              {contact ? (
                <Link
                  href={`/agency/contacts/${contact.id}`}
                  className="inline-flex items-center gap-1 text-fg-2 hover:text-fg hover:underline"
                >
                  {contact.name}
                  <SquareArrowOutUpRight
                    className="size-3"
                    strokeWidth={1.75}
                  />
                </Link>
              ) : (
                "Contact removed"
              )}
              {" · "}
              {client.name}
              {" · "}
              {pipeline.name}
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-7 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label="Stage"
            value={o.stageId}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              start(() => actions.move(o.id, v));
            }}
            className="h-7 rounded border border-line-strong bg-surface px-2 text-xs font-medium text-fg focus:border-fg focus:outline-none disabled:opacity-60"
          >
            {pipeline.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {o.status !== "open" && (
            <Tag tone="neutral">{statusLabel[o.status]}</Tag>
          )}
          {tone && <Tag tone="amber">{`${d} days in ${stage.name}`}</Tag>}
          {o.tags.map((t) => (
            <Tag key={t} tone="neutral">
              {t}
            </Tag>
          ))}
        </div>
        <StatusActions o={o} reasons={reasons} setStatus={actions.setStatus} />
      </header>

      <div className="flex flex-col gap-6 px-5 py-5">
        <div className="grid grid-cols-2 gap-2">
          <Tile
            label="Value"
            value={o.valueCents ? formatDollars(o.valueCents) : "–"}
            sub={
              o.status === "open"
                ? `${formatDollars(Math.round((o.valueCents * prob) / 100))} weighted`
                : statusLabel[o.status]
            }
          />
          <Tile
            label="Chance to close"
            value={`${prob}%`}
            sub={o.status === "open" ? `in ${stage.name}` : "closed"}
          />
          <Tile
            label="In this stage"
            value={`${d} ${d === 1 ? "day" : "days"}`}
            sub={`Watch after ${pipeline.staleDays ?? 14}`}
            tone={tone}
          />
          <Tile
            label={o.closedAt ? "Days to close" : "Age"}
            value={`${age} ${age === 1 ? "day" : "days"}`}
            sub={`Opened ${new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
          />
        </div>

        <section className="flex flex-col gap-2">
          <SectionTitle sub="Time spent in each stage.">
            Stage path
          </SectionTitle>
          <StagePath o={o} pipeline={pipeline} now={now} />
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle
            aside={
              !editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 text-xs text-fg-2 hover:text-fg"
                >
                  <Pencil className="size-3.5" strokeWidth={1.75} />
                  Edit
                </button>
              )
            }
          >
            Details
          </SectionTitle>
          {editing ? (
            <EditForm
              o={o}
              team={team}
              update={actions.update}
              onDone={() => setEditing(false)}
            />
          ) : (
            <div className="rounded border border-line bg-surface-2/40 px-3.5">
              <Row label="Owner">
                {owner ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar person={owner} size="xs" /> {owner.name}
                  </span>
                ) : (
                  <span className="text-fg-3">Unassigned</span>
                )}
              </Row>
              <Row label="Source">{sourceLabel[o.source]}</Row>
              <Row label="Expected close">
                {o.closeOn ? (
                  <span className={cn("num", closeLate && "text-amber")}>
                    {new Date(`${o.closeOn}T12:00:00`).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                    {closeLate ? " · past due" : ""}
                  </span>
                ) : (
                  <span className="text-fg-3">–</span>
                )}
              </Row>
              <Row label="Email">
                {contact?.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="hover:underline"
                  >
                    {contact.email}
                  </a>
                ) : (
                  <span className="text-fg-3">–</span>
                )}
              </Row>
              <Row label="Phone">
                {contact?.phone ? (
                  <a
                    href={`tel:${contact.phone}`}
                    className="num hover:underline"
                  >
                    {contact.phone}
                  </a>
                ) : (
                  <span className="text-fg-3">–</span>
                )}
              </Row>
            </div>
          )}
        </section>

        {related.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionTitle
              sub={`${contact?.name.split(" ")[0] ?? "This contact"} has ${related.length} more.`}
            >
              Other opportunities
            </SectionTitle>
            <ul className="divide-y divide-line rounded border border-line">
              {related.map((r) => {
                const rp = pipelines.find((p) => p.id === r.pipelineId);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(r)}
                      className="flex w-full items-baseline gap-3 px-3 py-2 text-left hover:bg-surface-2/60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {r.name}
                        </span>
                        <span className="block truncate text-xs text-fg-3">
                          {rp?.name} ·{" "}
                          {r.status === "open"
                            ? stageFor(rp, r.stageId).name
                            : statusLabel[r.status]}
                        </span>
                      </span>
                      <span className="num shrink-0 text-sm">
                        {r.valueCents ? formatDollars(r.valueCents) : "–"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <SectionTitle sub="Moves, status changes and notes, newest first.">
            Activity
          </SectionTitle>
          <NoteForm o={o} addNote={actions.addNote} />
          <History events={o.history} pipeline={pipeline} now={now} />
        </section>

        <div className="border-t border-line pt-4">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-fg-2">
                Delete this opportunity? The contact stays.
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => start(() => actions.remove(o.id))}
                className="inline-flex h-7 items-center rounded bg-red px-2.5 font-medium text-white hover:bg-red/90"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-fg-3 hover:text-fg"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 text-xs text-fg-3 hover:text-red"
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
              Delete opportunity
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
