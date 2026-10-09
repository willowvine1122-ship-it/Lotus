import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { FunnelPage } from "@/components/funnels/renderer";
import { findFunnel } from "@/lib/data/store";
import { submitFunnelAction } from "@/app/agency/funnels/actions";

/* Public funnel pages: /f/<funnel-slug>/<step-path>. The first step is the root. */

async function Page({ params }: { params: Promise<{ slug: string; step?: string[] }> }) {
  const { slug, step: stepParts } = await params;
  await connection();
  const now = new Date();
  const funnel = findFunnel(now, slug);
  if (!funnel || funnel.status !== "live") notFound();
  const path = (stepParts ?? []).join("/");
  const step = funnel.steps.find((s) => s.path === path) ?? (path === "" ? funnel.steps[0] : undefined);
  if (!step) notFound();
  return <FunnelPage funnel={funnel} step={step} formAction={submitFunnelAction.bind(null, funnel.id, step.id)} />;
}

export default function PublicFunnelPage({ params }: { params: Promise<{ slug: string; step?: string[] }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#faf9f6]" />}>
      <Page params={params} />
    </Suspense>
  );
}
