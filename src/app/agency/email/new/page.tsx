import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { emailClients } from "@/components/email/data";
import { NewCampaignForm } from "@/components/email/new-campaign-form";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { emailTemplates } from "@/lib/data/email-templates";
import { createCampaignAction } from "../actions";

export const metadata = { title: "New campaign" };

async function Form({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  const clients = emailClients(new Date());
  return (
    <div className="bg-surface">
      <NewCampaignForm action={createCampaignAction} clients={clients} templates={emailTemplates} initialClientId={clients.find((c) => c.id === client || c.slug === client)?.id} />
    </div>
  );
}

export default function NewCampaignPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/email">
      <PageHeader
        title="New campaign"
        meta={
          <Link href="/agency/email" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Email
          </Link>
        }
      />
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
