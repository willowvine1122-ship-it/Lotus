import { openPublicWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Checkout } from "@/components/donate/checkout";
import { DonateShell } from "@/components/donate/donate-shell";
import { findCampaign } from "@/lib/data/donors";
import { formatCount, formatDollars, formatDollarsCompact, timeAgo } from "@/lib/utils";

export const metadata = { title: "Donate" };

async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  if (!(await openPublicWorkspace(`campaign:${slug}`))) notFound();
  const now = new Date();
  const found = findCampaign(now, slug);
  if (!found) notFound();
  const { campaign, client, data } = found;

  const gifts = data.donations.filter((d) => d.campaignId === campaign.id && d.status === "succeeded");
  const raised = gifts.reduce((a, d) => a + d.amountCents, 0);
  const donorCount = new Set(gifts.map((d) => d.donorId)).size;
  const monthly = data.plans.filter((p) => p.campaignId === campaign.id && p.status === "active").length;
  const pct = campaign.goalCents ? raised / campaign.goalCents : 0;
  const recent = gifts
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map((g) => {
      const donor = data.donors.find((d) => d.id === g.donorId);
      const name = !donor || donor.anonymous ? "Anonymous" : `${donor.contact.firstName} ${donor.contact.lastName.slice(0, 1)}.`;
      return { id: g.id, name, amountCents: g.amountCents, monthly: g.frequency === "monthly", when: timeAgo(g.createdAt, now) };
    });

  return (
    <DonateShell orgName={client.account.name}>
      <div className="mx-auto grid w-full max-w-[1120px] gap-x-14 gap-y-8 px-5 py-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-12">
        <section className="flex flex-col gap-6 lg:col-start-1">
          <div>
            <p className="text-sm text-fg-3">{client.account.name}</p>
            <h1 className="mt-1 max-w-[22ch] text-2xl font-semibold tracking-tight text-balance">{campaign.title}</h1>
            <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-fg-2">{campaign.summary}</p>
          </div>

          <div className="max-w-[560px]">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm text-fg-2">
                <span className="num text-xl font-semibold text-fg">{formatDollars(raised)}</span> raised
              </p>
              <p className="num text-sm text-fg-3">{formatDollarsCompact(campaign.goalCents)} goal</p>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-[2px] bg-surface-2"
              role="progressbar"
              aria-label="Raised toward goal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(1, pct) * 100)}
            >
              <div className="h-full rounded-[2px] bg-rail" style={{ width: `${Math.min(100, pct * 100)}%` }} />
            </div>
            <p className="num mt-2 text-xs text-fg-3">
              {Math.round(pct * 100)}% funded · {formatCount(donorCount)} donors · {formatCount(monthly)} giving monthly
            </p>
          </div>
        </section>

        <aside className="lg:sticky lg:top-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <Checkout
            campaign={{
              slug: campaign.slug,
              title: campaign.title,
              amounts: campaign.amounts,
              impact: campaign.impact,
              defaultFrequency: campaign.defaultFrequency,
              designations: campaign.designations,
              live: campaign.status === "live",
            }}
            orgName={client.account.name}
            defaultCountry={client.countries[0]?.code ?? "US"}
          />
        </aside>

        <section className="flex flex-col gap-8 lg:col-start-1">
          <div className="flex max-w-[64ch] flex-col gap-4 border-t border-line pt-6">
            <h2 className="text-sm font-semibold">Why it matters</h2>
            {campaign.story.map((p, i) => (
              <p key={i} className="text-base leading-relaxed text-fg-2">
                {p}
              </p>
            ))}
          </div>

          {recent.length > 0 && (
            <div className="max-w-[560px] border-t border-line pt-6">
              <h2 className="text-sm font-semibold">Recent gifts</h2>
              <ul className="mt-2">
                {recent.map((g) => (
                  <li key={g.id} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm last:border-b-0">
                    <span className="min-w-0 truncate font-medium">{g.name}</span>
                    <span className="flex shrink-0 items-baseline gap-3">
                      <span className="num font-medium">
                        {formatDollars(g.amountCents)}
                        {g.monthly && <span className="font-normal text-fg-3">/mo</span>}
                      </span>
                      <span className="w-[72px] text-right text-xs text-fg-3">{g.when}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </DonateShell>
  );
}

export default function DonatePage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<DonateShell orgName="">{null}</DonateShell>}>
      <CampaignPage params={params} />
    </Suspense>
  );
}
