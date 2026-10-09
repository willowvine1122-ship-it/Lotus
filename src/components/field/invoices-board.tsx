"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/page-header";
import { dayDiff, formatDay, invoiceDisplay, invoiceMoney, type InvoiceDisplay } from "@/lib/field";
import type { Invoice } from "@/lib/types";
import { cn, formatCount, formatDollars, formatDollarsCompact } from "@/lib/utils";
import { InvoicePanel, type InvoiceActions } from "./invoice-panel";
import type { CustomerRef, FieldClientRef } from "./model";
import { DataTable, InkSelect, InvoiceTag, Kpi, KpiStrip, PanelFrame, TopBar, TwoLine, useBoardState, useSorted, type Column } from "./ui";

/* Invoices: what is owed, what is late, and what came in. */

type Scope = "unpaid" | "overdue" | "draft" | "paid" | "all";

const order: InvoiceDisplay[] = ["overdue", "partial", "sent", "draft", "paid", "void"];

export function InvoicesBoard({
  invoices,
  clients,
  customers,
  jobNumbers,
  initialClientId,
  initialScope,
  actions,
  nowIso,
}: {
  invoices: Invoice[];
  clients: FieldClientRef[];
  customers: Record<string, CustomerRef>;
  jobNumbers: Record<string, string>;
  initialClientId?: string;
  initialScope?: Scope;
  actions: InvoiceActions;
  nowIso: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [clientId, setClientId] = useState(initialClientId ?? "all");
  const [scope, setScope] = useState<Scope>(initialScope ?? "unpaid");
  const [query, setQuery] = useState("");
  const board = useBoardState<Invoice>({ key: "status", dir: "asc" });
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const today = (i: Invoice) => clientById.get(i.accountId)?.today ?? "";
  const display = (i: Invoice) => invoiceDisplay(i, today(i));

  const inClient = useMemo(() => invoices.filter((i) => clientId === "all" || i.accountId === clientId), [invoices, clientId]);

  const columns: Column<Invoice>[] = [
    { key: "invoice", label: "Invoice", className: "min-w-[220px]", sort: (i) => i.number, cell: (i) => <TwoLine title={i.title} sub={`${i.number} · ${customers[i.contactId]?.name ?? "Unknown"}`} /> },
    { key: "client", label: "Client", className: "hidden max-w-[160px] truncate whitespace-nowrap text-fg-2 md:table-cell", sort: (i) => clientById.get(i.accountId)?.name ?? "", cell: (i) => clientById.get(i.accountId)?.name },
    { key: "status", label: "Status", sort: (i) => `${order.indexOf(display(i))}-${i.dueOn}`, cell: (i) => <InvoiceTag status={display(i)} /> },
    {
      key: "due",
      label: "Due",
      className: "hidden whitespace-nowrap sm:table-cell",
      sort: (i) => i.dueOn,
      cell: (i) => {
        const d = display(i);
        const late = dayDiff(today(i), i.dueOn);
        if (d === "paid" || d === "void") return <span className="num text-fg-3">{formatDay(i.dueOn, { month: "short", day: "numeric" })}</span>;
        return <span className={cn("num", d === "overdue" ? "font-medium text-red" : "text-fg-2")}>{d === "overdue" ? `${late} days late` : late === 0 ? "Today" : formatDay(i.dueOn, { month: "short", day: "numeric" })}</span>;
      },
    },
    { key: "total", label: "Total", align: "right", className: "hidden xl:table-cell", defaultDir: "desc", sort: (i) => invoiceMoney(i).total, cell: (i) => <span className="num text-fg-2">{formatDollars(invoiceMoney(i).total)}</span> },
    {
      key: "balance",
      label: "Balance",
      align: "right",
      defaultDir: "desc",
      sort: (i) => (i.status === "void" ? -1 : invoiceMoney(i).balance),
      cell: (i) => {
        const b = invoiceMoney(i).balance;
        return <span className={cn("num", b === 0 || i.status === "void" ? "text-fg-3" : "font-medium")}>{i.status === "void" ? "–" : formatDollars(b)}</span>;
      },
    },
  ];

  const rows = useSorted(
    inClient
      .filter((i) => {
        const d = display(i);
        switch (scope) {
          case "unpaid": return d === "sent" || d === "partial" || d === "overdue" || d === "draft";
          case "overdue": return d === "overdue";
          case "draft": return d === "draft";
          case "paid": return d === "paid";
          case "all": return true;
        }
      })
      .filter((i) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return [i.title, i.number, customers[i.contactId]?.name ?? "", clientById.get(i.accountId)?.name ?? ""].some((s) => s.toLowerCase().includes(q));
      }),
    columns,
    board.sort,
    (a, b) => b.number.localeCompare(a.number),
  );
  const selected = rows.find((i) => i.id === board.selectedId) ?? rows[0] ?? null;

  const owing = inClient.filter((i) => ["sent", "partial", "overdue"].includes(display(i)));
  const overdue = owing.filter((i) => display(i) === "overdue");
  const drafts = inClient.filter((i) => display(i) === "draft");
  const payments = inClient.flatMap((i) => i.payments).filter((p) => now.getTime() - new Date(p.at).getTime() < 30 * 86400000);
  const bal = (xs: Invoice[]) => xs.reduce((a, i) => a + invoiceMoney(i).balance, 0);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title="Invoices"
          meta={
            <>
              {formatDollars(bal(owing))} outstanding
              {overdue.length > 0 && <span className="font-medium text-red-soft"> · {overdue.length} overdue</span>}
            </>
          }
          search={{ value: query, onChange: setQuery, placeholder: "Search invoices, customers" }}
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
              { value: "unpaid", label: "Unpaid" },
              { value: "overdue", label: "Overdue" },
              { value: "draft", label: "Drafts" },
              { value: "paid", label: "Paid" },
              { value: "all", label: "All invoices" },
            ]}
          />
          <ButtonLink href={clientId === "all" ? "/agency/invoices/new" : `/agency/invoices/new?client=${clientById.get(clientId)?.slug ?? ""}`} className="h-7 whitespace-nowrap px-2.5 text-xs">
            <Plus className="size-3.5" strokeWidth={2.25} />
            <span className="hidden 2xl:inline">New invoice</span>
            <span className="sr-only 2xl:hidden">New invoice</span>
          </ButtonLink>
        </TopBar>

        <KpiStrip>
          <Kpi label="Outstanding" value={formatDollarsCompact(bal(owing))} aside={`${formatCount(owing.length)} invoices`} />
          <Kpi label="Overdue" value={formatDollarsCompact(bal(overdue))} aside={overdue.length ? `${overdue.length} invoices` : "None"} tone={overdue.length ? "red" : undefined} />
          <Kpi label="Collected, 30 days" value={formatDollarsCompact(payments.reduce((a, p) => a + p.amountCents, 0))} aside={`${formatCount(payments.length)} payments`} />
          <Kpi label="Drafts to send" value={formatCount(drafts.length)} aside={`${formatDollarsCompact(drafts.reduce((a, i) => a + invoiceMoney(i).total, 0))} not billed`} tone={drafts.length ? "amber" : undefined} />
        </KpiStrip>

        <DataTable columns={columns} rows={rows} sort={board.sort} onSort={board.setSort} selectedId={selected?.id} onSelect={board.select} empty={scope === "overdue" ? "Nothing overdue." : "No invoices match."} />
      </div>

      {selected && (
        <PanelFrame label={selected.title} open={board.panelOpen} onClose={() => board.setPanelOpen(false)}>
          {(close) => (
            <InvoicePanel
              key={selected.id}
              inv={selected}
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
