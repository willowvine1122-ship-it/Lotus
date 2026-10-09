import { Suspense } from "react";
import { connection } from "next/server";
import { Inbox } from "@/components/inbox/inbox";
import { Shell } from "@/components/shell";
import { listInboxContacts, listThreads, setConversationRead } from "@/lib/data/inbox";
import { listClients, teamDirectory } from "@/lib/data/store";

export const metadata = { title: "Inbox" };

async function InboxLoader({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const params = await searchParams;
  const now = new Date();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const conversationId = one(params.c);
  // Opening a conversation from a link reads it, as clicking it in the list does.
  if (conversationId) setConversationRead(now, conversationId, true);
  const threads = listThreads(now);
  const clients = listClients(now)
    .map((c) => ({ id: c.account.id, name: c.account.name, slug: c.account.slug, mode: c.mode }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const clientSlug = one(params.client);
  return (
    <Inbox
      threads={threads}
      contacts={listInboxContacts(now)}
      clients={clients}
      team={teamDirectory}
      me="Afza"
      nowIso={now.toISOString()}
      initialClientId={clients.find((c) => c.slug === clientSlug)?.id ?? null}
      initialConversationId={conversationId ?? null}
    />
  );
}

export default function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Shell current="/agency/inbox">
      <Suspense
        fallback={
          <header className="bg-rail px-5 py-3 text-rail-fg md:px-6">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">Inbox</h1>
            <p className="text-xs text-rail-fg-2">Loading conversations…</p>
          </header>
        }
      >
        <InboxLoader searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
