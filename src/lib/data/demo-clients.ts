import type {
  Assignee,
  ClientRecord,
  DiagnosticNote,
  FundraisingClient,
  FundraisingDay,
  MarketingClient,
  MarketingDay,
  Task,
} from "@/lib/types";
import { assessFundraising, assessMarketing } from "@/lib/diagnostic";
import { demoAgency } from "./demo";

/*
 * Synthetic clients with 92 days of daily history, generated from a seeded
 * PRNG so every render shows the same numbers. Shocks (a budget doubling, a
 * broken landing page) are written in explicitly so the board has something
 * to flag. All of this is labelled demo data in the UI.
 */

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

const DAYS = 92;

function isoDaysAgo(now: Date, n: number) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, 12);
  return d.toISOString().slice(0, 10);
}

function hoursAgo(now: Date, h: number) {
  return new Date(now.getTime() - h * 3600 * 1000).toISOString();
}

const afza: Assignee = { name: "Afza", initials: "A", tone: "violet" };
const mahad: Assignee = { name: "Mahad", initials: "M", tone: "orange" };
const sara: Assignee = { name: "Sara", initials: "S", tone: "teal" };

interface MarketingSpec {
  id: string;
  name: string;
  slug: string;
  location: string;
  timeZone: string;
  tags: string[];
  assignees: Assignee[];
  startedDaysAgo: number;
  dailyBudget: number; // dollars
  cpl: number; // dollars
  bookRate: number;
  showRate: number;
  closeRate: number;
  avgJob: number; // dollars
  drift: number; // cpl multiplier per day across the window
  /** Recent change: from N days ago, spend and cpl multiply by these. */
  shock?: { fromDaysAgo: number; spend: number; cpl: number };
  summary?: string;
}

