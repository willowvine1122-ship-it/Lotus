import { sitemapResponse } from "@/components/websites/public";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return sitemapResponse({ kind: "slug", slug: (await params).slug });
}
