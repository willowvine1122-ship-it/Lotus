import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { BuilderEditor } from "@/components/builder/editor";
import { blocksToDoc, themeOf } from "@/components/builder/model";
import { builderRefs } from "@/components/builder/refs";
import { SiteFooter, SiteHeader } from "@/components/websites/site";
import { findClient } from "@/lib/data/store";
import { findWebsite } from "@/lib/data/websites";
import { savePageDocAction } from "../../../actions";

export const metadata = { title: "Page builder" };

/* A website page in the visual builder, with the site's header and footer around the canvas. */

async function Builder({ params }: { params: Promise<{ id: string; pageId: string }> }) {
  const { id, pageId } = await params;
  await connection();
  const now = new Date();
  const site = findWebsite(now, id);
  const page = site?.pages.find((p) => p.id === pageId);
  if (!site || !page) notFound();
  const client = findClient(now, site.accountId);
  const base = `/agency/websites/${site.id}/builder`;
  return (
    <BuilderEditor
      key={page.id}
      context="site"
      title={page.title}
      meta={`${site.name} · /${page.path}`}
      backHref={`/agency/websites/${site.id}`}
      backLabel={site.name}
      initialDoc={page.doc ?? blocksToDoc(page.blocks)}
      initialTheme={themeOf(site.theme, site.brandColor)}
      refs={builderRefs(now, site.accountId)}
      pages={site.pages.map((p) => ({ id: p.id, name: p.title, href: `${base}/${p.id}`, meta: `/${p.path}${p.doc ? "" : " · blocks"}`, active: p.id === page.id }))}
      pagesLabel="Pages"
      templateContext={{ name: client?.account.name ?? site.name, industry: client?.industry ?? "", location: client?.location ?? "" }}
      previewHref={`/agency/websites/${site.id}/preview${page.path ? `/${page.path}` : ""}`}
      save={savePageDocAction.bind(null, site.id, page.id)}
      chrome={{
        header: (
          <div className="@container" inert>
            <SiteHeader site={site} page={page} base={`/s/${site.slug}`} />
          </div>
        ),
        footer: (
          <div className="@container" inert>
            <SiteFooter site={site} base={`/s/${site.slug}`} />
          </div>
        ),
      }}
    />
  );
}

export default function WebsiteBuilderPage(props: { params: Promise<{ id: string; pageId: string }> }) {
  return (
    <Suspense fallback={<div className="h-14 bg-rail" />}>
      <Builder {...props} />
    </Suspense>
  );
}