const marketingSpecs: MarketingSpec[] = [
  { id: "acc-1", name: "Brightside Dental", slug: "brightside-dental", location: "Austin, TX", timeZone: "America/Chicago", tags: ["Implants offer"], assignees: [afza, mahad], startedDaysAgo: 210, dailyBudget: 420, cpl: 31, bookRate: 0.42, showRate: 0.8, closeRate: 0.45, avgJob: 2400, drift: -0.001 },
  { id: "acc-2", name: "Summit Roofing Co.", slug: "summit-roofing", location: "Denver, CO", timeZone: "America/Denver", tags: ["Storm season"], assignees: [mahad], startedDaysAgo: 96, dailyBudget: 480, cpl: 68, bookRate: 0.3, showRate: 0.75, closeRate: 0.35, avgJob: 9800, drift: 0.0005, shock: { fromDaysAgo: 5, spend: 2.0, cpl: 2.6 },
    summary: "Spend doubled after the \"Storm Season v2\" ad set launched, but leads fell. Cost per lead is nearly three times the prior week. Pause the ad set and restore last week's budget." },
  { id: "acc-5", name: "Air Pro HVAC", slug: "air-pro-hvac", location: "San Diego, CA", timeZone: "America/Los_Angeles", tags: ["Shoulder season"], assignees: [afza, sara], startedDaysAgo: 15, dailyBudget: 85, cpl: 17, bookRate: 0.18, showRate: 0.85, closeRate: 0.5, avgJob: 7600, drift: -0.004 },
  { id: "acc-6", name: "Harbor Plumbing", slug: "harbor-plumbing", location: "Tampa, FL", timeZone: "America/New_York", tags: [], assignees: [mahad], startedDaysAgo: 400, dailyBudget: 300, cpl: 44, bookRate: 0.36, showRate: 0.8, closeRate: 0.55, avgJob: 1900, drift: 0 },
  { id: "acc-7", name: "Northwind Solar", slug: "northwind-solar", location: "Phoenix, AZ", timeZone: "America/Phoenix", tags: ["Rebate push"], assignees: [afza], startedDaysAgo: 150, dailyBudget: 900, cpl: 110, bookRate: 0.22, showRate: 0.7, closeRate: 0.3, avgJob: 24000, drift: 0.002, shock: { fromDaysAgo: 9, spend: 1.0, cpl: 1.3 },
    summary: "Lead cost has crept up for nine days while spend is flat. Search impression share is the likely cause after a competitor entered the auction. Review bids on the top three keywords." },
  { id: "acc-8", name: "Maple Lane Orthodontics", slug: "maple-lane-ortho", location: "Columbus, OH", timeZone: "America/New_York", tags: ["Back to school"], assignees: [sara], startedDaysAgo: 320, dailyBudget: 260, cpl: 52, bookRate: 0.4, showRate: 0.82, closeRate: 0.6, avgJob: 5200, drift: -0.0015 },
  { id: "acc-9", name: "Keystone Garage Doors", slug: "keystone-garage", location: "Pittsburgh, PA", timeZone: "America/New_York", tags: [], assignees: [mahad, sara], startedDaysAgo: 60, dailyBudget: 180, cpl: 38, bookRate: 0.33, showRate: 0.78, closeRate: 0.5, avgJob: 1400, drift: 0 },
  { id: "acc-10", name: "Clearwater Pools", slug: "clearwater-pools", location: "Orlando, FL", timeZone: "America/New_York", tags: ["Off season"], assignees: [afza], startedDaysAgo: 500, dailyBudget: 150, cpl: 95, bookRate: 0.25, showRate: 0.7, closeRate: 0.4, avgJob: 38000, drift: 0.001, shock: { fromDaysAgo: 20, spend: 0.45, cpl: 1.0 },
    summary: "Budget was cut for the off season on purpose, so underspend against the monthly budget is expected. Lower the budget in settings so pacing stops flagging it." },
  { id: "acc-11", name: "Evergreen Landscaping", slug: "evergreen-landscaping", location: "Portland, OR", timeZone: "America/Los_Angeles", tags: [], assignees: [sara], startedDaysAgo: 240, dailyBudget: 220, cpl: 29, bookRate: 0.38, showRate: 0.8, closeRate: 0.48, avgJob: 3100, drift: -0.0005 },
  { id: "acc-12", name: "Redwood Movers", slug: "redwood-movers", location: "Sacramento, CA", timeZone: "America/Los_Angeles", tags: ["Peak season"], assignees: [mahad], startedDaysAgo: 180, dailyBudget: 350, cpl: 24, bookRate: 0.45, showRate: 0.9, closeRate: 0.6, avgJob: 1800, drift: -0.002 },
  { id: "acc-13", name: "Lakeside Vet Clinic", slug: "lakeside-vet", location: "Madison, WI", timeZone: "America/Chicago", tags: [], assignees: [afza], startedDaysAgo: 120, dailyBudget: 120, cpl: 21, bookRate: 0.5, showRate: 0.88, closeRate: 0.7, avgJob: 420, drift: 0 },
  { id: "acc-14", name: "Ironclad Fencing", slug: "ironclad-fencing", location: "Nashville, TN", timeZone: "America/Chicago", tags: [], assignees: [mahad, afza], startedDaysAgo: 75, dailyBudget: 200, cpl: 47, bookRate: 0.3, showRate: 0.75, closeRate: 0.45, avgJob: 6200, drift: 0.0008 },
];

interface FundraisingSpec {
  id: string;
  name: string;
  slug: string;
  location: string;
  timeZone: string;
  tags: string[];
  assignees: Assignee[];
  startedDaysAgo: number;
  dailyRaised: number; // dollars
  avgGift: number; // dollars
  recurringShare: number;
  newDonorShare: number;
  drift: number;
  monthlyGoal: number; // dollars
  countries: [string, string, number][]; // code, name, weight
  shock?: { fromDaysAgo: number; raised: number; gift: number };
  summary?: string;
}

