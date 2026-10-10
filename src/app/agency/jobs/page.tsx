import { Suspense } from "react";
import { connection } from "next/server";
import { JobsBoard } from "@/components/field/jobs-board";
import { crewMap, customerRefs, fieldClientRefs, jobLinks, receivables, resolveClient } from "@/components/field/data";
import { Shell } from "@/components/shell";
import { listJobs } from "@/lib/data/field-store";
import { invoiceJobAction, scheduleJobAction, setJobStatusAction, unscheduleJobAction } from "./actions";

export const metadata = { title: "Jobs" };

type Scope = "open" | "today" | "unscheduled" | "completed" | "all";
const scopes: Scope[] = ["open", "today", "unscheduled", "completed", "all"];

async function Board({ searchParams }: { searchParams: Promise<{ client?: string; show?: string }> }) {
  const { client, show } = await searchParams;
  await connection();
  const now = new Date();
  const clients = fieldClientRefs(now);
  const jobs = listJobs(now);
  return (
    <JobsBoard
      jobs={jobs}
      clients={clients}
      customers={customerRefs(now, clients.map((c) => c.id))}
      crew={crewMap(now)}
      links={jobLinks(now, jobs, clients)}
      summary={receivables(now, clients)}
      initialClientId={resolveClient(clients, client)?.id}
      initialScope={scopes.includes(show as Scope) ? (show as Scope) : undefined}
      dateLabel={now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
      actions={{ schedule: scheduleJobAction, setStatus: setJobStatusAction, invoice: invoiceJobAction, unschedule: unscheduleJobAction }}
    />
  );
}

export default function JobsPage({ searchParams }: { searchParams: Promise<{ client?: string; show?: string }> }) {
  return (
    <Shell current="/agency/jobs">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
