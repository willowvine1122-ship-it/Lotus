import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { ContactForm } from "@/components/crm/contact-form";
import { crmClients, crmPipelines, teamDirectory } from "@/components/crm/data";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { createContactAction } from "../actions";

export const metadata = { title: "Add contact" };

async function Form({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  const now = new Date();
  const clients = crmClients(now);
  return (
    <div className="bg-surface">
      <ContactForm action={createContactAction} clients={clients} pipelines={crmPipelines(now, clients)} team={teamDirectory} initialClientId={clients.find((c) => c.id === client || c.slug === client)?.id} />
    </div>
  );
}

export default function NewContactPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/contacts">
      <PageHeader
        title="Add contact"
        meta={
          <Link href="/agency/contacts" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Contacts
          </Link>
        }
      />
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
