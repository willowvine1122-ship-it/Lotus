import type { DonationElement, ElementDay } from "@/lib/types";
import { campaignFor, elementDays } from "@/lib/data/elements";
import { totals, type ElementTotals } from "@/lib/elements";
import type { CheckoutCampaign } from "@/components/donate/checkout";

/* Server-side loaders shared by the elements pages and the public element routes. */

export interface LiveGift {
  id: string;
  first: string;
  last: string;
  place: string;
  amountCents: number;
  monthly: boolean;
  at: string;
}

/** Everything an element needs to draw itself with live numbers. */
export interface ElementLive {
  orgName: string;
  campaign: CheckoutCampaign;
  defaultCountry: string;
  goalCents: number;
  raisedCents: number;
  donors: number;
  gifts: number;
  monthlyDonors: number;
  monthlyCents: number;
  recent: LiveGift[];
}

export function elementLive(now: Date, e: Pick<DonationElement, "accountId" | "campaignId">): ElementLive | null {
  const found = campaignFor(now, e);
  if (!found) return null;
  const { campaign, client, data } = found;
  const gifts = data.donations.filter((d) => d.campaignId === campaign.id && d.status === "succeeded");
  const plans = data.plans.filter((p) => p.campaignId === campaign.id && p.status === "active");
  const recent: LiveGift[] = [];
  for (const g of [...gifts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    if (recent.length >= 12) break;
    const donor = data.donors.find((d) => d.id === g.donorId);
    if (!donor || donor.anonymous) continue;
    const city = donor.contact.city;
    recent.push({
      id: g.id,
      first: donor.contact.firstName,
      last: donor.contact.lastName,
      place: [city, donor.countryCode].filter(Boolean).join(", "),
      amountCents: g.amountCents,
      monthly: g.frequency === "monthly",
      at: g.createdAt,
    });
  }
  return {
    orgName: client.account.name,
    campaign: {
      slug: campaign.slug,
      title: campaign.title,
      amounts: campaign.amounts,
      impact: campaign.impact,
      defaultFrequency: campaign.defaultFrequency,
      designations: campaign.designations,
      live: campaign.status === "live",
    },
    defaultCountry: client.countries[0]?.code ?? "US",
    goalCents: campaign.goalCents,
    raisedCents: gifts.reduce((a, d) => a + d.amountCents, 0),
    donors: new Set(gifts.map((d) => d.donorId)).size,
    gifts: gifts.length,
    monthlyDonors: plans.length,
    monthlyCents: plans.reduce((a, p) => a + p.amountCents, 0),
    recent,
  };
}

export interface ElementStats {
  days: ElementDay[];
  last30: ElementTotals;
  last7: ElementTotals;
  prev7: ElementTotals;
}

export function elementStats(now: Date, id: string): ElementStats {
  const days = elementDays(now, id);
  return { days, last30: totals(days), last7: totals(days.slice(-7)), prev7: totals(days.slice(-14, -7)) };
}
