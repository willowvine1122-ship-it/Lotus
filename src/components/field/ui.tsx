"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from "lucide-react";
import type { EstimateDisplay, InvoiceDisplay } from "@/lib/field";
import { estimateLabel, invoiceLabel, jobStatusLabel } from "@/lib/field";
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * Board grammar shared by Jobs, Estimates and Invoices: the ink top bar, the
 * KPI strip, one sortable table, and the right-hand panel (a sheet below lg).
 * Same shapes as the Daily Diagnostic and Contacts so the tool reads as one.
 */

export function TopBar({
  title,
  meta,
  search,
  children,
}: {
  title: string;
  meta: React.ReactNode;
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
  };
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:flex-nowrap md:px-6">
      <div className="min-w-0 md:shrink-0">
        <h1 className="text-lg font-semibold leading-6 tracking-tight">
          {title}
        </h1>
        <p className="num text-xs text-rail-fg-2 md:whitespace-nowrap">
          {meta}
        </p>
      </div>
      {search && (
        <label className="relative order-last w-full md:order-none md:ml-2 md:w-auto md:min-w-[160px] md:max-w-[280px] md:flex-1">
          <span className="sr-only">Search</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2"
            strokeWidth={1.75}
          />
          <input
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            className="h-8 w-full rounded border border-rail-line bg-rail-2 pl-8 pr-3 text-sm text-rail-fg placeholder:text-rail-fg-2/80 focus:border-rail-fg-2 focus:outline-none"
          />
        </label>
      )}
      <div className="ml-auto flex min-w-0 max-w-full items-center gap-2 md:shrink-0">
        {children}
      </div>
    </header>
  );
}

export const inkControl =
  "h-7 rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none";

export function InkSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        inkControl,
        "min-w-0 max-w-[160px] flex-1 md:flex-none",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function InkLink({
  href,
  icon: Icon,
  label,
  wide = "xl",
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  wide?: "xl" | "always";
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-7 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium text-rail-fg transition-colors duration-150 hover:bg-rail-line"
    >
      <Icon className="size-3.5" strokeWidth={1.75} />
      <span className={wide === "always" ? "" : "hidden xl:inline"}>
        {label}
      </span>
      {wide !== "always" && <span className="sr-only xl:hidden">{label}</span>}
    </Link>
  );
}

export function Kpi({
  label,
  value,
  aside,
  tone,
}: {
  label: string;
  value: string;
  aside?: React.ReactNode;
  tone?: "red" | "amber";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded border border-line bg-surface px-4 py-3 sm:gap-0.5">
      <div className="min-w-0">
        <div className="whitespace-nowrap text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
          {label}
        </div>
        <div className="num mt-0.5 text-xl font-semibold leading-7">
          {value}
        </div>
      </div>
      <div
        className={cn(
          "num min-h-4 whitespace-nowrap text-xs sm:self-end sm:text-right",
          tone === "red"
            ? "font-medium text-red"
            : tone === "amber"
              ? "font-medium text-amber"
              : "text-fg-3",
        )}
      >
        {aside ?? "\u00a0"}
      </div>
    </div>
  );
}

export function KpiStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6 xl:grid-cols-4">
      {children}
    </div>
  );
}

/* ------------------------------ Table ------------------------------- */

export interface Column<T> {
  key: string;
  label: string;
  className?: string;
  align?: "right";
  defaultDir?: "asc" | "desc";
  sort?: (row: T) => string | number;
  cell: (row: T) => React.ReactNode;
}

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

export function useSorted<T>(
  rows: T[],
  columns: Column<T>[],
  sort: SortState,
  tie: (a: T, b: T) => number,
) {
  const col = columns.find((c) => c.key === sort.key);
  if (!col?.sort) return rows;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = col.sort!(a);
    const bv = col.sort!(b);
    const p = av < bv ? -1 : av > bv ? 1 : 0;
    return p !== 0 ? p * dir : tie(a, b);
  });
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  sort,
  onSort,
  selectedId,
  onSelect,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  sort: SortState;
  onSort: (s: SortState) => void;
  selectedId?: string;
  onSelect: (row: T) => void;
  empty: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto border-y border-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => {
              const active = sort.key === c.key;
              const Icon = active
                ? sort.dir === "asc"
                  ? ArrowUp
                  : ArrowDown
                : ChevronsUpDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    c.sort
                      ? active
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6",
                    c.className,
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSort(
                          active
                            ? {
                                key: c.key,
                                dir: sort.dir === "asc" ? "desc" : "asc",
                              }
                            : { key: c.key, dir: c.defaultDir ?? "asc" },
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1 uppercase hover:text-fg",
                        active && "text-fg",
                        c.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {c.label}
                      <Icon
                        className={cn("size-3", !active && "opacity-60")}
                        strokeWidth={2}
                      />
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = row.id === selectedId;
            return (
              <tr
                key={row.id}
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => onSelect(row)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(row);
                  }
                }}
                className={cn(
                  "h-[52px] cursor-pointer border-b border-line transition-colors duration-100 focus-visible:outline-offset-[-2px]",
                  isSelected
                    ? "bg-brand-soft/40 shadow-[inset_2px_0_0_var(--brand)]"
                    : "hover:bg-surface-2/60",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3 py-1.5 first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6",
                      c.className,
                      c.align === "right" && "text-right",
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-12 text-center text-sm text-fg-3"
              >
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Title over a muted second line: the first column of every field table. */
export function TwoLine({
  title,
  sub,
}: {
  title: React.ReactNode;
  sub: React.ReactNode;
}) {
  return (
    <div className="min-w-0 max-w-[340px]">
      <span className="block truncate font-medium">{title}</span>
      <span className="num block truncate text-xs text-fg-3">{sub}</span>
    </div>
  );
}

/* ---------------------------- Panel frame --------------------------- */

/**
 * Persistent right panel from lg; below lg (and always, with `sheet`) it is
 * a right-anchored sheet over an ink scrim.
 */
export function PanelFrame({
  label,
  open,
  onClose,
  sheet,
  children,
}: {
  label: string;
  open: boolean;
  onClose: () => void;
  sheet?: boolean;
  children: (close?: () => void) => React.ReactNode;
}) {
  return (
    <>
      {!sheet && (
        <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[384px] 2xl:w-[420px]">
          {children()}
        </aside>
      )}
      {open && (
        <div
          className={cn("fixed inset-0 z-30 flex", !sheet && "lg:hidden")}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        >
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="flex-1 bg-rail/40"
          />
          <aside className="h-full w-[min(100%,420px)] overflow-y-auto border-l border-line bg-surface shadow-2">
            {children(onClose)}
          </aside>
        </div>
      )}
    </>
  );
}

export function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="grid size-7 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg"
    >
      <X className="size-4" strokeWidth={2} />
    </button>
  );
}

