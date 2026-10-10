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

export type ActivityKind = "call" | "sms" | "email" | "form" | "appointment" | "donation" | "note" | "stage" | "task" | "job" | "estimate" | "invoice" | "payment";

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

/* ------------------------------------------------------------------ */
/* Fundraising: donors, donations, recurring plans, campaigns           */
/* ------------------------------------------------------------------ */

export type GiftFrequency = "one_time" | "monthly";

export interface Campaign {
  id: string;
  accountId: string;
  slug: string; // public checkout lives at /donate/[slug]
  title: string;
  summary: string;
  story: string[];
  goalCents: number;
  /** Suggested amounts in cents, per frequency; the middle one is preselected. */
  amounts: Record<GiftFrequency, number[]>;
  /** What a gift does, keyed by amount in cents; shown under the amount grid. */
  impact: Record<number, string>;
  defaultFrequency: GiftFrequency;
  designations: string[];
  status: "live" | "draft" | "ended";
  createdAt: string;
}

export type DonationStatus = "succeeded" | "refunded" | "failed";

export interface Donation {
  id: string;
  accountId: string;
  donorId: string;
  campaignId: string;
  amountCents: number; // the gift itself
  feeCoveredCents: number; // extra the donor added to cover processing
  frequency: GiftFrequency;
  recurringPlanId?: string;
  designation: string;
  countryCode: string;
  status: DonationStatus;
  paymentRef: string; // Stripe PaymentIntent id, or a demo ref
  createdAt: string;
}

export type RecurringStatus = "active" | "past_due" | "paused" | "canceled";

export interface RecurringPlan {
  id: string;
  accountId: string;
  donorId: string;
  campaignId: string;
  amountCents: number;
  feeCoveredCents: number;
  designation: string;
  status: RecurringStatus;
  startedAt: string;
  nextChargeOn: string | null; // YYYY-MM-DD
  canceledAt?: string;
}

/** A contact who has given. Country comes from the donor's billing details. */
export interface Donor {
  id: string;
  accountId: string;
  contact: Contact;
  countryCode: string;
  countryName: string;
  anonymous: boolean;
}

/* ------------------------------------------------------------------ */
/* Funnels and websites                                                 */
/* ------------------------------------------------------------------ */

export type FunnelStatus = "draft" | "live";

export type FunnelBlock =
  | { id: string; type: "hero"; eyebrow?: string; headline: string; subhead?: string; buttonLabel?: string; buttonHref?: string; align?: "left" | "center" | "split" }
  | { id: string; type: "form"; headline: string; subhead?: string; fields: ("name" | "email" | "phone" | "address" | "message" | "amount")[]; buttonLabel: string; note?: string }
  | { id: string; type: "features"; headline?: string; items: { title: string; body: string }[] }
  | { id: string; type: "stats"; items: { value: string; label: string }[] }
  | { id: string; type: "testimonial"; quote: string; name: string; detail?: string }
  | { id: string; type: "text"; headline?: string; body: string }
  | { id: string; type: "faq"; items: { q: string; a: string }[] }
  | { id: string; type: "cta"; headline: string; body?: string; buttonLabel: string; buttonHref?: string }
  | { id: string; type: "footer"; text: string };

export type FunnelBlockType = FunnelBlock["type"];

export interface FunnelStep {
  id: string;
  name: string;
  /** Path segment after the funnel slug; the first step is the root. */
  path: string;
  blocks: FunnelBlock[];
}

export interface FunnelDay {
  day: string;
  visitors: number;
  leads: number;
}

export interface Funnel {
  id: string;
  accountId: string;
  name: string;
  slug: string;
  status: FunnelStatus;
  template: string;
  /** Brand colour for the public pages; falls back to the account's. */
  brandColor: string;
  steps: FunnelStep[];
  days: FunnelDay[]; // oldest first
  createdAt: string;
  updatedAt: string;
}

export interface FunnelSubmission {
  id: string;
  funnelId: string;
  stepId: string;
  contactId?: string;
  values: Record<string, string>;
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

/* ------------------------------------------------------------------ */
/* Field service: technicians, jobs, estimates, invoices, payments       */
/* ------------------------------------------------------------------ */

/** Someone on the client's crew who can be dispatched to a job. */
export interface Technician extends Assignee {
  id: string;
  accountId: string;
  role: string;
  phone?: string;
}

export type JobStatus = "unscheduled" | "scheduled" | "en_route" | "in_progress" | "completed" | "canceled";

/** A priced row on a job, estimate option or invoice. */
export interface LineItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitCents: number;
}

