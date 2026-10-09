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

/* ------------------------------------------------------------------ */
/* CRM: contacts, pipeline stages, activity                              */
/* ------------------------------------------------------------------ */

export type ContactSource = "meta" | "google" | "website" | "referral" | "donation-page" | "import" | "manual";

/** One pipeline per client; marketing and fundraising clients use different stage sets. */
export interface PipelineStage {
  id: string;
  name: string;
  /** Terminal stages: a won deal or a recurring donor is "won", a lost deal or lapsed donor is "lost". */
  outcome?: "won" | "lost";
}

export interface Pipeline {
  id: string;
  accountId: string;
  name: string;
  stages: PipelineStage[];
}

export interface Contact {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  city?: string;
  tags: string[];
  source: ContactSource;
  /** Stage id within the client's pipeline. */
  stageId: string;
  /** Agency or client person who owns the relationship. */
  ownerName?: string;
  /** Marketing: estimated or won job value. Fundraising: lifetime donated. */
  valueCents: number;
  /** Fundraising only: active monthly giving. */
  recurring?: boolean;
  doNotContact: { email: boolean; sms: boolean; call: boolean };
  createdAt: string;
  lastActivityAt: string;
}

export type ActivityKind = "call" | "sms" | "email" | "form" | "appointment" | "donation" | "note" | "stage" | "task";

export interface ContactActivity {
  id: string;
  contactId: string;
  kind: ActivityKind;
  title: string;
  body?: string;
  /** Person who did it (agency member) or "System" for automated events. */
  by?: string;
  amountCents?: number;
  at: string;
}

/* ------------------------------------------------------------------ */
/* Email marketing: templates, audiences, campaigns, sends               */
/* ------------------------------------------------------------------ */

/** One block of an email body. Text supports {{first_name}} style merge tags. */
export type EmailBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "button"; text: string; url: string }
  | { id: string; type: "image"; alt: string; caption?: string }
  | { id: string; type: "divider" };

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  /** Which client mode it is written for; undefined means both. */
  mode?: AccountMode;
  subject: string;
  previewText: string;
  blocks: EmailBlock[];
}

/** Rules for a segment. Empty arrays mean "any". All rules must match. */
export interface AudienceFilter {
  tags: string[];
  stageIds: string[];
  sources: ContactSource[];
  /** Only contacts added in the last N days. */
  addedWithinDays?: number;
}

export interface EmailAudience {
  id: string;
  accountId: string;
  name: string;
  /** A segment is evaluated live from its rules; a list is a fixed set of contacts. */
  kind: "segment" | "list";
  filter: AudienceFilter;
  contactIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus = "draft" | "scheduled" | "sent";

export interface EmailCampaign {
  id: string;
  accountId: string;
  name: string;
  subject: string;
  previewText: string;
  fromName: string;
  fromEmail: string;
  audienceId?: string;
  templateId?: string;
  blocks: EmailBlock[];
  status: CampaignStatus;
  scheduledFor?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type SendStatus = "delivered" | "bounced";

/** One email to one contact. Engagement timestamps are set by provider webhooks. */
export interface EmailSend {
  id: string;
  campaignId: string;
  contactId: string;
  email: string;
  status: SendStatus;
  sentAt: string;
  openedAt?: string;
  clickedAt?: string;
  clickedUrl?: string;
  unsubscribedAt?: string;
}
