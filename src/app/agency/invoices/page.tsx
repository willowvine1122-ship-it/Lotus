import { openWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import { connection } from "next/server";
import { InvoicesBoard } from "@/components/field/invoices-board";
import { customerRefs, fieldClientRefs, resolveClient } from "@/components/field/data";
import { Shell } from "@/components/shell";
import { listInvoices, listJobs } from "@/lib/data/field-store";
import { recordPaymentAction, sendInvoiceAction, voidInvoiceAction } from "./actions";

export const metadata = { title: "Invoices" };

type Scope = "unpaid" | "overdue" | "draft" | "paid" | "all";
const scopes: Scope[] = ["unpaid", "overdue", "draft", "paid", "all"];

async function Board({ searchParams }: { searchParams: Promise<{ client?: string; show?: string }> }) {
  const { client, show } = await searchParams;
  await connection();
  await openWorkspace();
  const now = new Date();
  const clients = fieldClientRefs(now);
  return (
    <InvoicesBoard
      invoices={listInvoices(now)}
      clients={clients}
      customers={customerRefs(now, clients.map((c) => c.id))}
      jobNumbers={Object.fromEntries(listJobs(now).filter((j) => j.invoiceId).map((j) => [j.id, j.number]))}
      initialClientId={resolveClient(clients, client)?.id}
      initialScope={scopes.includes(show as Scope) ? (show as Scope) : undefined}
      nowIso={now.toISOString()}
      actions={{ send: sendInvoiceAction, void: voidInvoiceAction, recordPayment: recordPaymentAction }}
    />
  );
}

export default function InvoicesPage({ searchParams }: { searchParams: Promise<{ client?: string; show?: string }> }) {
  return (
    <Shell current="/agency/invoices">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
