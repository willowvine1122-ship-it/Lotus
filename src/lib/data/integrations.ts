import { stamp } from "@/lib/ids";
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { ApiKey, Contact, ContactSource, IncomingWebhook, IntegrationConnection, IntegrationLog, IntegrationLogKind, OutgoingWebhook } from "@/lib/types";
import { appAction, appEvent, apps, extractContact, fillDone, findApp, type ContactFieldKey } from "@/components/integrations/catalog";
import { appEventReceived, contactCreated, webhookReceived } from "./automation-events";
import { defineModule } from "@/lib/server/workspace";
import { addActivity, createContact, findClient, findContact, listContacts, updateContact } from "./store";

/*
 * Integrations: which apps each client has connected, the webhooks in and
 * out, API keys, and a log of everything that crossed the boundary. Saved
 * per agency in the "integrations" module; webhook tokens and API key
 * hashes are public keys so an outside call finds its agency.
 *
 * What is real: incoming webhooks (POST /api/hooks/{token}) create and
 * update contacts and start workflows; outgoing webhooks POST signed JSON
 * to the URL; API keys authenticate /api/v1/contacts. What is stubbed until
 * each app is registered with its provider: the sign-in to the outside app
 * and delivery of app actions, which are recorded in the log instead.
 */

interface IntegrationStore {
  connections: IntegrationConnection[];
  hooksIn: IncomingWebhook[];
  hooksOut: OutgoingWebhook[];
  keys: ApiKey[];
  logs: IntegrationLog[];
}

const MAX_LOGS = 1000;

const integrationsModule = defineModule<IntegrationStore>({
  key: "integrations",
  init: () => ({ connections: [], hooksIn: [], hooksOut: [], keys: [], logs: [] }),
  publicKeys: (s) => [...s.hooksIn.map((h) => `hook:${h.token}`), ...s.keys.filter((k) => !k.revokedAt).map((k) => `apikey:${k.hash}`)],
});

const uid = (p: string) => `${p}-${stamp()}-${Math.floor(Math.random() * 1e6).toString(36)}`;
const token = (bytes = 18) => randomBytes(bytes).toString("base64url");
export const hashKey = (raw: string) => createHash("sha256").update(raw).digest("hex");

function store(_now: Date): IntegrationStore {
  return integrationsModule.get();
}

function pretty(payload: unknown) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return text.length > 6000 ? `${text.slice(0, 6000)}\n…` : text;
}

function log(now: Date, entry: Omit<IntegrationLog, "id" | "at"> & { at?: string }): IntegrationLog {
  const s = store(now);
  const l: IntegrationLog = { id: uid("new-log"), at: entry.at ?? now.toISOString(), ...entry };
  s.logs.push(l);
  if (s.logs.length > MAX_LOGS) s.logs.splice(0, s.logs.length - MAX_LOGS);
  return l;
}

/* ------------------------------ contacts ----------------------------- */

const digits = (p?: string) => (p ?? "").replace(/\D/g, "");

/** Find by email, then by the last ten digits of the phone, inside one client. */
export function matchContact(now: Date, accountId: string, f: { email?: string; phone?: string }): Contact | undefined {
  const pool = listContacts(now, accountId);
  const email = f.email?.toLowerCase();
  const phone = digits(f.phone).slice(-10);
  return (email ? pool.find((c) => c.email?.toLowerCase() === email) : undefined) ?? (phone.length >= 7 ? pool.find((c) => digits(c.phone).endsWith(phone)) : undefined);
}

/** Create or fill in a contact from outside data. Never overwrites a field the contact already has. */
export function upsertContact(now: Date, accountId: string, f: Partial<Record<ContactFieldKey, string>>, source: ContactSource, tags: string[]): { contact?: Contact; created: boolean } {
  const existing = matchContact(now, accountId, f);
  if (existing) {
    const patch: Partial<Contact> = {};
    if (!existing.email && f.email) patch.email = f.email;
    if (!existing.phone && f.phone) patch.phone = f.phone;
    if (!existing.company && f.company) patch.company = f.company;
    if (!existing.city && f.city) patch.city = f.city;
    const newTags = tags.filter((t) => !existing.tags.some((x) => x.toLowerCase() === t.toLowerCase()));
    if (newTags.length) patch.tags = [...existing.tags, ...newTags];
    updateContact(now, existing.id, patch);
    return { contact: existing, created: false };
  }
  if (!f.email && !f.phone && !f.firstName) return { created: false };
  const contact = createContact(now, {
    accountId,
    firstName: f.firstName || (f.email ? f.email.split("@")[0]! : "New"),
    lastName: f.lastName || (f.firstName ? "" : "contact"),
    email: f.email,
    phone: f.phone,
    company: f.company,
    city: f.city,
    tags,
    source,
  });
  return { contact, created: !!contact };
}

