import type {
  Account,
  Agency,
  ClientOverview,
  DailyDiagnostic,
  DiagnosticNote,
  Task,
} from "@/lib/types";

// Demo data used until Supabase is configured, so the UI can be run and
// reviewed without any backend. Shapes match the database rows 1:1.

export const demoAgency: Agency = {
  id: "agency-lotus",
  name: "Lotus",
  slug: "lotus",
  brandColor: "#7c3aed",
};

export const demoAccounts: Account[] = [
  { id: "acc-1", agencyId: demoAgency.id, name: "Brightside Dental", slug: "brightside-dental", mode: "marketing" },
  { id: "acc-2", agencyId: demoAgency.id, name: "Summit Roofing Co.", slug: "summit-roofing", mode: "marketing" },
  { id: "acc-3", agencyId: demoAgency.id, name: "Hope Harbor Foundation", slug: "hope-harbor", mode: "fundraising" },
  { id: "acc-4", agencyId: demoAgency.id, name: "Riverside Animal Rescue", slug: "riverside-rescue", mode: "fundraising" },
];

const today = () => new Date().toISOString().slice(0, 10);

export const demoDiagnostics: DailyDiagnostic[] = [
  {
    id: "diag-1",
    accountId: "acc-1",
    day: today(),
    health: "green",
    metrics: {
      mode: "marketing",
      today: { spendCents: 42_000, leads: 14, bookedAppointments: 6, showed: 5, closed: 2 },
      trend7d: [9, 11, 12, 10, 13, 12, 14],
    },
    alerts: [],
    summary:
      "Steady day. Leads up 17% against the 7-day average on flat spend; cost per booked appointment is $70, the best this month.",
  },
  {
    id: "diag-2",
    accountId: "acc-2",
    day: today(),
    health: "red",
    metrics: {
      mode: "marketing",
      today: { spendCents: 96_000, leads: 5, bookedAppointments: 1, showed: 0, closed: 0 },
      trend7d: [12, 11, 13, 10, 9, 7, 5],
    },
    alerts: ["CPA up 140% vs 7-day average", "Meta spend doubled while leads fell"],
    summary:
      "Spend doubled to $960 after the new Meta ad set launched, but leads dropped to 5. Cost per lead is $192 against a $68 average. Suggest pausing ad set \"Storm Season v2\" and restoring yesterday's budget.",
  },
  {
    id: "diag-3",
    accountId: "acc-3",
    day: today(),
    health: "green",
    metrics: {
      mode: "fundraising",
      today: { raisedCents: 1_284_000, donations: 61, newDonors: 18, newRecurring: 7, averageGiftCents: 21_049 },
      trend7d: [6_900, 7_400, 8_100, 7_950, 9_200, 11_000, 12_840],
    },
    alerts: [],
    summary:
      "Best day in 30 days. $12,840 raised, with 7 new monthly donors from the upgrade prompt. Email campaign \"Winter Shelter\" drove 58% of gifts.",
  },
  {
    id: "diag-4",
    accountId: "acc-4",
    day: today(),
    health: "amber",
    metrics: {
      mode: "fundraising",
      today: { raisedCents: 182_000, donations: 9, newDonors: 2, newRecurring: 0, averageGiftCents: 20_222 },
      trend7d: [4_100, 3_800, 3_600, 3_100, 2_700, 2_200, 1_820],
    },
    alerts: ["Raised down 48% vs 7-day average", "Donation page conversion 1.1% (was 2.4%)"],
    summary:
      "Six straight days of decline. Traffic is flat, so this is a conversion problem: the donation page conversion rate halved after Tuesday's page edit. Recommend reverting the hero section.",
  },
];

export const demoNotes: DiagnosticNote[] = [
  {
    id: "note-1",
    accountId: "acc-2",
    authorName: "Afza (CMO)",
    body: "Call with Mike at Summit. He approved the new creative but wants spend capped at $500/day until CPL recovers. @Mahad can you adjust the Meta budget today?",
    internalOnly: true,
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: "note-2",
    accountId: "acc-4",
    authorName: "Afza (CMO)",
    body: "Riverside asked why donations dipped. Told them we're reverting the page change and will report back Friday.",
    internalOnly: true,
    createdAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
  },
  {
    id: "note-3",
    accountId: "acc-3",
    authorName: "Mahad",
    body: "Hope Harbor wants a year-end campaign plan by Nov 1. Drafting it this week.",
    internalOnly: true,
    createdAt: new Date(Date.now() - 50 * 3600 * 1000).toISOString(),
  },
];

export const demoTasks: Task[] = [
  { id: "t-1", accountId: "acc-2", title: "Cap Meta daily budget at $500", status: "todo", assigneeName: "Mahad", dueOn: today() },
  { id: "t-2", accountId: "acc-2", title: "Pause ad set Storm Season v2", status: "in_progress", assigneeName: "Mahad", dueOn: today() },
  { id: "t-3", accountId: "acc-4", title: "Revert donation page hero", status: "todo", assigneeName: "Afza" },
  { id: "t-4", accountId: "acc-3", title: "Draft year-end campaign plan", status: "in_progress", assigneeName: "Mahad" },
  { id: "t-5", accountId: "acc-1", title: "Send October report", status: "done", assigneeName: "Afza" },
];

export function demoOverview(): ClientOverview[] {
  return demoAccounts.map((account) => ({
    account,
    diagnostic: demoDiagnostics.find((d) => d.accountId === account.id) ?? null,
    latestNote:
      demoNotes
        .filter((n) => n.accountId === account.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
    openTasks: demoTasks.filter((t) => t.accountId === account.id && t.status !== "done").length,
  }));
}