export interface Job {
  id: string;
  number: string;
  accountId: string;
  contactId: string;
  title: string;
  address: string;
  status: JobStatus;
  technicianIds: string[];
  /** Wall-clock time in the client's time zone, "YYYY-MM-DDTHH:mm". Unset while unscheduled. */
  start?: string;
  durationMin: number;
  lineItems: LineItem[];
  notes?: string;
  estimateId?: string;
  invoiceId?: string;
  createdAt: string;
  completedAt?: string;
}

export type EstimateStatus = "draft" | "sent" | "approved" | "declined";

/** Good, better, best: each option is priced on its own and the customer picks one. */
export interface EstimateOption {
  id: string;
  name: string;
  lineItems: LineItem[];
}

export interface Estimate {
  id: string;
  number: string;
  accountId: string;
  contactId: string;
  title: string;
  address: string;
  status: EstimateStatus;
  options: EstimateOption[];
  approvedOptionId?: string;
  taxRateBps: number;
  message?: string;
  createdAt: string;
  sentAt?: string;
  decidedAt?: string;
  expiresOn: string;
  jobId?: string;
}

/** Stored state. "Overdue" and "Partly paid" are derived from dates and payments. */
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export type PaymentMethod = "card" | "ach" | "cash" | "check";

export interface Payment {
  id: string;
  invoiceId: string;
  amountCents: number;
  method: PaymentMethod;
  at: string;
  /** Processor reference; demo payments carry a stubbed Stripe id. */
  reference?: string;
}

