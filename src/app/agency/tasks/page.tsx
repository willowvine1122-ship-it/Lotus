import { openWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import { connection } from "next/server";
import { TasksBoard, type TaskRow } from "@/components/tasks/tasks-board";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { listClients, teamDirectory } from "@/lib/data/store";
import { addTaskAction, toggleTaskAction } from "./actions";

export const metadata = { title: "Tasks" };

async function Board() {
  await connection();
  const session = await openWorkspace();
  const now = new Date();
  const clients = listClients(now);
  const tasks: TaskRow[] = clients.flatMap((c) =>
    c.tasks.map((t) => ({
      ...t,
      clientId: c.account.id,
      clientName: c.account.name,
      clientSlug: c.account.slug,
      assignee: teamDirectory().find((a) => a.name === t.assigneeName),
    })),
  );
  return (
    <TasksBoard
      tasks={tasks}
      clients={clients.map((c) => ({ id: c.account.id, name: c.account.name })).sort((a, b) => a.name.localeCompare(b.name))}
      team={teamDirectory()}
      nowIso={now.toISOString()}
      me={session.user.name}
      actions={{ toggle: toggleTaskAction, add: addTaskAction }}
    />
  );
}

export default function TasksPage() {
  return (
    <Shell current="/agency/tasks">
      <Suspense fallback={<PageHeader title="Tasks" meta={<span className="text-fg-3">Loading…</span>} />}>
        <Board />
      </Suspense>
    </Shell>
  );
}
