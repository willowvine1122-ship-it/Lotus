import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { DiagnosticCard } from "@/components/diagnostic-card";
import { getClientDetail } from "@/lib/data/agency";
import { cn } from "@/lib/utils";

const statusLabel = { todo: "To do", in_progress: "In progress", done: "Done" } as const;

async function ClientDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  const detail = await getClientDetail(slug);
  if (!detail) notFound();
  const { account, diagnostics, notes, tasks } = detail;
  const today = diagnostics[0] ?? null;

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {account.mode === "marketing" ? "Digital marketing" : "Digital fundraising"} sub-account
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <DiagnosticCard
            overview={{
              account,
              diagnostic: today,
              latestNote: notes[0] ?? null,
              openTasks: tasks.filter((t) => t.status !== "done").length,
            }}
          />

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Notes</h2>
            <ul className="flex flex-col gap-3">
              {notes.length === 0 && <li className="text-sm text-muted">No notes yet.</li>}
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted">
                    <span className="font-medium text-foreground">{n.authorName}</span>
                    <span>
                      {new Date(n.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      {n.internalOnly && " · internal"}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{n.body}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Tasks</h2>
          <ul className="flex flex-col gap-2">
            {tasks.length === 0 && <li className="text-sm text-muted">No tasks.</li>}
            {tasks.map((t) => (
              <li
                key={t.id}
                className={cn(
                  "rounded-lg border border-border bg-surface px-3 py-2 text-sm",
                  t.status === "done" && "text-muted line-through",
                )}
              >
                <div>{t.title}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {statusLabel[t.status]}
                  {t.assigneeName && ` · ${t.assigneeName}`}
                  {t.dueOn && ` · due ${t.dueOn}`}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}

export default function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <ClientDetail params={params} />
      </Suspense>
    </div>
  );
}
