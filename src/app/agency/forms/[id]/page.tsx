import { notFound } from "next/navigation";
import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { FormBuilder } from "@/components/forms/builder";
import { formClients } from "@/components/forms/data";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { findForm, listResponses } from "@/lib/data/forms";
import { deleteFormAction, duplicateFormAction, saveFormAction, setFormStatusAction } from "../actions";

const actions = { save: saveFormAction, setStatus: setFormStatusAction, duplicate: duplicateFormAction, remove: deleteFormAction };

async function Builder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  const now = new Date();
  const form = findForm(now, id);
  if (!form) notFound();
  const client = formClients(now).find((c) => c.id === form.accountId);
  if (!client) notFound();
  return <FormBuilder initial={structuredClone(form)} client={client} responses={listResponses(now, id).length} origin={origin} nowIso={now.toISOString()} actions={actions} />;
}

export default function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell current="/agency/forms">
      <Suspense fallback={<PageHeader title="Form" meta={<span className="text-fg-3">Loading…</span>} />}>
        <Builder params={params} />
      </Suspense>
    </Shell>
  );
}
