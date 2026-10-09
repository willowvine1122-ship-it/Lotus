"use client";

import { useActionState, useRef, useState } from "react";
import { Lock, Send, X } from "lucide-react";
import { replyAction, startConversationAction, type InboxActionState } from "@/app/agency/inbox/actions";
import { Segmented } from "@/components/diagnostic/primitives";
import { Field, Input, Select, SubmitButton, controlClass } from "@/components/form";
import type { Channel, Contact, InboxThread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChannelIcon, channelLabel, channels } from "./channel";
import { contactName } from "./format";

/*
 * Reply composer under a thread, and the new-message form that takes the
 * thread's place. Sending is recorded in the demo store; nothing leaves the
 * app until the channel providers are connected.
 */

/** Which channels can reach this contact, and why not when they cannot. */
export function channelAvailability(contact: Contact, thread?: InboxThread): Record<Channel, string | null> {
  const hasFacebook = thread?.messages.some((m) => m.channel === "facebook" && m.direction === "inbound") ?? false;
  return {
    sms: !contact.phone ? "No phone number" : contact.doNotContact.sms ? "Opted out of texts" : null,
    email: !contact.email ? "No email address" : contact.doNotContact.email ? "Opted out of email" : null,
    whatsapp: !contact.phone ? "No phone number" : null,
    facebook: hasFacebook ? null : "Has not messaged your page",
  };
}

function addressFor(contact: Contact, ch: Channel) {
  if (ch === "email") return contact.email;
  if (ch === "facebook") return "Messenger";
  return contact.phone;
}

const SMS_SEGMENT = 160;

const replyPlaceholder: Record<Channel, string> = {
  sms: "Write a text reply",
  email: "Write an email reply",
  whatsapp: "Write a WhatsApp reply",
  facebook: "Write a Messenger reply",
};

function ChannelSelect({ value, onChange, availability, id }: { value: Channel; onChange: (c: Channel) => void; availability: Record<Channel, string | null>; id: string }) {
  return (
    <span className="relative inline-flex items-center">
      <ChannelIcon channel={value} className="pointer-events-none absolute left-2 text-fg-2" />
      <select
        id={id}
        name="channel"
        value={value}
        onChange={(e) => onChange(e.target.value as Channel)}
        className="h-7 w-[136px] rounded border border-line-strong bg-surface pl-7 pr-6 text-xs font-medium text-fg transition-colors duration-150 hover:border-fg-3 focus:border-brand focus:outline-none"
      >
        {channels.map((ch) => (
          <option key={ch} value={ch} disabled={availability[ch] !== null}>
            {channelLabel[ch]}
            {availability[ch] ? ` (${availability[ch]})` : ""}
          </option>
        ))}
      </select>
    </span>
  );
}

function submitOnModEnter(e: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  }
}

