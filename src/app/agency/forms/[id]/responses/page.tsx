import { openWorkspace } from "@/lib/server/workspace";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { formClients, formStats } from "@/components/forms/data";
import { ResponsesView } from "@/components/forms/responses";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { contactName, findForm, listResponses } from "@/lib/data/forms";
import { deleteResponseAction } from "../../actions";

async function Responses({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ r?: string }> }) {
  const [{ id }, { r }] = await Promise.all([params, searchParams]);
  await connection();
  await openWorkspace();
  const now = new Date();
  const form = findForm(now, id);
  if (!form) notFound();
  const client = formClients(now).find((c) => c.id === form.accountId);
  if (!client) notFound();
  const responses = listResponses(now, id).map((x) => ({ ...x, contactName: contactName(now, x.contactId) }));
  return <ResponsesView form={form} client={client} responses={responses} stats={formStats(now, form)} nowIso={now.toISOString()} initialId={r} remove={deleteResponseAction} />;
}

export default function FormResponsesPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ r?: string }> }) {
  return (
    <Shell current="/agency/forms">
      <Suspense fallback={<PageHeader title="Responses" meta={<span className="text-fg-3">Loading…</span>} />}>
        <Responses {...props} />
      </Suspense>
    </Shell>
  );
}
