"use client";

import Link from "next/link";
import { useActionState, useMemo } from "react";
import { X } from "lucide-react";
import { BarList, LineChart } from "@/components/charts";
import { CheckboxChip, Field, FormNotice, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { SectionTitle, Tag } from "@/components/diagnostic/primitives";
import type { ActionState } from "@/app/agency/reputation/actions";
import type { Contact, ReputationSettings, Review, ReviewRequest } from "@/lib/types";
import { cn, formatCount, formatRate, timeAgo } from "@/lib/utils";
import { averageRating, channelLabel, distribution, fillTemplate, requestStatusLabel, rollingRating, sourceLabel, triggerLabel, windowed, type ClientRef } from "./model";

/*
 * Right-hand panels for the reputation board. Reviews mode: the review, a
 * reply box, then how the client is rated over time. Requests mode: send a
 * request by hand and the rules for automatic ones.
 */

export interface ReputationActions {
  reply: (reviewId: string, prev: ActionState, fd: FormData) => Promise<ActionState>;
  sendRequest: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  updateSettings: (accountId: string, prev: ActionState, fd: FormData) => Promise<ActionState>;
}

/** Five squares, filled in ink up to the rating. Neutral on purpose: a rating is not a health signal. */
export function Stars({ rating, size = "sm", className }: { rating: number; size?: "sm" | "md"; className?: string }) {
  return (
    <span role="img" aria-label={`${rating} out of 5`} className={cn("inline-flex items-center", size === "sm" ? "gap-[3px]" : "gap-1", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden className={cn("block rounded-[2px]", size === "sm" ? "size-2" : "size-2.5", i <= Math.round(rating) ? "bg-fg" : "bg-line-strong")} />
      ))}
    </span>
  );
}

function PanelFrame({ onClose, title, sub, children }: { onClose?: () => void; title: React.ReactNode; sub: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 flex items-start gap-2 border-b border-line bg-surface px-5 pb-4 pt-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-6 tracking-tight">{title}</h2>
          <div className="mt-0.5 text-xs text-fg-3">{sub}</div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
            <X className="size-4" strokeWidth={2} />
          </button>
        )}
      </header>
      <div className="flex flex-col gap-6 px-5 py-5">{children}</div>
    </div>
  );
}

