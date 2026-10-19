"use client";

import { useMemo, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { ButtonLink } from "@/components/page-header";
import { dayDiff, estimateDisplay, estimateRange, estimateValue, type EstimateDisplay } from "@/lib/field";
import type { Estimate } from "@/lib/types";
import { cn, formatCount, formatDollars, formatDollarsCompact, timeAgo } from "@/lib/utils";
import { EstimatePanel, type EstimateActions } from "./estimate-panel";
import type { CustomerRef, FieldClientRef } from "./model";
import { DataTable, EstimateTag, InkLink, InkSelect, Kpi, KpiStrip, PanelFrame, TopBar, TwoLine, useBoardState, useSorted, type Column } from "./ui";

/* Estimates: what is out with customers, what came back, and what to chase. */

type Scope = "open" | "chase" | "approved" | "closed" | "all";

const order: EstimateDisplay[] = ["draft", "sent", "expired", "approved", "converted", "declined"];

export function EstimatesBoard({
  estimates,
  clients,
  customers,
  jobNumbers,
  initialClientId,
  actions,
  nowIso,
}: {
  estimates: Estimate[];
  clients: FieldClientRef[];
  customers: Record<string, CustomerRef>;
  jobNumbers: Record<string, string>;
  initialClientId?: string;
  actions: EstimateActions;
  nowIso: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [clientId, setClientId] = useState(initialClientId ?? "all");
  const [scope, setScope] = useState<Scope>("open");
  const [query, setQuery] = useState("");
  const board = useBoardState<Estimate>({ key: "sent", dir: "desc" });
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const today = (e: Estimate) => clientById.get(e.accountId)?.today ?? "";
  const display = (e: Estimate) => estimateDisplay(e, today(e));
  const waitingDays = (e: Estimate) => (e.sentAt ? Math.floor((now.getTime() - new Date(e.sentAt).getTime()) / 86400000) : 0);
  const needsChase = (e: Estimate) => display(e) === "sent" && waitingDays(e) >= 7;

  const inClient = useMemo(() => estimates.filter((e) => clientId === "all" || e.accountId === clientId), [estimates, clientId]);

  const columns: Column<Estimate>[] = [
    { key: "estimate", label: "Estimate", className: "min-w-[220px]", sort: (e) => e.title.toLowerCase(), cell: (e) => <TwoLine title={e.title} sub={`${e.number} · ${customers[e.contactId]?.name ?? "Unknown"}`} /> },
    { key: "client", label: "Client", className: "hidden max-w-[160px] truncate whitespace-nowrap text-fg-2 md:table-cell", sort: (e) => clientById.get(e.accountId)?.name ?? "", cell: (e) => clientById.get(e.accountId)?.name },
    { key: "status", label: "Status", sort: (e) => order.indexOf(display(e)), cell: (e) => <EstimateTag status={display(e)} /> },
    {
      key: "options",
      label: "Options",
      className: "hidden whitespace-nowrap xl:table-cell",
      cell: (e) => {
        if (e.options.length === 1) return <span className="text-fg-3">One price</span>;
        const r = estimateRange(e);
        return (
          <span className="num text-fg-2">
            {e.options.length} · {formatDollarsCompact(r.low)}–{formatDollarsCompact(r.high)}
          </span>
        );
      },
    },
    {
      key: "sent",
      label: "Sent",
      className: "hidden whitespace-nowrap sm:table-cell",
      defaultDir: "desc",
      sort: (e) => e.sentAt ?? e.createdAt,
      cell: (e) =>
        e.sentAt ? (
          <span className={cn("num", needsChase(e) ? "font-medium text-amber" : "text-fg-2")}>{needsChase(e) ? `${waitingDays(e)} days, no answer` : timeAgo(e.sentAt, now)}</span>
        ) : (
          <span className="text-fg-3">Not sent</span>
        ),
    },
    { key: "value", label: "Value", align: "right", defaultDir: "desc", sort: (e) => estimateValue(e), cell: (e) => <span className="num">{formatDollars(estimateValue(e))}</span> },
  ];

  const rows = useSorted(
    inClient
      .filter((e) => {
        const d = display(e);
        switch (scope) {
          case "open": return d === "draft" || d === "sent";
          case "chase": return needsChase(e) || d === "expired";
          case "approved": return d === "approved" || d === "converted";
          case "closed": return d === "declined" || d === "expired";
          case "all": return true;
        }
      })
      .filter((e) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return [e.title, e.number, e.address, customers[e.contactId]?.name ?? "", clientById.get(e.accountId)?.name ?? ""].some((s) => s.toLowerCase().includes(q));
      }),
    columns,
    board.sort,
    (a, b) => b.number.localeCompare(a.number),
  );
  const selected = rows.find((e) => e.id === board.selectedId) ?? rows[0] ?? null;

  // KPIs follow the client filter.
  const open = inClient.filter((e) => display(e) === "sent");
  const drafts = inClient.filter((e) => display(e) === "draft");
  const recent = inClient.filter((e) => e.decidedAt && now.getTime() - new Date(e.decidedAt).getTime() < 30 * 86400000);
  const expiredRecent = inClient.filter((e) => display(e) === "expired" && dayDiff(today(e), e.expiresOn) < 30);
  const won = recent.filter((e) => e.status === "approved");
  const decided = recent.length + expiredRecent.length;
  const chase = inClient.filter(needsChase);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title="Estimates"
          meta={
            <>
              {formatCount(open.length)} out with customers
              {chase.length > 0 && <span className="font-medium text-amber-soft"> · {chase.length} to chase</span>}
            </>
          }
          search={{ value: query, onChange: setQuery, placeholder: "Search estimates, customers" }}
        >
          <InkSelect
            className="max-w-[120px] sm:max-w-[160px]"
            label="Client"
            value={clientId}
            onChange={(v) => {
              setClientId(v);
              board.setSelectedId(null);
            }}
            options={[{ value: "all", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <InkSelect<Scope>
            className="max-w-[120px] sm:max-w-[160px]"
            label="Show"
            value={scope}
            onChange={setScope}
            options={[
              { value: "open", label: "Open" },
              { value: "chase", label: "To chase" },
              { value: "approved", label: "Approved" },
              { value: "closed", label: "Declined or expired" },
              { value: "all", label: "All estimates" },
            ]}
          />
          <InkLink href={`/agency/estimates/library${clientId === "all" ? "" : `?client=${clientId}`}`} icon={BookOpen} label="Price book" />
          <ButtonLink href={clientId === "all" ? "/agency/estimates/new" : `/agency/estimates/new?client=${clientById.get(clientId)?.slug ?? ""}`} className="h-7 whitespace-nowrap px-2.5 text-xs">
            <Plus className="size-3.5" strokeWidth={2.25} />
            <span className="hidden 2xl:inline">New estimate</span>
            <span className="sr-only 2xl:hidden">New estimate</span>
          </ButtonLink>
        </TopBar>

        <KpiStrip>
          <Kpi label="Out with customers" value={formatDollarsCompact(open.reduce((a, e) => a + estimateValue(e), 0))} aside={`${open.length} estimates · ${drafts.length} drafts`} />
          <Kpi label="Approval rate, 30 days" value={decided ? `${Math.round((won.length / decided) * 100)}%` : "–"} aside={`${won.length} of ${decided} answered`} />
          <Kpi label="Approved, 30 days" value={formatDollarsCompact(won.reduce((a, e) => a + estimateValue(e), 0))} aside={`${won.filter((e) => !e.jobId).length} not yet a job`} tone={won.some((e) => !e.jobId) ? "amber" : undefined} />
          <Kpi label="To chase" value={formatCount(chase.length)} aside={chase.length ? "No answer in 7+ days" : "Nothing waiting"} tone={chase.length ? "amber" : undefined} />
        </KpiStrip>

        <DataTable columns={columns} rows={rows} sort={board.sort} onSort={board.setSort} selectedId={selected?.id} onSelect={board.select} empty="No estimates match." />
      </div>

      {selected && (
        <PanelFrame label={selected.title} open={board.panelOpen} docked={board.docked} onClose={() => board.setPanelOpen(false)}>
          {(close) => (
            <EstimatePanel
              key={selected.id}
              e={selected}
              client={clientById.get(selected.accountId)!}
              customer={customers[selected.contactId]}
              jobNumber={selected.jobId ? jobNumbers[selected.jobId] : undefined}
              actions={actions}
              now={now}
              onClose={close}
            />
          )}
        </PanelFrame>
      )}
    </div>
  );
}
