import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { IntegrationsHub, type HubData, type HubTab } from "@/components/integrations/hub";
import { flatten } from "@/components/automations/model";
import { Shell } from "@/components/shell";
import { listWorkflows } from "@/lib/data/automations";
import { listConnections, listHooksIn, listHooksOut, listKeys, listLogs } from "@/lib/data/integrations";
import { findContact, listClients } from "@/lib/data/store";

export const metadata = { title: "Integrations" };

const DAY = 86400000;
const tabs: HubTab[] = ["apps", "webhooks", "keys", "activity"];

async function Hub({ searchParams }: { searchParams: Promise<{ client?: string; tab?: string }> }) {
  const sp = await searchParams;
  await connection();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  const now = new Date();
  const clients = listClients(now)
    .map((c) => ({ id: c.account.id, name: c.account.name, slug: c.account.slug, mode: c.mode }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const client = clients.find((c) => c.id === sp.client || c.slug === sp.client) ?? clients[0]!;

  // Which workflows lean on each app and webhook, so disconnecting or deleting says what it breaks.
  const usage: Record<string, string[]> = {};
  const note = (key: string, name: string) => {
    const list = (usage[key] ??= []);
    if (!list.includes(name)) list.push(name);
  };
  for (const wf of listWorkflows(now, client.id)) {
    if (wf.trigger.type === "app_event" && wf.trigger.appEvent) note(wf.trigger.appEvent.split(".")[0]!, wf.name);
    if (wf.trigger.type === "webhook_received" && wf.trigger.hookId) note(wf.trigger.hookId, wf.name);
    for (const s of flatten(wf.steps)) {
      if (s.type === "app_action" && s.app) note(s.app, wf.name);
      if (s.type === "send_webhook" && s.hookId) note(s.hookId, wf.name);
    }
  }

  const since = new Date(now.getTime() - 30 * DAY).toISOString();
  const logs = listLogs(now, client.id)
    .filter((l) => l.at >= since)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 400);
  const contacts: Record<string, string> = {};
  for (const l of logs) {
    if (!l.contactId || contacts[l.contactId]) continue;
    const c = findContact(now, l.contactId);
    if (c) contacts[c.id] = `${c.firstName} ${c.lastName}`.trim();
  }

  const data: HubData = {
    client,
    connections: listConnections(now, client.id),
    hooksIn: listHooksIn(now, client.id),
    hooksOut: listHooksOut(now, client.id),
    keys: listKeys(now, client.id).map((k) => ({ ...k, hash: "" })),
    logs,
    contacts,
    usage,
  };
  return <IntegrationsHub key={client.id} clients={clients} data={data} origin={origin} nowIso={now.toISOString()} initialTab={tabs.includes(sp.tab as HubTab) ? (sp.tab as HubTab) : "apps"} />;
}

export default function IntegrationsPage({ searchParams }: { searchParams: Promise<{ client?: string; tab?: string }> }) {
  return (
    <Shell current="/agency/integrations">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Hub searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
