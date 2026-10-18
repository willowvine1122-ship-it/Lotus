import { openWorkspace } from "@/lib/server/workspace";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { automationClients } from "@/components/automations/data";
import { NewWorkflowForm, type RecipeLite } from "@/components/automations/new-workflow-form";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { workflowTemplates } from "@/lib/data/automation-templates";
import { createWorkflowAction } from "../actions";

export const metadata = { title: "New workflow" };

const recipes: RecipeLite[] = workflowTemplates.map((t) => ({ id: t.id, name: t.name, description: t.description, mode: t.mode, trigger: t.trigger.type, steps: t.steps.map((s) => s.type) }));

async function Form({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  await openWorkspace();
  const clients = automationClients(new Date());
  return (
    <div className="bg-surface">
      <NewWorkflowForm action={createWorkflowAction} clients={clients} recipes={recipes} initialClientId={clients.find((c) => c.id === client || c.slug === client)?.id} />
    </div>
  );
}

export default function NewWorkflowPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/automations">
      <PageHeader
        title="New workflow"
        meta={
          <Link href="/agency/automations" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Automations
          </Link>
        }
      />
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
