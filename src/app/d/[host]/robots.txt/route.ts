import { robotsResponse } from "@/components/websites/public";

export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  return robotsResponse({ kind: "host", host: (await params).host });
}
