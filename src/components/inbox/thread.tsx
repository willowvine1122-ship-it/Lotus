"use client";

import { Fragment, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert, CircleCheck, Info, Lock, Mail, RotateCcw } from "lucide-react";
import { StatusDot } from "@/components/diagnostic/primitives";
import type { Assignee, InboxMessage, InboxThread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChannelIcon, channelLabel } from "./channel";
import { ContactAvatar } from "./contact-avatar";
import { Composer } from "./composer";
import { clockTime, contactName, dayLabel, sameDay } from "./format";

/*
 * One contact's conversation across every channel, oldest at the top.
 * Their messages sit on white at the left; the team's sit on a pale ink
 * wash at the right (ink is the agency's frame colour); internal notes are
 * dashed and full width so they never read as something the contact saw.
 */

const statusLabel: Record<NonNullable<InboxMessage["status"]>, string> = { sent: "Sent", delivered: "Delivered", read: "Read", failed: "Not delivered" };

function Meta({ m, timeZone, align }: { m: InboxMessage; timeZone: string; align: "start" | "end" }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-fg-3", align === "end" && "justify-end")}>
      <ChannelIcon channel={m.channel} className="size-3" />
      <span>{channelLabel[m.channel]}</span>
      <span aria-hidden>·</span>
      <time dateTime={m.sentAt} className="num">
        {clockTime(m.sentAt, timeZone)}
      </time>
      {m.direction === "outbound" && m.authorName && (
        <>
          <span aria-hidden>·</span>
          <span>{m.authorName}</span>
        </>
      )}
      {m.status && (
        <>
          <span aria-hidden>·</span>
          {m.status === "failed" ? (
            <span className="inline-flex items-center gap-1 font-medium text-red">
              <CircleAlert className="size-3" strokeWidth={2} aria-hidden />
              {statusLabel[m.status]}
            </span>
          ) : (
            <span>{statusLabel[m.status]}</span>
          )}
        </>
      )}
    </p>
  );
}

function Message({ m, timeZone }: { m: InboxMessage; timeZone: string }) {
  if (m.kind === "note") {
    return (
      <div className="mx-auto w-full max-w-[600px] rounded border border-dashed border-line-strong bg-surface px-3.5 py-2.5">
        <p className="flex items-center gap-1.5 text-2xs text-fg-3">
          <Lock className="size-3" strokeWidth={2} aria-hidden />
          <span className="font-medium text-fg-2">Internal note</span>
          <span aria-hidden>·</span>
          <span>{m.authorName}</span>
          <span aria-hidden>·</span>
          <time dateTime={m.sentAt} className="num">
            {clockTime(m.sentAt, timeZone)}
          </time>
        </p>
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-fg-2">{m.body}</p>
      </div>
    );
  }
  const out = m.direction === "outbound";
  const email = m.channel === "email";
  return (
    <div className={cn("flex flex-col gap-1", out ? "items-end" : "items-start")}>
      <div
        className={cn(
          "rounded border px-3.5 py-2.5 text-sm leading-relaxed text-fg",
          email ? "w-full max-w-[600px]" : "max-w-[min(85%,520px)]",
          out ? "border-[var(--ink-100)] bg-[var(--ink-100)]" : "border-line bg-surface",
          m.status === "failed" && "border-red/25",
        )}
      >
        {email && m.subject && <p className="mb-2 border-b border-line-strong/60 pb-2 font-semibold">{m.subject}</p>}
        <p className="whitespace-pre-line [overflow-wrap:anywhere]">{m.body}</p>
      </div>
      <Meta m={m} timeZone={timeZone} align={out ? "end" : "start"} />
    </div>
  );
}

export function Thread({
  thread,
  team,
  now,
  timeZone,
  onBack,
  onInfo,
  onAssign,
  onMarkUnread,
  onStatus,
}: {
  thread: InboxThread;
  team: Assignee[];
  now: Date;
  timeZone: string;
  onBack: () => void;
  onInfo: () => void;
  onAssign: (name: string) => void;
  onMarkUnread: () => void;
  onStatus: (s: "open" | "closed") => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const count = thread.messages.length;

  // Land on the newest message when a thread opens or a message is added.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.id, count]);

  const c = thread.contact;
  const used = [...new Set(thread.messages.filter((m) => m.kind === "message").map((m) => m.channel))];
  const closed = thread.status === "closed";

  const iconButton = "grid size-8 shrink-0 place-items-center rounded text-fg-2 transition-colors duration-150 hover:bg-surface-2 hover:text-fg";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-4 py-3 md:px-5">
        <button type="button" onClick={onBack} aria-label="Back to conversations" className={cn(iconButton, "-ml-1 lg:hidden")}>
          <ArrowLeft className="size-4" strokeWidth={1.75} />
        </button>
        <ContactAvatar contact={c} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold leading-6">{contactName(c)}</h2>
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-fg-3">
            <StatusDot health={thread.client.health} className="size-1.5" />
            <Link href={`/agency/clients/${thread.client.slug}`} className="truncate hover:text-fg hover:underline">
              {thread.client.name}
            </Link>
            <span aria-hidden>·</span>
            <span className="flex shrink-0 items-center gap-1" aria-label={`Channels: ${used.map((u) => channelLabel[u]).join(", ")}`}>
              {used.map((u) => (
                <ChannelIcon key={u} channel={u} className="size-3" />
              ))}
            </span>
          </p>
        </div>
        <div className="flex w-full items-center gap-1.5 sm:w-auto">
          <label htmlFor={`assign-${thread.id}`} className="sr-only">
            Assigned to
          </label>
          <select
            id={`assign-${thread.id}`}
            value={thread.assigneeName ?? ""}
            onChange={(e) => onAssign(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded border border-line-strong bg-surface px-2 text-xs font-medium text-fg transition-colors duration-150 hover:border-fg-3 focus:border-brand focus:outline-none sm:w-[128px] sm:flex-none"
          >
            <option value="">Unassigned</option>
            {team.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={onMarkUnread} aria-label="Mark as unread" title="Mark as unread" className={iconButton}>
            <Mail className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => onStatus(closed ? "open" : "closed")}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded border border-line-strong bg-surface px-2.5 text-xs font-medium text-fg transition-colors duration-150 hover:bg-surface-2"
          >
            {closed ? <RotateCcw className="size-3.5" strokeWidth={2} /> : <CircleCheck className="size-3.5" strokeWidth={2} />}
            {closed ? "Reopen" : "Close"}
          </button>
          <button type="button" onClick={onInfo} aria-label="Contact details" title="Contact details" className={cn(iconButton, "min-[1400px]:hidden")}>
            <Info className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-5" aria-label={`Conversation with ${contactName(c)}`} role="log">
        <div className="mx-auto flex max-w-[760px] flex-col gap-3">
          {thread.messages.map((m, i) => {
            const newDay = i === 0 || !sameDay(thread.messages[i - 1].sentAt, m.sentAt, timeZone);
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className="my-1 flex items-center gap-3" role="separator">
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{dayLabel(m.sentAt, now, timeZone)}</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                <Message m={m} timeZone={timeZone} />
              </Fragment>
            );
          })}
          {closed && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-fg-3">
              <CircleCheck className="size-3.5" strokeWidth={1.75} aria-hidden />
              Closed. A new message from {c.firstName} reopens it.
            </p>
          )}
        </div>
      </div>

      <Composer key={thread.id} thread={thread} />
    </div>
  );
}
