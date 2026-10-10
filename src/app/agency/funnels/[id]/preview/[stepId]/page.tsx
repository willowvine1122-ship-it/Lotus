import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { BuilderPage } from "@/components/builder/render";
import { blocksToDoc, themeOf } from "@/components/builder/model";
import { builderRefs } from "@/components/builder/refs";
import { findFunnel } from "@/lib/data/store";

/* The saved page as visitors will see it, drafts included. Forms don't submit here. */

export const metadata = { title: "Preview", robots: { index: false } };

async function Preview({ params, searchParams }: { params: Promise<{ id: string; stepId: string }>; searchParams: Promise<{ v?: string }> }) {
  const [{ id, stepId }, sp] = await Promise.all([params, searchParams]);
  await connection();
  const now = new Date();
  const funnel = findFunnel(now, id);
  const step = funnel?.steps.find((s) => s.id === stepId);
  if (!funnel || !step) notFound();
  const doc = sp.v === "b" && step.variant ? step.variant.doc : (step.doc ?? blocksToDoc(step.blocks));
  const i = funnel.steps.indexOf(step);
  const next = funnel.steps[i + 1];
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-50 flex h-9 items-center justify-center gap-2 bg-rail text-xs text-rail-fg-2">
        Preview of <b className="font-semibold text-rail-fg">{step.name}</b>
        {sp.v === "b" && step.variant ? " (version B)" : ""} · forms don&apos;t submit here
        {next && (
          <a href={`/agency/funnels/${funnel.id}/preview/${next.id}`} className="ml-2 font-medium text-rail-fg underline underline-offset-2">
            Next step
          </a>
        )}
      </div>
      <BuilderPage doc={doc} theme={themeOf(funnel.theme, funnel.brandColor)} refs={{ ...builderRefs(now, funnel.accountId), nextHref: next ? `/agency/funnels/${funnel.id}/preview/${next.id}` : "#" }} />
    </div>
  );
}

export default function FunnelPreviewPage(props: { params: Promise<{ id: string; stepId: string }>; searchParams: Promise<{ v?: string }> }) {
  return (
    <Suspense fallback={null}>
      <Preview {...props} />
    </Suspense>
  );
}
