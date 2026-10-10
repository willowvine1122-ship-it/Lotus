"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, MessageSquare } from "lucide-react";
import { Sparkline } from "@/components/charts";
import type { Health } from "@/lib/types";
import { cn, formatCount, formatDollars, formatDollarsExact, formatMultiple, formatRate } from "@/lib/utils";
import { Change, PacingGauge, StatusDot, Tag } from "./primitives";
import type { FundraisingRow, MarketingRow, Row } from "./model";

/*
 * The board. A real table so columns align across every row and the eye
 * reads down a column; the selected row drives the panel on the right.
 */

export type SortKey =
  | "health"
  | "name"
  | "leadCost"
  | "aptCost"
  | "bookRate"
  | "pacing"
  | "spend"
  | "roi"
  | "raised"
  | "gift"
  | "donors"
  | "recurring"
  | "trend";

export interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

const healthOrder: Record<Health, number> = { red: 0, amber: 1, green: 2 };

const nullLast = (v: number | null) => (v === null ? Number.POSITIVE_INFINITY : v);

export function sortValue(r: Row, key: SortKey): number | string {
  switch (key) {
    case "health":
      return healthOrder[r.client.health] * 10 - Math.min(9, r.client.alerts.length);
    case "name":
      return r.client.account.name.toLowerCase();
    case "pacing":
      return r.pacing.pct;
    case "trend":
      return r.mode === "marketing" ? nullLast(r.leadsChange) : nullLast(r.raisedChange);
    case "leadCost":
      return r.mode === "marketing" ? nullLast(r.cur.leadCostCents) : 0;
    case "aptCost":
      return r.mode === "marketing" ? nullLast(r.cur.aptCostCents) : 0;
    case "bookRate":
      return r.mode === "marketing" ? nullLast(r.cur.bookRate) : 0;
    case "spend":
      return r.mode === "marketing" ? r.cur.spendCents : 0;
    case "roi":
      return r.mode === "marketing" ? nullLast(r.cur.roi) : 0;
    case "raised":
      return r.mode === "fundraising" ? r.cur.raisedCents : 0;
    case "gift":
      return r.mode === "fundraising" ? nullLast(r.cur.avgGiftCents) : 0;
    case "donors":
      return r.mode === "fundraising" ? r.cur.newDonors : 0;
    case "recurring":
      return r.mode === "fundraising" ? nullLast(r.cur.recurringShare) : 0;
  }
}

interface Column {
  key: SortKey;
  label: string;
  align?: "right";
  className?: string;
  defaultDir?: "asc" | "desc";
}

const marketingColumns: Column[] = [
  { key: "name", label: "Client", className: "w-[160px] min-w-[160px]" },
  { key: "leadCost", label: "Lead cost", className: "min-w-[88px]" },
  { key: "aptCost", label: "Apt cost", className: "hidden sm:table-cell min-w-[88px]" },
  { key: "bookRate", label: "Book rate", align: "right", className: "hidden md:table-cell", defaultDir: "desc" },
  { key: "pacing", label: "Budget pacing", className: "hidden md:table-cell" },
  { key: "spend", label: "Spend", align: "right", defaultDir: "desc" },
  { key: "roi", label: "Est ROI", align: "right", className: "hidden md:table-cell", defaultDir: "desc" },
  { key: "trend", label: "30-day leads", className: "hidden lg:table-cell", defaultDir: "desc" },
];

const fundraisingColumns: Column[] = [
  { key: "name", label: "Client", className: "w-[160px] min-w-[160px]" },
  { key: "raised", label: "Raised", className: "min-w-[100px]", defaultDir: "desc" },
  { key: "gift", label: "Avg gift", className: "hidden sm:table-cell min-w-[88px]", defaultDir: "desc" },
  { key: "donors", label: "New donors", align: "right", className: "hidden md:table-cell", defaultDir: "desc" },
  { key: "pacing", label: "Goal pacing", className: "hidden md:table-cell" },
  { key: "recurring", label: "Recurring", className: "hidden md:table-cell min-w-[80px]", defaultDir: "desc" },
  { key: "trend", label: "30-day raised", className: "hidden lg:table-cell", defaultDir: "desc" },
];

