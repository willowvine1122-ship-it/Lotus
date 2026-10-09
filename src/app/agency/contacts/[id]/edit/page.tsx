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
      <div className="bg-surface">
        <ContactForm action={updateContactAction.bind(null, id)} clients={clients} pipelines={crmPipelines(now, clients)} team={teamDirectory} contact={contact} onDelete={deleteContactAction.bind(null, id)} />
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
