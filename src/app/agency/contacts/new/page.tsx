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
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 bg-surface">
        <ContactForm action={createContactAction} clients={clients} pipelines={crmPipelines(now, clients)} team={teamDirectory} initialClientId={clients.find((c) => c.id === client || c.slug === client)?.id} />
      </div>
        <aside className="border-t border-line px-5 py-6 text-sm leading-relaxed text-fg-2 lg:border-l lg:border-t-0 lg:px-6">
          <h2 className="text-sm font-semibold text-fg">What happens next</h2>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-4">
            <li>The contact appears on the client&apos;s pipeline at the stage you pick.</li>
            <li>The owner sees them on the Contacts board and gets the daily flags.</li>
            <li>Email and text opt-outs are set from the contact page.</li>
          </ol>
        </aside>
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