/* ------------------------------ connections ---------------------------- */

export function listConnections(now: Date, accountId?: string) {
  const all = store(now).connections;
  return accountId ? all.filter((c) => c.accountId === accountId) : all;
}

export function findConnection(now: Date, accountId: string, appId: string) {
  return store(now).connections.find((c) => c.accountId === accountId && c.appId === appId);
}

export function connectApp(now: Date, accountId: string, appId: string, accountLabel: string, by: string) {
  const app = findApp(appId);
  if (!app || !findClient(now, accountId)) return undefined;
  const existing = findConnection(now, accountId, appId);
  if (existing) return existing;
  const c: IntegrationConnection = { id: uid("new-conn"), accountId, appId, accountLabel: accountLabel.trim() || app.accountPlaceholder, connectedAt: now.toISOString(), connectedBy: by };
  store(now).connections.push(c);
  log(now, { accountId, kind: "app_event", ref: appId, title: `${app.name} connected`, status: "ok", detail: `Signed in as ${c.accountLabel} by ${by}` });
  return c;
}

export function disconnectApp(now: Date, accountId: string, appId: string, by: string) {
  const s = store(now);
  const app = findApp(appId);
  const before = s.connections.length;
  s.connections = s.connections.filter((c) => !(c.accountId === accountId && c.appId === appId));
  if (app && s.connections.length < before) log(now, { accountId, kind: "app_event", ref: appId, title: `${app.name} disconnected`, status: "ok", detail: `By ${by}. Workflow steps that use it will fail until it is connected again.` });
}

/** An event arrived from a connected app (or was sent as a test): contact first, then workflows. */
export function receiveAppEvent(now: Date, accountId: string, key: string, payload: Record<string, string>, opts: { test?: boolean } = {}) {
  const ev = appEvent(key);
  if (!ev) return { ok: false as const, error: "Unknown event" };
  if (!findConnection(now, accountId, ev.app.id)) return { ok: false as const, error: `${ev.app.name} isn't connected for this client` };
  const source: ContactSource = ev.app.id === "meta_lead_ads" ? "meta" : ev.app.id === "google_ads" ? "google" : "import";
  const f = extractContact(payload);
  const { contact, created } = upsertContact(now, accountId, f, source, [ev.app.name]);
  if (contact) {
    addActivity(now, contact.id, { kind: "form", title: `${ev.app.name}: ${ev.trigger.label}`, body: Object.entries(payload).map(([k, v]) => `${k}: ${v}`).join("\n"), by: ev.app.name });
    if (created) contactCreated(now, contact);
  }
  const runs = contact ? appEventReceived(now, contact.id, key, `${ev.app.name}: ${ev.trigger.label}`) : [];
  log(now, {
    accountId,
    kind: "app_event",
    ref: ev.app.id,
    title: `${ev.trigger.label}${opts.test ? " (test)" : ""}`,
    status: contact ? "ok" : "failed",
    detail: contact ? `${created ? "Created" : "Updated"} ${contact.firstName} ${contact.lastName}${runs.length ? ` · started ${runs.length} ${runs.length === 1 ? "workflow" : "workflows"}` : ""}` : "No email, phone or name in the event, so no contact was made",
    payload: pretty(payload),
    contactId: contact?.id,
  });
  return { ok: true as const, contactId: contact?.id, created, workflows: runs.length };
}

export function sendTestEvent(now: Date, accountId: string, key: string) {
  const ev = appEvent(key);
  if (!ev) return { ok: false as const, error: "Unknown event" };
  // A fresh address each time so the test always shows a new contact arriving.
  const n = Math.floor(Math.random() * 9000 + 1000);
  const sample = { ...ev.trigger.sample, email: ev.trigger.sample.email?.replace("@", `+${n}@`) ?? "" };
  return receiveAppEvent(now, accountId, key, sample, { test: true });
}