function ReplyForm({ review, reply }: { review: Review; reply: ReputationActions["reply"] }) {
  const [state, formAction] = useActionState(reply.bind(null, review.id), null);
  if (review.reply) {
    return (
      <section className="flex flex-col gap-2">
        <SectionTitle sub={`${review.reply.by} replied`}>Reply</SectionTitle>
        <div className="rounded border border-line bg-surface-2/40 px-3.5 py-3 text-sm leading-relaxed text-fg-2">{review.reply.body}</div>
      </section>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-3 rounded border border-line bg-surface p-4">
      <Field label="Reply publicly" htmlFor="reply-body" error={state?.errors?.body} hint={`Posts to ${sourceLabel[review.source]} as the client. Keep it short and specific.`}>
        <Textarea id="reply-body" name="body" placeholder={review.rating >= 4 ? "Thank you, Mike. Glad the crew took care of it." : "Thanks for telling us. We've called to put this right."} aria-invalid={!!state?.errors?.body} />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Posting…">Post reply</SubmitButton>
        <FormNotice state={state} />
      </div>
    </form>
  );
}

function RatingHistory({ reviews, now, client }: { reviews: Review[]; now: Date; client: ClientRef }) {
  const trend = useMemo(() => rollingRating(reviews, now), [reviews, now]);
  const dist = distribution(reviews);
  const { cur, prev } = windowed(reviews, now, 30);
  const avg = averageRating(reviews);
  const avg30 = averageRating(cur);
  const avgPrev = averageRating(prev);
  return (
    <>
      <section className="flex flex-col gap-2">
        <SectionTitle sub="All time, and the last 30 days">
          <Link href={`/agency/clients/${client.slug}`} className="hover:underline">
            {client.name}
          </Link>
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded border border-line bg-surface-2/50 px-3.5 py-3">
            <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Rating</div>
            <div className="num mt-0.5 flex items-center gap-2 text-lg font-semibold">
              {avg === null ? "–" : avg.toFixed(1)}
              {avg !== null && <Stars rating={avg} />}
            </div>
            <div className="num text-xs text-fg-2">{formatCount(reviews.length)} reviews</div>
          </div>
          <div className="rounded border border-line bg-surface-2/50 px-3.5 py-3">
            <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Last 30 days</div>
            <div className="num mt-0.5 text-lg font-semibold">{avg30 === null ? "–" : avg30.toFixed(1)}</div>
            <div className="num text-xs text-fg-2">
              {formatCount(cur.length)} new{avgPrev !== null && avg30 !== null ? ` · was ${avgPrev.toFixed(1)}` : ""}
            </div>
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <SectionTitle sub="90-day average, by week">Rating trend</SectionTitle>
        {reviews.length >= 3 ? (
          <LineChart labels={trend.map((t) => t.label)} format={(v) => v.toFixed(1)} height={150} series={[{ key: "avg", label: "Average rating", color: "var(--chart-1)", values: trend.map((t) => t.avg) }]} />
        ) : (
          <div className="grid h-20 place-items-center rounded border border-dashed border-line-strong text-xs text-fg-3">Not enough reviews yet</div>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <SectionTitle>By stars</SectionTitle>
        <BarList items={dist.map((d) => ({ key: String(d.stars), label: `${d.stars} star${d.stars === 1 ? "" : "s"}`, value: d.count }))} color="var(--chart-1)" format={(v) => formatCount(v)} />
      </section>
    </>
  );
}

export function ReviewPanel({ review, client, clientReviews, now, actions, onClose }: { review: Review; client: ClientRef; clientReviews: Review[]; now: Date; actions: ReputationActions; onClose?: () => void }) {
  return (
    <PanelFrame
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className="truncate">{review.author}</span>
          <Stars rating={review.rating} size="md" />
        </span>
      }
      sub={
        <span className="flex flex-wrap items-center gap-x-2">
          <span>{sourceLabel[review.source]}</span>
          <span>·</span>
          <span>{client.name}</span>
          <span>·</span>
          <span className="num">{timeAgo(review.at, now)}</span>
          <Tag tone="neutral">{review.reply ? "Replied" : "Needs reply"}</Tag>
        </span>
      }
    >
      <p className="text-[15px] leading-relaxed text-fg">“{review.body}”</p>
      <ReplyForm key={review.id} review={review} reply={actions.reply} />
      <RatingHistory reviews={clientReviews} now={now} client={client} />
    </PanelFrame>
  );
}

function SendRequestForm({ client, contacts, settings, sendRequest }: { client: ClientRef; contacts: Contact[]; settings: ReputationSettings; sendRequest: ReputationActions["sendRequest"] }) {
  const [state, formAction] = useActionState(sendRequest, null);
  const eligible = contacts.filter((c) => (settings.channel === "sms" ? c.phone && !c.doNotContact.sms : c.email && !c.doNotContact.email)).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  return (
    <form action={formAction} key={state?.ok ? state.message : "open"} className="flex flex-col gap-3 rounded border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold">Send a request now</h3>
      <input type="hidden" name="accountId" value={client.id} />
      <Field label="Contact" htmlFor="rq-contact" error={state?.errors?.contactId} hint={`${formatCount(eligible.length)} contacts can be reached by ${channelLabel[settings.channel].toLowerCase()}.`}>
        <Select id="rq-contact" name="contactId" defaultValue="">
          <option value="" disabled>
            Pick a contact
          </option>
          {eligible.slice(0, 60).map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
              {c.company ? ` · ${c.company}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Send by" htmlFor="rq-channel">
        <Select id="rq-channel" name="channel" defaultValue={settings.channel}>
          <option value="sms">Text message</option>
          <option value="email">Email</option>
        </Select>
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Sending…">Send request</SubmitButton>
        <FormNotice state={state} />
      </div>
    </form>
  );
}

function SettingsForm({ client, settings, updateSettings }: { client: ClientRef; settings: ReputationSettings; updateSettings: ReputationActions["updateSettings"] }) {
  const [state, formAction] = useActionState(updateSettings.bind(null, client.id), null);
  const e = state?.errors ?? {};
  const events = client.mode === "marketing" ? [{ key: "job", label: "After a job is done" }, { key: "appointment", label: "After an appointment" }] : [{ key: "donation", label: "After a gift" }];
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <SectionTitle sub="Requests go out on their own after these events.">Automatic requests</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        {events.map((ev) => (
          <CheckboxChip key={ev.key} name="autoAfter" value={ev.key} label={ev.label} defaultChecked={settings.autoAfter[ev.key as keyof ReputationSettings["autoAfter"]]} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Send by" htmlFor="st-channel">
          <Select id="st-channel" name="channel" defaultValue={settings.channel}>
            <option value="sms">Text message</option>
            <option value="email">Email</option>
          </Select>
        </Field>
        <Field label="Wait" htmlFor="st-delay" error={e.delayHours}>
          <Select id="st-delay" name="delayHours" defaultValue={String(settings.delayHours)}>
            <option value="0">Straight away</option>
            <option value="2">2 hours</option>
            <option value="24">1 day</option>
            <option value="72">3 days</option>
          </Select>
        </Field>
      </div>
      <Field label="Message" htmlFor="st-message" error={e.message} hint="{first} and {client} are filled in. The review link is added at the end.">
        <Textarea id="st-message" name="message" defaultValue={settings.message} aria-invalid={!!e.message} />
      </Field>
      <div className="rounded border border-line bg-surface-2/40 px-3.5 py-2.5 text-xs leading-relaxed text-fg-2">
        <span className="font-medium text-fg">Preview: </span>
        {fillTemplate(settings.message, "Mike", client.name)} {settings.googleUrl ?? ""}
      </div>
      <Field label="Google review link" htmlFor="st-google" error={e.googleUrl}>
        <Input id="st-google" name="googleUrl" defaultValue={settings.googleUrl} placeholder="https://g.page/r/…/review" className="num" />
      </Field>
      <Field label="Facebook review link" htmlFor="st-facebook" error={e.facebookUrl} hint="Optional. Google is used when both are set.">
        <Input id="st-facebook" name="facebookUrl" defaultValue={settings.facebookUrl} placeholder="https://facebook.com/…/reviews" className="num" />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton variant="secondary" pendingLabel="Saving…">
          Save settings
        </SubmitButton>
        <FormNotice state={state} />
      </div>
    </form>
  );
}

export function RequestsPanel({ client, contacts, settings, requests, now, actions, onClose }: { client: ClientRef; contacts: Contact[]; settings: ReputationSettings; requests: ReviewRequest[]; now: Date; actions: ReputationActions; onClose?: () => void }) {
  const last30 = requests.filter((r) => (now.getTime() - new Date(r.sentAt).getTime()) / 86400000 < 30);
  const reviewed = last30.filter((r) => r.status === "reviewed").length;
  const opened = last30.filter((r) => r.status !== "sent").length;
  return (
    <PanelFrame
      onClose={onClose}
      title={client.name}
      sub={
        <span className="num">
          {formatCount(last30.length)} requests in 30 days · {formatRate(last30.length ? reviewed / last30.length : null)} left a review
        </span>
      }
    >
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Sent", value: last30.length },
          { label: "Opened", value: opened },
          { label: "Reviewed", value: reviewed },
        ].map((t) => (
          <div key={t.label} className="rounded border border-line bg-surface-2/50 px-3.5 py-3">
            <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{t.label}</div>
            <div className="num mt-0.5 text-lg font-semibold">{formatCount(t.value)}</div>
          </div>
        ))}
      </div>
      <SendRequestForm key={client.id} client={client} contacts={contacts} settings={settings} sendRequest={actions.sendRequest} />
      <SettingsForm key={`${client.id}-settings`} client={client} settings={settings} updateSettings={actions.updateSettings} />
      <p className="text-xs leading-relaxed text-fg-3">Texts and emails go out through the Inbox once it is connected. Until then every request is recorded here and on the contact.</p>
    </PanelFrame>
  );
}

export { requestStatusLabel, triggerLabel };
