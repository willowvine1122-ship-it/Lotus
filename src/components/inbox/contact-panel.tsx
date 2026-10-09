"use client";

import Link from "next/link";
import { ArrowUpRight, MapPin, X } from "lucide-react";
import { Avatar, StatusDot, Tag } from "@/components/diagnostic/primitives";
import type { Assignee, Channel, ContactSource, InboxThread } from "@/lib/types";
import { formatDollars } from "@/lib/utils";
import { ChannelIcon, channelLabel, channels } from "./channel";
import { ContactAvatar } from "./contact-avatar";
import { contactName, listTime } from "./format";

/*
 * Who you are talking to: the contact, the client they belong to, and how
 * they have reached the team. Same section rhythm as the client panel.
 */

const sourceLabel: Record<ContactSource, string> = {
  meta: "Meta ads",
  google: "Google ads",
  website: "Website form",
  referral: "Referral",
  "donation-page": "Donation page",
  import: "Import",
  manual: "Added by hand",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0">
      <dt className="shrink-0 text-xs text-fg-3">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm text-fg">{children}</dd>
    </div>
  );
}

export function ContactPanel({
  thread,
  team,
  now,
  timeZone,
  onClose,
  onFilterClient,
}: {
  thread: InboxThread;
  team: Assignee[];
  now: Date;
  timeZone: string;
  onClose?: () => void;
  onFilterClient: (clientId: string) => void;
}) {
  const c = thread.contact;
  const assignee = team.find((t) => t.name === thread.assigneeName);
  const fundraising = thread.client.mode === "fundraising";
  const since = new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone });

  const used = channels
    .map((ch) => {
      const msgs = thread.messages.filter((m) => m.kind === "message" && m.channel === ch);
      return { ch, count: msgs.length, last: msgs[msgs.length - 1]?.sentAt };
    })
    .filter((u) => u.count > 0) as { ch: Channel; count: number; last: string }[];

  return (
    <div className="flex flex-col">
      <header className="flex flex-col gap-3 border-b border-line px-5 py-4">
        <div className="flex items-start gap-3">
          <ContactAvatar contact={c} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold leading-6">{contactName(c)}</h2>
            <p className="flex items-center gap-1 text-xs text-fg-3">
              {c.city && (
                <>
                  <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="truncate">{c.city}</span>
                  <span aria-hidden>·</span>
                </>
              )}
              <span className="whitespace-nowrap">Since {since}</span>
            </p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close contact details" className="grid size-8 shrink-0 place-items-center rounded text-fg-2 transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
              <X className="size-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
        {c.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.tags.map((t) => (
              <Tag key={t} tone="neutral">
                {t}
              </Tag>
            ))}
          </div>
        )}
      </header>

      <div className="flex flex-col gap-6 px-5 py-5">
        <Section title="Contact">
          <dl>
            <Row label="Phone">{c.phone ? <a href={`tel:${c.phone}`} className="num hover:underline">{c.phone}</a> : <span className="text-fg-3">None</span>}</Row>
            <Row label="Email">{c.email ? <a href={`mailto:${c.email}`} className="hover:underline" title={c.email}>{c.email}</a> : <span className="text-fg-3">None</span>}</Row>
            <Row label="Source">{sourceLabel[c.source]}</Row>
            <Row label={fundraising ? "Lifetime giving" : "Est. value"}>
              <span className="num">{c.valueCents ? formatDollars(c.valueCents) : <span className="text-fg-3">–</span>}</span>
              {fundraising && c.recurring && <span className="text-fg-3"> · monthly</span>}
            </Row>
            {c.doNotContact.sms && <Row label="Texts">Opted out</Row>}
            {c.doNotContact.email && <Row label="Email">Opted out</Row>}
          </dl>
        </Section>

        <Section title="Client">
          <div className="flex flex-col gap-2 rounded border border-line bg-surface-2/50 px-3.5 py-3">
            <div className="flex items-center gap-2">
              <StatusDot health={thread.client.health} />
              <Link href={`/agency/clients/${thread.client.slug}`} className="min-w-0 truncate text-sm font-medium hover:underline">
                {thread.client.name}
              </Link>
              <Link
                href={`/agency/clients/${thread.client.slug}`}
                aria-label={`Open ${thread.client.name}`}
                className="ml-auto grid size-6 place-items-center rounded text-fg-3 transition-colors duration-150 hover:bg-surface hover:text-fg"
              >
                <ArrowUpRight className="size-4" strokeWidth={1.75} />
              </Link>
            </div>
            <p className="text-xs text-fg-3">{fundraising ? "Fundraising" : "Marketing"} client</p>
            <button
              type="button"
              onClick={() => onFilterClient(thread.client.id)}
              className="self-start text-xs font-medium text-fg-2 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-fg hover:decoration-fg"
            >
              Show only this client&apos;s conversations
            </button>
          </div>
        </Section>

        <Section title="Channels">
          <ul>
            {used.map((u) => (
              <li key={u.ch} className="flex items-center gap-2 border-b border-line py-2 text-sm last:border-b-0">
                <ChannelIcon channel={u.ch} className="size-4 text-fg-2" />
                <span>{channelLabel[u.ch]}</span>
                <span className="num text-xs text-fg-3">{u.count}</span>
                <span className="num ml-auto text-xs text-fg-3">{listTime(u.last, now, timeZone)}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Assigned">
          <div className="flex items-center gap-2 text-sm">
            {assignee ? (
              <>
                <Avatar person={assignee} />
                <span>{assignee.name}</span>
              </>
            ) : (
              <span className="text-fg-3">No one yet. Replying assigns it to you.</span>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
