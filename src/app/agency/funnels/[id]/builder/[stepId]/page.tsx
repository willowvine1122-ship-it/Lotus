import { openWorkspace } from "@/lib/server/workspace";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { BuilderEditor } from "@/components/builder/editor";
import { blocksToDoc, stepKindLabel, themeOf } from "@/components/builder/model";
import { builderRefs } from "@/components/builder/refs";
import { findClient, findFunnel } from "@/lib/data/store";
import { saveStepDocAction } from "../../../actions";

export const metadata = { title: "Page builder" };

async function Builder({ params, searchParams }: { params: Promise<{ id: string; stepId: string }>; searchParams: Promise<{ v?: string }> }) {
  const [{ id, stepId }, sp] = await Promise.all([params, searchParams]);
  await connection();
  await openWorkspace();
  const now = new Date();
  const funnel = findFunnel(now, id);
  const step = funnel?.steps.find((s) => s.id === stepId);
  if (!funnel || !step) notFound();
  const client = findClient(now, funnel.accountId);
  const variant = sp.v === "b" && step.variant ? "b" : "a";
  const doc = variant === "b" ? step.variant!.doc : (step.doc ?? blocksToDoc(step.blocks));
  const i = funnel.steps.indexOf(step);
  const next = funnel.steps[i + 1];
  const base = `/agency/funnels/${funnel.id}/builder`;
  return (
    <BuilderEditor
      key={`${step.id}-${variant}`}
      context="funnel"
      title={step.name}
      meta={`${funnel.name} · step ${i + 1} of ${funnel.steps.length} · ${stepKindLabel[step.kind ?? "custom"]}`}
      backHref={`/agency/funnels/${funnel.id}`}
      backLabel={funnel.name}
      initialDoc={doc}
      initialTheme={themeOf(funnel.theme, funnel.brandColor)}
      refs={builderRefs(now, funnel.accountId, next ? `/f/${funnel.slug}/${next.path}` : undefined)}
      pages={funnel.steps.map((s) => ({ id: s.id, name: s.name, href: `${base}/${s.id}`, meta: `${stepKindLabel[s.kind ?? "custom"]} · /${s.path}`, active: s.id === step.id }))}
      pagesLabel="Steps"
      templateContext={{ name: client?.account.name ?? funnel.name, industry: client?.industry ?? "", location: client?.location ?? "" }}
      previewHref={`/agency/funnels/${funnel.id}/preview/${step.id}${variant === "b" ? "?v=b" : ""}`}
      variants={step.variant ? { current: variant, hrefA: `${base}/${step.id}`, hrefB: `${base}/${step.id}?v=b` } : undefined}
      save={saveStepDocAction.bind(null, funnel.id, step.id, variant)}
    />
  );
}

export default function FunnelBuilderPage(props: { params: Promise<{ id: string; stepId: string }>; searchParams: Promise<{ v?: string }> }) {
  return (
    <Suspense fallback={<div className="h-14 bg-rail" />}>
      <Builder {...props} />
    </Suspense>
  );
}
