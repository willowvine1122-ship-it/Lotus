import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { customerRefs, fieldClientRefs, priceBooks, resolveClient } from "@/components/field/data";
import { JobForm } from "@/components/field/job-form";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { listTechnicians } from "@/lib/data/field-store";
import { createJobAction } from "../actions";

export const metadata = { title: "New job" };

async function Form({ searchParams }: { searchParams: Promise<{ client?: string; contact?: string }> }) {
  const { client, contact } = await searchParams;
  await connection();
  const now = new Date();
  const clients = fieldClientRefs(now);
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 bg-surface">
        <JobForm
          action={createJobAction}
          clients={clients}
          customers={Object.values(customerRefs(now, clients.map((c) => c.id)))}
          crew={listTechnicians(now)}
          books={priceBooks(now, clients)}
          initialClientId={resolveClient(clients, client)?.id}
          initialContactId={contact}
        />
      </div>
      <aside className="border-t border-line px-5 py-6 text-sm leading-relaxed text-fg-2 lg:border-l lg:border-t-0 lg:px-6">
        <h2 className="text-sm font-semibold text-fg">What happens next</h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-4">
          <li>The job lands on the dispatch board, in the crew&apos;s lane or in the queue.</li>
          <li>It shows on the customer&apos;s timeline in Contacts.</li>
          <li>When the crew marks it complete, invoice it in one click.</li>
        </ol>
      </aside>
    </div>
  );
}

export default function NewJobPage({ searchParams }: { searchParams: Promise<{ client?: string; contact?: string }> }) {
  return (
    <Shell current="/agency/jobs">
      <PageHeader
        title="New job"
        meta={
          <Link href="/agency/jobs" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Jobs
          </Link>
        }
      />
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