export interface Invoice {
  id: string;
  number: string;
  accountId: string;
  contactId: string;
  jobId?: string;
  estimateId?: string;
  title: string;
  lineItems: LineItem[];
  taxRateBps: number;
  status: InvoiceStatus;
  issuedOn: string;
  dueOn: string;
  sentAt?: string;
  payments: Payment[];
  memo?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Automations: workflows, their steps, and runs per contact            */
/* ------------------------------------------------------------------ */

export type TriggerType =
  | "contact_created"
  | "form_submitted"
  | "tag_added"
  | "stage_changed"
  | "appointment_booked"
  | "appointment_no_show"
  | "donation_received"
  | "message_received"
  | "email_opened"
  | "email_clicked"
  | "job_completed"
  | "webhook_received"
  | "app_event";

/** What starts a workflow. Optional fields narrow it; empty means "any". */
export interface WorkflowTrigger {
  type: TriggerType;
  tag?: string;
  stageId?: string;
  source?: ContactSource;
  channel?: Channel;
  minAmountCents?: number;
  /** form_submitted: only this form. */
  formId?: string;
  /** webhook_received: only this incoming webhook. */
  hookId?: string;
  /** app_event: "app.event", e.g. "meta_lead_ads.new_lead". */
  appEvent?: string;
}

export type ConditionField = "tag" | "stage" | "source" | "has_email" | "has_phone" | "value" | "owner";

/** One test on the contact. `op` reads as "is", "is not", "at least". */
export interface WorkflowCondition {
  field: ConditionField;
  op: "is" | "is_not" | "gte";
  value: string;
}

export type WaitUnit = "minutes" | "hours" | "days";

export type WorkflowStep =
  | { id: string; type: "send_sms"; body: string }
  | { id: string; type: "send_email"; subject: string; body: string }
  | { id: string; type: "add_tag"; tag: string }
  | { id: string; type: "remove_tag"; tag: string }
  | { id: string; type: "move_stage"; stageId: string }
  | { id: string; type: "assign_owner"; ownerName: string }
  | { id: string; type: "create_task"; title: string; assigneeName?: string; dueInDays: number }
  | { id: string; type: "notify"; to: string; message: string }
  | { id: string; type: "wait"; amount: number; unit: WaitUnit }
  | { id: string; type: "branch"; condition: WorkflowCondition; yes: WorkflowStep[]; no: WorkflowStep[] }
  | { id: string; type: "send_webhook"; hookId: string }
  | { id: string; type: "app_action"; app: string; action: string; fields: Record<string, string> };

export type StepType = WorkflowStep["type"];

export type WorkflowStatus = "active" | "paused" | "draft";

export interface Workflow {
  id: string;
  accountId: string;
  name: string;
  status: WorkflowStatus;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  /** When false a contact goes through the workflow once, ever. */
  allowReentry: boolean;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
}

export type RunStatus = "waiting" | "completed" | "failed" | "stopped";

export type RunStepStatus = "done" | "skipped" | "failed" | "waiting";

/** What happened at one step for one contact, in plain words. */
export interface RunStep {
  stepId: string;
  type: StepType;
  status: RunStepStatus;
  /** "Sent: Hi Dana, thanks…", "Skipped: no phone number", "Took Yes: tag is VIP". */
  detail: string;
  at: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  accountId: string;
  contactId: string;
  status: RunStatus;
  /** The event that started it, in words: "Booked a call", "Tag added: VIP". */
  triggeredBy: string;
  /** A test run started by hand from the builder. */
  test?: boolean;
  startedAt: string;
  finishedAt?: string;
  /** Set while waiting. */
  resumeAt?: string;
  /** Step ids still to run, in order. A branch replaces itself with its chosen lane. */
  pending: string[];
  steps: RunStep[];
}

/* ------------------------------------------------------------------ */
/* Reputation: reviews, review requests, per-client settings            */
/* ------------------------------------------------------------------ */

export type ReviewSource = "google" | "facebook";

export interface Review {
  id: string;
  accountId: string;
  source: ReviewSource;
  rating: 1 | 2 | 3 | 4 | 5;
  author: string;
  body: string;
  at: string;
  /** The client's (or the agency's, on their behalf) public reply. */
  reply?: { body: string; by: string; at: string };
  contactId?: string;
}

export type ReviewRequestChannel = "sms" | "email";
export type ReviewRequestTrigger = "job" | "appointment" | "donation" | "manual";
export type ReviewRequestStatus = "sent" | "opened" | "reviewed";

export interface ReviewRequest {
  id: string;
  accountId: string;
  contactId: string;
  contactName: string;
  channel: ReviewRequestChannel;
  trigger: ReviewRequestTrigger;
  status: ReviewRequestStatus;
  sentAt: string;
  reviewId?: string;
}

export interface ReputationSettings {
  accountId: string;
  /** Send a request automatically after these events. */
  autoAfter: { job: boolean; appointment: boolean; donation: boolean };
  channel: ReviewRequestChannel;
  delayHours: number;
  googleUrl?: string;
  facebookUrl?: string;
  /** Message template; {first} and {client} are filled in. */
  message: string;
}

/* ------------------------------------------------------------------ */
/* Reporting: per-client report config and the sends it produced        */
/* ------------------------------------------------------------------ */

export type ReportSectionId = "summary" | "performance" | "volume" | "months" | "countries" | "reviews" | "note";
export type ReportRange = 7 | 30 | 90;

export interface ReportConfig {
  accountId: string;
  enabled: boolean;
  range: ReportRange;
  sections: ReportSectionId[];
  recipients: string[];
  /** Weekly send: 0 = Sunday … 6 = Saturday, hour in the client's time zone. */
  weekday: number;
  hour: number;
  note?: string;
}

export interface ReportSend {
  id: string;
  accountId: string;
  at: string;
  recipients: string[];
  range: ReportRange;
  /** "schedule" for the weekly run, "manual" for Send now. */
  kind: "schedule" | "manual";
}

/* ------------------------------------------------------------------ */
/* Integrations: connected apps, webhooks in and out, API keys          */
/* ------------------------------------------------------------------ */

/** A client's link to an outside app. Sign-in is stubbed until each app is registered; actions are recorded, not delivered. */
export interface IntegrationConnection {
  id: string;
  accountId: string;
  appId: string;
  /** The outside account it signed in as: "ops@brightsmile.com", "#leads workspace". */
  accountLabel: string;
  connectedAt: string;
  connectedBy: string;
}

/** A URL any outside tool can post to; each post creates or updates a contact. */
export interface IncomingWebhook {
  id: string;
  accountId: string;
  name: string;
  /** Secret path segment: POST /api/hooks/{token}. */
  token: string;
  /** Contact field to payload key, e.g. { email: "contact.email" }. Empty keys are guessed. */
  mapping: Partial<Record<"firstName" | "lastName" | "email" | "phone" | "company" | "city", string>>;
  tags: string[];
  createdAt: string;
}

/** A URL Lotus posts contact data to from a workflow step. Signed with HMAC-SHA256. */
export interface OutgoingWebhook {
  id: string;
  accountId: string;
  name: string;
  url: string;
  secret: string;
  createdAt: string;
}

/** A client's key for the REST API. Only the hash is kept; the key is shown once. */
export interface ApiKey {
  id: string;
  accountId: string;
  label: string;
  /** First characters, shown in lists: "lts_4f9a". */
  prefix: string;
  hash: string;
  createdAt: string;
  createdBy: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export type IntegrationLogKind = "webhook_in" | "webhook_out" | "app_event" | "app_action" | "api" | "import";

/** One thing that crossed the boundary, in or out, in plain words. */
export interface IntegrationLog {
  id: string;
  accountId: string;
  kind: IntegrationLogKind;
  /** App id, webhook id or key id. */
  ref: string;
  title: string;
  status: "ok" | "failed";
  detail: string;
  /** JSON as sent or received, pretty-printed and capped. */
  payload?: string;
  /** HTTP status for webhooks out and API calls. */
  code?: number;
  contactId?: string;
  at: string;
}

/* ------------------------------------------------------------------ */
/* Forms: Typeform-style forms, one question at a time                  */
/* ------------------------------------------------------------------ */

export type FormQuestionType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "multiple_choice"
  | "checkboxes"
  | "dropdown"
  | "yes_no"
  | "rating"
  | "opinion_scale"
  | "date"
  | "file_upload"
  | "statement";

/** Contact fields a question can fill. "name" splits into first and last. */
export type FormContactField = "name" | "firstName" | "lastName" | "email" | "phone" | "company" | "city";

export interface FormChoice {
  id: string;
  label: string;
  /** Quiz points for picking this choice. */
  score?: number;
}

/** "If the answer {op} {value}, jump to {goTo}". Rules run top to bottom; the first match wins. */
export interface FormLogicRule {
  id: string;
  op: "is" | "is_not" | "contains" | "gt" | "lt" | "answered";
  value: string;
  /** A question id, or "end" to finish the form. */
  goTo: string;
}

export interface FormQuestion {
  id: string;
  type: FormQuestionType;
  title: string;
  description?: string;
  required: boolean;
  choices?: FormChoice[];
  /** Rating: number of stars (3 to 10). Opinion scale: top of the 0..N scale. */
  steps?: number;
  placeholder?: string;
  mapTo?: FormContactField;
  logic?: FormLogicRule[];
}

/** A closing screen. With scoring on, the first ending whose minScore the total reaches is shown. */
export interface FormEnding {
  id: string;
  title: string;
  body: string;
  minScore?: number;
  buttonLabel?: string;
  buttonUrl?: string;
}

export type FormStatus = "draft" | "live" | "closed";
export type FormThemeKey = "paper" | "ink" | "violet" | "sand" | "forest" | "sky";

export interface FormDefinition {
  id: string;
  accountId: string;
  name: string;
  slug: string;
  status: FormStatus;
  welcome: { enabled: boolean; title: string; body: string; button: string };
  questions: FormQuestion[];
  endings: FormEnding[];
  /** URL parameters saved with each response, e.g. utm_source. */
  hiddenFields: string[];
  theme: FormThemeKey;
  /** Quiz mode: add up choice scores and pick an ending by score. */
  scoring: boolean;
  /** Tags added to the contact on submit. */
  tags: string[];
  /** Email the team on each response. */
  notify?: string;
  template?: string;
  createdAt: string;
  updatedAt: string;
}

export type FormAnswer = string | string[];

export interface FormFile {
  id: string;
  questionId: string;
  name: string;
  type: string;
  size: number;
}

export interface FormResponse {
  id: string;
  formId: string;
  accountId: string;
  contactId?: string;
  answers: Record<string, FormAnswer>;
  hidden: Record<string, string>;
  files: FormFile[];
  score?: number;
  endingId?: string;
  startedAt: string;
  submittedAt: string;
}

/** A visit that opened the form; drop-off is read from lastQuestionId. */
export interface FormVisit {
  id: string;
  formId: string;
  at: string;
  lastQuestionId?: string;
  completed: boolean;
}

/* ------------------------------------------------------------------ */
/* Websites: multi-page sites with navigation, domain and SEO           */
/* ------------------------------------------------------------------ */

// (websites types go here)

/* ------------------------------------------------------------------ */
/* Estimate templates: price book, templates, signatures, deposits      */
/* ------------------------------------------------------------------ */

// (estimate template types go here)
