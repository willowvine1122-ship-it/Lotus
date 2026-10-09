import type { Campaign, ClientRecord, Contact, Donation, Donor, FundraisingClient, GiftFrequency, RecurringPlan } from "@/lib/types";
import { countryName, feeToCover, nextMonthly } from "@/lib/fundraising";
import { addActivity, createContact, listClients, listContacts, moveContactStage } from "./store";

/*
 * Demo fundraising store: campaigns, donors, gifts and monthly plans for
 * every fundraising-mode client in the client store. Generated from a
 * seeded PRNG per client so the numbers are stable, kept on globalThis so
 * gifts made on the public checkout survive dev reloads, and replaced by
 * the tables in migration 0006 once Supabase is connected.
 */

export interface AccountFundraising {
  campaigns: Campaign[];
  donors: Donor[];
  donations: Donation[];
  plans: RecurringPlan[];
}

interface FundraisingStore {
  seededFor: string;
  byAccount: Map<string, AccountFundraising>;
}

const g = globalThis as unknown as { __lotusFundraising?: FundraisingStore };

function fstore(now: Date): FundraisingStore {
  const key = now.toISOString().slice(0, 10);
  if (!g.__lotusFundraising || g.__lotusFundraising.seededFor !== key) {
    g.__lotusFundraising = { seededFor: key, byAccount: new Map() };
  }
  return g.__lotusFundraising;
}

export function fundraisingClients(now: Date): FundraisingClient[] {
  return listClients(now).filter((c): c is FundraisingClient => c.mode === "fundraising");
}

/** Everything fundraising for one client, seeded on first read. */
export function accountFundraising(now: Date, client: FundraisingClient): AccountFundraising {
  const s = fstore(now);
  let a = s.byAccount.get(client.account.id);
  if (!a) {
    a = seedAccount(client, now);
    s.byAccount.set(client.account.id, a);
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
}

/** Record a gift from the checkout: match or create the donor, add the gift, start the plan. */
export function recordGift(now: Date, input: GiftInput): GiftReceipt | null {
  const found = findCampaign(now, input.campaignSlug);
  if (!found) return null;
  const { campaign, client, data } = found;
  const at = now.toISOString();
  const stamp = Date.now().toString(36);

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
      id: `dn-${client.account.id}-${stamp}`,
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
      id: `rp-${client.account.id}-${stamp}`,
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
    id: `gf-${client.account.id}-${stamp}`,
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
  };
}

/* ------------------------------- seed ------------------------------- */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const DAY = 86_400_000;
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

