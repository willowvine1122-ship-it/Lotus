import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { customerRefs, fieldClientRefs, priceBooks, resolveClient } from "@/components/field/data";
import { EstimateForm } from "@/components/field/estimate-form";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { createEstimateAction } from "../actions";

export const metadata = { title: "New estimate" };

async function Form({ searchParams }: { searchParams: Promise<{ client?: string; contact?: string }> }) {
  const { client, contact } = await searchParams;
  await connection();
  const now = new Date();
  const clients = fieldClientRefs(now);
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 bg-surface">
        <EstimateForm
          action={createEstimateAction}
          clients={clients}
          customers={Object.values(customerRefs(now, clients.map((c) => c.id)))}
          books={priceBooks(now, clients)}
          initialClientId={resolveClient(clients, client)?.id}
          initialContactId={contact}
        />
      </div>
      <aside className="border-t border-line px-5 py-6 text-sm leading-relaxed text-fg-2 lg:border-l lg:border-t-0 lg:px-6">
        <h2 className="text-sm font-semibold text-fg">What happens next</h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-4">
          <li>The customer gets a link with your options and approves the one they want.</li>
          <li>You see the answer here and on their timeline.</li>
          <li>One click turns the approved option into a job, with the same line items.</li>
        </ol>
      </aside>
    </div>
  );
}

export default function NewEstimatePage({ searchParams }: { searchParams: Promise<{ client?: string; contact?: string }> }) {
  return (
    <Shell current="/agency/estimates">
      <PageHeader
        title="New estimate"
        meta={
          <Link href="/agency/estimates" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Estimates
          </Link>
        }
      />
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
