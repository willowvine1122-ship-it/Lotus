"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronsUpDown, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { Field, Input, Select } from "@/components/form";
import { Button } from "@/components/page-header";
import { Segmented, SectionTitle } from "@/components/diagnostic/primitives";
import { sourceLabel } from "@/components/crm/model";
import type { AudienceInput, EmailActionState } from "@/app/agency/email/actions";
import type { AudienceFilter, ContactSource, EmailAudience, Pipeline } from "@/lib/types";
import { cn, formatCount, timeAgo } from "@/lib/utils";
import type { AudienceRow, ContactLite, EmailClientRef } from "./data";
import { matchesFilter } from "./model";
import { Kpi } from "./ui";

/*
 * Audiences: one table of every segment and list, and the builder in the
 * right panel. A segment is a set of rules over CRM fields and is evaluated
 * at send time; a list is a fixed set of hand-picked contacts.
 */

type Key = "name" | "client" | "kind" | "total" | "sendable" | "used" | "updated";
interface Sort { key: Key; dir: "asc" | "desc" }

const columns: { key: Key; label: string; className?: string; align?: "right"; defaultDir?: "asc" | "desc" }[] = [
  { key: "name", label: "Audience", className: "min-w-[220px]" },
  { key: "client", label: "Client", className: "hidden md:table-cell" },
  { key: "kind", label: "Type", className: "hidden sm:table-cell" },
  { key: "total", label: "Contacts", align: "right", className: "hidden lg:table-cell", defaultDir: "desc" },
  { key: "sendable", label: "Can email", align: "right", defaultDir: "desc" },
  { key: "used", label: "Campaigns", align: "right", className: "hidden 2xl:table-cell", defaultDir: "desc" },
  { key: "updated", label: "Updated", className: "hidden 2xl:table-cell", defaultDir: "desc" },
];

export interface AudienceActions {
  save: (input: AudienceInput) => Promise<EmailActionState>;
  remove: (id: string) => Promise<EmailActionState>;
}

const emptyFilter = (): AudienceFilter => ({ tags: [], stageIds: [], sources: [] });