const campaignSpecs: Record<string, CampaignSpec[]> = {
  "acc-3": [
    {
      slug: "hope-harbor",
      title: "Keep the winter shelter open",
      summary: "Every night from November to March, 140 neighbours sleep warm at Hope Harbor. Your gift keeps the doors open.",
      story: [
        "When the temperature in Boston drops below freezing, our shelter on Harbor Street becomes the difference between a dangerous night outside and a warm bed, a hot dinner and a caseworker in the morning.",
        "Last winter we turned no one away. This year demand is up a fifth, and the shelter runs on gifts from people like you: 82 cents of every dollar goes straight to beds, meals and housing support.",
      ],
      goal: 60000,
      oneTime: [50, 100, 180, 250, 500, 1000],
      monthly: [15, 25, 50, 75, 100, 200],
      impact: {
        15: "A hot dinner for one guest, every week of the winter.",
        25: "Clean bedding and a laundry service for two guests a month.",
        50: "Five nights in a warm bed with dinner and breakfast.",
        75: "A week of shelter, meals and a caseworker check-in.",
        100: "Ten nights in a warm bed for a neighbour with nowhere to go.",
        180: "A full month of nights for one guest this winter.",
        200: "A month of shelter and a housing navigator's time.",
        250: "Winter coats, boots and gloves for ten guests.",
        500: "A family's first month of rent in a new apartment.",
        1000: "Keeps one shelter bed open for the whole winter.",
      },
      designations: ["Where it's needed most", "Winter shelter beds", "Hot meals", "Housing navigation"],
      weight: 0.75,
    },
    {
      slug: "hope-harbor-year-end",
      title: "Year-end appeal",
      summary: "Help us start the new year with a housing plan for every guest.",
      story: ["Every gift before December 31 funds a housing navigator for a guest leaving the shelter in spring."],
      goal: 24000,
      oneTime: [50, 100, 250, 500, 1000, 2500],
      monthly: [20, 35, 50, 100, 150, 250],
      impact: { 100: "A week of a housing navigator's time.", 250: "Moving costs for one family.", 500: "A security deposit for a new home." },
      designations: ["Where it's needed most", "Housing navigation"],
      weight: 0.25,
    },
  ],
  "acc-4": [
    {
      slug: "riverside-rescue",
      title: "Fund a rescue, from intake to adoption",
      summary: "We take in 1,200 dogs and cats a year. Each one needs a vet check, a foster home and time before they find a family.",
      story: [
        "Most of our animals arrive frightened, underweight or injured. Before adoption they get vaccines, surgery when they need it, and weeks in a foster home learning to trust people again.",
        "Your gift pays for that whole journey, and monthly donors let us say yes to emergency intakes without waiting for the next appeal.",
      ],
      goal: 18000,
      oneTime: [25, 50, 65, 100, 250, 500],
      monthly: [10, 15, 25, 40, 60, 100],
      impact: {
        10: "Flea, tick and worming treatment for a new arrival.",
        15: "A month of food for a dog in foster care.",
        25: "Core vaccines for one rescued puppy or kitten.",
        40: "A microchip and registration for two animals.",
        50: "A spay or neuter surgery for one cat.",
        60: "A month of medication for an animal recovering from surgery.",
        65: "A full intake exam with bloodwork.",
        100: "Everything one animal needs from intake to adoption day.",
        250: "Emergency surgery for a dog hit by a car.",
        500: "Supplies for a new foster home for a whole year.",
      },
      designations: ["Where it's needed most", "Medical fund", "Foster program"],
    },
  ],
  "acc-15": [
    {
      slug: "bright-futures",
      title: "Send a first-generation student to college",
      summary: "Scholarships, mentors and a laptop for Chicago students who will be the first in their family to graduate.",
      story: [
        "Our scholars are the first in their families to go to college. Tuition is only part of it: books, a laptop, a bus pass and a mentor who has done it before are what keep them enrolled.",
        "Nine in ten Bright Futures scholars finish their degree. Your gift adds one more.",
      ],
      goal: 90000,
      oneTime: [100, 240, 500, 1000, 2500, 5000],
      monthly: [20, 40, 80, 100, 200, 400],
      impact: {
        20: "A month of transit passes so a scholar gets to class.",
        40: "Textbooks for one course.",
        80: "A semester of one-to-one tutoring.",
        100: "Application fees for three colleges.",
        200: "A month of a mentor's stipend.",
        240: "A year of books for one scholar.",
        400: "A semester's housing deposit.",
        500: "A new laptop for an incoming freshman.",
        1000: "A semester of book, laptop and transit support.",
        2500: "A full-year scholarship top-up.",
        5000: "A scholar's entire first year of support.",
      },
      designations: ["Scholarship fund", "Mentoring", "Laptops and books"],
      defaultFrequency: "one_time",
    },
  ],
  "acc-16": [
    {
      slug: "clean-water",
      title: "Bring clean water to 40 villages",
      summary: "A protected well serves 400 people for twenty years. This season we are building forty of them in Kenya and Uganda.",
      story: [
        "Women and girls in the villages we work with walk an average of three hours a day for water, and it is rarely safe to drink.",
        "A protected well, a trained repair committee and hygiene training change that for a generation. Every dollar you give goes to the field; our operating costs are covered by founding partners.",
      ],
      goal: 22000,
      oneTime: [35, 50, 95, 150, 300, 1000],
      monthly: [10, 20, 35, 50, 75, 150],
      impact: {
        10: "Clean water for one person for a year.",
        20: "Hygiene training for a family.",
        35: "Clean water for one person for life.",
        50: "A household water filter and training.",
        75: "Tools for a village repair committee.",
        95: "Clean water for a family of five for twenty years.",
        150: "A hand pump replacement part kit.",
        300: "A rainwater tank for a primary school.",
        1000: "A quarter of a new protected well.",
      },
      designations: ["Where it's needed most", "Wells in Kenya", "Wells in Uganda", "School latrines"],
      defaultFrequency: "monthly",
      weight: 0.7,
    },
    {
      slug: "clean-water-match",
      title: "Double your gift: the $10K match",
      summary: "Every gift is matched dollar for dollar, up to $10,000 from a founding partner.",
      story: ["A founding partner will match every gift made through this page, up to $10,000."],
      goal: 10000,
      oneTime: [25, 50, 100, 250, 500, 1000],
      monthly: [10, 25, 50, 75, 100, 200],
      impact: { 50: "Becomes $100: a household filter for two families.", 100: "Becomes $200: a school rainwater tank part." },
      designations: ["Matched gift"],
      weight: 0.3,
    },
  ],
  "acc-17": [
    {
      slug: "shelter-first",
      title: "A first home for every family",
      summary: "We move families from emergency shelter into homes of their own, then stay with them for the first year.",
      story: [
        "Families in Toronto's shelter system wait an average of nine months for housing. Shelter First finds the apartment, covers the first month and stays for a year of support.",
        "Monthly gifts are what let us sign a lease the day a unit comes up.",
      ],
      goal: 28000,
      oneTime: [36, 72, 150, 300, 600, 1200],
      monthly: [15, 30, 50, 72, 100, 150],
      impact: {
        15: "Kitchen basics for a family's first night.",
        30: "A month of phone and transit for a parent job-hunting.",
        50: "A bed frame and mattress for one child.",
        72: "A week of a housing worker's visits.",
        100: "Moving day: the truck, boxes and two helpers.",
        150: "Furniture for a family's first living room.",
        300: "Utility deposits for a new apartment.",
        600: "Half a family's first month of rent.",
        1200: "A family's first month of rent, in full.",
      },
      designations: ["Where it's needed most", "First month's rent", "Furniture bank"],
    },
  ],
  "acc-18": [
    {
      slug: "open-hands",
      title: "Feed a family this Thanksgiving",
      summary: "Our goal is 10,000 Thanksgiving boxes for families across metro Atlanta. Every $1 buys four meals.",
      story: [
        "One in seven of our neighbours does not know where their next meal is coming from. This Thanksgiving we are packing 10,000 boxes with a turkey, fresh produce and staples for a week.",
        "Because we buy wholesale and work with 120 partner pantries, every dollar you give becomes four meals.",
      ],
      goal: 24000,
      oneTime: [25, 54, 100, 250, 500, 1000],
      monthly: [10, 20, 30, 54, 75, 100],
      impact: {
        10: "Forty meals for neighbours in need.",
        20: "A week of groceries for a senior living alone.",
        25: "A hundred meals.",
        30: "Fresh produce for a family for a month.",
        54: "A full Thanksgiving box for a family of four.",
        75: "Three hundred meals.",
        100: "Four Thanksgiving boxes.",
        250: "A thousand meals.",
        500: "Feeds a classroom's families for Thanksgiving.",
        1000: "A partner pantry's turkey order.",
      },
      designations: ["Where it's needed most", "Thanksgiving boxes", "Kids' weekend meals"],
    },
  ],
};

