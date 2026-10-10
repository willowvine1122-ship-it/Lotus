import type { Campaign, Donation, Donor, GiftFrequency, Health, RecurringPlan } from "@/lib/types";

/*
 * Pure fundraising maths shared by the checkout, the donor CRM and the
 * server actions. No data access here: every function takes the records
 * it needs, so the same code runs on the demo store and on Supabase rows.
 */

/** Stripe's US nonprofit rate: 2.2% + 30c per successful card charge. */
export const FEE_RATE = 0.022;
export const FEE_FIXED_CENTS = 30;

/** What to add so the organisation nets the full gift after card fees. */
export function feeToCover(amountCents: number) {
  if (amountCents <= 0) return 0;
  const gross = Math.ceil((amountCents + FEE_FIXED_CENTS) / (1 - FEE_RATE));
  return gross - amountCents;
}

/** A donor is lapsed when their last gift is over a year old and nothing recurs. */
export const LAPSED_AFTER_DAYS = 365;
/** Lifetime giving at or above this is flagged as a major donor. */
export const MAJOR_DONOR_CENTS = 500_000;

export type DonorState = "past_due" | "lapsed" | "new" | "active";

export const donorStateLabel: Record<DonorState, string> = {
  past_due: "Payment failed",
  lapsed: "Lapsed",
  new: "New",
  active: "Active",
};

/** Donor health uses the same three signals as client health. */
export const donorStateHealth: Record<DonorState, Health> = {
  past_due: "red",
  lapsed: "amber",
  new: "green",
  active: "green",
};

export interface GiftLine {
  id: string;
  at: string;
  amountCents: number;
  feeCoveredCents: number;
  frequency: GiftFrequency;
  designation: string;
  campaignId: string;
  status: Donation["status"];
}

export interface PlanLine {
  id: string;
  amountCents: number;
  status: RecurringPlan["status"];
  startedAt: string;
  nextChargeOn: string | null;
  designation: string;
  campaignId: string;
}

/** One row of the donor table, with what the panel needs to draw the donor. */
export interface DonorRow {
  id: string;
  accountId: string;
  clientName: string;
  name: string;
  email: string;
  city?: string;
  countryCode: string;
  countryName: string;
  anonymous: boolean;
  state: DonorState;
  lifetimeCents: number;
  last12Cents: number;
  giftCount: number;
  avgGiftCents: number;
  largestCents: number;
  firstGiftAt: string | null;
  lastGiftAt: string | null;
  lastGiftCents: number;
  daysSinceLastGift: number | null;
  plan: PlanLine | null; // the live plan (active or past due), else the most recent
  major: boolean;
  history: GiftLine[]; // newest first, capped
}

const DAY = 86_400_000;

export function daysBetween(fromIso: string, now: Date) {
  return Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY);
}

