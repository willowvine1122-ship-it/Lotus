"use server";

import { actorName, withWorkspace } from "@/lib/server/workspace";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appEvent, findApp } from "@/components/integrations/catalog";
import {
  connectApp,
  contactPayload,
  createHookIn,
  createHookOut,
  createKey,
  deleteHookIn,
  deleteHookOut,
  deliver,
  disconnectApp,
  findHookIn,
  findHookOut,
  importFromApp,
  receiveWebhook,
  revokeKey,
  safeUrl,
  sendTestEvent,
  updateHookIn,
  updateHookOut,
} from "@/lib/data/integrations";
import { findClient, listContacts } from "@/lib/data/store";

/* Integrations actions. zod in, { ok, message } out, like the rest of Lotus. */

export type IntegrationResult = { ok: boolean; message?: string; errors?: Record<string, string>; id?: string; secret?: string };


function touch() {
  revalidatePath("/agency/integrations");
  revalidatePath("/agency/automations");
  revalidatePath("/agency/contacts");
}

const accountId = z.string().min(1).max(80);
const fail = (err: z.ZodError): IntegrationResult => {
  const errors: Record<string, string> = {};
  for (const i of err.issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { ok: false, errors, message: Object.values(errors)[0] };
};

export async function connectAppAction(input: { accountId: string; appId: string; accountLabel: string }): Promise<IntegrationResult> {
  return withWorkspace(async () => {
    const p = z.object({ accountId, appId: z.string().refine((v) => !!findApp(v), "Unknown app"), accountLabel: z.string().trim().max(120) }).safeParse(input);
    if (!p.success) return fail(p.error);
    const c = connectApp(new Date(), p.data.accountId, p.data.appId, p.data.accountLabel, actorName());
    if (!c) return { ok: false, message: "That client does not exist." };
    touch();
    return { ok: true, message: `${findApp(c.appId)!.name} connected as ${c.accountLabel}.` };
  });
}

export async function disconnectAppAction(input: { accountId: string; appId: string }): Promise<IntegrationResult> {
  return withWorkspace(async () => {
    const p = z.object({ accountId, appId: z.string().max(40) }).safeParse(input);
    if (!p.success) return fail(p.error);
    disconnectApp(new Date(), p.data.accountId, p.data.appId, actorName());
    touch();
    return { ok: true };
  });
}

export async function testEventAction(input: { accountId: string; event: string }): Promise<IntegrationResult> {
  return withWorkspace(async () => {
    const p = z.object({ accountId, event: z.string().refine((v) => !!appEvent(v), "Unknown event") }).safeParse(input);
    if (!p.success) return fail(p.error);
    const r = sendTestEvent(new Date(), p.data.accountId, p.data.event);
    touch();
    if (!r.ok) return { ok: false, message: r.error };
    return { ok: true, id: r.contactId, message: `Test ${appEvent(p.data.event)!.trigger.label.toLowerCase()} received. ${r.created ? "Created a contact" : "Updated a contact"}${r.workflows ? ` and started ${r.workflows} ${r.workflows === 1 ? "workflow" : "workflows"}` : ", no workflow is listening yet"}.` };
  });
}

export async function importAction(input: { accountId: string; appId: string }): Promise<IntegrationResult> {
  return withWorkspace(async () => {
    const p = z.object({ accountId, appId: z.string().max(40) }).safeParse(input);
    if (!p.success) return fail(p.error);
    const r = importFromApp(new Date(), p.data.accountId, p.data.appId);
    touch();
    if (!r.ok) return { ok: false, message: r.error };
    return { ok: true, message: `Imported ${r.created} new contacts${r.updated ? `; ${r.updated} were already in Lotus and got the tag` : ""}.` };
  });
}

const tagList = z.array(z.string().trim().min(1).max(40)).max(10);

export async function createHookInAction(input: { accountId: string; name: string; tags: string[] }): Promise<IntegrationResult> {
  return withWorkspace(async () => {
    const p = z.object({ accountId, name: z.string().trim().min(2, "Name it after what will post to it").max(60), tags: tagList }).safeParse(input);
    if (!p.success) return fail(p.error);
    const h = createHookIn(new Date(), p.data.accountId, p.data.name, p.data.tags);
    if (!h) return { ok: false, message: "That client does not exist." };
    touch();
    return { ok: true, id: h.id };
  });
}

const path = z.string().trim().max(80).regex(/^[\w.-]*$/, "Use letters, numbers, dots and underscores");

export async function updateHookInAction(input: { id: string; name: string; tags: string[]; mapping: Record<string, string> }): Promise<IntegrationResult> {
  return withWorkspace(async () => {
    const p = z
      .object({
        id: z.string().max(80),
        name: z.string().trim().min(2, "Name it").max(60),
        tags: tagList,
        mapping: z.object({ firstName: path, lastName: path, email: path, phone: path, company: path, city: path }).partial(),
      })
      .safeParse(input);
    if (!p.success) return fail(p.error);
    const mapping = Object.fromEntries(Object.entries(p.data.mapping).filter(([, v]) => v));
    if (!updateHookIn(new Date(), p.data.id, { name: p.data.name, tags: p.data.tags, mapping })) return { ok: false, message: "That webhook was deleted." };
    touch();
    return { ok: true, message: "Saved." };
  });
}

export async function testHookInAction(input: { id: string }): Promise<IntegrationResult> {
  return withWorkspace(async () => {
    const now = new Date();
    const h = findHookIn(now, z.string().max(80).parse(input.id));
    if (!h) return { ok: false, message: "That webhook was deleted." };
    const n = Math.floor(Math.random() * 9000 + 1000);
    const r = receiveWebhook(now, h.token, { first_name: "Test", last_name: `Lead ${n}`, email: `test.lead+${n}@example.com`, phone: "+1 555 010 4477", message: "Sent with “Send a test” in Lotus" }, { test: true });
    touch();
    return r.status === 200 ? { ok: true, message: `Test received: created Test Lead ${n}${r.body.workflowsStarted ? ` and started ${r.body.workflowsStarted} ${r.body.workflowsStarted === 1 ? "workflow" : "workflows"}` : ""}.` } : { ok: false, message: String(r.body.error) };
  });
}

export async function deleteHookInAction(input: { id: string }): Promise<IntegrationResult> {
  return withWorkspace(async () => {
    deleteHookIn(new Date(), z.string().max(80).parse(input.id));
    touch();
    return { ok: true };
  });
}

const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !!safeUrl(v), "Enter a public https:// address");

