import { buildRow, type Row } from "@/components/diagnostic/model";
import { getReportConfig, listClients, listReportSends, listReviews } from "@/lib/data/store";
import type { ClientRecord, ReportConfig, ReportSend, Review } from "@/lib/types";

/* Server-side loaders shared by the reporting pages and the client portal. */

export interface ReportClient {
  id: string;
  name: string;
  slug: string;
  mode: "marketing" | "fundraising";
  status: ClientRecord["status"];
  managerName?: string;
  config: ReportConfig;
  lastSend?: ReportSend;
}

export function reportClients(now: Date): ReportClient[] {
  return listClients(now)
    .map((c) => {
      const config = getReportConfig(now, c.account.id)!;
      const sends = listReportSends(now, c.account.id);
      return { id: c.account.id, name: c.account.name, slug: c.account.slug, mode: c.mode, status: c.status, managerName: c.assignees[0]?.name, config, lastSend: sends[0] };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function reportFor(now: Date, client: ClientRecord, config: ReportConfig): { row: Row; reviews: Review[] } {
  return { row: buildRow(client, config.range, now), reviews: listReviews(now, client.account.id) };
}

export { getReportConfig, listReportSends };
