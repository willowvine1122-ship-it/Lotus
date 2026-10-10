import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { ContactForm } from "@/components/crm/contact-form";
import { crmClients, crmPipelines, teamDirectory } from "@/components/crm/data";
import { fullName } from "@/components/crm/model";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { findContact } from "@/lib/data/store";
import { deleteContactAction, updateContactAction } from "../../actions";

async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const now = new Date();
  const contact = findContact(now, id);
  if (!contact) notFound();
  const clients = crmClients(now);
  return (
    <>
      <PageHeader
        title={`Edit ${fullName(contact)}`}
        meta={
          <Link href={`/agency/contacts/${id}`} className="inline-flex items-center gap-1 text-rail-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Back to contact
          </Link>
        }
      />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 bg-surface">
          <ContactForm action={updateContactAction.bind(null, id)} clients={clients} pipelines={crmPipelines(now, clients)} team={teamDirectory} contact={contact} onDelete={deleteContactAction.bind(null, id)} />
        </div>
        <aside className="border-t border-line px-5 py-6 text-sm leading-relaxed text-fg-2 lg:border-l lg:border-t-0 lg:px-6">
          <h2 className="text-sm font-semibold text-fg">Good to know</h2>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-4">
            <li>Changing the stage here logs a move on the activity trail.</li>
            <li>Deleting removes the contact and its history. Mark them lost or lapsed instead if you may need it.</li>
          </ol>
        </aside>
      </div>
    </>
  );
}

export default function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell current="/agency/contacts">
      <Suspense fallback={<PageHeader title="Edit contact" />}>
        <Edit params={params} />
      </Suspense>
    </Shell>
  );
}