const importPeople = [
  ["Avery", "Brooks"], ["Riley", "Chen"], ["Quinn", "Patel"], ["Harper", "Nguyen"], ["Rowan", "Garcia"], ["Emerson", "Hill"], ["Sage", "Ward"], ["Parker", "Diaz"], ["Reese", "Murphy"], ["Dakota", "Price"], ["Skyler", "James"], ["Kendall", "Flores"],
] as const;

/** One-time import from an app that holds past records (Mailchimp audience, Calendly bookings). */
export function importFromApp(now: Date, accountId: string, appId: string) {
  const app = findApp(appId);
  if (!app?.importLabel) return { ok: false as const, error: "Nothing to import from this app" };
  if (!findConnection(now, accountId, appId)) return { ok: false as const, error: `Connect ${app.name} first` };
  const tag = `Imported from ${app.name}`;
  let created = 0;
  let updated = 0;
  for (const [first, last] of importPeople) {
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@example.com`;
    const r = upsertContact(now, accountId, { firstName: first, lastName: last, email }, "import", [tag]);
    if (r.created) created++;
    else if (r.contact) updated++;
    if (r.contact) addActivity(now, r.contact.id, { kind: "note", title: tag, by: app.name });
  }
  log(now, { accountId, kind: "import", ref: appId, title: app.importLabel, status: "ok", detail: `${created} new contacts, ${updated} already in Lotus, all tagged “${tag}”` });
  return { ok: true as const, created, updated };
}

/* --------------------------- incoming webhooks -------------------------- */

export function listHooksIn(now: Date, accountId?: string) {
  const all = store(now).hooksIn;
  return accountId ? all.filter((h) => h.accountId === accountId) : all;
}

export function findHookIn(now: Date, id: string) {
  return store(now).hooksIn.find((h) => h.id === id);
}

export function createHookIn(now: Date, accountId: string, name: string, tags: string[]) {
  if (!findClient(now, accountId)) return undefined;
  const h: IncomingWebhook = { id: uid("new-in"), accountId, name: name.trim(), token: token(), mapping: {}, tags, createdAt: now.toISOString() };
  store(now).hooksIn.push(h);
  return h;
}

export function updateHookIn(now: Date, id: string, patch: Partial<Pick<IncomingWebhook, "name" | "mapping" | "tags">>) {
  const h = findHookIn(now, id);
  if (h) Object.assign(h, patch);
  return h;
}

export function deleteHookIn(now: Date, id: string) {
  const s = store(now);
  s.hooksIn = s.hooksIn.filter((h) => h.id !== id);
}

/**
 * Something posted to /api/hooks/{token}. Creates or updates the contact,
 * logs it on the timeline, starts workflows listening for this webhook.
 */
export function receiveWebhook(now: Date, hookToken: string, payload: unknown, opts: { test?: boolean } = {}) {
  const h = store(now).hooksIn.find((x) => x.token === hookToken);
  if (!h) return { status: 404, body: { ok: false, error: "No webhook at this address. Check the URL in Lotus › Integrations." } };
  const f = extractContact(payload, h.mapping);
  const { contact, created } = upsertContact(now, h.accountId, f, "import", h.tags);
  if (!contact) {
    log(now, { accountId: h.accountId, kind: "webhook_in", ref: h.id, title: `${h.name}${opts.test ? " (test)" : ""}`, status: "failed", code: 422, detail: "No email, phone or name found. Map the fields in the webhook settings.", payload: pretty(payload) });
    return { status: 422, body: { ok: false, error: "Couldn't find an email, phone or name in the payload. Set a field mapping for this webhook in Lotus." } };
  }
  addActivity(now, contact.id, { kind: "form", title: `Received from the “${h.name}” webhook`, body: summarise(payload), by: "Webhook" });
  if (created) contactCreated(now, contact);
  const runs = webhookReceived(now, contact.id, h.id, `Posted to “${h.name}”`);
  log(now, {
    accountId: h.accountId,
    kind: "webhook_in",
    ref: h.id,
    title: `${h.name}${opts.test ? " (test)" : ""}`,
    status: "ok",
    code: 200,
    detail: `${created ? "Created" : "Updated"} ${contact.firstName} ${contact.lastName}${runs.length ? ` · started ${runs.length} ${runs.length === 1 ? "workflow" : "workflows"}` : ""}`,
    payload: pretty(payload),
    contactId: contact.id,
  });
  return { status: 200, body: { ok: true, contactId: contact.id, created, workflowsStarted: runs.length } };
}

function summarise(payload: unknown) {
  if (!payload || typeof payload !== "object") return String(payload ?? "");
  return Object.entries(payload as Record<string, unknown>)
    .filter(([, v]) => v !== null && typeof v !== "object")
    .slice(0, 12)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("\n");
}

/* --------------------------- outgoing webhooks -------------------------- */

export function listHooksOut(now: Date, accountId?: string) {
  const all = store(now).hooksOut;
  return accountId ? all.filter((h) => h.accountId === accountId) : all;
}

export function findHookOut(now: Date, id: string) {
  return store(now).hooksOut.find((h) => h.id === id);
}

export function createHookOut(now: Date, accountId: string, name: string, url: string) {
  if (!findClient(now, accountId)) return undefined;
  const h: OutgoingWebhook = { id: uid("new-out"), accountId, name: name.trim(), url: url.trim(), secret: `whsec_${token(24)}`, createdAt: now.toISOString() };
  store(now).hooksOut.push(h);
  return h;
}

export function updateHookOut(now: Date, id: string, patch: Partial<Pick<OutgoingWebhook, "name" | "url">>) {
  const h = findHookOut(now, id);
  if (h) Object.assign(h, patch);
  return h;
}

export function deleteHookOut(now: Date, id: string) {
  const s = store(now);
  s.hooksOut = s.hooksOut.filter((h) => h.id !== id);
}

export function contactPayload(now: Date, c: Contact) {
  const client = findClient(now, c.accountId);
  return {
    id: c.id,
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email ?? null,
    phone: c.phone ?? null,
    company: c.company ?? null,
    city: c.city ?? null,
    tags: c.tags,
    source: c.source,
    stage: c.stageId,
    owner: c.ownerName ?? null,
    value: c.valueCents / 100,
    created_at: c.createdAt,
    client: client ? { id: client.account.id, name: client.account.name } : null,
  };
}

/** Signs the body like Stripe does: t=timestamp,v1=hmac(secret, "t.body"). */
export function sign(secret: string, body: string, at: Date) {
  const t = Math.floor(at.getTime() / 1000);
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

/** Only public http(s) hosts: no loopback, link-local or private ranges from a server that can reach them. */
export function safeUrl(raw: string): URL | undefined {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host === "metadata.google.internal") return undefined;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host === "[::1]" || host.startsWith("[fd") || host.startsWith("[fe80")) return undefined;
    return u;
  } catch {
    return undefined;
  }
}

/**
 * POST the event to an outgoing webhook. Resolves once the receiver answers
 * (or after 8 seconds); the log entry is written straight away and updated
 * with the response code.
 */
export async function deliver(now: Date, hook: OutgoingWebhook, event: string, data: unknown, opts: { contactId?: string; test?: boolean } = {}) {
  const body = JSON.stringify({ event, sent_at: now.toISOString(), data });
  const entry = log(now, { accountId: hook.accountId, kind: "webhook_out", ref: hook.id, title: `${hook.name}${opts.test ? " (test)" : ""}`, status: "ok", detail: "Sending…", payload: pretty(JSON.parse(body)), contactId: opts.contactId });
  const url = safeUrl(hook.url);
  if (!url) {
    Object.assign(entry, { status: "failed", detail: "Blocked: the URL must be a public http(s) address" });
    return entry;
  }
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "Lotus-Webhooks/1.0", "x-lotus-event": event, "x-lotus-signature": sign(hook.secret, body, now) },
      body,
      signal: AbortSignal.timeout(8000),
      redirect: "manual",
    });
    Object.assign(entry, { code: res.status, status: res.ok ? "ok" : "failed", detail: `${res.ok ? "Delivered" : "Rejected"}: HTTP ${res.status} in ${Date.now() - started} ms` });
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? "no answer within 8 seconds" : err instanceof Error ? err.message : "network error";
    Object.assign(entry, { status: "failed", detail: `Not delivered: ${reason}` });
  }
  return entry;
}

/* --------------------- what automations call into --------------------- */

type StepResult = { status: "done" | "skipped" | "failed"; detail: string };

/** Workflow step: post the contact to an outgoing webhook. A replay records without sending. */
export function stepSendWebhook(now: Date, accountId: string, hookId: string, contact: Contact, workflowName: string, opts: { replay: boolean; at: Date }): StepResult {
  const hook = findHookOut(now, hookId);
  if (!hook || hook.accountId !== accountId) return { status: "failed", detail: "Failed: that webhook was deleted" };
  const data = { contact: contactPayload(now, contact), workflow: workflowName };
  if (opts.replay) {
    log(now, { accountId, kind: "webhook_out", ref: hook.id, title: hook.name, status: "ok", code: 200, detail: `Delivered: HTTP 200 in ${80 + (contact.id.length * 17) % 300} ms`, payload: pretty({ event: "workflow.step", sent_at: opts.at.toISOString(), data }), contactId: contact.id, at: opts.at.toISOString() });
  } else {
    void deliver(now, hook, "workflow.step", data, { contactId: contact.id });
  }
  return { status: "done", detail: `Posted to ${hook.name} (${new URL(hook.url).host})` };
}

/** Workflow step: do something in a connected app. Recorded, not delivered, until the app is registered. */
export function stepAppAction(now: Date, accountId: string, app: string, action: string, fields: Record<string, string>, contact: Contact, opts: { replay: boolean; at: Date }): StepResult {
  const a = appAction(app, action);
  if (!a) return { status: "failed", detail: "Failed: that app action no longer exists" };
  if (!findConnection(now, accountId, app)) return { status: "failed", detail: `Failed: ${a.app.name} isn't connected for this client` };
  const done = fillDone(a.action.done, fields);
  log(now, {
    accountId,
    kind: "app_action",
    ref: app,
    title: `${a.action.label}`,
    status: "ok",
    detail: done,
    payload: pretty(fields),
    contactId: contact.id,
    at: opts.at.toISOString(),
  });
  return { status: "done", detail: done };
}

/* -------------------------------- API keys ------------------------------- */

export function listKeys(now: Date, accountId?: string) {
  const all = store(now).keys;
  return accountId ? all.filter((k) => k.accountId === accountId) : all;
}

/** Returns the full key once; only its hash is kept. */
export function createKey(now: Date, accountId: string, label: string, by: string) {
  if (!findClient(now, accountId)) return undefined;
  const raw = `lts_${token(24)}`;
  const k: ApiKey = { id: uid("new-key"), accountId, label: label.trim(), prefix: raw.slice(0, 8), hash: hashKey(raw), createdAt: now.toISOString(), createdBy: by };
  store(now).keys.push(k);
  return { key: k, raw };
}

export function revokeKey(now: Date, id: string) {
  const k = store(now).keys.find((x) => x.id === id);
  if (k && !k.revokedAt) k.revokedAt = now.toISOString();
  return k;
}

/** The client a bearer key belongs to, or undefined. Marks the key used. */
/** The public address an API key is filed under, so a request can find its agency before opening it. */
export function apiKeyAddress(header: string | null) {
  const raw = header?.match(/^Bearer\s+(\S+)$/i)?.[1];
  return raw ? `apikey:${hashKey(raw)}` : null;
}

export function authenticate(now: Date, header: string | null) {
  const raw = header?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!raw) return undefined;
  const h = hashKey(raw);
  const k = store(now).keys.find((x) => x.hash === h && !x.revokedAt);
  if (k) k.lastUsedAt = now.toISOString();
  return k;
}

export function logApiCall(now: Date, key: ApiKey, title: string, code: number, detail: string, contactId?: string) {
  log(now, { accountId: key.accountId, kind: "api", ref: key.id, title, status: code < 400 ? "ok" : "failed", code, detail, contactId });
}

/** API create: same upsert as a webhook, with an explicit source. */
export function apiUpsertContact(now: Date, accountId: string, f: Partial<Record<ContactFieldKey, string>>, tags: string[]) {
  const r = upsertContact(now, accountId, f, "import", tags);
  if (r.contact && r.created) contactCreated(now, r.contact);
  return r;
}

/* --------------------------------- logs --------------------------------- */

export function listLogs(now: Date, accountId?: string): IntegrationLog[] {
  const all = store(now).logs;
  return accountId ? all.filter((l) => l.accountId === accountId) : all;
}

export function logKinds(): IntegrationLogKind[] {
  return ["app_event", "app_action", "webhook_in", "webhook_out", "api", "import"];
}

/** Contact ids the logs point at that still exist, for linking in the UI. */
export function liveContactIds(now: Date, ids: string[]) {
  return new Set(ids.filter((id) => !!findContact(now, id)));
}

export { apps };
