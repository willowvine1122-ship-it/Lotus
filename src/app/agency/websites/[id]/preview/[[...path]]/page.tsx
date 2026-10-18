import { openWorkspace } from "@/lib/server/workspace";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { builderRefs } from "@/components/builder/refs";
import { SitePage } from "@/components/websites/site";
import { findPage, findWebsite } from "@/lib/data/websites";

/* A website as visitors will see it, drafts included. Links stay inside the preview; forms don't submit. */

export const metadata = { title: "Preview", robots: { index: false } };

async function Preview({ params }: { params: Promise<{ id: string; path?: string[] }> }) {
  const { id, path } = await params;
  await connection();
  await openWorkspace();
  const now = new Date();
  const site = findWebsite(now, id);
  const page = site && findPage(site, path);
  if (!site || !page) notFound();
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-50 flex h-9 items-center justify-center gap-2 bg-rail text-xs text-rail-fg-2">
        Preview of <b className="font-semibold text-rail-fg">{site.name}</b> · {page.title} · forms don&apos;t submit here
      </div>
      <SitePage site={site} page={page} base={`/agency/websites/${site.id}/preview`} refs={builderRefs(now, site.accountId)} />
    </div>
  );
}

export default function WebsitePreviewPage(props: { params: Promise<{ id: string; path?: string[] }> }) {
  return (
    <Suspense fallback={null}>
      <Preview {...props} />
    </Suspense>
  );
}
