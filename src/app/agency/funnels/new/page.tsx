import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { funnelClients } from "@/components/funnels/data";
import { NewFunnelForm } from "@/components/funnels/new-funnel-form";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { funnelTemplates } from "@/components/builder/templates";
import { stepKindLabel } from "@/components/builder/model";
import { createFunnelAction } from "../actions";

export const metadata = { title: "New funnel" };

async function Form({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  const now = new Date();
  const clients = funnelClients(now);
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 bg-surface">
        <NewFunnelForm
          action={createFunnelAction}
          clients={clients}
          templates={funnelTemplates.map((t) => ({ id: t.key, name: t.label, description: t.blurb, mode: t.mode, steps: t.steps.map((s) => s.name), kinds: t.steps.map((s) => stepKindLabel[s.kind]) }))}
          initialClientId={clients.find((c) => c.id === client || c.slug === client)?.id}
        />
      </div>
      <aside className="border-t border-line px-5 py-6 text-sm leading-relaxed text-fg-2 lg:border-l lg:border-t-0 lg:px-6">
        <h2 className="text-sm font-semibold text-fg">What happens next</h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-4">
          <li>The funnel opens as a draft with every step&apos;s page already built.</li>
          <li>Open any step in the page builder: drag sections and elements, edit text in place, set phone sizes.</li>
          <li>Every form submission becomes a contact on the client&apos;s pipeline.</li>
        </ol>
      </aside>
    </div>
  );
}

export default function NewFunnelPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/funnels">
      <PageHeader
        title="New funnel"
        meta={
          <Link href="/agency/funnels" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Funnels
          </Link>
        }
      />
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
