"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Plus } from "lucide-react";
import { ButtonLink } from "@/components/page-header";
import { Avatar } from "@/components/diagnostic/primitives";
import { addDays, formatWhen, isOpenJob, jobStatusOrder, jobValue } from "@/lib/field";
import type { Job } from "@/lib/types";
import { formatCount, formatDollars, formatDollarsCompact } from "@/lib/utils";
import { JobPanel, type JobActions, type JobLinks } from "./job-panel";
import { crewFor, type Crew, type CustomerRef, type FieldClientRef } from "./model";
import { DataTable, InkLink, InkSelect, Kpi, KpiStrip, PanelFrame, TopBar, TwoLine, JobTag, useBoardState, useSorted, type Column } from "./ui";

/*
 * Jobs: every job across the field service clients. Top bar, four numbers,
 * the table, and the job panel. Dispatch is the same jobs laid out by
 * technician and hour.
 */

type Scope = "open" | "today" | "unscheduled" | "completed" | "all";

export interface JobsSummary {
  unpaidCents: number;
  overdueCount: number;
}

export function JobsBoard({
  jobs,
  clients,
  customers,
  crew,
  links,
  summary,
  initialClientId,
  initialScope,
  actions,
  dateLabel,
}: {
  jobs: Job[];
  clients: FieldClientRef[];
  customers: Record<string, CustomerRef>;
  crew: Crew;
  links: Record<string, JobLinks>;
  summary: Record<string, JobsSummary>;
  initialClientId?: string;
  initialScope?: Scope;
  actions: JobActions;
  dateLabel: string;
}) {
  const [clientId, setClientId] = useState(initialClientId ?? "all");
  const [scope, setScope] = useState<Scope>(initialScope ?? "open");
  const [query, setQuery] = useState("");
  const board = useBoardState<Job>({ key: "when", dir: "asc" });
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const today = (j: Job) => clientById.get(j.accountId)?.today ?? "";

  const inClient = useMemo(() => jobs.filter((j) => clientId === "all" || j.accountId === clientId), [jobs, clientId]);

  const columns: Column<Job>[] = [
    {
      key: "job",
      label: "Job",
      className: "min-w-[220px]",
      sort: (j) => j.title.toLowerCase(),
      cell: (j) => <TwoLine title={j.title} sub={`${j.number} · ${customers[j.contactId]?.name ?? "Unknown"}`} />,
    },
    { key: "client", label: "Client", className: "hidden max-w-[160px] truncate whitespace-nowrap text-fg-2 md:table-cell", sort: (j) => clientById.get(j.accountId)?.name ?? "", cell: (j) => clientById.get(j.accountId)?.name },
    { key: "status", label: "Status", sort: (j) => jobStatusOrder.indexOf(j.status), cell: (j) => <JobTag status={j.status} /> },
    {
      key: "when",
      label: "Scheduled",
      className: "hidden whitespace-nowrap sm:table-cell",
      // Unscheduled first: they are the ones a dispatcher has to place.
      sort: (j) => j.start ?? "0000",
      cell: (j) => <span className={j.start ? "num text-fg-2" : "text-fg-3"}>{formatWhen(j.start, j.durationMin, today(j))}</span>,
    },
    {
      key: "crew",
      label: "Crew",
      className: "hidden 2xl:table-cell",
      cell: (j) => {
        const people = crewFor(crew, j.technicianIds);
        return people.length ? (
          <span className="flex -space-x-1.5">
            {people.map((t) => (
              <Avatar key={t.id} person={t} />
            ))}
          </span>
        ) : (
          <span className="text-fg-3">–</span>
        );
      },
    },
    { key: "value", label: "Value", align: "right", className: "hidden sm:table-cell", defaultDir: "desc", sort: (j) => jobValue(j), cell: (j) => <span className="num">{formatDollars(jobValue(j))}</span> },
  ];

  const rows = useSorted(
    inClient
      .filter((j) => {
        switch (scope) {
          case "open": return isOpenJob(j);
          case "today": return j.start?.slice(0, 10) === today(j);
          case "unscheduled": return j.status === "unscheduled";
          case "completed": return j.status === "completed";
          case "all": return true;
        }
      })
      .filter((j) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        const c = customers[j.contactId];
        return [j.title, j.number, j.address, c?.name ?? "", c?.phone ?? "", clientById.get(j.accountId)?.name ?? ""].some((s) => s.toLowerCase().includes(q));
      }),
    columns,
    board.sort,
    (a, b) => a.number.localeCompare(b.number),
  );

  const selected = rows.find((j) => j.id === board.selectedId) ?? rows[0] ?? null;

  // KPIs follow the client filter, not the search or scope.
  const todays = inClient.filter((j) => j.start?.slice(0, 10) === today(j) && j.status !== "canceled");
  const done = todays.filter((j) => j.status === "completed").length;
  const live = todays.filter((j) => j.status === "in_progress" || j.status === "en_route").length;
  const unscheduled = inClient.filter((j) => j.status === "unscheduled");
  const week = inClient.filter((j) => j.status === "scheduled" && j.start && j.start.slice(0, 10) > today(j) && j.start.slice(0, 10) <= addDays(today(j), 7));
  const sums = Object.entries(summary).filter(([id]) => clientId === "all" || id === clientId).map(([, s]) => s);
  const unpaid = sums.reduce((a, s) => a + s.unpaidCents, 0);
  const overdue = sums.reduce((a, s) => a + s.overdueCount, 0);
  const client = clientId === "all" ? undefined : clientById.get(clientId);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title="Jobs"
          meta={
            <>
              {dateLabel} · {formatCount(todays.length)} today
              {unscheduled.length > 0 && <span className="font-medium text-amber-soft"> · {unscheduled.length} to schedule</span>}
            </>
          }
          search={{ value: query, onChange: setQuery, placeholder: "Search jobs, customers, addresses" }}
        >
          <InkSelect
            label="Client"
            value={clientId}
            onChange={(v) => {
              setClientId(v);
              board.setSelectedId(null);
            }}
            options={[{ value: "all", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <InkSelect<Scope>
            label="Show"
            value={scope}
            onChange={setScope}
            options={[
              { value: "open", label: "Open" },
              { value: "today", label: "Today" },
              { value: "unscheduled", label: "Unscheduled" },
              { value: "completed", label: "Completed" },
              { value: "all", label: "All jobs" },
            ]}
          />
          <InkLink href={client ? `/agency/jobs/dispatch?client=${client.slug}` : "/agency/jobs/dispatch"} icon={CalendarRange} label="Dispatch" />
          <ButtonLink href={client ? `/agency/jobs/new?client=${client.slug}` : "/agency/jobs/new"} className="h-7 whitespace-nowrap px-2.5 text-xs">
            <Plus className="size-3.5" strokeWidth={2.25} />
            <span className="hidden 2xl:inline">New job</span>
            <span className="sr-only 2xl:hidden">New job</span>
          </ButtonLink>
        </TopBar>

        <KpiStrip>
          <Kpi label="Today" value={formatCount(todays.length)} aside={`${done} done · ${live} under way`} />
          <Kpi label="To schedule" value={formatCount(unscheduled.length)} aside={`${formatDollarsCompact(unscheduled.reduce((a, j) => a + jobValue(j), 0))} waiting`} tone={unscheduled.length ? "amber" : undefined} />
          <Kpi label="Booked next 7 days" value={formatDollarsCompact(week.reduce((a, j) => a + jobValue(j), 0))} aside={`${formatCount(week.length)} jobs`} />
          <Kpi label="Unpaid invoices" value={formatDollarsCompact(unpaid)} aside={overdue ? `${overdue} overdue` : "None overdue"} tone={overdue ? "red" : undefined} />
        </KpiStrip>

        <DataTable
          columns={columns}
          rows={rows}
          sort={board.sort}
          onSort={board.setSort}
          selectedId={selected?.id}
          onSelect={board.select}
          empty={scope === "unscheduled" ? "Every job has a slot." : "No jobs match."}
        />
      </div>

      {selected && (
        <PanelFrame label={selected.title} open={board.panelOpen} onClose={() => board.setPanelOpen(false)}>
          {(close) => {
            const c = clientById.get(selected.accountId)!;
            return (
              <JobPanel
                key={selected.id}
                job={selected}
                client={c}
                customer={customers[selected.contactId]}
                crew={Object.values(crew).filter((t) => t.accountId === selected.accountId)}
                links={links[selected.id] ?? {}}
                actions={actions}
                onClose={close}
              />
            );
          }}
        </PanelFrame>
      )}
    </div>
  );
}
