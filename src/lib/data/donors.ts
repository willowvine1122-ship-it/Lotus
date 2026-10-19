import { stamp } from "@/lib/ids";
import type { Campaign, ClientRecord, Donation, Donor, FundraisingClient, GiftFrequency, RecurringPlan } from "@/lib/types";
import { countryName, nextMonthly } from "@/lib/fundraising";
import { defineModule } from "@/lib/server/workspace";
import { addActivity, createContact, listClients, listContacts, moveContactStage } from "./store";

/*
 * Fundraising: campaigns, donors, gifts and monthly plans for every
 * fundraising-mode client, saved per agency in the "fundraising" module.
 * A client gets its first campaign (named after it) the first time its
 * fundraising is opened; a campaign's slug is its public donation page.
 */

export interface AccountFundraising {
  campaigns: Campaign[];
  donors: Donor[];
  donations: Donation[];
  plans: RecurringPlan[];
}

interface FundraisingStore {
  byAccount: Record<string, AccountFundraising>;
}

const fundraisingModule = defineModule<FundraisingStore>({
  key: "fundraising",
  init: () => ({ byAccount: {} }),
  publicKeys: (s) => Object.values(s.byAccount).flatMap((a) => a.campaigns.map((c) => `campaign:${c.slug}`)),
});

function fstore(_now: Date): FundraisingStore {
  return fundraisingModule.get();
}

export function fundraisingClients(now: Date): FundraisingClient[] {
  return listClients(now).filter((c): c is FundraisingClient => c.mode === "fundraising");
}

/** Everything fundraising for one client, started on first read. */
export function accountFundraising(now: Date, client: FundraisingClient): AccountFundraising {
  const s = fstore(now);
  let a = s.byAccount[client.account.id];
  if (!a) {
    a = { campaigns: [buildCampaign(defaultCampaign(client), client.account.id, now)], donors: [], donations: [], plans: [] };
    s.byAccount[client.account.id] = a;
  }
  return a;
}

export function findCampaign(now: Date, slug: string): { campaign: Campaign; client: FundraisingClient; data: AccountFundraising } | null {
  for (const client of fundraisingClients(now)) {
    const data = accountFundraising(now, client);
    const campaign = data.campaigns.find((c) => c.slug === slug);
    if (campaign) return { campaign, client, data };
  }
  return null;
}

/* ------------------------------ record ------------------------------ */

export interface GiftInput {
  campaignSlug: string;
  amountCents: number;
  feeCoveredCents: number;
  frequency: GiftFrequency;
  designation: string;
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  anonymous: boolean;
  paymentRef: string;
}

export interface GiftReceipt {
  donationId: string;
  donorId: string;
  planId?: string;
  nextChargeOn?: string;
  totalCents: number;
  newDonor: boolean;
  /** The CRM contact behind the donor, when the CRM knows them. */
  contactId?: string;
  accountId: string;
}

