import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft, MapPin } from "lucide-react";
import { ActivityTimeline, ContactDetails, LogActivityForm, StageSelect } from "@/components/crm/contact-panel";
import { crmClients, teamDirectory } from "@/components/crm/data";
import { fullName, sourceLabel } from "@/components/crm/model";
import { Avatar, SectionTitle, Tag } from "@/components/diagnostic/primitives";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { findContact, getPipeline, listActivities } from "@/lib/data/store";
import { personFor } from "@/components/crm/model";
import { ContactOpportunities } from "@/components/opportunities/contact-opportunities";
import { listOpportunities, listPipelines } from "@/lib/data/opportunities";
import { logActivityAction, moveStageAction, toggleDndAction } from "../actions";

async function ContactView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const now = new Date();
  const contact = findContact(now, id);
  if (!contact) notFound();
  const client = crmClients(now).find((c) => c.id === contact.accountId);
  const pipeline = getPipeline(now, contact.accountId);
  if (!client || !pipeline) notFound();
  const activities = listActivities(now, id);
  const owner = personFor(teamDirectory, contact.ownerName);
  const actions = { moveStage: moveStageAction, logActivity: logActivityAction, toggleDnd: toggleDndAction };
  return (
    <>
      <PageHeader
        title={fullName(contact)}
        meta={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/agency/contacts" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Contacts
            </Link>
            <span aria-hidden>·</span>
            <Link href={`/agency/clients/${client.slug}`} className="hover:underline">
              {client.name}
            </Link>
            <span aria-hidden>·</span>
            <span>{sourceLabel[contact.source]}</span>
            {contact.city && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" strokeWidth={1.75} />
                  {contact.city}
                </span>
              </>
            )}
          </span>
        }
        actions={
          <>
            {owner && <Avatar person={owner} size="md" />}
            <StageSelect contact={contact} pipeline={pipeline} moveStage={moveStageAction} className="h-8 border-rail-line bg-rail-2 text-rail-fg" />
          </>
        }
      />
      <div className="grid gap-x-10 gap-y-8 px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex max-w-[640px] flex-col gap-3">
          <SectionTitle sub="Everything that has happened, newest first.">Activity</SectionTitle>
          <LogActivityForm contact={contact} mode={client.mode} logActivity={logActivityAction} />
          <ActivityTimeline activities={activities} now={now} />
        </section>
        <aside className="flex flex-col gap-6">
          <ContactDetails contact={contact} client={client} team={teamDirectory} actions={actions} />
          <ContactOpportunities contactId={contact.id} clientSlug={client.slug} opportunities={listOpportunities(now, { contactId: contact.id })} pipelines={listPipelines(now, contact.accountId)} />
          {contact.tags.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionTitle>Tags</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

export default function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell current="/agency/contacts">
      <Suspense fallback={<PageHeader title="Contact" meta={<span className="text-fg-3">Loading…</span>} />}>
        <ContactView params={params} />
      </Suspense>
    </Shell>
  );
}
