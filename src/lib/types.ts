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
/* Inbox: conversations and messages across channels                    */
/* ------------------------------------------------------------------ */

export type Channel = "sms" | "email" | "whatsapp" | "facebook";

export interface InboxMessage {
  id: string;
  conversationId: string;
  channel: Channel;
  direction: "inbound" | "outbound";
  /** A note is internal: agency staff only, never sent. */
  kind: "message" | "note";
  subject?: string;
  body: string;
  authorName?: string;
  status?: "sent" | "delivered" | "read" | "failed";
  sentAt: string;
}

export interface Conversation {
  id: string;
  accountId: string;
  contactId: string;
  assigneeName?: string;
  status: "open" | "closed";
  unread: number;
  messages: InboxMessage[]; // oldest first
}

/** A conversation joined with its contact and client, as the inbox renders it. */
export interface InboxThread extends Conversation {
  contact: Contact;
  /** The contact's pipeline stage name, for the contact panel. */
  stageName?: string;
  client: { id: string; name: string; slug: string; mode: AccountMode; health: Health };
}

/* ------------------------------------------------------------------ */
/* Calendars and booking                                               */
/* ------------------------------------------------------------------ */

/**
 * The slice of a contact that booking needs. A stub until the contacts
 * module lands; a booking creates or matches a contact by email.
 */
export interface ContactRef {
  id: string;
  accountId: string;
  name: string;
  email: string;
  phone?: string;
}

export type MeetingLocation = "phone" | "video" | "in_person";

export interface AppointmentType {
  id: string;
  calendarId: string;
  name: string;
  durationMinutes: number;
  description?: string;
  location: MeetingLocation;
  locationDetail?: string;
  active: boolean;
}

/** One bookable window inside a day, in minutes from midnight (calendar time zone). */
export interface AvailabilityWindow {
  start: number;
  end: number;
}

export interface Calendar {
  id: string;
  accountId: string;
  name: string;
  slug: string;
  description?: string;
  ownerName: string;
  timeZone: string;
  /** Index 0 is Sunday. An empty list means closed that day. */
  weekly: AvailabilityWindow[][];
  blockedDates: string[]; // YYYY-MM-DD in the calendar's time zone
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  slotStepMinutes: number;
  bookingEnabled: boolean;
  types: AppointmentType[];
  createdAt: string;
}

/** booked = the lead booked but has not confirmed; confirmed = reminder answered. */
export type AppointmentStatus = "booked" | "confirmed" | "showed" | "no_show" | "cancelled";
export type AppointmentSource = "booking_page" | "manual" | "ads";

export interface Appointment {
  id: string;
  calendarId: string;
  accountId: string;
  typeId: string;
  contact: ContactRef;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes?: string;
  createdAt: string;
}
