import type { Channel, Contact, Conversation, InboxMessage, InboxThread } from "@/lib/types";
import { demoInbox } from "./inbox-demo";
import { addActivity, findClient, findContact, getPipeline, listContacts } from "./store";

/*
 * Demo inbox store. Conversations live in process memory on globalThis,
 * seeded per day like the client store, and are mutated by the inbox server
 * actions. Sending records the message and marks it delivered; nothing
 * leaves the app until Twilio, Resend and Meta are connected.
 */

interface InboxStore {
  seededFor: string;
  conversations: Conversation[];
}

const g = globalThis as unknown as { __lotusInbox?: InboxStore };

function store(now: Date): InboxStore {
  const key = now.toISOString().slice(0, 10);
  if (!g.__lotusInbox || g.__lotusInbox.seededFor !== key) {
    const seed = demoInbox(now);
    // The people writing in are CRM contacts too: add them to the CRM store,
    // on the stage their client's pipeline would put them.
    const crm = listContacts(now);
    for (const c of seed.contacts) {
      if (crm.some((x) => x.id === c.id)) continue;
      const stages = getPipeline(now, c.accountId)?.stages ?? [];
      const stageId = c.recurring && stages.some((s) => s.id === "monthly") ? "monthly" : (stages[1]?.id ?? c.stageId);
      crm.push({ ...c, stageId });
    }
    g.__lotusInbox = { seededFor: key, conversations: seed.conversations };
  }
  return g.__lotusInbox;
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
