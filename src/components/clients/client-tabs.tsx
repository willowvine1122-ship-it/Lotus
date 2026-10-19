"use client";

import { useActionState } from "react";
import { Check, Mail, Trash2 } from "lucide-react";
import { Field, FormNotice, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { Avatar, Tag } from "@/components/diagnostic/primitives";
import { NotesFeed } from "@/components/diagnostic/panel";
import type { ActionState } from "@/app/agency/clients/actions";
import type { Assignee, ClientRecord, Member, Task } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

/* Interactive sections of the client page: notes, tasks, team. */

type Bound = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function NotesTab({ client, nowIso, addNote }: { client: ClientRecord; nowIso: string; addNote: Bound }) {
  const [state, formAction] = useActionState(addNote, null);
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="max-w-[640px]">
        <NotesFeed notes={client.notes} now={new Date(nowIso)} />
      </div>
      <form action={formAction} key={state?.ok ? "reset" : "open"} className="flex h-fit flex-col gap-3 rounded border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold">Add a note</h3>
        <Field label="Note" htmlFor="body" error={state?.errors?.body} hint="Internal only. Read aloud in the client meeting; the client never sees it.">
          <Textarea id="body" name="body" placeholder="Call with Mike. He approved the new creative…" aria-invalid={!!state?.errors?.body} />
        </Field>
        <div>
          <SubmitButton pendingLabel="Saving…">Save note</SubmitButton>
        </div>
      </form>
    </div>
  );
}

const taskStatus: Record<Task["status"], string> = { todo: "To do", in_progress: "In progress", done: "Done" };

export function TasksTab({
  client,
  team,
  nowIso,
  addTask,
  toggleTask,
}: {
  client: ClientRecord;
  team: Assignee[];
  nowIso: string;
  addTask: Bound;
  toggleTask: (taskId: string, done: boolean) => Promise<void>;
}) {
  const [state, formAction] = useActionState(addTask, null);
  const today = nowIso.slice(0, 10);
  const open = client.tasks.filter((t) => t.status !== "done");
  const done = client.tasks.filter((t) => t.status === "done");
  const due = (iso?: string) => {
    if (!iso) return null;
    const label = new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (iso === today) return <span className="font-medium text-fg">due today</span>;
    if (iso < today) return <span className="font-medium text-fg">overdue since {label}</span>;
    return <span>due {label}</span>;
  };
  const Row = ({ t }: { t: Task }) => (
    <li className="flex items-start gap-3 border-b border-line py-2.5">
      <form action={() => toggleTask(t.id, t.status !== "done")}>
        <button
          type="submit"
          aria-label={t.status === "done" ? "Mark not done" : "Mark done"}
          className={cn(
            "mt-0.5 grid size-4 place-items-center rounded-[3px] border transition-colors duration-150",
            t.status === "done" ? "border-green bg-green text-white" : "border-line-strong bg-surface hover:border-fg-3",
          )}
        >
          {t.status === "done" && <Check className="size-3" strokeWidth={3} />}
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm", t.status === "done" && "text-fg-3 line-through")}>{t.title}</div>
        <div className="text-xs text-fg-3">
          {taskStatus[t.status]}
          {t.assigneeName && ` · ${t.assigneeName}`}
          {t.status !== "done" && t.dueOn && <> · {due(t.dueOn)}</>}
        </div>
      </div>
    </li>
  );
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="max-w-[640px]">
        <h3 className="text-sm font-semibold">
          Open <span className="num text-fg-3">({open.length})</span>
        </h3>
        {open.length === 0 ? <p className="py-3 text-sm text-fg-3">Nothing open.</p> : <ul>{open.map((t) => <Row key={t.id} t={t} />)}</ul>}
        {done.length > 0 && (
          <>
            <h3 className="mt-8 text-sm font-semibold">
              Done <span className="num text-fg-3">({done.length})</span>
            </h3>
            <ul>{done.map((t) => <Row key={t.id} t={t} />)}</ul>
          </>
        )}
      </div>
      <form action={formAction} key={state?.ok ? "reset" : "open"} className="flex h-fit flex-col gap-3 rounded border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold">Add a task</h3>
        <Field label="Task" htmlFor="title" error={state?.errors?.title}>
          <Input id="title" name="title" placeholder="Cap Meta daily budget at $500" aria-invalid={!!state?.errors?.title} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assignee" htmlFor="assignee">
            <Select id="assignee" name="assignee" defaultValue={client.assignees[0]?.name ?? ""}>
              <option value="">Unassigned</option>
              {team.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due" htmlFor="dueOn">
            <Input id="dueOn" name="dueOn" type="date" className="num" />
          </Field>
        </div>
        <div>
          <SubmitButton pendingLabel="Adding…">Add task</SubmitButton>
        </div>
      </form>
    </div>
  );
}

