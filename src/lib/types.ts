export type AccountMode = "marketing" | "fundraising";
export type Health = "green" | "amber" | "red";

export interface Agency {
  id: string;
  name: string;
  slug: string;
  brandColor: string;
}

export interface Account {
  id: string;
  agencyId: string;
  name: string;
  slug: string;
  mode: AccountMode;
  brandColor?: string;
}

/** Yesterday's numbers for a marketing (lead-gen) client. */
export interface MarketingMetrics {
  spendCents: number;
  leads: number;
  bookedAppointments: number;
  showed: number;
  closed: number;
}

/** Yesterday's numbers for a fundraising client. */
export interface FundraisingMetrics {
  raisedCents: number;
  donations: number;
  newDonors: number;
  newRecurring: number;
  averageGiftCents: number;
}

export type DiagnosticMetrics =
  | { mode: "marketing"; today: MarketingMetrics; trend7d: number[] }
  | { mode: "fundraising"; today: FundraisingMetrics; trend7d: number[] };

export interface DailyDiagnostic {
  id: string;
  accountId: string;
  day: string; // YYYY-MM-DD
  health: Health;
  metrics: DiagnosticMetrics;
  alerts: string[];
  summary: string | null;
}

export interface DiagnosticNote {
  id: string;
  accountId: string;
  authorName: string;
  body: string;
  internalOnly: boolean;
  createdAt: string;
}

export interface Task {
  id: string;
  accountId: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  assigneeName?: string;
  dueOn?: string;
}

export interface ClientOverview {
  account: Account;
  diagnostic: DailyDiagnostic | null;
  latestNote: DiagnosticNote | null;
  openTasks: number;
}

/* ------------------------------------------------------------------ */
/* Daily Diagnostic: per-client daily series used by the board/panel    */
/* ------------------------------------------------------------------ */

export interface Assignee {
  name: string;
  initials: string;
  tone: "violet" | "orange" | "teal" | "ink";
}

export interface MarketingDay {
  day: string; // YYYY-MM-DD
  spendCents: number;
  leads: number;
  appointments: number;
  showed: number;
  closed: number;
}

export interface FundraisingDay {
  day: string;
  raisedCents: number;
  donations: number;
  newDonors: number;
  newRecurring: number;
}

export interface CountryRaised {
  code: string;
  name: string;
  raisedCents: number;
}

export type ClientStatus = "onboarding" | "active" | "paused";

/** A person with access: agency staff on the client, or the client's own logins. */
export interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member" | "client";
  initials: string;
  tone: Assignee["tone"];
  invitedAt?: string; // set until the invite is accepted
}

interface ClientBase {
  account: Account;
  status: ClientStatus;
  industry: string;
  website?: string;
  location: string;
  timeZone: string;
  tags: string[];
  assignees: Assignee[];
  startedOn: string;
  health: Health;
  alerts: string[];
  summary: string | null;
  notes: DiagnosticNote[];
  tasks: Task[];
  /** The client's own logins (sub-account members). */
  clientMembers: Member[];
}

export interface MarketingClient extends ClientBase {
  mode: "marketing";
  monthlyBudgetCents: number;
  avgJobValueCents: number;
  days: MarketingDay[]; // oldest first, last entry is yesterday
}

export interface FundraisingClient extends ClientBase {
  mode: "fundraising";
  monthlyGoalCents: number;
  days: FundraisingDay[];
  countries: CountryRaised[]; // last 30 days
}

export type ClientRecord = MarketingClient | FundraisingClient;
