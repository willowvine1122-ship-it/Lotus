"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { MessageSquarePlus, Search } from "lucide-react";
import { assignAction, setReadAction, setStatusAction } from "@/app/agency/inbox/actions";
import { Segmented } from "@/components/diagnostic/primitives";
import { Button } from "@/components/page-header";
import type { Assignee, Channel, Contact, InboxThread } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { InboxClientRef } from "./composer";
import { channels } from "./channel";
import { NewConversation } from "./composer";
import { ContactPanel } from "./contact-panel";
import { contactName, useTimeZone } from "./format";
import { ConversationList, type ListFilters } from "./list";
import { Thread } from "./thread";

/*
 * The inbox: ink top bar, then three columns on paper. Conversations on the
 * left, the open thread in the middle, the contact on the right. On a phone
 * the list is the page and a thread opens over it.
 */

type View = "all" | "mine" | "unassigned";

export function Inbox({
  threads,
  contacts,
  clients,
  team,
  me,
  nowIso,
  initialClientId,
  initialConversationId,
  initialComposeTo,
}: {
  threads: InboxThread[];
  contacts: Contact[];
  clients: InboxClientRef[];
  team: Assignee[];
  me: string;
  nowIso: string;
  initialClientId: string | null;
  initialConversationId: string | null;
  /** A contact to start a new message to, when linked from the CRM. */
  initialComposeTo: string | null;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const timeZone = useTimeZone();
  const [, startTransition] = useTransition();

  const initial = threads.find((t) => t.id === initialConversationId);
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ListFilters>({
    clientId: initialClientId,
    status: initial?.status ?? "open",
    channel: null,
  });
  const [selectedId, setSelectedId] = useState<string | null>(initial?.id ?? null);
  const [threadOpen, setThreadOpen] = useState(Boolean(initial || initialComposeTo));
  const [panelOpen, setPanelOpen] = useState(false);
  const [composing, setComposing] = useState(Boolean(initialComposeTo));
  // Read state the user just changed, ahead of the server round trip.
  const [readOverride, setReadOverride] = useState<Record<string, boolean>>({});

  const unreadOf = (t: InboxThread) => {
    const o = readOverride[t.id];
    if (o === true) return 0;
    if (o === false) return Math.max(1, t.unread);
    return t.unread;
  };

  const q = query.trim().toLowerCase();
  const matches = (t: InboxThread, skip?: "channel") => {
    if (view === "mine" && t.assigneeName !== me) return false;
    if (view === "unassigned" && t.assigneeName) return false;
    if (filters.clientId && t.accountId !== filters.clientId) return false;
    if (filters.status === "closed" ? t.status !== "closed" : t.status !== "open") return false;
    if (filters.status === "unread" && unreadOf(t) === 0) return false;
    if (skip !== "channel" && filters.channel && !t.messages.some((m) => m.kind === "message" && m.channel === filters.channel)) return false;
    if (q) {
      const hay = [contactName(t.contact), t.client.name, t.contact.phone ?? "", t.contact.email ?? "", ...t.contact.tags, ...t.messages.map((m) => `${m.subject ?? ""} ${m.body}`)]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const visible = threads.filter((t) => matches(t));
  const forChannelCounts = threads.filter((t) => matches(t, "channel"));
  const channelCounts = { all: forChannelCounts.length } as Record<Channel | "all", number>;
  for (const ch of channels) channelCounts[ch] = forChannelCounts.filter((t) => t.messages.some((m) => m.kind === "message" && m.channel === ch)).length;

  const open = threads.filter((t) => t.status === "open");
  const totalUnread = open.filter((t) => unreadOf(t) > 0).length;
  const unassigned = open.filter((t) => !t.assigneeName).length;
  const mine = open.filter((t) => t.assigneeName === me).length;

  // Desktop always shows a thread: the selection if it is still in view, else the newest.
  const selected = visible.find((t) => t.id === selectedId) ?? (selectedId ? threads.find((t) => t.id === selectedId && matches(t)) : undefined) ?? visible[0] ?? null;

  // On desktop the newest thread opens by itself; reading it there counts as reading it.
  const shownId = selected && !composing ? selected.id : null;
  const shownUnread = selected ? selected.unread > 0 && readOverride[selected.id] === undefined : false;
  useEffect(() => {
    if (!shownId || !shownUnread || !window.matchMedia("(min-width: 1024px)").matches) return;
    startTransition(() => setReadAction(shownId, true));
  }, [shownId, shownUnread]);

  const syncUrl = (id: string | null, clientId = filters.clientId) => {
    const params = new URLSearchParams();
    const slug = clients.find((c) => c.id === clientId)?.slug;
    if (slug) params.set("client", slug);
    if (id) params.set("c", id);
    const s = params.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  };

  const select = (id: string) => {
    setSelectedId(id);
    setComposing(false);
    setThreadOpen(true);
    setPanelOpen(false);
    syncUrl(id);
    const t = threads.find((x) => x.id === id);
    if (t && unreadOf(t) > 0) {
      setReadOverride((o) => ({ ...o, [id]: true }));
      startTransition(() => setReadAction(id, true));
    }
  };

  const updateFilters = (f: Partial<ListFilters>) => {
    setFilters((prev) => ({ ...prev, ...f }));
    if ("clientId" in f) syncUrl(selected?.id ?? null, f.clientId ?? null);
  };

  const clearFilters = () => {
    setFilters({ clientId: null, status: "open", channel: null });
    setView("all");
    setQuery("");
    syncUrl(selected?.id ?? null, null);
  };

  const filtered = Boolean(filters.clientId || filters.channel || q || view !== "all" || filters.status !== "open");

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-50px)]">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:flex-nowrap md:px-6">
        <div className="min-w-0 md:shrink-0">
          <h1 className="text-lg font-semibold leading-6 tracking-tight">Inbox</h1>
          <p className="num text-xs text-rail-fg-2 md:whitespace-nowrap">
            {open.length} open
            {totalUnread > 0 && (
              <span className="font-medium text-rail-fg">
                {" · "}
                {totalUnread} unread
              </span>
            )}
            {` · ${unassigned} unassigned`}
          </p>
        </div>
        <label className="relative order-last w-full md:order-none md:ml-2 md:w-auto md:min-w-[120px] md:max-w-[320px] md:flex-1">
          <span className="sr-only">Search conversations</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2" strokeWidth={1.75} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, clients, messages"
            className="h-8 w-full rounded border border-rail-line bg-rail-2 pl-8 pr-3 text-sm text-rail-fg placeholder:text-rail-fg-2/80 focus:border-rail-fg-2 focus:outline-none"
          />
        </label>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Segmented
            label="Show"
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: "All" },
              { value: "mine", label: `Mine ${mine}` },
              { value: "unassigned", label: `Unassigned ${unassigned}` },
            ]}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setComposing(true);
              setThreadOpen(true);
              setPanelOpen(false);
            }}
            className="h-7 whitespace-nowrap px-2.5 text-xs"
          >
            <MessageSquarePlus className="size-3.5" strokeWidth={2.25} />
            <span className="hidden lg:inline">New message</span>
            <span className="sr-only lg:hidden">New message</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section aria-label="Conversation list" className="flex min-h-0 w-full shrink-0 flex-col bg-surface lg:w-[360px] lg:border-r lg:border-line">
          <ConversationList
            threads={visible}
            filters={filters}
            onFilters={updateFilters}
            channelCounts={channelCounts}
            clients={clients}
            selectedId={composing ? null : (selected?.id ?? null)}
            selectedImplicit={!threadOpen}
            onSelect={select}
            unreadOf={unreadOf}
            now={now}
            timeZone={timeZone}
            onClear={clearFilters}
            me={me}
            team={team}
            showAssignee={view === "all"}
            filtered={filtered}
          />
        </section>

        <section
          aria-label="Conversation"
          className={cn(
            "min-w-0 flex-1 flex-col bg-bg",
            threadOpen ? "fixed inset-0 z-30 flex lg:static lg:z-auto" : "hidden lg:flex",
          )}
        >
          {composing ? (
            <NewConversation
              contacts={contacts}
              clients={clients}
              defaultClientId={contacts.find((c) => c.id === initialComposeTo)?.accountId ?? filters.clientId}
              defaultContactId={initialComposeTo}
              onClose={() => {
                setComposing(false);
                setThreadOpen(false);
              }}
              onStarted={(id) => {
                setComposing(false);
                setSelectedId(id);
                setFilters((f) => ({ ...f, status: "open", channel: null }));
                setView("all");
                setQuery("");
                syncUrl(id);
              }}
            />
          ) : selected ? (
            <Thread
              thread={selected}
              team={team}
              now={now}
              timeZone={timeZone}
              onBack={() => setThreadOpen(false)}
              onInfo={() => setPanelOpen(true)}
              onAssign={(name) => startTransition(() => assignAction(selected.id, name))}
              onMarkUnread={() => {
                setReadOverride((o) => ({ ...o, [selected.id]: false }));
                startTransition(() => setReadAction(selected.id, false));
                setThreadOpen(false);
              }}
              onStatus={(s) => {
                startTransition(() => setStatusAction(selected.id, s));
                setSelectedId(null);
                setThreadOpen(false);
              }}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
              <p className="text-sm font-medium">No conversation open</p>
              <p className="text-xs text-fg-3">Pick one from the list, or start a new message.</p>
            </div>
          )}
        </section>

        {selected && !composing && (
          <>
            {panelOpen && <button type="button" aria-label="Close contact details" onClick={() => setPanelOpen(false)} className="fixed inset-0 z-40 bg-rail/40 min-[1400px]:hidden" />}
            <aside
              aria-label="Contact"
              className={cn(
                "overflow-y-auto border-l border-line bg-surface",
                panelOpen ? "fixed inset-y-0 right-0 z-50 w-[min(100%,360px)] shadow-2 min-[1400px]:static min-[1400px]:z-auto min-[1400px]:w-[300px] min-[1400px]:shadow-none 2xl:w-[340px]" : "hidden min-[1400px]:block min-[1400px]:w-[300px] min-[1400px]:shrink-0 2xl:w-[340px]",
              )}
            >
              <ContactPanel
                thread={selected}
                team={team}
                now={now}
                timeZone={timeZone}
                onClose={panelOpen ? () => setPanelOpen(false) : undefined}
                onFilterClient={(id) => {
                  updateFilters({ clientId: id });
                  setPanelOpen(false);
                }}
              />
            </aside>
          </>
        )}
      </div>
    </div>
  );
}