export function DiagnosticTable({
  rows,
  mode,
  sort,
  onSort,
  selectedId,
  onSelect,
}: {
  rows: Row[];
  mode: "marketing" | "fundraising";
  sort: Sort;
  onSort: (s: Sort) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const columns = mode === "marketing" ? marketingColumns : fundraisingColumns;

  const toggle = (c: Column) => {
    if (sort.key === c.key) onSort({ key: c.key, dir: sort.dir === "asc" ? "desc" : "asc" });
    else onSort({ key: c.key, dir: c.defaultDir ?? "asc" });
  };

  return (
    <div className="overflow-x-auto bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-[1] bg-surface">
          <tr className="border-b border-line">
            {columns.map((c) => {
              const active = sort.key === c.key;
              const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn("whitespace-nowrap px-2 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 last:pr-5", c.className, c.align === "right" ? "text-right" : "text-left")}
                >
                  <button
                    type="button"
                    onClick={() => toggle(c)}
                    className={cn("inline-flex items-center gap-1 rounded hover:text-fg", active && "text-fg", c.align === "right" && "flex-row-reverse")}
                  >
                    {c.label}
                    <Icon className={cn("size-3", !active && "opacity-60")} strokeWidth={2} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.client.account.id}
              onClick={() => onSelect(r.client.account.id)}
              aria-selected={selectedId === r.client.account.id}
              className={cn(
                "h-[52px] cursor-pointer border-b border-line transition-colors duration-100 hover:bg-surface-2/60",
                selectedId === r.client.account.id && "bg-brand-soft/40 hover:bg-brand-soft/50",
              )}
            >
              <ClientCell row={r} />
              {r.mode === "marketing" ? <MarketingCells row={r} /> : <FundraisingCells row={r} />}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-5 py-10 text-center text-sm text-fg-3">
                No clients match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ClientCell({ row }: { row: Row }) {
  const { client } = row;
  const noteCount = client.notes.length;
  return (
    <td className="px-2 py-2 pl-5">
      <div className="flex items-center gap-2.5">
        <StatusDot health={client.health} />
        <span className="truncate font-medium">{client.account.name}</span>
        {row.isNew && <Tag tone="brand">New</Tag>}
        {noteCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-2xs text-fg-3" title={`${noteCount} notes`}>
            <MessageSquare className="size-3" strokeWidth={1.75} />
            <span className="num">{noteCount}</span>
          </span>
        )}
      </div>
    </td>
  );
}

/** 30-day sparkline; the change versus the previous range is in the tooltip and for screen readers. */
function TrendCell({ spark, change }: { spark: number[]; change: number | null }) {
  const label = change === null ? "No prior period" : `${change > 0 ? "+" : ""}${Math.round(change * 100)}% vs previous period`;
  return (
    <td className="hidden px-2 py-2 pr-5 lg:table-cell" title={label}>
      <Sparkline values={spark} color="var(--chart-1)" width={64} />
      <span className="sr-only">{label}</span>
    </td>
  );
}

function Money({ cents, change, sub, goodWhenUp = false, className }: { cents: number | null; change: number | null; sub: string; goodWhenUp?: boolean; className?: string }) {
  return (
    <td className={cn("px-2 py-2", className)}>
      <div className="flex items-baseline gap-1.5">
        <span className="num font-medium">{cents === null ? "–" : formatDollars(cents)}</span>
        <Change value={change} goodWhenUp={goodWhenUp} />
      </div>
      <div className="num text-2xs text-fg-3">{sub}</div>
    </td>
  );
}

function MarketingCells({ row }: { row: MarketingRow }) {
  const { cur } = row;
  return (
    <>
      <Money cents={cur.leadCostCents} change={row.leadCostChange} sub={`${formatCount(cur.leads)} leads`} />
      <Money cents={cur.aptCostCents} change={row.aptCostChange} sub={`${formatCount(cur.appointments)} apts`} className="hidden sm:table-cell" />
      <td className="num hidden px-2 py-2 text-right md:table-cell">{formatRate(cur.bookRate)}</td>
      <td className="hidden px-2 py-2 md:table-cell">
        <PacingGauge pct={row.pacing.pct} budgetCents={row.pacing.budgetCents} />
      </td>
      <td className="num px-2 py-2 text-right font-medium">{formatDollars(cur.spendCents)}</td>
      <td className={cn("num hidden px-2 py-2 text-right font-medium md:table-cell", cur.roi !== null && cur.roi >= 3 ? "text-green" : "text-fg-2")}>{formatMultiple(cur.roi)}</td>
      <TrendCell spark={row.spark} change={row.leadsChange} />
    </>
  );
}

function FundraisingCells({ row }: { row: FundraisingRow }) {
  const { cur } = row;
  return (
    <>
      <Money cents={cur.raisedCents} change={row.raisedChange} sub={`${formatCount(cur.donations)} gifts`} goodWhenUp />
      <td className="hidden px-2 py-2 sm:table-cell">
        <div className="flex items-baseline gap-1.5">
          <span className="num font-medium">{cur.avgGiftCents === null ? "–" : formatDollarsExact(cur.avgGiftCents)}</span>
          <Change value={row.giftChange} goodWhenUp />
        </div>
        <div className="num text-2xs text-fg-3">per gift</div>
      </td>
      <td className="num hidden px-2 py-2 text-right md:table-cell">{formatCount(cur.newDonors)}</td>
      <td className="hidden px-2 py-2 md:table-cell">
        <PacingGauge pct={row.pacing.pct} budgetCents={row.pacing.budgetCents} kind="goal" />
      </td>
      <td className="hidden px-2 py-2 md:table-cell">
        <div className="num font-medium">{formatRate(cur.recurringShare)}</div>
        <div className="num whitespace-nowrap text-2xs text-fg-3">{formatCount(cur.newRecurring)} new</div>
      </td>
      <TrendCell spark={row.spark} change={row.raisedChange} />
    </>
  );
}
