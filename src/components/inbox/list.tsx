"use client";

import { Inbox as InboxIcon } from "lucide-react";
import { Segmented, StatusDot } from "@/components/diagnostic/primitives";
import type { Channel, InboxThread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChannelIcon, channelLabel, channels } from "./channel";
import { ContactAvatar } from "./contact-avatar";
import { contactName, listTime } from "./format";

/*
 * The conversation list: filters on top (client, open or closed, channel,
 * unread), then one row per contact. Rows read like the board: who, which
 * client, the last line, and an ink count when something is unread.
 */

export interface ListFilters {
  clientId: string | null;
  status: "open" | "unread" | "closed";
  channel: Channel | null;
}

export function lastMessage(t: InboxThread) {
  for (let i = t.messages.length - 1; i >= 0; i--) if (t.messages[i].kind === "message") return t.messages[i];
  return t.messages[t.messages.length - 1];
}

function Chip({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[4px] border px-2 text-xs font-medium transition-colors duration-150",
        active ? "border-rail bg-rail text-rail-fg" : "border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

export function ConversationList({
  threads,
  filters,
  onFilters,
  channelCounts,
  clients,
  selectedId,
  selectedImplicit,
  onSelect,
  unreadOf,
  now,
  timeZone,
  onClear,
  filtered,
}: {
  threads: InboxThread[];
  filters: ListFilters;
  onFilters: (f: Partial<ListFilters>) => void;
  channelCounts: Record<Channel | "all", number>;
  clients: { id: string; name: string; mode: "marketing" | "fundraising" }[];
  selectedId: string | null;
  /** The selection is the desktop default, not something the user opened: only mark it where the thread shows. */
  selectedImplicit: boolean;
  onSelect: (id: string) => void;
  unreadOf: (t: InboxThread) => number;
  now: Date;
  timeZone: string;
  onClear: () => void;
  filtered: boolean;
}) {
  const marketing = clients.filter((c) => c.mode === "marketing");
  const fundraising = clients.filter((c) => c.mode === "fundraising");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2.5 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="inbox-client">
            Client
          </label>
          <select
            id="inbox-client"
            value={filters.clientId ?? ""}
            onChange={(e) => onFilters({ clientId: e.target.value || null })}
            className="h-7 min-w-0 flex-1 rounded border border-line-strong bg-surface px-2 text-xs font-medium text-fg transition-colors duration-150 hover:border-fg-3 focus:border-brand focus:outline-none"
          >
            <option value="">All clients</option>
            <optgroup label="Marketing">
              {marketing.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Fundraising">
              {fundraising.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          </select>
          <Segmented
            tone="paper"
            label="Conversation status"
            value={filters.status}
            onChange={(v) => onFilters({ status: v })}
            options={[
              { value: "open", label: "Open" },
              { value: "unread", label: "Unread" },
              { value: "closed", label: "Closed" },
            ]}
          />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="group" aria-label="Channel">
          <Chip active={filters.channel === null} onClick={() => onFilters({ channel: null })}>
            All <span className={cn("num", filters.channel === null ? "text-rail-fg-2" : "text-fg-3")}>{channelCounts.all}</span>
          </Chip>
          {channels.map((ch) => (
            <Chip key={ch} active={filters.channel === ch} onClick={() => onFilters({ channel: filters.channel === ch ? null : ch })} label={`${channelLabel[ch]}, ${channelCounts[ch]} conversations`}>
              <ChannelIcon channel={ch} />
              <span className="hidden 2xl:inline">{channelLabel[ch]}</span>
              <span className={cn("num", filters.channel === ch ? "text-rail-fg-2" : "text-fg-3")}>{channelCounts[ch]}</span>
            </Chip>
          ))}
        </div>
      </div>

      {threads.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <InboxIcon className="size-5 text-fg-3" strokeWidth={1.75} aria-hidden />
          <p className="text-sm font-medium">{filtered ? "No conversations match these filters" : "No conversations yet"}</p>
          <p className="max-w-[32ch] text-xs text-fg-3">
            {filtered
              ? "Try another client or channel, or clear the filters to see everything."
              : "Texts, emails, WhatsApp and Facebook messages from every client's contacts land here."}
          </p>
          {filtered && (
            <button type="button" onClick={onClear} className="mt-1 text-sm font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Conversations">
          {threads.map((t) => {
            const last = lastMessage(t);
            const unread = unreadOf(t);
            const selected = t.id === selectedId;
            const preview = last ? (last.channel === "email" && last.subject ? last.subject : last.body) : "";
            return (
              <li key={t.id} className="border-b border-line">
                <button
                  type="button"
                  onClick={() => onSelect(t.id)}
                  aria-current={selected && !selectedImplicit ? "true" : undefined}
                  className={cn(
                    "relative grid w-full grid-cols-[32px_minmax(0,1fr)] gap-3 px-4 py-3 text-left transition-colors duration-150",
                    "hover:bg-surface-2/60",
                    selected &&
                      (selectedImplicit
                        ? "lg:bg-surface-2 lg:before:absolute lg:before:inset-y-0 lg:before:left-0 lg:before:w-0.5 lg:before:bg-rail lg:hover:bg-surface-2"
                        : "bg-surface-2 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-rail hover:bg-surface-2"),
                  )}
                >
                  <ContactAvatar contact={t.contact} />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-baseline gap-2">
                      <span className={cn("truncate text-sm", unread ? "font-semibold text-fg" : "font-medium text-fg")}>{contactName(t.contact)}</span>
                      <span className={cn("num ml-auto shrink-0 text-2xs", unread ? "font-medium text-fg" : "text-fg-3")}>{last ? listTime(last.sentAt, now, timeZone) : ""}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-fg-3">
                      <StatusDot health={t.client.health} className="size-1.5" />
                      <span className="truncate">{t.client.name}</span>
                      <span className="ml-auto shrink-0">
                        {t.assigneeName ?? "Unassigned"}
                      </span>
                    </span>
                    <span className="mt-1 flex min-w-0 items-center gap-1.5">
                      {last && <ChannelIcon channel={last.channel} className={unread ? "text-fg" : "text-fg-3"} />}
                      <span className={cn("truncate text-sm", unread ? "text-fg" : "text-fg-2")}>
                        {last?.direction === "outbound" && <span className="text-fg-3">You: </span>}
                        {preview}
                      </span>
                      {unread > 0 && (
                        <span className="num ml-auto grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-[4px] bg-rail px-1 text-2xs font-semibold text-rail-fg">
                          {unread}
                          <span className="sr-only"> unread</span>
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
