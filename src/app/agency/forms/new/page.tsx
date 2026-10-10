import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { formClients } from "@/components/forms/data";
import { formTemplates } from "@/components/forms/model";
import { NewFormForm, type TemplateLite } from "@/components/forms/new-form";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { createFormAction } from "../actions";

export const metadata = { title: "New form" };

const templates: TemplateLite[] = formTemplates.map((t) => {
  const built = t.build("Client");
  return { key: t.key, name: t.name, summary: t.summary, modes: t.modes, types: built.questions.map((q) => q.type), scoring: built.scoring };
});

async function Form({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  const clients = formClients(new Date());
  return (
    <div className="bg-surface">
      <NewFormForm action={createFormAction} clients={clients} templates={templates} initialClientId={clients.find((c) => c.id === client || c.slug === client)?.id} />
    </div>
  );
}

export default function NewFormPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/forms">
      <PageHeader
        title="New form"
        meta={
          <Link href="/agency/forms" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Forms
          </Link>
        }
      />
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
