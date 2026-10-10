import { sitemapResponse } from "@/components/websites/public";

export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  return sitemapResponse({ kind: "host", host: (await params).host });
}
