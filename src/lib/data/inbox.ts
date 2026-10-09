import type { Channel, Contact, Conversation, InboxMessage, InboxThread } from "@/lib/types";
import { demoInbox } from "./inbox-demo";
import { addActivity, findClient, findContact, listClients } from "./store";

/*
 * Demo inbox store. Conversations live in process memory on globalThis,
 * seeded per day like the client store, and are mutated by the inbox server
 * actions. Sending records the message and marks it delivered; nothing
 * leaves the app until Twilio, Resend and Meta are connected.
 */

interface InboxStore {
  seededFor: string;
  conversations: Conversation[];
  /** The inbox's own copy of its demo contacts, used when the CRM has no match. */
  contacts: Map<string, Contact>;
}

const g = globalThis as unknown as { __lotusInbox?: InboxStore };

function store(now: Date): InboxStore {
  const key = now.toISOString().slice(0, 10);
  if (!g.__lotusInbox || g.__lotusInbox.seededFor !== key) {
    const seed = demoInbox(now);
    g.__lotusInbox = {
      seededFor: key,
      conversations: seed.conversations,
      contacts: new Map(seed.contacts.map((c) => [c.id, c])),
    };
  }
  return g.__lotusInbox;
}

function contactFor(now: Date, id: string): Contact | undefined {
  return findContact(now, id) ?? store(now).contacts.get(id);
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
      client: { id: client.account.id, name: client.account.name, slug: client.account.slug, mode: client.mode, health: client.health },
    });
  }
  return out.sort((a, b) => lastActivityAt(b).localeCompare(lastActivityAt(a)));
}

export function findConversation(now: Date, id: string) {
  return store(now).conversations.find((c) => c.id === id);
}

/** Contacts the composer can start a conversation with, for one client or all. */
export function listInboxContacts(now: Date): Contact[] {
  const ids = new Set(listClients(now).map((c) => c.account.id));
  const s = store(now);
  const byId = new Map<string, Contact>();
  for (const c of s.contacts.values()) byId.set(c.id, contactFor(now, c.id) ?? c);
  return [...byId.values()].filter((c) => ids.has(c.accountId));
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
    id: `${conv.id}-m-${Date.now().toString(36)}`,
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
    conv = { id: `cv-${Date.now().toString(36)}`, accountId: contact.accountId, contactId: contact.id, assigneeName: input.authorName, status: "open", unread: 0, messages: [] };
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