const fundraisingSpecs: FundraisingSpec[] = [
  { id: "acc-3", name: "Hope Harbor Foundation", slug: "hope-harbor", location: "Boston, MA", timeZone: "America/New_York", tags: ["Winter shelter"], assignees: [mahad, afza], startedDaysAgo: 300, dailyRaised: 9200, avgGift: 180, recurringShare: 0.12, newDonorShare: 0.3, drift: 0.004, monthlyGoal: 300000, countries: [["US", "United States", 0.62], ["CA", "Canada", 0.14], ["GB", "United Kingdom", 0.11], ["AU", "Australia", 0.06], ["DE", "Germany", 0.04], ["AE", "United Arab Emirates", 0.03]] },
  { id: "acc-4", name: "Riverside Animal Rescue", slug: "riverside-rescue", location: "Minneapolis, MN", timeZone: "America/Chicago", tags: [], assignees: [afza], startedDaysAgo: 200, dailyRaised: 3600, avgGift: 65, recurringShare: 0.2, newDonorShare: 0.25, drift: 0, monthlyGoal: 110000, countries: [["US", "United States", 0.9], ["CA", "Canada", 0.08], ["GB", "United Kingdom", 0.02]], shock: { fromDaysAgo: 6, raised: 0.5, gift: 0.9 },
    summary: "Six straight days of decline on flat traffic, so this is a conversion problem. The donation page conversion rate halved after Tuesday's hero edit. Revert the hero section." },
  { id: "acc-15", name: "Bright Futures Scholars", slug: "bright-futures", location: "Chicago, IL", timeZone: "America/Chicago", tags: ["Fall appeal"], assignees: [sara], startedDaysAgo: 420, dailyRaised: 5400, avgGift: 240, recurringShare: 0.08, newDonorShare: 0.35, drift: 0.002, monthlyGoal: 170000, countries: [["US", "United States", 0.8], ["GB", "United Kingdom", 0.08], ["IN", "India", 0.07], ["CA", "Canada", 0.05]] },
  { id: "acc-16", name: "Clean Water Collective", slug: "clean-water", location: "Seattle, WA", timeZone: "America/Los_Angeles", tags: ["Matching gift"], assignees: [mahad], startedDaysAgo: 90, dailyRaised: 7100, avgGift: 95, recurringShare: 0.3, newDonorShare: 0.4, drift: 0.006, monthlyGoal: 200000, countries: [["US", "United States", 0.48], ["GB", "United Kingdom", 0.17], ["DE", "Germany", 0.1], ["NL", "Netherlands", 0.08], ["SE", "Sweden", 0.07], ["KE", "Kenya", 0.05], ["CA", "Canada", 0.05]] },
  { id: "acc-17", name: "Shelter First", slug: "shelter-first", location: "Toronto, ON", timeZone: "America/Toronto", tags: [], assignees: [afza, sara], startedDaysAgo: 260, dailyRaised: 2900, avgGift: 72, recurringShare: 0.25, newDonorShare: 0.2, drift: -0.001, monthlyGoal: 120000, countries: [["CA", "Canada", 0.84], ["US", "United States", 0.12], ["GB", "United Kingdom", 0.04]], shock: { fromDaysAgo: 30, raised: 0.8, gift: 1.0 },
    summary: "Running well behind the monthly goal. Volume is down since the spring campaign ended and nothing has replaced it. A fall appeal is due for planning." },
  { id: "acc-18", name: "Open Hands Food Bank", slug: "open-hands", location: "Atlanta, GA", timeZone: "America/New_York", tags: ["Thanksgiving drive"], assignees: [mahad], startedDaysAgo: 140, dailyRaised: 4300, avgGift: 54, recurringShare: 0.18, newDonorShare: 0.3, drift: 0.003, monthlyGoal: 140000, countries: [["US", "United States", 0.95], ["CA", "Canada", 0.05]] },
];

/** Round to an integer with probability equal to the fraction, so small daily rates survive. */
function stochastic(v: number, r: () => number) {
  const f = Math.floor(v);
  return f + (r() < v - f ? 1 : 0);
}

function weekendFactor(iso: string) {
  const dow = new Date(`${iso}T12:00:00`).getDay();
  return dow === 0 || dow === 6 ? 0.62 : 1;
}