export function buildDonorRow(
  donor: Donor,
  clientName: string,
  donations: Donation[],
  plans: RecurringPlan[],
  now: Date,
  historyCap = 12,
): DonorRow {
  const ok = donations.filter((d) => d.status === "succeeded").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const lifetime = ok.reduce((a, d) => a + d.amountCents, 0);
  const yearAgo = now.getTime() - 365 * DAY;
  const last12 = ok.filter((d) => new Date(d.createdAt).getTime() >= yearAgo).reduce((a, d) => a + d.amountCents, 0);
  const live = plans.find((p) => p.status === "active" || p.status === "past_due");
  const latestPlan = live ?? [...plans].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const last = ok[0];
  const first = ok[ok.length - 1];
  const since = last ? daysBetween(last.createdAt, now) : null;

  let state: DonorState = "active";
  if (live?.status === "past_due") state = "past_due";
  else if (!live && (since === null || since > LAPSED_AFTER_DAYS)) state = "lapsed";
  else if (first && daysBetween(first.createdAt, now) <= 30) state = "new";

  const c = donor.contact;
  return {
    id: donor.id,
    accountId: donor.accountId,
    clientName,
    name: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email ?? "",
    city: c.city,
    countryCode: donor.countryCode,
    countryName: donor.countryName,
    anonymous: donor.anonymous,
    state,
    lifetimeCents: lifetime,
    last12Cents: last12,
    giftCount: ok.length,
    avgGiftCents: ok.length ? Math.round(lifetime / ok.length) : 0,
    largestCents: ok.reduce((a, d) => Math.max(a, d.amountCents), 0),
    firstGiftAt: first?.createdAt ?? null,
    lastGiftAt: last?.createdAt ?? null,
    lastGiftCents: last?.amountCents ?? 0,
    daysSinceLastGift: since,
    plan: latestPlan
      ? {
          id: latestPlan.id,
          amountCents: latestPlan.amountCents,
          status: latestPlan.status,
          startedAt: latestPlan.startedAt,
          nextChargeOn: latestPlan.nextChargeOn,
          designation: latestPlan.designation,
          campaignId: latestPlan.campaignId,
        }
      : null,
    major: lifetime >= MAJOR_DONOR_CENTS,
    history: donations
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, historyCap)
      .map((d) => ({
        id: d.id,
        at: d.createdAt,
        amountCents: d.amountCents,
        feeCoveredCents: d.feeCoveredCents,
        frequency: d.frequency,
        designation: d.designation,
        campaignId: d.campaignId,
        status: d.status,
      })),
  };
}

export interface CampaignTotal {
  id: string;
  accountId: string;
  clientName: string;
  slug: string;
  title: string;
  status: Campaign["status"];
  goalCents: number;
  raisedCents: number;
  gifts: number;
  donors: number;
  activePlans: number;
  monthlyCents: number; // recurring revenue the campaign's live plans bring in
}

export function campaignTotals(campaign: Campaign, clientName: string, donations: Donation[], plans: RecurringPlan[]): CampaignTotal {
  const ok = donations.filter((d) => d.campaignId === campaign.id && d.status === "succeeded");
  const live = plans.filter((p) => p.campaignId === campaign.id && p.status === "active");
  return {
    id: campaign.id,
    accountId: campaign.accountId,
    clientName,
    slug: campaign.slug,
    title: campaign.title,
    status: campaign.status,
    goalCents: campaign.goalCents,
    raisedCents: ok.reduce((a, d) => a + d.amountCents, 0),
    gifts: ok.length,
    donors: new Set(ok.map((d) => d.donorId)).size,
    activePlans: live.length,
    monthlyCents: live.reduce((a, p) => a + p.amountCents, 0),
  };
}

export interface CountryTotal {
  code: string;
  name: string;
  raisedCents: number;
  donors: number;
}

/** Succeeded gifts in the window, grouped by the donor's country. */
export function countryTotals(rows: { countryCode: string; countryName: string; last12Cents: number }[]): CountryTotal[] {
  const map = new Map<string, CountryTotal>();
  for (const r of rows) {
    if (r.last12Cents <= 0) continue;
    const t = map.get(r.countryCode) ?? { code: r.countryCode, name: r.countryName, raisedCents: 0, donors: 0 };
    t.raisedCents += r.last12Cents;
    t.donors += 1;
    map.set(r.countryCode, t);
  }
  return [...map.values()].sort((a, b) => b.raisedCents - a.raisedCents);
}

/** Next monthly charge date: same day next month, clamped to the month's end. */
export function nextMonthly(from: Date) {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + 1;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(from.getUTCDate(), last))).toISOString().slice(0, 10);
}

export const countries: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "FR", name: "France" },
  { code: "IE", name: "Ireland" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "IN", name: "India" },
  { code: "KE", name: "Kenya" },
  { code: "NZ", name: "New Zealand" },
  { code: "SG", name: "Singapore" },
  { code: "ZA", name: "South Africa" },
];

export function countryName(code: string) {
  return countries.find((c) => c.code === code)?.name ?? code;
}
