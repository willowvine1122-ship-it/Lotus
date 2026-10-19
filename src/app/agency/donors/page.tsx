import { openWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import { connection } from "next/server";
import { Donors } from "@/components/donors/donors";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { accountFundraising, fundraisingClients } from "@/lib/data/donors";
import { buildDonorRow, campaignTotals, type CampaignTotal, type DonorRow } from "@/lib/fundraising";

export const metadata = { title: "Donors" };

async function DonorBoard() {
  await connection();
  await openWorkspace();
  const now = new Date();
  const clients = fundraisingClients(now);
  const rows: DonorRow[] = [];
  const campaigns: CampaignTotal[] = [];
  const titles: Record<string, string> = {};
  for (const c of clients) {
    const data = accountFundraising(now, c);
    for (const cp of data.campaigns) {
      campaigns.push(campaignTotals(cp, c.account.name, data.donations, data.plans));
      titles[cp.id] = cp.title;
    }
    for (const d of data.donors) {
      rows.push(
        buildDonorRow(
          d,
          c.account.name,
          data.donations.filter((x) => x.donorId === d.id),
          data.plans.filter((p) => p.donorId === d.id),
          now,
        ),
      );
    }
  }
  return (
    <Donors
      rows={rows}
      campaigns={campaigns}
      campaignTitles={titles}
      clients={clients.map((c) => ({ id: c.account.id, name: c.account.name, slug: accountFundraising(now, c).campaigns[0]?.slug ?? c.account.slug }))}
      nowIso={now.toISOString()}
    />
  );
}

export default function DonorsPage() {
  return (
    <Shell current="/agency/donors">
      <Suspense fallback={<PageHeader className="pb-3 pt-3" title={<span className="text-lg leading-6">Donors</span>} meta="Loading donors…" />}>
        <DonorBoard />
      </Suspense>
    </Shell>
  );
}