function marketingDays(spec: MarketingSpec, now: Date, seed: number): MarketingDay[] {
  const r = rng(seed);
  const out: MarketingDay[] = [];
  for (let ago = DAYS; ago >= 1; ago--) {
    const day = isoDaysAgo(now, ago);
    if (ago > spec.startedDaysAgo) continue;
    const t = DAYS - ago;
    const wk = weekendFactor(day);
    let spend = spec.dailyBudget * wk * (0.86 + r() * 0.28);
    let cpl = spec.cpl * (1 + spec.drift * t) * (0.78 + r() * 0.44);
    if (spec.shock && ago <= spec.shock.fromDaysAgo) {
      spend *= spec.shock.spend;
      cpl *= spec.shock.cpl;
    }
    const leads = Math.max(0, Math.round(spend / cpl));
    const appointments = stochastic(leads * spec.bookRate * (0.75 + r() * 0.5), r);
    const showed = stochastic(appointments * spec.showRate * (0.8 + r() * 0.3), r);
    const closed = stochastic(showed * spec.closeRate * (0.7 + r() * 0.5), r);
    out.push({ day, spendCents: Math.round(spend * 100), leads, appointments: Math.min(appointments, leads), showed: Math.min(showed, appointments), closed: Math.min(closed, showed) });
  }
  return out;
}

function fundraisingDays(spec: FundraisingSpec, now: Date, seed: number): FundraisingDay[] {
  const r = rng(seed);
  const out: FundraisingDay[] = [];
  for (let ago = DAYS; ago >= 1; ago--) {
    const day = isoDaysAgo(now, ago);
    if (ago > spec.startedDaysAgo) continue;
    const t = DAYS - ago;
    const wk = new Date(`${day}T12:00:00`).getDay() === 2 ? 1.5 : 1; // Tuesday sends
    let gift = spec.avgGift * (0.7 + r() * 0.6);
    let raised = spec.dailyRaised * (1 + spec.drift * t) * wk * (0.6 + r() * 0.8);
    if (spec.shock && ago <= spec.shock.fromDaysAgo) {
      raised *= spec.shock.raised;
      gift *= spec.shock.gift;
    }
    const donations = Math.max(1, Math.round(raised / gift));
    out.push({
      day,
      raisedCents: Math.round(raised * 100),
      donations,
      newDonors: stochastic(donations * spec.newDonorShare * (0.7 + r() * 0.6), r),
      newRecurring: stochastic(donations * spec.recurringShare * (0.6 + r() * 0.8), r),
    });
  }
  return out;
}

function notesFor(now: Date): Record<string, DiagnosticNote[]> {
  const n = (id: string, accountId: string, authorName: string, h: number, body: string): DiagnosticNote => ({
    id, accountId, authorName, body, internalOnly: true, createdAt: hoursAgo(now, h),
  });
  return {
    "acc-2": [
      n("note-1", "acc-2", "Afza", 3, "Call with Mike at Summit. He approved the new creative but wants spend capped at $500/day until CPL recovers. Mahad, can you adjust the Meta budget today?"),
      n("note-4", "acc-2", "Mahad", 52, "Launched Storm Season v2 with the new video. Watching CPL for 48 hours before scaling."),
      n("note-5", "acc-2", "Afza", 170, "Monthly review done. Mike is happy with September, wants us to push harder into hail season."),
    ],
    "acc-4": [
      n("note-2", "acc-4", "Afza", 26, "Riverside asked why donations dipped. Told them we're reverting the page change and will report back Friday."),
      n("note-6", "acc-4", "Sara", 120, "Shipped the new donation page hero with the adoption photo. Monitoring conversion."),
    ],
    "acc-3": [
      n("note-3", "acc-3", "Mahad", 50, "Hope Harbor wants a year-end campaign plan by Nov 1. Drafting it this week."),
      n("note-7", "acc-3", "Afza", 200, "Winter Shelter email went out Tuesday. Best open rate of the year so far at 41%."),
    ],
    "acc-5": [
      n("note-8", "acc-5", "Afza", 30, "Two weeks in. The Install Video with the $500 off offer is the clear top performer and is driving most delivery. UGC creatives are barely getting spend yet."),
      n("note-9", "acc-5", "Sara", 190, "Onboarding call done. Shoulder season until mid October, so expect low volume; ramp budget in November."),
    ],
    "acc-7": [n("note-10", "acc-7", "Afza", 8, "Competitor showed up on our top rebate keywords. Reviewing bids with Mahad tomorrow.")],
    "acc-10": [n("note-11", "acc-10", "Afza", 400, "Off-season budget cut agreed with the client, back to full spend in March.")],
    "acc-17": [n("note-12", "acc-17", "Sara", 72, "Spring campaign wrapped. Need a fall appeal concept before the board meeting on the 20th.")],
    "acc-16": [n("note-13", "acc-16", "Mahad", 20, "Matching gift from the foundation is live through the 31st. Pushing it in every email.")],
  };
}

