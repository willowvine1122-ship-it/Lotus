import { Suspense } from "react";
import { SiteRoute, siteMetadata } from "@/components/websites/public";

/* Public websites on their Lotus address: /s/<site-slug>/<page-path>. */

type Props = { params: Promise<{ slug: string; path?: string[] }>; searchParams: Promise<{ sent?: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug, path } = await params;
  return siteMetadata({ kind: "slug", slug }, path);
}

async function Page({ params, searchParams }: Props) {
  const [{ slug, path }, sp] = await Promise.all([params, searchParams]);
  return <SiteRoute refP={{ kind: "slug", slug }} segments={path} sent={sp.sent === "1"} />;
}

export default function PublicSitePage(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#faf9f6]" />}>
      <Page {...props} />
    </Suspense>
  );
}
