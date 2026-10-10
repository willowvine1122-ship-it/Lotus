import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { teamDirectory } from "@/lib/data/store";
import { createClientAction } from "../actions";

export const metadata = { title: "Add client" };

export default function NewClientPage() {
  return (
    <Shell current="/agency/clients">
      <PageHeader
        title="Add client"
        meta={
          <Link href="/agency/clients" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Clients
          </Link>
        }
      />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 bg-surface">
          <ClientForm action={createClientAction} team={teamDirectory} />
        </div>
        <aside className="border-t border-line px-5 py-6 text-sm leading-relaxed text-fg-2 lg:border-l lg:border-t-0 lg:px-6">
          <h2 className="text-sm font-semibold text-fg">What happens next</h2>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-4">
            <li>The client gets a sub-account with its own contacts, inbox, calendar and funnels.</li>
            <li>It shows on the Daily Diagnostic as onboarding until the first full day of numbers lands.</li>
            <li>Two onboarding tasks are created for the assigned team.</li>
            <li>If you add a contact, an invite to the client view is prepared; it sends once email is connected.</li>
          </ol>
        </aside>
      </div>
    </Shell>
  );
}
