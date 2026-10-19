import { openWorkspace } from "@/lib/server/workspace";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { websiteClients } from "@/components/websites/data";
import { siteTemplates } from "@/components/websites/model";
import { NewSiteForm, type SiteTemplateLite } from "@/components/websites/new-site";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { createWebsiteAction } from "../actions";

export const metadata = { title: "New website" };

const templates: SiteTemplateLite[] = siteTemplates.map((t) => {
  const built = t.build({ name: "Client" });
  return { key: t.key, name: t.name, summary: t.summary, modes: t.modes, pages: t.key === "blank" ? [] : built.pages.map((p) => p.title), color: built.brandColor };
});

async function Form({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  await openWorkspace();
  const clients = websiteClients(new Date());
  return (
    <div className="bg-surface">
      <NewSiteForm action={createWebsiteAction} clients={clients} templates={templates} initialClientId={clients.find((c) => c.id === client || c.slug === client)?.id} />
    </div>
  );
}

export default function NewWebsitePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/websites">
      <PageHeader
        title="New website"
        meta={
          <Link href="/agency/websites" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Websites
          </Link>
        }
      />
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