export function Composer({ thread }: { thread: InboxThread }) {
  const availability = channelAvailability(thread.contact, thread);
  const lastInbound = [...thread.messages].reverse().find((m) => m.kind === "message" && m.direction === "inbound");
  const preferred = lastInbound?.channel ?? thread.messages[thread.messages.length - 1]?.channel ?? "sms";
  const firstOpen = availability[preferred] === null ? preferred : (channels.find((c) => availability[c] === null) ?? preferred);

  const [mode, setMode] = useState<"message" | "note">("message");
  const [channel, setChannel] = useState<Channel>(firstOpen);
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState(() => {
    const s = [...thread.messages].reverse().find((m) => m.channel === "email" && m.subject)?.subject;
    return s ? (s.startsWith("Re:") ? s : `Re: ${s}`) : "";
  });
  const textRef = useRef<HTMLTextAreaElement>(null);

  const [state, action] = useActionState(async (prev: InboxActionState, fd: FormData) => {
    const r = await replyAction(prev, fd);
    if (r?.ok) {
      setBody("");
      textRef.current?.focus();
    }
    return r;
  }, null);

  const isNote = mode === "note";
  const isEmail = !isNote && channel === "email";
  const isText = !isNote && channel !== "email";
  const segments = Math.max(1, Math.ceil(body.length / SMS_SEGMENT));
  const errors = state && !state.ok ? state.errors : undefined;
  const to = addressFor(thread.contact, channel);

  return (
    <form action={action} className={cn("border-t border-line px-4 py-3 md:px-5", isNote ? "bg-surface-2/60" : "bg-surface")}>
      <input type="hidden" name="conversationId" value={thread.id} />
      <input type="hidden" name="kind" value={mode} />
      <div className="mx-auto flex max-w-[760px] flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            tone="paper"
            label="Compose"
            value={mode}
            onChange={setMode}
            options={[
              { value: "message", label: "Reply" },
              { value: "note", label: "Internal note" },
            ]}
          />
          {isNote ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-fg-3">
              <Lock className="size-3.5" strokeWidth={1.75} aria-hidden />
              Only your team sees notes
            </span>
          ) : (
            <>
              <label htmlFor={`via-${thread.id}`} className="text-xs text-fg-3">
                via
              </label>
              <ChannelSelect id={`via-${thread.id}`} value={channel} onChange={setChannel} availability={availability} />
              {to && <span className="num min-w-0 truncate text-xs text-fg-3">to {to}</span>}
            </>
          )}
        </div>
        {isNote && <input type="hidden" name="channel" value={channel} />}

        {isEmail && (
          <input
            name="subject"
            aria-label="Subject"
            aria-invalid={errors?.subject ? true : undefined}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className={cn(controlClass, "h-8")}
          />
        )}

        <textarea
          ref={textRef}
          name="body"
          aria-label={isNote ? "Internal note" : `Message to ${contactName(thread.contact)}`}
          aria-invalid={errors?.body ? true : undefined}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={submitOnModEnter}
          rows={isEmail ? 5 : 3}
          placeholder={isNote ? "Leave a note for the team. Mention what you promised or what to check." : replyPlaceholder[channel]}
          className={cn(controlClass, "h-auto max-h-[240px] min-h-[76px] resize-y py-2 leading-relaxed", isNote && "border-dashed")}
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="min-w-0 flex-1 text-xs text-fg-3" aria-live="polite">
            {errors?.channel || errors?.body || errors?.subject || state?.message ? (
              <span className="text-red" role="alert">
                {errors?.channel ?? errors?.body ?? errors?.subject ?? state?.message}
              </span>
            ) : isText ? (
              <span className="num">
                {body.length} characters{channel === "sms" && body.length > 0 && ` · ${segments} segment${segments === 1 ? "" : "s"}`}
                <span className="hidden sm:inline"> · Ctrl+Enter to send</span>
              </span>
            ) : (
              <span className="hidden sm:inline">Ctrl+Enter to {isNote ? "save" : "send"}</span>
            )}
          </p>
          <SubmitButton pendingLabel={isNote ? "Saving" : "Sending"} className="ml-auto h-8">
            {isNote ? <Lock className="size-3.5" strokeWidth={2} /> : <Send className="size-3.5" strokeWidth={2} />}
            {isNote ? "Add note" : "Send"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function NewConversation({
  contacts,
  clients,
  defaultClientId,
  defaultContactId,
  onClose,
  onStarted,
}: {
  contacts: Contact[];
  clients: { id: string; name: string; mode: "marketing" | "fundraising" }[];
  defaultClientId: string | null;
  defaultContactId?: string | null;
  onClose: () => void;
  onStarted: (conversationId: string) => void;
}) {
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [contactId, setContactId] = useState(defaultContactId ?? "");
  const [channel, setChannel] = useState<Channel>(() => {
    const c = contacts.find((x) => x.id === defaultContactId);
    if (!c) return "sms";
    const a = channelAvailability(c);
    return channels.find((ch) => a[ch] === null) ?? "sms";
  });

  const forClient = contacts.filter((c) => !clientId || c.accountId === clientId).sort((a, b) => contactName(a).localeCompare(contactName(b)));
  const contact = contacts.find((c) => c.id === contactId);
  const availability = contact ? channelAvailability(contact) : { sms: null, email: null, whatsapp: null, facebook: "Reply from an existing conversation" };

  const [state, action] = useActionState(async (prev: InboxActionState, fd: FormData) => {
    const r = await startConversationAction(prev, fd);
    if (r?.ok && r.conversationId) onStarted(r.conversationId);
    return r;
  }, null);
  const errors = state && !state.ok ? state.errors : undefined;

  const pickContact = (id: string) => {
    setContactId(id);
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    const a = channelAvailability(c);
    if (a[channel] !== null) setChannel(channels.find((ch) => a[ch] === null) ?? "sms");
  };

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <header className="flex items-center gap-3 border-b border-line px-5 py-3">
        <h2 className="text-base font-semibold">New message</h2>
        <button type="button" onClick={onClose} aria-label="Close new message" className="ml-auto grid size-8 place-items-center rounded text-fg-2 transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </header>
      <form action={action} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto flex max-w-[560px] flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client" htmlFor="nc-client">
              <Select
                id="nc-client"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setContactId("");
                }}
              >
                <option value="">All clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="To" htmlFor="nc-contact" error={errors?.contactId}>
              <Select id="nc-contact" name="contactId" value={contactId} onChange={(e) => pickContact(e.target.value)} aria-invalid={errors?.contactId ? true : undefined}>
                <option value="">Pick a contact</option>
                {forClient.map((c) => (
                  <option key={c.id} value={c.id}>
                    {contactName(c)}
                    {!clientId ? ` · ${clientName(c.accountId)}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Channel" htmlFor="nc-channel" error={errors?.channel} hint={contact ? addressFor(contact, channel) : "Pick a contact to see where it goes"}>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Channel" id="nc-channel">
              {channels.map((ch) => {
                const blocked = availability[ch];
                const active = channel === ch;
                return (
                  <label
                    key={ch}
                    title={blocked ?? undefined}
                    className={cn(
                      "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded border px-2.5 text-sm transition-colors duration-150",
                      active ? "border-rail bg-rail text-rail-fg" : "border-line-strong bg-surface text-fg hover:border-fg-3",
                      blocked && "cursor-not-allowed opacity-50 hover:border-line-strong",
                    )}
                  >
                    <input type="radio" name="channel" value={ch} checked={active} disabled={!!blocked} onChange={() => setChannel(ch)} className="sr-only" />
                    <ChannelIcon channel={ch} />
                    {channelLabel[ch]}
                  </label>
                );
              })}
            </div>
          </Field>

          {channel === "email" && (
            <Field label="Subject" htmlFor="nc-subject" error={errors?.subject}>
              <Input id="nc-subject" name="subject" aria-invalid={errors?.subject ? true : undefined} />
            </Field>
          )}

          <Field label="Message" htmlFor="nc-body" error={errors?.body}>
            <textarea id="nc-body" name="body" rows={6} onKeyDown={submitOnModEnter} aria-invalid={errors?.body ? true : undefined} className={cn(controlClass, "h-auto min-h-[140px] resize-y py-2 leading-relaxed")} />
          </Field>

          <div className="flex items-center gap-3">
            <SubmitButton pendingLabel="Sending">
              <Send className="size-3.5" strokeWidth={2} />
              Send
            </SubmitButton>
            <button type="button" onClick={onClose} className="text-sm text-fg-2 hover:text-fg hover:underline">
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