function defaultCampaign(client: FundraisingClient): CampaignSpec {
  return {
    slug: client.account.slug,
    title: `Support ${client.account.name}`,
    summary: `Your gift powers ${client.account.name}'s work in ${client.location}.`,
    story: [`${client.account.name} is new to Lotus. Its story and impact amounts are set from the client page.`],
    goal: Math.max(10000, Math.round(client.monthlyGoalCents / 100)),
    oneTime: [25, 50, 100, 250, 500, 1000],
    monthly: [10, 25, 50, 75, 100, 200],
    impact: {},
    designations: ["Where it's needed most"],
  };
}

const firstNames = [
  "Amira", "James", "Sofia", "Daniel", "Priya", "Michael", "Olivia", "Hassan", "Emma", "Lucas", "Grace", "Mateo", "Hannah", "Noah", "Aisha",
  "Ethan", "Chloe", "Samuel", "Leila", "Benjamin", "Mei", "David", "Zara", "Owen", "Isabel", "Kwame", "Ruth", "Omar", "Claire", "Tomás",
  "Fatima", "Henry", "Naomi", "Julian", "Ingrid", "Marcus", "Yuki", "Patrick", "Elena", "Ibrahim", "Laura", "Ravi", "Anna", "Theo", "Nadia",
];
const lastNames = [
  "Okafor", "Bennett", "García", "Chen", "Sharma", "O'Neill", "Johansson", "Haddad", "Müller", "Rossi", "Nguyen", "Adeyemi", "Walsh", "Kim",
  "Novak", "Fischer", "Murphy", "Ali", "Lindqvist", "Brooks", "Patel", "Moreau", "Tanaka", "Reyes", "Campbell", "Mensah", "Kowalski",
  "Hughes", "Silva", "Van Dijk", "Hassan", "Clarke", "Ibrahim", "Larsen", "Dubois", "Ortiz", "Byrne", "Singh", "Abbott", "Mwangi",
];
const cities: Record<string, string[]> = {
  US: ["Boston", "Chicago", "Atlanta", "Seattle", "Austin", "Denver", "Minneapolis", "Brooklyn", "Portland", "San Diego"],
  CA: ["Toronto", "Vancouver", "Montreal", "Ottawa", "Calgary"],
  GB: ["London", "Manchester", "Edinburgh", "Bristol", "Leeds"],
  AU: ["Sydney", "Melbourne", "Brisbane"],
  DE: ["Berlin", "Munich", "Hamburg"],
  NL: ["Amsterdam", "Utrecht", "Rotterdam"],
  SE: ["Stockholm", "Gothenburg"],
  AE: ["Dubai", "Abu Dhabi"],
  IN: ["Mumbai", "Bengaluru", "Delhi"],
  KE: ["Nairobi", "Mombasa"],
};

