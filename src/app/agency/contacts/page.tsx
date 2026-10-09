import { Suspense } from "react";
import { connection } from "next/server";
import { ContactsBoard } from "@/components/crm/contacts-board";
import { crmActivities, crmClients, crmPipelines, listContacts, teamDirectory } from "@/components/crm/data";
import { Shell } from "@/components/shell";
import { logActivityAction, moveStageAction, toggleDndAction } from "./actions";

export const metadata = { title: "Contacts" };

async function Board({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  const now = new Date();
  const clients = crmClients(now);
  const contacts = listContacts(now);
  const initial = clients.find((c) => c.id === client || c.slug === client)?.id;
  return (
    <ContactsBoard
      contacts={contacts}
      activities={crmActivities(now, contacts.map((c) => c.id))}
      clients={clients}
      pipelines={crmPipelines(now, clients)}
      team={teamDirectory}
      nowIso={now.toISOString()}
      initialClientId={initial}
      actions={{ moveStage: moveStageAction, logActivity: logActivityAction, toggleDnd: toggleDndAction }}
    />
  );
}

export default function ContactsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/contacts">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
