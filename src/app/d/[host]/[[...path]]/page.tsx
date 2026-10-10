import { Suspense } from "react";
import { SiteRoute, siteMetadata } from "@/components/websites/public";

/* Public websites on a custom domain. src/proxy.ts rewrites <host>/<path> to /d/<host>/<path>. */

type Props = { params: Promise<{ host: string; path?: string[] }>; searchParams: Promise<{ sent?: string }> };

export async function generateMetadata({ params }: Props) {
  const { host, path } = await params;
  return siteMetadata({ kind: "host", host }, path);
}

async function Page({ params, searchParams }: Props) {
  const [{ host, path }, sp] = await Promise.all([params, searchParams]);
  return <SiteRoute refP={{ kind: "host", host }} segments={path} sent={sp.sent === "1"} />;
}

export default function PublicSitePage(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#faf9f6]" />}>
      <Page {...props} />
    </Suspense>
  );
}
