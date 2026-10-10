"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import {
  Field,
  FormNotice,
  Input,
  Select,
  SubmitButton,
} from "@/components/form";
import { Avatar, Segmented } from "@/components/diagnostic/primitives";
import { Kpi, KpiStrip, TopBar } from "@/components/field/ui";
import type { ActionState } from "@/app/agency/tasks/actions";
import type { Assignee, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/* Every client's tasks on one board: the ink bar, four KPIs, one table, the add panel. */

export interface TaskRow extends Task {
  clientId: string;
  clientName: string;
  clientSlug: string;
  assignee?: Assignee;
}

type View = "open" | "mine" | "done";

export function TasksBoard({
  tasks,
  clients,
  team,
  nowIso,
  me,
  actions,
}: {
  tasks: TaskRow[];
  clients: { id: string; name: string }[];
  team: Assignee[];
  nowIso: string;
  me: string;
  actions: {
    toggle: (clientId: string, taskId: string, done: boolean) => Promise<void>;
    add: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  };
}) {
  const [view, setView] = useState<View>("open");
  const [query, setQuery] = useState("");
  const [state, formAction] = useActionState(actions.add, null);
  const today = nowIso.slice(0, 10);
  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.dueOn && t.dueOn < today);
  const dueToday = open.filter((t) => t.dueOn === today);
  const mine = open.filter((t) => t.assigneeName === me);
  const q = query.trim().toLowerCase();
  const rows = (
    view === "open"
      ? open
      : view === "mine"
        ? mine
        : tasks.filter((t) => t.status === "done")
  )
    .filter(
      (t) =>
        !q ||
        `${t.title} ${t.clientName} ${t.assigneeName ?? ""}`
          .toLowerCase()
          .includes(q),
    )
    .sort(
      (a, b) =>
        (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999") ||
        a.clientName.localeCompare(b.clientName),
    );

  const due = (t: TaskRow) => {
    if (!t.dueOn) return <span className="text-fg-3">No date</span>;
    const label = new Date(`${t.dueOn}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (t.status === "done") return <span className="text-fg-3">{label}</span>;
    if (t.dueOn < today)
      return <span className="font-medium text-red">{label} · overdue</span>;
    if (t.dueOn === today)
      return <span className="font-medium text-amber">Today</span>;
    return <span>{label}</span>;
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title="Tasks"
          meta={`${open.length} open across ${clients.length} clients`}
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search tasks, clients, people",
          }}
        >
          <Segmented
            tone="ink"
            label="Show"
            value={view}
            onChange={setView}
            options={[
              { value: "open", label: "Open" },
              { value: "mine", label: `Mine ${mine.length}` },
              { value: "done", label: "Done" },
            ]}
          />
        </TopBar>
        <KpiStrip>
          <Kpi
            label="Open"
            value={String(open.length)}
            aside={`${open.filter((t) => !t.dueOn).length} undated`}
          />
          <Kpi
            label="Overdue"
            value={String(overdue.length)}
            aside={overdue.length ? "past their date" : "none"}
            tone={overdue.length ? "red" : undefined}
          />
          <Kpi
            label="Due today"
            value={String(dueToday.length)}
            aside={dueToday.length ? "still open" : "none"}
            tone={dueToday.length ? "amber" : undefined}
          />
          <Kpi
            label="Done"
            value={String(tasks.filter((t) => t.status === "done").length)}
            aside="all time"
          />
        </KpiStrip>
        <div className="min-w-0 overflow-x-auto px-5 pb-8 md:px-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                {["", "Task", "Client", "Assignee", "Due"].map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3",
                      i === 0 && "w-8 pl-0",
                      i === 1 && "md:w-[44%]",
                      i >= 2 && "hidden md:table-cell",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-sm text-fg-3"
                  >
                    {view === "done"
                      ? "Nothing finished yet."
                      : "Nothing open."}
                  </td>
                </tr>
              )}
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className="h-[52px] border-b border-line transition-colors duration-100 hover:bg-surface-2/60"
                >
                  <td className="px-3 pl-0">
                    <form
                      action={() =>
                        actions.toggle(t.clientId, t.id, t.status !== "done")
                      }
                    >
                      <button
                        type="submit"
                        aria-label={
                          t.status === "done"
                            ? `Reopen ${t.title}`
                            : `Mark ${t.title} done`
                        }
                        className={cn(
                          "grid size-4 place-items-center rounded-[3px] border transition-colors duration-150",
                          t.status === "done"
                            ? "border-green bg-green text-white"
                            : "border-line-strong bg-surface hover:border-fg-3",
                        )}
                      >
                        {t.status === "done" && (
                          <Check className="size-3" strokeWidth={3} />
                        )}
                      </button>
                    </form>
                  </td>
                  <td className="max-w-0 px-3 py-2 md:w-[44%]">
                    <div
                      className={cn(
                        "truncate font-medium",
                        t.status === "done" &&
                          "font-normal text-fg-3 line-through",
                      )}
                    >
                      {t.title}
                    </div>
                    <div className="num truncate text-xs text-fg-3 md:hidden">
                      {t.clientName}
                      {t.assigneeName && ` · ${t.assigneeName}`}
                      <span className="ml-1">· {due(t)}</span>
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 md:table-cell">
                    <Link
                      href={`/agency/clients/${t.clientSlug}?tab=tasks`}
                      className="text-fg-2 hover:text-fg hover:underline"
                    >
                      {t.clientName}
                    </Link>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 md:table-cell">
                    {t.assignee ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar person={t.assignee} size="xs" />
                        <span className="text-fg-2">{t.assignee.name}</span>
                      </span>
                    ) : (
                      <span className="text-fg-3">Unassigned</span>
                    )}
                  </td>
                  <td className="num hidden whitespace-nowrap px-3 text-xs md:table-cell">
                    {due(t)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <aside className="w-full border-t border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-[360px] lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0 xl:w-[384px] 2xl:w-[420px]">
        <form
          action={formAction}
          key={state?.ok ? "reset" : "open"}
          className="flex flex-col gap-3 p-5"
        >
          <h3 className="text-sm font-semibold">Add a task</h3>
          <Field
            label="Client"
            htmlFor="clientId"
            error={state?.errors?.clientId}
          >
            <Select
              id="clientId"
              name="clientId"
              defaultValue={clients[0]?.id ?? ""}
              aria-invalid={!!state?.errors?.clientId}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Task" htmlFor="title" error={state?.errors?.title}>
            <Input
              id="title"
              name="title"
              placeholder="Send October report draft"
              aria-invalid={!!state?.errors?.title}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Assignee" htmlFor="assignee">
              <Select id="assignee" name="assignee" defaultValue={me}>
                <option value="">Unassigned</option>
                {team.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due" htmlFor="dueOn">
              <Input id="dueOn" name="dueOn" type="date" min={today} />
            </Field>
          </div>
          <FormNotice state={state} />
          <div>
            <SubmitButton pendingLabel="Adding…">Add task</SubmitButton>
          </div>
        </form>
      </aside>
    </div>
  );
}