function pick<T>(r: () => number, xs: T[]): T {
  return xs[Math.floor(r() * xs.length)];
}

function weighted<T>(r: () => number, xs: { v: T; w: number }[]): T {
  const total = xs.reduce((a, x) => a + x.w, 0);
  let t = r() * total;
  for (const x of xs) {
    t -= x.w;
    if (t <= 0) return x.v;
  }
  return xs[xs.length - 1].v;
}

function buildCampaign(spec: CampaignSpec, accountId: string, i: number, now: Date): Campaign {
  const impact: Record<number, string> = {};
  for (const [k, v] of Object.entries(spec.impact)) impact[d$(Number(k))] = v;
  return {
    id: `cp-${accountId}-${i + 1}`,
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
    createdAt: new Date(now.getTime() - (400 - i * 120) * DAY).toISOString(),
  };
}

/** Round a dollar figure the way people actually give: to 5s, 10s, 25s. */
function giftish(dollars: number) {
  if (dollars < 30) return Math.max(5, Math.round(dollars / 5) * 5);
  if (dollars < 300) return Math.round(dollars / 10) * 10;
  return Math.round(dollars / 25) * 25;
}

function seedAccount(client: FundraisingClient, now: Date): AccountFundraising {
  const id = client.account.id;
  const specs = campaignSpecs[id] ?? [defaultCampaign(client)];
  const campaigns = specs.map((s, i) => buildCampaign(s, id, i, now));
  const out: AccountFundraising = { campaigns, donors: [], donations: [], plans: [] };
  // A client opened in Lotus today has a checkout but no donors yet.
  if (!campaignSpecs[id]) return out;

  const r = rng(hash(id));
  const countryPool = (client.countries.length ? client.countries : [{ code: "US", name: "United States", raisedCents: 1 }]).map((c) => ({ v: c, w: c.raisedCents || 1 }));
  const campaignPool = specs.map((s, i) => ({ v: campaigns[i], w: s.weight ?? 1 }));
  const recentAvg = (() => {
    const d = client.days.slice(-30);
    const raised = d.reduce((a, x) => a + x.raisedCents, 0);
    const n = d.reduce((a, x) => a + x.donations, 0);
    return n ? raised / n / 100 : 100;
  })();
  const donorCount = 46 + Math.floor(r() * 30);
  const used = new Set<string>();
  const nowMs = now.getTime();
  let seq = 0;

  for (let k = 0; k < donorCount; k++) {
    let first = pick(r, firstNames);
    let last = pick(r, lastNames);
    for (let tries = 0; used.has(`${first} ${last}`) && tries < 6; tries++) {
      first = pick(r, firstNames);
      last = pick(r, lastNames);
    }
    used.add(`${first} ${last}`);
    const country = weighted(r, countryPool);
    const donorId = `dn-${id}-${k + 1}`;
    const email = `${first}.${last}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z.]/g, "") + `@${pick(r, ["gmail.com", "outlook.com", "icloud.com", "proton.me", "yahoo.com"])}`;

    // Giving pattern: monthly (some failing, some canceled), repeat, one-off, lapsed.
    const kind = weighted(r, [
      { v: "monthly", w: 0.24 },
      { v: "repeat", w: 0.28 },
      { v: "once", w: 0.22 },
      { v: "lapsed", w: 0.13 },
      { v: "new", w: 0.06 },
    ] as const);
    const firstAgo =
      kind === "new" ? 2 + Math.floor(r() * 26) : kind === "lapsed" ? 400 + Math.floor(r() * 500) : 35 + Math.floor(r() * 820);
    const firstAt = nowMs - firstAgo * DAY - Math.floor(r() * 12) * 3600_000;
    const campaign = weighted(r, campaignPool);
    const designation = r() < 0.6 ? campaign.designations[0] : pick(r, campaign.designations);
    const coversFees = r() < 0.62;
    const gifts: Donation[] = [];
    const gift = (atMs: number, amount: number, frequency: GiftFrequency, planId?: string, status: Donation["status"] = "succeeded") => {
      const c = frequency === "monthly" && planId ? campaign : weighted(r, campaignPool);
      gifts.push({
        id: `gf-${id}-${++seq}`,
        accountId: id,
        donorId,
        campaignId: c.id,
        amountCents: d$(amount),
        feeCoveredCents: coversFees ? feeToCover(d$(amount)) : 0,
        frequency,
        recurringPlanId: planId,
        designation: frequency === "monthly" ? designation : r() < 0.6 ? c.designations[0] : pick(r, c.designations),
        countryCode: country.code,
        status,
        paymentRef: `pi_demo_${id.replace(/\W/g, "")}${seq}`,
        createdAt: new Date(atMs).toISOString(),
      });
    };

    if (kind === "monthly") {
      const amount = pick(r, specs[campaigns.indexOf(campaign)].monthly.slice(0, 4));
      const planId = `rp-${id}-${k + 1}`;
      const status = weighted(r, [
        { v: "active", w: 0.78 },
        { v: "past_due", w: 0.1 },
        { v: "canceled", w: 0.12 },
      ] as const);
      const months = Math.max(1, Math.floor(firstAgo / 30.4));
      const stopAfter = status === "canceled" ? Math.max(1, Math.floor(months * (0.3 + r() * 0.5))) : months;
      for (let m = 0; m <= Math.min(months, stopAfter); m++) {
        const at = firstAt + m * 30.4 * DAY;
        if (at > nowMs - DAY) break;
        gift(at, amount, "monthly", planId);
      }
      if (status === "past_due") gifts[gifts.length - 1].status = "failed";
      const lastAt = new Date(gifts[gifts.length - 1].createdAt);
      out.plans.push({
        id: planId,
        accountId: id,
        donorId,
        campaignId: campaign.id,
        amountCents: d$(amount),
        feeCoveredCents: gifts[0].feeCoveredCents,
        designation,
        status,
        startedAt: new Date(firstAt).toISOString(),
        nextChargeOn: status === "canceled" ? null : status === "past_due" ? new Date(nowMs + 3 * DAY).toISOString().slice(0, 10) : nextMonthly(lastAt),
        canceledAt: status === "canceled" ? new Date(lastAt.getTime() + 20 * DAY).toISOString() : undefined,
      });
    } else {
      const base = giftish(recentAvg * (0.35 + r() * 1.4) * (r() < 0.06 ? 8 : 1));
      const count = kind === "repeat" ? 2 + Math.floor(r() * 5) : kind === "lapsed" ? 1 + Math.floor(r() * 4) : 1;
      // Lapsed donors stopped more than a year ago; others gave across their history.
      const lastAgo = kind === "lapsed" ? 370 + Math.floor(r() * 30) : kind === "repeat" ? Math.floor(r() * Math.min(firstAgo, 300)) : firstAgo;
      for (let n = 0; n < count; n++) {
        const ago = count === 1 ? firstAgo : firstAgo - ((firstAgo - lastAgo) * n) / (count - 1);
        gift(nowMs - ago * DAY - Math.floor(r() * 8) * 3600_000, giftish(base * (0.8 + r() * 0.5)), "one_time");
      }
    }

    const ok = gifts.filter((x) => x.status === "succeeded");
    const lastActivity = gifts[gifts.length - 1].createdAt;
    const contact: Contact = {
      id: `ct-${id}-${k + 1}`,
      accountId: id,
      firstName: first,
      lastName: last,
      email,
      city: pick(r, cities[country.code] ?? [country.name]),
      tags: ["Donor"],
      source: firstAgo > 400 ? "import" : "donation-page",
      stageId: "donor",
      valueCents: ok.reduce((a, x) => a + x.amountCents, 0),
      recurring: kind === "monthly" && out.plans[out.plans.length - 1].status !== "canceled",
      doNotContact: { email: r() < 0.04, sms: false, call: false },
      createdAt: new Date(firstAt).toISOString(),
      lastActivityAt: lastActivity,
    };
    out.donors.push({ id: donorId, accountId: id, contact, countryCode: country.code, countryName: country.name, anonymous: r() < 0.07 });
    out.donations.push(...gifts);
  }
  return out;
}

export function clientName(clients: ClientRecord[], accountId: string) {
  return clients.find((c) => c.account.id === accountId)?.account.name ?? "";
}
