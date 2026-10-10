"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { List, Plus } from "lucide-react";
import { ButtonLink } from "@/components/page-header";
import { Avatar } from "@/components/diagnostic/primitives";
import type { Assignee, Contact, ContactActivity, Pipeline } from "@/lib/types";
import { cn, formatCount, formatDollars, formatDollarsCompact, timeAgo } from "@/lib/utils";
import { ContactPanel, type ContactActions } from "./contact-panel";
import { fullName, personFor, sourceLabel, type ClientRef } from "./model";

/*
 * Pipeline: one column per stage. A card is a contact; clicking it opens the
 * same panel as the contacts board, where the stage select moves it.
 */
export function PipelineBoard({ client, clients, pipeline, contacts, activities, team, nowIso, actions }: { client: ClientRef; clients: ClientRef[]; pipeline: Pipeline; contacts: Contact[]; activities: ContactActivity[]; team: Assignee[]; nowIso: string; actions: ContactActions }) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const selected = contacts.find((c) => c.id === selectedId) ?? null;
  const selectedActivities = useMemo(() => (selected ? activities.filter((a) => a.contactId === selected.id).sort((a, b) => b.at.localeCompare(a.at)) : []), [activities, selected]);
  const byStage = useMemo(() => {
    const m = new Map<string, Contact[]>();
    for (const s of pipeline.stages) m.set(s.id, []);
    for (const c of [...contacts].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))) m.get(c.stageId)?.push(c);
    return m;
  }, [contacts, pipeline]);
  const openValue = contacts.filter((c) => !pipeline.stages.find((s) => s.id === c.stageId)?.outcome).reduce((a, c) => a + c.valueCents, 0);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:flex-nowrap md:px-6">
          <div className="min-w-0 md:shrink-0">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">Pipeline</h1>
            <p className="num text-xs text-rail-fg-2 md:whitespace-nowrap">
              {pipeline.name} · {formatCount(contacts.length)} contacts · {formatDollarsCompact(openValue)} open
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <select
              aria-label="Client"
              value={client.id}
              onChange={(e) => {
                const next = clients.find((c) => c.id === e.target.value);
                if (next) router.push(`/agency/contacts/pipeline?client=${next.slug}`);
              }}
              className="h-7 max-w-[200px] rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Link href={`/agency/contacts?client=${client.id}`} className="inline-flex h-7 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium text-rail-fg hover:bg-rail-line">
              <List className="size-3.5" strokeWidth={1.75} />
              <span className="hidden xl:inline">List</span>
              <span className="sr-only xl:hidden">List</span>
            </Link>
            <ButtonLink href={`/agency/contacts/new?client=${client.id}`} className="h-7 whitespace-nowrap px-2.5 text-xs">
              <Plus className="size-3.5" strokeWidth={2.25} />
              <span className="hidden 2xl:inline">Add contact</span>
              <span className="sr-only 2xl:hidden">Add contact</span>
            </ButtonLink>
          </div>
        </header>

        <div className="flex flex-1 gap-3 overflow-x-auto px-5 py-4 md:px-6">
          {pipeline.stages.map((s) => {
            const cards = byStage.get(s.id) ?? [];
            const value = cards.reduce((a, c) => a + c.valueCents, 0);
            return (
              <section key={s.id} aria-label={s.name} className="flex w-[240px] shrink-0 flex-col rounded border border-line bg-surface-2/50">
                <header className="flex items-baseline justify-between gap-2 border-b border-line px-3 py-2">
                  <h2 className="text-sm font-semibold">
                    {s.name} <span className="num font-normal text-fg-3">{cards.length}</span>
                  </h2>
                  <span className="num text-xs text-fg-3">{value ? formatDollarsCompact(value) : ""}</span>
                </header>
                <ol className="flex flex-col gap-2 p-2">
                  {cards.map((c) => {
                    const owner = personFor(team, c.ownerName);
                    const isSelected = selected?.id === c.id;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(c.id);
                            setPanelOpen(true);
                          }}
                          className={cn("w-full rounded border bg-surface p-2.5 text-left transition-colors duration-100 hover:border-fg-3", isSelected ? "border-fg" : "border-line")}
                        >
                          <div className="flex items-start gap-2">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{fullName(c)}</span>
                              <span className="block truncate text-xs text-fg-3">{c.company || c.city || c.email || ""}</span>
                            </span>
                            {owner && <Avatar person={owner} />}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-fg-3">
                            <span className="truncate">
                              {sourceLabel[c.source]} · {timeAgo(c.lastActivityAt, now)}
                            </span>
                            {c.valueCents > 0 && <span className="num shrink-0 text-fg">{formatDollars(c.valueCents)}</span>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                  {cards.length === 0 && <li className="rounded border border-dashed border-line-strong px-3 py-4 text-center text-xs text-fg-3">Empty</li>}
                </ol>
              </section>
            );
          })}
        </div>
      </div>

      {selected && (
        <>
          <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[384px] 2xl:w-[420px]">
            <ContactPanel contact={selected} client={client} pipeline={pipeline} activities={selectedActivities} team={team} now={now} actions={actions} onClose={() => setSelectedId(null)} />
          </aside>
          {panelOpen && (
            <div className="fixed inset-0 z-20 flex lg:hidden" role="dialog" aria-modal="true" aria-label={fullName(selected)}>
              <button type="button" aria-label="Close panel" onClick={() => setPanelOpen(false)} className="flex-1 bg-rail/40" />
              <aside className="h-full w-[min(100%,400px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                <ContactPanel contact={selected} client={client} pipeline={pipeline} activities={selectedActivities} team={team} now={now} actions={actions} onClose={() => setPanelOpen(false)} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
