import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { customerRefs, fieldClientRefs, priceBooks, resolveClient } from "@/components/field/data";
import { InvoiceForm } from "@/components/field/invoice-form";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { createInvoiceAction } from "../actions";

export const metadata = { title: "New invoice" };

async function Form({ searchParams }: { searchParams: Promise<{ client?: string; contact?: string }> }) {
  const { client, contact } = await searchParams;
  await connection();
  const now = new Date();
  const clients = fieldClientRefs(now);
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 bg-surface">
        <InvoiceForm
          action={createInvoiceAction}
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
          <li>The customer gets a link to pay by card or bank transfer.</li>
          <li>Payments land here and on the customer&apos;s timeline.</li>
          <li>Unpaid invoices turn red on the day after they are due.</li>
        </ol>
      </aside>
    </div>
  );
}

export default function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string; contact?: string }> }) {
  return (
    <Shell current="/agency/invoices">
      <PageHeader
        title="New invoice"
        meta={
          <Link href="/agency/invoices" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Invoices
          </Link>
        }
      />
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
