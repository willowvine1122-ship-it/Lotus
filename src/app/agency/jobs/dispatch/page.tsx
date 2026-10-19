import { openWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import { connection } from "next/server";
import { DispatchBoard } from "@/components/field/dispatch-board";
import { customerRefs, fieldClientRefs, jobLinks, resolveClient } from "@/components/field/data";
import { Shell } from "@/components/shell";
import { listJobs, listTechnicians } from "@/lib/data/field-store";
import { addTechnicianAction, invoiceJobAction, moveJobAction, scheduleJobAction, setJobStatusAction, unscheduleJobAction } from "../actions";

export const metadata = { title: "Dispatch" };

async function Board({ searchParams }: { searchParams: Promise<{ client?: string; day?: string }> }) {
  const { client: key, day } = await searchParams;
  await connection();
  await openWorkspace();
  const now = new Date();
  const clients = fieldClientRefs(now);
  const client = resolveClient(clients, key) ?? clients[0];
  if (!client) return <p className="px-8 py-10 text-sm text-fg-3">No field service clients yet.</p>;
  const jobs = listJobs(now, client.id);
  return (
    <DispatchBoard
      key={`${client.id}-${day ?? client.today}`}
      clients={clients}
      client={client}
      day={day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : client.today}
      technicians={listTechnicians(now, client.id)}
      jobs={jobs}
      customers={customerRefs(now, [client.id])}
      links={jobLinks(now, jobs, [client])}
      actions={{ move: moveJobAction, unschedule: unscheduleJobAction, schedule: scheduleJobAction, setStatus: setJobStatusAction, invoice: invoiceJobAction, addTechnician: addTechnicianAction }}
    />
  );
}

export default function DispatchPage({ searchParams }: { searchParams: Promise<{ client?: string; day?: string }> }) {
  return (
    <Shell current="/agency/jobs">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
