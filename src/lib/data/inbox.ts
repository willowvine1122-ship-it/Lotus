import { stamp } from "@/lib/ids";
import { messageReceived } from "./automation-events";
import type { Channel, Contact, Conversation, InboxMessage, InboxThread } from "@/lib/types";
import { defineModule } from "@/lib/server/workspace";
import { addActivity, findClient, findContact, getPipeline, listContacts } from "./store";

/*
 * Inbox conversations, saved per agency in the "inbox" module. Every
 * conversation belongs to one CRM contact. Whether a message actually
 * leaves (Twilio, Resend, Meta) is decided by the sending layer.
 */

interface InboxStore {
  conversations: Conversation[];
}

const inboxModule = defineModule<InboxStore>({ key: "inbox", init: () => ({ conversations: [] }) });

function store(_now: Date): InboxStore {
  return inboxModule.get();
}

function contactFor(now: Date, id: string): Contact | undefined {
  store(now);
  return findContact(now, id);
}

export function lastActivityAt(c: Conversation) {
  const last = [...c.messages].reverse().find((m) => m.kind === "message") ?? c.messages[c.messages.length - 1];
  return last?.sentAt ?? "";
}

/** Every conversation joined with its contact and client, newest first. */
export function listThreads(now: Date): InboxThread[] {
  const s = store(now);
  const out: InboxThread[] = [];
  for (const conv of s.conversations) {
    const contact = contactFor(now, conv.contactId);
    const client = findClient(now, conv.accountId);
    if (!contact || !client) continue;
    out.push({
      ...conv,
      contact,
      stageName: getPipeline(now, conv.accountId)?.stages.find((st) => st.id === contact.stageId)?.name,
      client: { id: client.account.id, name: client.account.name, slug: client.account.slug, mode: client.mode, health: client.health },
    });
  }
  return out.sort((a, b) => lastActivityAt(b).localeCompare(lastActivityAt(a)));
}

export function findConversation(now: Date, id: string) {
  return store(now).conversations.find((c) => c.id === id);
}

/** Contacts the composer can start a conversation with: every CRM contact. */
export function listInboxContacts(now: Date): Contact[] {
  store(now);
  return listContacts(now);
}

const activityKind: Record<Channel, "sms" | "email"> = { sms: "sms", email: "email", whatsapp: "sms", facebook: "sms" };
const channelLabel: Record<Channel, string> = { sms: "SMS", email: "Email", whatsapp: "WhatsApp", facebook: "Facebook" };

export function sendMessage(
  now: Date,
  conversationId: string,
  input: { channel: Channel; body: string; subject?: string; authorName: string; kind: "message" | "note" },
): InboxMessage | undefined {
  const conv = findConversation(now, conversationId);
  if (!conv) return undefined;
  const m: InboxMessage = {
    id: `${conv.id}-m-${stamp()}`,
    conversationId: conv.id,
    channel: input.channel,
    direction: "outbound",
    kind: input.kind,
    subject: input.kind === "message" && input.channel === "email" ? input.subject : undefined,
    body: input.body.trim(),
    authorName: input.authorName,
    status: input.kind === "message" ? (input.channel === "email" ? "sent" : "delivered") : undefined,
    sentAt: now.toISOString(),
  };
  conv.messages.push(m);
  if (input.kind === "message") {
    conv.unread = 0;
    if (!conv.assigneeName) conv.assigneeName = input.authorName;
    addActivity(now, conv.contactId, {
      kind: activityKind[input.channel],
      title: `${channelLabel[input.channel]} sent`,
      body: m.subject ? `${m.subject}: ${m.body}` : m.body,
      by: input.authorName,
    });
  }
  return m;
}

/** Reuses the contact's conversation when one exists, so each contact has one thread. */
export function startConversation(
  now: Date,
  input: { contactId: string; channel: Channel; body: string; subject?: string; authorName: string },
): Conversation | undefined {
  const contact = contactFor(now, input.contactId);
  if (!contact) return undefined;
  const s = store(now);
  let conv = s.conversations.find((c) => c.contactId === contact.id && c.accountId === contact.accountId);
  if (!conv) {
    conv = { id: `cv-${stamp()}`, accountId: contact.accountId, contactId: contact.id, assigneeName: input.authorName, status: "open", unread: 0, messages: [] };
    s.conversations.push(conv);
  }
  conv.status = "open";
  sendMessage(now, conv.id, { ...input, kind: "message" });
  return conv;
}

export function assignConversation(now: Date, id: string, assigneeName: string | undefined) {
  const conv = findConversation(now, id);
  if (conv) conv.assigneeName = assigneeName;
}

export function setConversationRead(now: Date, id: string, read: boolean) {
  const conv = findConversation(now, id);
  if (!conv) return;
  if (read) conv.unread = 0;
  else conv.unread = Math.max(1, conv.unread);
}

export function setConversationStatus(now: Date, id: string, status: Conversation["status"]) {
  const conv = findConversation(now, id);
  if (conv) conv.status = status;
}

/**
 * An inbound message from a provider webhook (Twilio, Resend, Meta). Lands on
 * the contact's conversation, reopens it, bumps unread, logs the activity and
 * starts any workflow listening for a reply.
 */
export function receiveMessage(now: Date, input: { contactId: string; channel: Channel; body: string; subject?: string }): Conversation | undefined {
  const contact = contactFor(now, input.contactId);
  if (!contact) return undefined;
  const s = store(now);
  let conv = s.conversations.find((c) => c.contactId === contact.id && c.accountId === contact.accountId);
  if (!conv) {
    conv = { id: `cv-${stamp()}`, accountId: contact.accountId, contactId: contact.id, status: "open", unread: 0, messages: [] };
    s.conversations.push(conv);
  }
  const m: InboxMessage = {
    id: `${conv.id}-m-${stamp()}`,
    conversationId: conv.id,
    channel: input.channel,
    direction: "inbound",
    kind: "message",
    subject: input.channel === "email" ? input.subject : undefined,
    body: input.body.trim(),
    sentAt: now.toISOString(),
  };
  conv.messages.push(m);
  conv.status = "open";
  conv.unread += 1;
  addActivity(now, contact.id, { kind: activityKind[input.channel], title: `${channelLabel[input.channel]} received`, body: m.subject ? `${m.subject}: ${m.body}` : m.body });
  messageReceived(now, contact.id, input.channel, m.body);
  return conv;
}