export function TeamTab({
  client,
  nowIso,
  invite,
  remove,
}: {
  client: ClientRecord;
  nowIso: string;
  invite: Bound;
  remove: (memberId: string) => Promise<void>;
}) {
  const [state, formAction] = useActionState(invite, null);
  const now = new Date(nowIso);
  const MemberRow = ({ m }: { m: Member }) => (
    <li className="flex items-center gap-3 border-b border-line py-3">
      <Avatar person={{ name: m.name, initials: m.initials, tone: m.tone }} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          {m.name}
          {m.invitedAt && <Tag tone="amber">Invited {timeAgo(m.invitedAt, now)}</Tag>}
        </div>
        <div className="truncate text-xs text-fg-3">{m.email}</div>
      </div>
      <span className="text-xs text-fg-2">{m.role === "client" ? "Client view" : m.role}</span>
      <form action={() => remove(m.id)}>
        <button type="submit" aria-label={`Remove ${m.name}`} className="grid size-7 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-red">
          <Trash2 className="size-4" strokeWidth={1.75} />
        </button>
      </form>
    </li>
  );
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex max-w-[640px] flex-col gap-8">
        <section>
          <h3 className="text-sm font-semibold">Lotus team on this account</h3>
          <p className="text-xs text-fg-3">See every number and every note. Change who is assigned in Settings.</p>
          <ul className="mt-2">
            {client.assignees.map((a) => (
              <li key={a.name} className="flex items-center gap-3 border-b border-line py-3">
                <Avatar person={a} size="md" />
                <span className="flex-1 text-sm font-medium">{a.name}</span>
                <span className="text-xs text-fg-2">Agency</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="text-sm font-semibold">Client logins</h3>
          <p className="text-xs text-fg-3">
            People at {client.account.name} who can open their own view: results and shared updates only, never internal notes.
          </p>
          {client.clientMembers.length === 0 ? (
            <p className="mt-3 rounded border border-dashed border-line-strong px-3.5 py-4 text-center text-xs text-fg-3">No client logins yet. Invite the main contact on the right.</p>
          ) : (
            <ul className="mt-2">
              {client.clientMembers.map((m) => (
                <MemberRow key={m.id} m={m} />
              ))}
            </ul>
          )}
        </section>
      </div>
      <form action={formAction} key={state?.ok ? "reset" : "open"} className="flex h-fit flex-col gap-3 rounded border border-line bg-surface p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="size-4 text-fg-3" strokeWidth={1.75} />
          Invite to the client view
        </h3>
        <Field label="Name" htmlFor="invite-name" error={state?.errors?.name}>
          <Input id="invite-name" name="name" placeholder="Mike Summit" aria-invalid={!!state?.errors?.name} />
        </Field>
        <Field label="Email" htmlFor="invite-email" error={state?.errors?.email} hint="They get a link to set a password and see this client's dashboard.">
          <Input id="invite-email" name="email" type="email" placeholder="mike@summitroofing.com" aria-invalid={!!state?.errors?.email} />
        </Field>
        <div className="flex items-center gap-3">
          <SubmitButton pendingLabel="Inviting…">Send invite</SubmitButton>
        </div>
        <FormNotice state={state} />
        {state?.link && <Input readOnly value={state.link} aria-label="Invite link" className="num text-xs" onFocus={(e) => e.currentTarget.select()} />}
      </form>
    </div>
  );
}