/** Record a gift from the checkout: match or create the donor, add the gift, start the plan. */
export function recordGift(now: Date, input: GiftInput): GiftReceipt | null {
  const found = findCampaign(now, input.campaignSlug);
  if (!found) return null;
  const { campaign, client, data } = found;
  const at = now.toISOString();
  const sid = stamp();

  const email = input.email.trim().toLowerCase();
  let donor = data.donors.find((d) => d.contact.email?.toLowerCase() === email);
  const newDonor = !donor;
  if (!donor) {
    // Donors are contacts: reuse the CRM record when the email is known, else open one.
    const contact =
      listContacts(now, client.account.id).find((c) => c.email?.toLowerCase() === email) ??
      createContact(now, {
        accountId: client.account.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email,
        tags: ["Donor"],
        source: "donation-page",
        stageId: input.frequency === "monthly" ? "monthly" : "first",
      });
    if (!contact) return null;
    donor = {
      id: `dn-${client.account.id}-${sid}`,
      accountId: client.account.id,
      contact,
      countryCode: input.countryCode,
      countryName: countryName(input.countryCode),
      anonymous: input.anonymous,
    };
    data.donors.push(donor);
  }

  let plan: RecurringPlan | undefined;
  if (input.frequency === "monthly") {
    plan = {
      id: `rp-${client.account.id}-${sid}`,
      accountId: client.account.id,
      donorId: donor.id,
      campaignId: campaign.id,
      amountCents: input.amountCents,
      feeCoveredCents: input.feeCoveredCents,
      designation: input.designation,
      status: "active",
      startedAt: at,
      nextChargeOn: nextMonthly(now),
    };
    data.plans.push(plan);
  }

  const donation: Donation = {
    id: `gf-${client.account.id}-${sid}`,
    accountId: client.account.id,
    donorId: donor.id,
    campaignId: campaign.id,
    amountCents: input.amountCents,
    feeCoveredCents: input.feeCoveredCents,
    frequency: input.frequency,
    recurringPlanId: plan?.id,
    designation: input.designation,
    countryCode: donor.countryCode,
    status: "succeeded",
    paymentRef: input.paymentRef,
    createdAt: at,
  };
  data.donations.push(donation);

  // Seeded demo donors live only here; a contact the CRM knows gets the activity and stage.
  const inCrm = Boolean(addActivity(now, donor.contact.id, {
    kind: "donation",
    title: `${input.frequency === "monthly" ? "Started a monthly gift" : "Gave"} to ${campaign.title}`,
    body: input.designation,
    by: "System",
    amountCents: input.amountCents,
  }));
  if (!inCrm) {
    donor.contact.valueCents += input.amountCents;
    donor.contact.lastActivityAt = at;
  }
  if (plan) {
    donor.contact.recurring = true;
    if (inCrm) moveContactStage(now, donor.contact.id, "monthly", "System");
  } else if (inCrm && donor.contact.stageId === "first" && !newDonor) {
    moveContactStage(now, donor.contact.id, "repeat", "System");
  }

  return {
    donationId: donation.id,
    donorId: donor.id,
    planId: plan?.id,
    nextChargeOn: plan?.nextChargeOn ?? undefined,
    totalCents: input.amountCents + input.feeCoveredCents,
    newDonor,
    contactId: inCrm ? donor.contact.id : undefined,
    accountId: client.account.id,
  };
}

/* ---------------------------- first campaign ---------------------------- */

const d$ = (dollars: number) => dollars * 100;

interface CampaignSpec {
  slug: string;
  title: string;
  summary: string;
  story: string[];
  goal: number; // dollars
  oneTime: number[];
  monthly: number[];
  impact: Record<number, string>; // dollars -> line
  designations: string[];
  defaultFrequency?: GiftFrequency;
  status?: Campaign["status"];
  weight?: number; // share of gifts
}

function defaultCampaign(client: FundraisingClient): CampaignSpec {
  return {
    slug: client.account.slug,
    title: `Support ${client.account.name}`,
    summary: `Your gift powers ${client.account.name}'s work in ${client.location}.`,
    story: [],
    goal: Math.max(10000, Math.round(client.monthlyGoalCents / 100)),
    oneTime: [25, 50, 100, 250, 500, 1000],
    monthly: [10, 25, 50, 75, 100, 200],
    impact: {},
    designations: ["Where it's needed most"],
  };
}

function buildCampaign(spec: CampaignSpec, accountId: string, now: Date): Campaign {
  const impact: Record<number, string> = {};
  for (const [k, v] of Object.entries(spec.impact)) impact[d$(Number(k))] = v;
  return {
    id: `cp-${accountId}-${stamp()}`,
    accountId,
    slug: spec.slug,
    title: spec.title,
    summary: spec.summary,
    story: spec.story,
    goalCents: d$(spec.goal),
    amounts: { one_time: spec.oneTime.map(d$), monthly: spec.monthly.map(d$) },
    impact,
    defaultFrequency: spec.defaultFrequency ?? "monthly",
    designations: spec.designations,
    status: spec.status ?? "live",
    createdAt: now.toISOString(),
  };
}

export function clientName(clients: ClientRecord[], accountId: string) {
  return clients.find((c) => c.account.id === accountId)?.account.name ?? "";
}