/* ------------------------------- Tags ------------------------------- */

type Tone = "neutral" | "green" | "red" | "amber" | "live" | "muted";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-2",
  green: "bg-green-soft text-green",
  red: "bg-red-soft text-red",
  amber: "bg-amber-soft text-amber",
  live: "bg-surface text-fg ring-1 ring-inset ring-fg/70",
  muted: "text-fg-3 ring-1 ring-inset ring-line-strong",
};

export function StatusTag({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-[4px] px-1.5 text-2xs font-medium whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {tone === "live" && (
        <span aria-hidden className="relative inline-flex size-1.5">
          <span className="absolute inset-0 rounded-full bg-fg motion-safe:animate-ping motion-safe:opacity-40" />
          <span className="relative size-1.5 rounded-full bg-fg" />
        </span>
      )}
      {children}
    </span>
  );
}

const jobTone: Record<JobStatus, Tone> = {
  unscheduled: "amber",
  scheduled: "neutral",
  en_route: "live",
  in_progress: "live",
  completed: "green",
  canceled: "muted",
};
export function JobTag({ status }: { status: JobStatus }) {
  return <StatusTag tone={jobTone[status]}>{jobStatusLabel[status]}</StatusTag>;
}

const estimateTone: Record<EstimateDisplay, Tone> = {
  draft: "muted",
  sent: "neutral",
  approved: "green",
  converted: "green",
  declined: "muted",
  expired: "amber",
};
export function EstimateTag({ status }: { status: EstimateDisplay }) {
  return (
    <StatusTag tone={estimateTone[status]}>{estimateLabel[status]}</StatusTag>
  );
}

const invoiceTone: Record<InvoiceDisplay, Tone> = {
  draft: "muted",
  sent: "neutral",
  partial: "neutral",
  overdue: "red",
  paid: "green",
  void: "muted",
};
export function InvoiceTag({ status }: { status: InvoiceDisplay }) {
  return (
    <StatusTag
      tone={invoiceTone[status]}
      className={status === "void" ? "line-through" : undefined}
    >
      {invoiceLabel[status]}
    </StatusTag>
  );
}

/* ------------------------------ Bits -------------------------------- */

export function PanelSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Ledger({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-line bg-surface-2/40 px-3.5">
      {children}
    </div>
  );
}

export function LedgerRow({
  label,
  children,
  strong,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
      <span
        className={cn(
          "shrink-0",
          strong ? "text-sm font-medium text-fg" : "text-xs text-fg-3",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 truncate text-right",
          strong ? "text-base font-semibold" : "text-fg",
        )}
      >
        {children}
      </span>
    </div>
  );
}

export function useBoardState<T extends { id: string }>(
  initialSort: SortState,
) {
  const [sort, setSort] = useState<SortState>(initialSort);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const select = (row: T) => {
    setSelectedId(row.id);
    setPanelOpen(true);
  };
  return {
    sort,
    setSort,
    selectedId,
    setSelectedId,
    panelOpen,
    setPanelOpen,
    select,
  };
}

/** Small bordered action button for panels, quieter than the page primary. */
export function PanelButton({
  children,
  onClick,
  disabled,
  tone = "default",
  type = "button",
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "default" | "ink" | "danger";
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded border px-3 text-xs font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        tone === "ink"
          ? "border-rail bg-rail text-rail-fg hover:bg-rail-2"
          : tone === "danger"
            ? "border-line-strong bg-surface text-fg-2 hover:border-red/40 hover:text-red"
            : "border-line-strong bg-surface text-fg hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PanelLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded border border-line-strong bg-surface px-3 text-xs font-medium text-fg transition-colors duration-150 hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </Link>
  );
}