export function AudiencesBoard({
  rows,
  clients,
  contacts,
  pipelines,
  nowIso,
  initialClientId,
  actions,
}: {
  rows: AudienceRow[];
  clients: EmailClientRef[];
  contacts: ContactLite[];
  pipelines: Record<string, Pipeline>;
  nowIso: string;
  initialClientId?: string;
  actions: AudienceActions;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [clientId, setClientId] = useState(initialClientId ?? "all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "client", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const inClient = useMemo(() => rows.filter((r) => clientId === "all" || r.accountId === clientId), [rows, clientId]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dir = sort.dir === "asc" ? 1 : -1;
    const v = (r: AudienceRow): string | number => {
      switch (sort.key) {
        case "name": return r.name.toLowerCase();
        case "client": return clientById.get(r.accountId)?.name ?? "";
        case "kind": return r.kind;
        case "total": return r.reach.total;
        case "sendable": return r.reach.sendable;
        case "used": return r.usedBy;
        case "updated": return r.updatedAt;
      }
    };
    return inClient
      .filter((r) => !q || [r.name, r.summary, clientById.get(r.accountId)?.name ?? ""].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => {
        const av = v(a);
        const bv = v(b);
        const p = av < bv ? -1 : av > bv ? 1 : 0;
        return p !== 0 ? p * dir : b.reach.sendable - a.reach.sendable || a.name.localeCompare(b.name);
      });
  }, [inClient, query, sort, clientById]);

  const selected = creating ? null : (visible.find((r) => r.id === selectedId) ?? visible[0] ?? null);

  // KPIs over the client's contacts, not the audiences, so nobody is counted twice.
  const people = contacts.filter((c) => clientId === "all" || c.accountId === clientId);
  const optedOut = people.filter((c) => c.optedOut).length;
  const noEmail = people.filter((c) => !c.email).length;
  const sendable = people.length - optedOut - people.filter((c) => !c.email && !c.optedOut).length;

  const builderClient = creating ? clientById.get(clientId === "all" ? clients[0]!.id : clientId)! : selected ? clientById.get(selected.accountId)! : null;
  const startNew = () => {
    setCreating(true);
    setPanelOpen(true);
  };

  const panel = (onClose?: () => void) =>
    builderClient ? (
      <AudienceBuilder
        key={creating ? `new-${builderClient.id}` : selected!.id}
        audience={creating ? null : selected}
        client={builderClient}
        clients={creating && clientId === "all" ? clients : undefined}
        contacts={contacts}
        pipelines={pipelines}
        now={now}
        actions={actions}
        onSaved={(id) => {
          setCreating(false);
          if (id) setSelectedId(id);
        }}
        onCancel={creating ? () => setCreating(false) : undefined}
        onClose={onClose}
      />
    ) : null;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:flex-nowrap md:px-6">
          <div className="min-w-0 md:shrink-0">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">Audiences</h1>
            <p className="num flex items-center gap-1.5 text-xs text-rail-fg-2 md:whitespace-nowrap">
              <Link href={clientId === "all" ? "/agency/email" : `/agency/email?client=${clientById.get(clientId)?.slug ?? ""}`} className="inline-flex items-center gap-1 text-rail-fg hover:underline">
                <ArrowLeft className="size-3" strokeWidth={2} />
                Email
              </Link>
              · {formatCount(inClient.length)} audiences
            </p>
          </div>
          <label className="relative order-last w-full md:order-none md:ml-2 md:w-auto md:min-w-[160px] md:max-w-[260px] md:flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2" strokeWidth={1.75} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search audiences and rules"
              className="h-8 w-full rounded border border-rail-line bg-rail-2 pl-8 pr-3 text-sm text-rail-fg placeholder:text-rail-fg-2/80 focus:border-rail-fg-2 focus:outline-none"
            />
          </label>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <select
              aria-label="Client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setSelectedId(null);
                setCreating(false);
              }}
              className="h-7 max-w-[150px] rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none"
            >
              <option value="all">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button onClick={startNew} className="h-7 whitespace-nowrap px-2.5 text-xs">
              <Plus className="size-3.5" strokeWidth={2.25} />
              <span className="hidden sm:inline">New audience</span>
              <span className="sr-only sm:hidden">New audience</span>
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 px-5 py-4 md:px-6 xl:grid-cols-4">
          <Kpi label="Contacts" value={formatCount(people.length)} aside={clientId === "all" ? `${clients.length} clients` : clientById.get(clientId)?.name} />
          <Kpi label="Emailable" value={formatCount(sendable)} aside={people.length ? `${Math.round((sendable / people.length) * 100)}% of all` : undefined} />
          <Kpi label="Opted out" value={formatCount(optedOut)} aside="never emailed" />
          <Kpi label="No address" value={formatCount(noEmail)} aside="phone only" />
        </div>

        <div className="overflow-x-auto border-y border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                {columns.map((c) => {
                  const active = sort.key === c.key;
                  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={cn("whitespace-nowrap px-3 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6", c.className, c.align === "right" ? "text-right" : "text-left")}
                    >
                      <button
                        type="button"
                        onClick={() => setSort(active ? { key: c.key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: c.defaultDir ?? "asc" })}
                        className={cn("inline-flex items-center gap-1 hover:text-fg", active && "text-fg", c.align === "right" && "flex-row-reverse")}
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
              {visible.map((r) => {
                const isSelected = selected?.id === r.id;
                return (
                  <tr
                    key={r.id}
                    aria-selected={isSelected}
                    onClick={() => {
                      setCreating(false);
                      setSelectedId(r.id);
                      setPanelOpen(true);
                    }}
                    className={cn("h-[52px] cursor-pointer border-b border-line transition-colors duration-100", isSelected ? "bg-brand-soft/40 shadow-[inset_2px_0_0_var(--brand)]" : "hover:bg-surface-2/60")}
                  >
                    <td className="max-w-[360px] px-3 py-1.5 pl-5 md:pl-6">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-fg-3">
                        <span className="text-fg-2 md:hidden">{clientById.get(r.accountId)?.name} · </span>
                        {r.summary}
                      </span>
                    </td>
                    <td className="hidden max-w-[180px] truncate px-3 py-1.5 text-fg-2 md:table-cell">{clientById.get(r.accountId)?.name}</td>
                    <td className="hidden px-3 py-1.5 text-fg-2 sm:table-cell">{r.kind === "segment" ? "Segment" : "List"}</td>
                    <td className="num hidden px-3 py-1.5 text-right lg:table-cell">{formatCount(r.reach.total)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <span className="num block font-medium">{formatCount(r.reach.sendable)}</span>
                      {r.reach.total > r.reach.sendable && <span className="num block text-2xs text-fg-3">{formatCount(r.reach.total - r.reach.sendable)} skipped</span>}
                    </td>
                    <td className="num hidden px-3 py-1.5 text-right 2xl:table-cell">{r.usedBy || <span className="text-fg-3">0</span>}</td>
                    <td className="hidden px-3 py-1.5 pr-6 text-fg-2 2xl:table-cell">{timeAgo(r.updatedAt, now)}</td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-fg-3">
                    {inClient.length === 0 ? "No audiences yet. Every client starts with Everyone once it has contacts." : "No audiences match."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {builderClient && (
        <>
          <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[400px] 2xl:w-[440px]">{panel()}</aside>
          {panelOpen && (
            <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label={selected?.name ?? "New audience"}>
              <button type="button" aria-label="Close panel" onClick={() => setPanelOpen(false)} className="flex-1 bg-rail/40" />
              <aside className="h-full w-[min(100%,420px)] overflow-y-auto border-l border-line bg-surface shadow-2">{panel(() => setPanelOpen(false))}</aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------ builder ----------------------------- */

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-[4px] border px-2 text-xs font-medium transition-colors duration-150",
        on ? "border-rail bg-rail text-rail-fg" : "border-line-strong bg-surface text-fg-2 hover:border-fg-3 hover:text-fg",
      )}
    >
      {on && <Check className="size-3" strokeWidth={2.5} />}
      {children}
    </button>
  );
}

function RuleGroup({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-2xs text-fg-3">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function toggleIn<T>(xs: T[], x: T) {
  return xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x];
}

function AudienceBuilder({
  audience,
  client: initialClient,
  clients,
  contacts,
  pipelines,
  now,
  actions,
  onSaved,
  onCancel,
  onClose,
}: {
  audience: AudienceRow | null;
  client: EmailClientRef;
  clients?: EmailClientRef[];
  contacts: ContactLite[];
  pipelines: Record<string, Pipeline>;
  now: Date;
  actions: AudienceActions;
  onSaved: (id?: string) => void;
  onCancel?: () => void;
  onClose?: () => void;
}) {
  const [accountId, setAccountId] = useState(audience?.accountId ?? initialClient.id);
  const client = clients?.find((c) => c.id === accountId) ?? initialClient;
  const [name, setName] = useState(audience?.name ?? "");
  const [kind, setKind] = useState<EmailAudience["kind"]>(audience?.kind ?? "segment");
  const [filter, setFilter] = useState<AudienceFilter>(audience?.filter ?? emptyFilter());
  const [picked, setPicked] = useState<string[]>(audience?.contactIds ?? []);
  const [find, setFind] = useState("");
  const [state, setState] = useState<EmailActionState>(null);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pipeline = pipelines[accountId];
  const mine = useMemo(() => contacts.filter((c) => c.accountId === accountId), [contacts, accountId]);
  const tags = useMemo(() => [...new Set(mine.flatMap((c) => c.tags))].sort(), [mine]);
  const sources = useMemo(() => [...new Set(mine.map((c) => c.source))] as ContactSource[], [mine]);
  const members = kind === "list" ? mine.filter((c) => picked.includes(c.id)) : mine.filter((c) => matchesFilter(c, filter, now));
  const optedOut = members.filter((c) => c.optedOut).length;
  const noEmail = members.filter((c) => !c.email).length;
  const sendable = members.length - optedOut - members.filter((c) => !c.email && !c.optedOut).length;
  const e = state?.errors ?? {};
  const q = find.trim().toLowerCase();
  const candidates = mine.filter((c) => !q || `${c.firstName} ${c.lastName} ${c.email ?? ""}`.toLowerCase().includes(q)).slice(0, 40);
  const isEveryone = audience?.name === "Everyone" && audience.kind === "segment" && !audience.id.startsWith("new-");

  const save = () =>
    start(async () => {
      const r = await actions.save({ id: audience?.id, accountId, name, kind, filter, contactIds: kind === "list" ? picked : [] });
      setState(r);
      if (r?.ok) onSaved(r.id);
    });

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-1 border-b border-line bg-surface px-5 pb-4 pt-4">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold leading-6 tracking-tight">{audience ? audience.name : "New audience"}</h2>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
              <X className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
        <p className="num text-sm text-fg-2">
          <span className="font-semibold text-fg">{formatCount(sendable)}</span> can be emailed
          <span className="text-fg-3">
            {" "}
            of {formatCount(members.length)}
            {optedOut > 0 && ` · ${optedOut} opted out`}
            {noEmail > 0 && ` · ${noEmail} no address`}
          </span>
        </p>
      </header>

      <div className="flex flex-col gap-5 px-5 py-5">
        {clients && (
          <Field label="Client" htmlFor="aud-client">
            <Select
              id="aud-client"
              value={accountId}
              onChange={(ev) => {
                setAccountId(ev.target.value);
                setFilter(emptyFilter());
                setPicked([]);
              }}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Name" htmlFor="aud-name" error={e.name}>
          <Input id="aud-name" value={name} onChange={(ev) => setName(ev.target.value)} placeholder={client.mode === "fundraising" ? "Donors who gave last winter" : "Leads waiting on an estimate"} aria-invalid={!!e.name} />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Type</span>
          <Segmented
            tone="paper"
            label="Audience type"
            value={kind}
            onChange={setKind}
            options={[
              { value: "segment", label: "Segment" },
              { value: "list", label: "List" },
            ]}
          />
        </div>
        <p className="-mt-3 text-xs leading-relaxed text-fg-3">
          {kind === "segment" ? "Rules over CRM fields. New contacts that match join automatically, right up to the moment of sending." : "A fixed set of people you pick. Nobody joins unless you add them."}
        </p>

        {kind === "segment" ? (
          <div className="flex flex-col gap-4 rounded border border-line bg-surface-2/40 p-3.5">
            <RuleGroup label="Stage" hint="Any of">
              {pipeline?.stages.map((s) => (
                <Toggle key={s.id} on={filter.stageIds.includes(s.id)} onClick={() => setFilter({ ...filter, stageIds: toggleIn(filter.stageIds, s.id) })}>
                  {s.name}
                </Toggle>
              ))}
            </RuleGroup>
            <RuleGroup label="Tags" hint="Any of">
              {tags.length ? (
                tags.map((t) => (
                  <Toggle key={t} on={filter.tags.includes(t)} onClick={() => setFilter({ ...filter, tags: toggleIn(filter.tags, t) })}>
                    {t}
                  </Toggle>
                ))
              ) : (
                <span className="text-xs text-fg-3">No tags on this client&apos;s contacts yet.</span>
              )}
            </RuleGroup>
            <RuleGroup label="Source" hint="Any of">
              {sources.map((s) => (
                <Toggle key={s} on={filter.sources.includes(s)} onClick={() => setFilter({ ...filter, sources: toggleIn(filter.sources, s) })}>
                  {sourceLabel[s]}
                </Toggle>
              ))}
            </RuleGroup>
            <RuleGroup label="Added" hint="To the CRM">
              {[undefined, 7, 30, 90].map((d) => (
                <Toggle key={d ?? "any"} on={filter.addedWithinDays === d} onClick={() => setFilter({ ...filter, addedWithinDays: d })}>
                  {d ? `Last ${d} days` : "Any time"}
                </Toggle>
              ))}
            </RuleGroup>
            <p className="text-2xs text-fg-3">Different rules must all match. Leave a rule empty to ignore it.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-3" strokeWidth={1.75} />
              <Input type="search" value={find} onChange={(ev) => setFind(ev.target.value)} placeholder="Find contacts" className="pl-8" aria-label="Find contacts" />
            </label>
            {e.contactIds && <p className="text-xs text-red">{e.contactIds}</p>}
            <ul className="max-h-[300px] overflow-y-auto rounded border border-line">
              {candidates.map((c) => {
                const on = picked.includes(c.id);
                return (
                  <li key={c.id} className="border-b border-line last:border-b-0">
                    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-surface-2/60">
                      <input type="checkbox" checked={on} onChange={() => setPicked(toggleIn(picked, c.id))} className="size-3.5 accent-[var(--rail)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="block truncate text-2xs text-fg-3">{c.email ?? "No email address"}</span>
                      </span>
                      {c.optedOut && <span className="text-2xs text-fg-3">Opted out</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="num text-2xs text-fg-3">{picked.length} picked</p>
          </div>
        )}

        {kind === "segment" && (
          <section className="flex flex-col gap-2">
            <SectionTitle sub="A sample of who matches right now">In this audience</SectionTitle>
            <ul className="flex flex-col">
              {members.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 text-sm last:border-b-0">
                  <Link href={`/agency/contacts/${c.id}`} className="truncate hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                  <span className="shrink-0 text-2xs text-fg-3">{c.optedOut ? "Opted out" : c.email ? "" : "No address"}</span>
                </li>
              ))}
              {members.length === 0 && <li className="py-2 text-xs text-fg-3">Nobody matches these rules.</li>}
              {members.length > 6 && <li className="num pt-1.5 text-2xs text-fg-3">and {formatCount(members.length - 6)} more</li>}
            </ul>
          </section>
        )}

        {state && !state.ok && state.message && (
          <p role="alert" className="rounded border border-red/25 bg-red-soft/60 px-3 py-2 text-sm text-red">
            {state.message}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
            {audience ? "Save audience" : "Create audience"}
          </Button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-sm text-fg-2 hover:text-fg">
              Cancel
            </button>
          )}
          {state?.ok && state.message && <span className="text-xs text-green">{state.message}</span>}
          {audience && !isEveryone && (
            <span className="ml-auto flex items-center gap-2">
              {confirmDelete ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      start(async () => {
                        const r = await actions.remove(audience.id);
                        setState(r);
                        setConfirmDelete(false);
                        if (r?.ok) onSaved();
                      })
                    }
                    className="text-sm font-medium text-red hover:underline"
                  >
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-sm text-fg-2 hover:text-fg">
                    Keep
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Delete audience" className="grid size-7 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-red">
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                </button>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
