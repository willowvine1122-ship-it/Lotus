import { notFound } from "next/navigation";
import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { WebsiteEditor } from "@/components/websites/editor";
import { websiteClients } from "@/components/websites/data";
import { Shell } from "@/components/shell";
import { listForms } from "@/lib/data/forms";
import { findWebsite } from "@/lib/data/websites";
import { checkDomainAction, deleteWebsiteAction, removeDomainAction, saveWebsiteAction, setDomainAction, setWebsiteStatusAction } from "../actions";

export const metadata = { title: "Edit website" };

const actions = { save: saveWebsiteAction, setStatus: setWebsiteStatusAction, remove: deleteWebsiteAction, setDomain: setDomainAction, checkDomain: checkDomainAction, removeDomain: removeDomainAction };

async function Editor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  await connection();
  const now = new Date();
  const site = findWebsite(now, id);
  if (!site) notFound();
  const client = websiteClients(now).find((c) => c.id === site.accountId);
  if (!client) notFound();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  const forms = listForms(now, site.accountId).map((f) => ({ id: f.id, slug: f.slug, name: f.name, live: f.status === "live" }));
  return <WebsiteEditor site={site} client={client} forms={forms} origin={origin} nowIso={now.toISOString()} initialPane={tab === "domain" ? "domain" : tab === "site" ? "site" : undefined} actions={actions} />;
}

export default function WebsiteEditorPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  return (
    <Shell current="/agency/websites">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Editor {...props} />
      </Suspense>
    </Shell>
  );
}