export async function createHookOutAction(input: { accountId: string; name: string; url: string }): Promise<IntegrationResult> {
  return withWorkspace(async () => {
    const p = z.object({ accountId, name: z.string().trim().min(2, "Name it after where it goes").max(60), url }).safeParse(input);
    if (!p.success) return fail(p.error);
    const h = createHookOut(new Date(), p.data.accountId, p.data.name, p.data.url);
    if (!h) return { ok: false, message: "That client does not exist." };
    touch();
    return { ok: true, id: h.id };
  });
}

export async function updateHookOutAction(input: { id: string; name: string; url: string }): Promise<IntegrationResult> {
  return withWorkspace(async () => {
    const p = z.object({ id: z.string().max(80), name: z.string().trim().min(2, "Name it").max(60), url }).safeParse(input);
    if (!p.success) return fail(p.error);
    if (!updateHookOut(new Date(), p.data.id, { name: p.data.name, url: p.data.url })) return { ok: false, message: "That webhook was deleted." };
    touch();
    return { ok: true, message: "Saved." };
  });
}

/** Sends a real, signed POST with a sample contact and waits for the answer. */
export async function testHookOutAction(input: { id: string }): Promise<IntegrationResult> {
  return withWorkspace(async () => {
    const now = new Date();
    const h = findHookOut(now, z.string().max(80).parse(input.id));
    if (!h) return { ok: false, message: "That webhook was deleted." };
    const sample = listContacts(now, h.accountId)[0];
    const entry = await deliver(now, h, "test", { contact: sample ? contactPayload(now, sample) : null, workflow: "Test from Lotus" }, { test: true, contactId: sample?.id });
    touch();
    return { ok: entry.status === "ok", message: entry.detail };
  });
}

export async function deleteHookOutAction(input: { id: string }): Promise<IntegrationResult> {
  return withWorkspace(async () => {
    deleteHookOut(new Date(), z.string().max(80).parse(input.id));
    touch();
    return { ok: true };
  });
}

export async function createKeyAction(input: { accountId: string; label: string }): Promise<IntegrationResult> {
  return withWorkspace(async () => {
    const p = z.object({ accountId, label: z.string().trim().min(2, "Say what will use the key").max(60) }).safeParse(input);
    if (!p.success) return fail(p.error);
    if (!findClient(new Date(), p.data.accountId)) return { ok: false, message: "That client does not exist." };
    const r = createKey(new Date(), p.data.accountId, p.data.label, actorName());
    if (!r) return { ok: false, message: "That client does not exist." };
    touch();
    return { ok: true, id: r.key.id, secret: r.raw };
  });
}

export async function revokeKeyAction(input: { id: string }): Promise<IntegrationResult> {
  return withWorkspace(async () => {
    revokeKey(new Date(), z.string().max(80).parse(input.id));
    touch();
    return { ok: true };
  });
}