function tasksFor(now: Date): Task[] {
  const today = isoDaysAgo(now, 0);
  return [
    { id: "t-1", accountId: "acc-2", title: "Cap Meta daily budget at $500", status: "todo", assigneeName: "Mahad", dueOn: today },
    { id: "t-2", accountId: "acc-2", title: "Pause ad set Storm Season v2", status: "in_progress", assigneeName: "Mahad", dueOn: today },
    { id: "t-3", accountId: "acc-4", title: "Revert donation page hero", status: "todo", assigneeName: "Sara" },
    { id: "t-4", accountId: "acc-3", title: "Draft year-end campaign plan", status: "in_progress", assigneeName: "Mahad" },
    { id: "t-5", accountId: "acc-1", title: "Send October report", status: "done", assigneeName: "Afza" },
    { id: "t-6", accountId: "acc-7", title: "Review rebate keyword bids", status: "todo", assigneeName: "Mahad", dueOn: isoDaysAgo(now, -1) },
    { id: "t-7", accountId: "acc-17", title: "Fall appeal concept", status: "todo", assigneeName: "Sara", dueOn: isoDaysAgo(now, -4) },
  ];
}

let cache: { key: string; records: ClientRecord[] } | null = null;

/** Deterministic for a given calendar day, so the board is stable across requests. */
export function demoClients(now: Date): ClientRecord[] {
  const key = isoDaysAgo(now, 0);
  if (cache && cache.key === key) return cache.records;

  const notes = notesFor(now);
  const tasks = tasksFor(now);
  const records: ClientRecord[] = [];

  marketingSpecs.forEach((s, i) => {
    const base: Omit<MarketingClient, "health" | "alerts"> = {
      mode: "marketing",
      account: { id: s.id, agencyId: demoAgency.id, name: s.name, slug: s.slug, mode: "marketing" },
      location: s.location,
      timeZone: s.timeZone,
      tags: s.tags,
      assignees: s.assignees,
      startedOn: isoDaysAgo(now, s.startedDaysAgo),
      summary: s.summary ?? null,
      notes: (notes[s.id] ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      tasks: tasks.filter((t) => t.accountId === s.id),
      monthlyBudgetCents: Math.round(s.dailyBudget * 30.4) * 100,
      avgJobValueCents: s.avgJob * 100,
      days: marketingDays(s, now, 1000 + i),
    };
    records.push({ ...base, ...assessMarketing(base, now) });
  });

  fundraisingSpecs.forEach((s, i) => {
    const days = fundraisingDays(s, now, 2000 + i);
    const last30 = days.slice(-30).reduce((a, d) => a + d.raisedCents, 0);
    const base: Omit<FundraisingClient, "health" | "alerts"> = {
      mode: "fundraising",
      account: { id: s.id, agencyId: demoAgency.id, name: s.name, slug: s.slug, mode: "fundraising" },
      location: s.location,
      timeZone: s.timeZone,
      tags: s.tags,
      assignees: s.assignees,
      startedOn: isoDaysAgo(now, s.startedDaysAgo),
      summary: s.summary ?? null,
      notes: (notes[s.id] ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      tasks: tasks.filter((t) => t.accountId === s.id),
      monthlyGoalCents: s.monthlyGoal * 100,
      days,
      countries: s.countries.map(([code, name, w]) => ({ code, name, raisedCents: Math.round(last30 * w) })),
    };
    records.push({ ...base, ...assessFundraising(base, now) });
  });

  cache = { key, records };
  return records;
}
