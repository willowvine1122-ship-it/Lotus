"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Plus } from "lucide-react";
import {
  AvatarStack,
  Segmented,
  StatusDot,
  Tag,
} from "@/components/diagnostic/primitives";
import { ButtonLink } from "@/components/page-header";
import { TopBar } from "@/components/field/ui";
import { StatusChip } from "@/components/status";
import type { ClientRecord, ClientStatus, Health } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

/*
 * The client roster. Same table grammar as the Daily Diagnostic, but about
 * the relationship: mode, status, team, open tasks, latest note, since when.
 */

import { statusLabel, statusTone } from "./status";
const healthOrder: Record<Health, number> = { red: 0, amber: 1, green: 2 };
const statusOrder: Record<ClientStatus, number> = {
  onboarding: 0,
  active: 1,
  paused: 2,
};

type Key = "name" | "mode" | "status" | "health" | "tasks" | "note" | "since";
interface Sort {
  key: Key;
  dir: "asc" | "desc";
}

const columns: {
  key: Key;
  label: string;
  className?: string;
  align?: "right";
  defaultDir?: "asc" | "desc";
}[] = [
  { key: "name", label: "Client", className: "min-w-[220px]" },
  { key: "health", label: "Today" },
  {
    key: "tasks",
    label: "Open tasks",
    align: "right",
    className: "hidden md:table-cell",
    defaultDir: "desc",
  },
  {
    key: "note",
    label: "Latest note",
    className: "hidden lg:table-cell min-w-[240px]",
  },
  { key: "mode", label: "Mode", className: "hidden md:table-cell" },
  { key: "status", label: "Status", className: "hidden sm:table-cell" },
  {
    key: "since",
    label: "Client since",
    className: "hidden md:table-cell",
    defaultDir: "desc",
  },
];

function value(c: ClientRecord, key: Key): string | number {
  switch (key) {
    case "name":
      return c.account.name.toLowerCase();
    case "mode":
      return c.mode;
    case "status":
      return statusOrder[c.status];
    case "health":
      return healthOrder[c.health];
    case "tasks":
      return c.tasks.filter((t) => t.status !== "done").length;
    case "note":
      return c.notes[0]?.createdAt ?? "";
    case "since":
      return c.startedOn;
  }
}

export function ClientsTable({
  clients,
  nowIso,
  meta,
}: {
  clients: ClientRecord[];
  nowIso: string;
  meta: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"all" | "marketing" | "fundraising">("all");
  const [sort, setSort] = useState<Sort>({ key: "health", dir: "asc" });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dir = sort.dir === "asc" ? 1 : -1;
    return clients
      .filter((c) => mode === "all" || c.mode === mode)
      .filter(
        (c) =>
          !q ||
          [
            c.account.name,
            c.industry,
            c.location,
            ...c.tags,
            ...c.assignees.map((a) => a.name),
          ].some((v) => v.toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        const av = value(a, sort.key);
        const bv = value(b, sort.key);
        const p = av < bv ? -1 : av > bv ? 1 : 0;
        return p !== 0 ? p * dir : a.account.name.localeCompare(b.account.name);
      });
  }, [clients, query, mode, sort]);

  return (
    <div className="bg-surface">
      <TopBar
        title="Clients"
        meta={
          rows.length === clients.length
            ? meta
            : `${rows.length} of ${clients.length} · ${meta}`
        }
        search={{
          value: query,
          onChange: setQuery,
          placeholder: "Search clients, tags, people",
        }}
      >
        <Segmented
          tone="ink"
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "all", label: "All" },
            { value: "marketing", label: "Marketing" },
            { value: "fundraising", label: "Fundraising" },
          ]}
        />
        <ButtonLink
          href="/agency/clients/new"
          className="h-7 shrink-0 px-2.5 text-xs"
        >
          <Plus className="size-4" strokeWidth={2} />
          <span className="hidden xl:inline">Add client</span>
        </ButtonLink>
      </TopBar>
      <div className="overflow-x-auto">
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
                      active
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 last:pr-5 md:first:pl-8 md:last:pr-8",
                      c.className,
                      c.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSort(
                          active
                            ? {
                                key: c.key,
                                dir: sort.dir === "asc" ? "desc" : "asc",
                              }
                            : { key: c.key, dir: c.defaultDir ?? "asc" },
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-fg",
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
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const open = c.tasks.filter((t) => t.status !== "done").length;
              const note = c.notes[0];
              return (
                <tr
                  key={c.account.id}
                  className="group h-[56px] border-b border-line transition-colors duration-100 hover:bg-surface-2/60"
                >
                  <td className="px-3 py-2 pl-5 md:pl-8">
                    <Link
                      href={`/agency/clients/${c.account.slug}`}
                      className="flex items-center gap-2.5"
                    >
                      <StatusDot health={c.health} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium group-hover:underline">
                          {c.account.name}
                        </span>
                        <span className="block truncate text-xs text-fg-3">
                          {c.industry} · {c.location}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <StatusChip health={c.health} />
                  </td>
                  <td className="num hidden px-3 py-2 text-right md:table-cell">
                    {open || <span className="text-fg-3">0</span>}
                  </td>
                  <td className="hidden px-3 py-2 lg:table-cell">
                    {note ? (
                      <span
                        className="block max-w-[36ch] truncate text-fg-2"
                        title={note.body}
                      >
                        <span className="font-medium text-fg">
                          {note.authorName}
                        </span>{" "}
                        {note.body}
                        <span className="ml-1.5 text-xs text-fg-3">
                          {timeAgo(note.createdAt, now)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-fg-3">No notes</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2 text-fg-2 md:table-cell">
                    {c.mode === "marketing" ? "Marketing" : "Fundraising"}
                  </td>
                  <td className="hidden px-3 py-2 sm:table-cell">
                    <Tag tone={statusTone[c.status]}>
                      {statusLabel[c.status]}
                    </Tag>
                  </td>
                  <td className="num hidden px-3 py-2 pr-5 text-fg-2 md:table-cell md:pr-8">
                    <span className="flex items-center justify-between gap-3">
                      {new Date(`${c.startedOn}T12:00:00`).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                      <AvatarStack people={c.assignees} />
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-10 text-center text-sm text-fg-3"
                >
                  No clients match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
