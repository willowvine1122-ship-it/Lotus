import { openPublicWorkspace } from "@/lib/server/workspace";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { connection } from "next/server";
import { BuilderPage } from "@/components/builder/render";
import { StickVariant } from "@/components/builder/live";
import { blocksToDoc, chooseVariant, themeOf } from "@/components/builder/model";
import { builderRefs } from "@/components/builder/refs";
import { findFunnel, recordStepView } from "@/lib/data/store";
import { submitFunnelAction, submitOrderAction, submitUpsellAction } from "@/app/agency/funnels/actions";
import { TrackingTags } from "@/components/tracking-tags";
import type { Metadata } from "next";

/*
 * Public funnel pages: /f/<funnel-slug>/<step-path>. The first step is the
 * root. A step with a split test sends each new visitor to A or B by the
 * step's split and keeps them there with a cookie.
 */

async function Page({ params, searchParams }: { params: Promise<{ slug: string; step?: string[] }>; searchParams: Promise<{ sent?: string }> }) {
  const [{ slug, step: stepParts }, sp] = await Promise.all([params, searchParams]);
  await connection();
  if (!(await openPublicWorkspace(`funnel:${slug}`))) notFound();
  const now = new Date();
  const funnel = findFunnel(now, slug);
  if (!funnel || funnel.status !== "live") notFound();
  const path = (stepParts ?? []).join("/");
  const step = funnel.steps.find((s) => s.path === path) ?? (path === "" ? funnel.steps[0] : undefined);
  if (!step) notFound();

  let variant: "a" | "b" = "a";
  let fresh = false;
  if (step.variant) {
    const saved = (await cookies()).get(`lb_v_${step.id}`)?.value;
    if (saved === "a" || saved === "b") variant = saved;
    else {
      variant = chooseVariant(step.variant.split);
      fresh = true;
    }
  }
  const doc = variant === "b" && step.variant ? step.variant.doc : (step.doc ?? blocksToDoc(step.blocks));
  const i = funnel.steps.indexOf(step);
  const next = funnel.steps[i + 1];
  recordStepView(now, funnel.id, step.id, variant);

  return (
    <>
      {fresh && <StickVariant stepId={step.id} variant={variant} />}
      <TrackingTags {...funnel.site} />
      <BuilderPage
        doc={doc}
        theme={themeOf(funnel.theme, funnel.brandColor)}
        header={
          sp.sent === "1" && !next ? (
            // A funnel with no step after this one thanks the visitor on the same page.
            <p role="status" style={{ margin: 0, padding: "14px 20px", background: "#dcf5e6", color: "#14532d", textAlign: "center", fontSize: 15, fontWeight: 500 }}>
              Thanks, we got it. We&apos;ll be in touch soon.
            </p>
          ) : undefined
        }
        refs={builderRefs(now, funnel.accountId, next ? `/f/${funnel.slug}/${next.path}` : `/f/${funnel.slug}?sent=1`)}
        actions={{
          form: submitFunnelAction.bind(null, funnel.id, step.id),
          order: submitOrderAction.bind(null, funnel.id, step.id),
          upsell: submitUpsellAction.bind(null, funnel.id, step.id),
        }}
      />
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  await connection();
  if (!(await openPublicWorkspace(`funnel:${slug}`))) return { title: "Page not found", robots: { index: false } };
  const funnel = findFunnel(new Date(), slug);
  if (!funnel || funnel.status !== "live") return { title: "Page not found", robots: { index: false } };
  const s = funnel.site ?? {};
  const title = s.title || funnel.name;
  return {
    title: { absolute: title },
    description: s.description,
    icons: s.favicon ? { icon: s.favicon, apple: s.favicon } : undefined,
    openGraph: { title, description: s.description, type: "website", images: s.shareImage ? [s.shareImage] : undefined },
    twitter: { card: s.shareImage ? "summary_large_image" : "summary", title, description: s.description },
  };
}

export default function PublicFunnelPage(props: { params: Promise<{ slug: string; step?: string[] }>; searchParams: Promise<{ sent?: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#faf9f6]" />}>
      <Page {...props} />
    </Suspense>
  );
}
