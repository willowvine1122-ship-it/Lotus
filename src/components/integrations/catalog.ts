/*
 * The apps a client can connect, and what each one adds to automations:
 * triggers (something happened over there, start a workflow here) and
 * actions (a workflow step that does something over there). Framework-free,
 * so the hub, the builder, the engine and the server actions share one list.
 */

export type AppCategory =
  | "Ads"
  | "Payments"
  | "Accounting"
  | "Spreadsheets"
  | "Team chat"
  | "Email"
  | "Calendar"
  | "Email marketing";

export interface AppField {
  key: string;
  label: string;
  placeholder?: string;
  /** Long text gets a textarea with merge chips. */
  multiline?: boolean;
  /** Merge tags allowed: {{first_name}}, {{email}}… */
  merge?: boolean;
  hint?: string;
}

export interface AppTrigger {
  key: string;
  label: string;
  /** "A lead fills in a Meta lead form": how the builder reads it. */
  summary: string;
  /** What a test event carries, so "Send a test event" makes a believable contact. */
  sample: Record<string, string>;
}

export interface AppAction {
  key: string;
  label: string;
  fields: AppField[];
  /** Past tense line for the run history, with {field} placeholders: "Posted to {channel}". */
  done: string;
}

export interface AppDef {
  id: string;
  name: string;
  category: AppCategory;
  /** Short line for the catalog row. */
  blurb: string;
  /** Two-letter mark and its colour for the logo square. */
  mark: string;
  color: string;
  /** What signing in asks for: the account the connection acts as. */
  accountPrompt: string;
  accountPlaceholder: string;
  triggers: AppTrigger[];
  actions: AppAction[];
  /** Apps that can bring past records into Lotus once. */
  importLabel?: string;
}

const person = (
  first: string,
  last: string,
  extra: Record<string, string> = {},
) => ({
  first_name: first,
  last_name: last,
  email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
  phone: "+1 555 010 2233",
  ...extra,
});

export const apps: AppDef[] = [
  {
    id: "meta_lead_ads",
    name: "Meta Lead Ads",
    category: "Ads",
    blurb:
      "New leads from Facebook and Instagram lead forms land in the CRM in seconds.",
    mark: "M",
    color: "#1877f2",
    accountPrompt: "Facebook page",
    accountPlaceholder: "Your client's page",
    triggers: [
      {
        key: "new_lead",
        label: "New lead",
        summary: "A lead fills in a Meta lead form",
        sample: person("Jordan", "Reyes", {
          form: "Spring whitening offer",
          campaign: "Whitening · Lookalike 2%",
        }),
      },
    ],
    actions: [],
  },
  {
    id: "google_ads",
    name: "Google Ads",
    category: "Ads",
    blurb:
      "Lead form assets create contacts; booked and won deals go back as offline conversions.",
    mark: "G",
    color: "#188038",
    accountPrompt: "Ads account",
    accountPlaceholder: "123-456-7890",
    triggers: [
      {
        key: "new_lead",
        label: "New lead form lead",
        summary: "A lead fills in a Google Ads lead form",
        sample: person("Priya", "Shah", {
          campaign: "Search · Emergency plumber",
        }),
      },
    ],
    actions: [
      {
        key: "offline_conversion",
        label: "Send offline conversion",
        fields: [
          {
            key: "conversion",
            label: "Conversion action",
            placeholder: "Booked appointment",
          },
          {
            key: "value",
            label: "Value",
            placeholder: "150",
            hint: "In dollars. Leave empty to use the contact's value.",
          },
        ],
        done: "Sent “{conversion}” to Google Ads",
      },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Payments",
    blurb:
      "Payments and cancelled subscriptions start workflows; send a payment link from any step.",
    mark: "S",
    color: "#635bff",
    accountPrompt: "Stripe account",
    accountPlaceholder: "acct_1Nc…",
    triggers: [
      {
        key: "payment_succeeded",
        label: "Payment succeeded",
        summary: "A payment succeeds in Stripe",
        sample: person("Sam", "Okafor", {
          amount: "249.00",
          description: "Whitening package",
        }),
      },
      {
        key: "subscription_canceled",
        label: "Subscription cancelled",
        summary: "A customer cancels a subscription",
        sample: person("Lee", "Carter", { plan: "Membership · monthly" }),
      },
    ],
    actions: [
      {
        key: "payment_link",
        label: "Create payment link",
        fields: [
          {
            key: "description",
            label: "What it's for",
            placeholder: "Deposit for {{first_name}}",
            merge: true,
          },
          {
            key: "amount",
            label: "Amount",
            placeholder: "99",
            hint: "In dollars.",
          },
        ],
        done: "Created a ${amount} payment link",
      },
    ],
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: "Accounting",
    blurb:
      "Won deals become QuickBooks customers and invoices without retyping.",
    mark: "QB",
    color: "#2ca01c",
    accountPrompt: "Company",
    accountPlaceholder: "Company name in QuickBooks",
    triggers: [
      {
        key: "invoice_paid",
        label: "Invoice paid",
        summary: "An invoice is paid in QuickBooks",
        sample: person("Ana", "Lopez", { amount: "480.00", invoice: "1042" }),
      },
    ],
    actions: [
      {
        key: "create_customer",
        label: "Create customer",
        fields: [
          {
            key: "display_name",
            label: "Display name",
            placeholder: "{{first_name}} {{last_name}}",
            merge: true,
          },
        ],
        done: "Created customer {display_name}",
      },
      {
        key: "create_invoice",
        label: "Create invoice",
        fields: [
          {
            key: "item",
            label: "Line item",
            placeholder: "Consultation",
            merge: true,
          },
          {
            key: "amount",
            label: "Amount",
            placeholder: "150",
            hint: "In dollars.",
          },
        ],
        done: "Created a ${amount} invoice for {item}",
      },
    ],
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    category: "Spreadsheets",
    blurb:
      "Add a row for every new lead, or start a workflow when a row is added.",
    mark: "Sh",
    color: "#0f9d58",
    accountPrompt: "Google account",
    accountPlaceholder: "ops@yourclient.com",
    triggers: [
      {
        key: "new_row",
        label: "New row",
        summary: "A row is added to a Google Sheet",
        sample: person("Chris", "Novak", { sheet: "Walk-ins" }),
      },
    ],
    actions: [
      {
        key: "add_row",
        label: "Add a row",
        fields: [
          {
            key: "spreadsheet",
            label: "Spreadsheet",
            placeholder: "Leads 2026",
          },
          { key: "sheet", label: "Sheet", placeholder: "Sheet1" },
          {
            key: "values",
            label: "Row values",
            placeholder: "{{first_name}}, {{last_name}}, {{email}}, {{phone}}",
            merge: true,
            hint: "Comma-separated, one value per column.",
          },
        ],
        done: "Added a row to {spreadsheet} › {sheet}",
      },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    category: "Team chat",
    blurb:
      "Tell the team in a channel the moment a lead, booking or gift comes in.",
    mark: "Sl",
    color: "#4a154b",
    accountPrompt: "Workspace",
    accountPlaceholder: "yourclient.slack.com",
    triggers: [],
    actions: [
      {
        key: "post_message",
        label: "Post a message",
        fields: [
          { key: "channel", label: "Channel", placeholder: "#leads" },
          {
            key: "message",
            label: "Message",
            placeholder: "New lead: {{first_name}} {{last_name}} ({{phone}})",
            multiline: true,
            merge: true,
          },
        ],
        done: "Posted to {channel}",
      },
    ],
  },
  {
    id: "gmail",
    name: "Gmail",
    category: "Email",
    blurb:
      "Send one-to-one email from your own Gmail address; new emails can start workflows.",
    mark: "Gm",
    color: "#ea4335",
    accountPrompt: "Gmail address",
    accountPlaceholder: "frontdesk@yourclient.com",
    triggers: [
      {
        key: "new_email",
        label: "New email",
        summary: "An email arrives in the connected Gmail inbox",
        sample: person("Taylor", "Kim", { subject: "Question about pricing" }),
      },
    ],
    actions: [
      {
        key: "send_email",
        label: "Send an email",
        fields: [
          { key: "to", label: "To", placeholder: "{{email}}", merge: true },
          {
            key: "subject",
            label: "Subject",
            placeholder: "Thanks, {{first_name}}",
            merge: true,
          },
          {
            key: "body",
            label: "Body",
            multiline: true,
            merge: true,
            placeholder: "Hi {{first_name}},",
          },
        ],
        done: "Emailed {to} from Gmail",
      },
    ],
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    category: "Calendar",
    blurb:
      "Put follow-ups on the team's calendar; new events can start workflows.",
    mark: "Ca",
    color: "#1a73e8",
    accountPrompt: "Calendar",
    accountPlaceholder: "team@yourclient.com",
    triggers: [
      {
        key: "event_created",
        label: "Event created",
        summary: "An event is added to the connected calendar",
        sample: person("Morgan", "Bell", { event: "Consultation" }),
      },
    ],
    actions: [
      {
        key: "create_event",
        label: "Create an event",
        fields: [
          {
            key: "title",
            label: "Title",
            placeholder: "Call back {{first_name}}",
            merge: true,
          },
          { key: "in_days", label: "Days from now", placeholder: "1" },
          { key: "duration", label: "Minutes", placeholder: "30" },
        ],
        done: "Added “{title}” to the calendar",
      },
    ],
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: "Email marketing",
    blurb:
      "Bring your audiences into Lotus once, or keep a list in sync while you move over.",
    mark: "Mc",
    color: "#241c15",
    accountPrompt: "Mailchimp account",
    accountPlaceholder: "Account name",
    triggers: [],
    actions: [
      {
        key: "add_subscriber",
        label: "Add to audience",
        fields: [
          { key: "audience", label: "Audience", placeholder: "Newsletter" },
        ],
        done: "Added to the {audience} audience",
      },
    ],
    importLabel: "Import audience",
  },
  {
    id: "calendly",
    name: "Calendly",
    category: "Calendar",
    blurb:
      "Bookings made in Calendly start the same workflows a Lotus booking does.",
    mark: "Cy",
    color: "#006bff",
    accountPrompt: "Calendly user",
    accountPlaceholder: "calendly.com/yourclient",
    triggers: [
      {
        key: "invitee_created",
        label: "Invitee booked",
        summary: "Someone books through Calendly",
        sample: person("Jamie", "Ortiz", { event: "15 minute intro" }),
      },
    ],
    actions: [],
    importLabel: "Import past bookings",
  },
];

export const appById = new Map(apps.map((a) => [a.id, a]));

export function findApp(id: string | undefined) {
  return id ? appById.get(id) : undefined;
}

/** "meta_lead_ads.new_lead" → the app and its trigger. */
export function appEvent(key: string | undefined) {
  if (!key) return undefined;
  const [appId, ev] = key.split(".");
  const app = findApp(appId);
  const trigger = app?.triggers.find((t) => t.key === ev);
  return app && trigger ? { app, trigger } : undefined;
}

export function appAction(appId: string, key: string) {
  const app = findApp(appId);
  const action = app?.actions.find((a) => a.key === key);
  return app && action ? { app, action } : undefined;
}

/** Fill a "done" template's {field} slots from the rendered fields. */
export function fillDone(template: string, fields: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => fields[k] || "…");
}

export const contactFieldLabel = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  company: "Company",
  city: "City",
} as const;

export type ContactFieldKey = keyof typeof contactFieldLabel;

/** The payload keys tried, in order, when a webhook has no mapping for a field. */
export const guessKeys: Record<ContactFieldKey, string[]> = {
  firstName: [
    "first_name",
    "firstName",
    "firstname",
    "first",
    "given_name",
    "name",
  ],
  lastName: [
    "last_name",
    "lastName",
    "lastname",
    "last",
    "family_name",
    "surname",
  ],
  email: ["email", "email_address", "emailAddress", "e-mail"],
  phone: ["phone", "phone_number", "phoneNumber", "mobile", "tel"],
  company: ["company", "company_name", "organization", "business"],
  city: ["city", "town", "locality"],
};

/** Read "a.b.c" out of a JSON payload, as text. */
export function readPath(payload: unknown, path: string): string | undefined {
  let cur: unknown = payload;
  for (const part of path.split(".")) {
    if (
      cur &&
      typeof cur === "object" &&
      part in (cur as Record<string, unknown>)
    )
      cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  if (cur === null || cur === undefined) return undefined;
  if (typeof cur === "string") return cur.trim() || undefined;
  if (typeof cur === "number" || typeof cur === "boolean") return String(cur);
  return undefined;
}

/** Contact fields out of any payload: the mapping first, then the usual key names, top level or under contact/data. */
export function extractContact(
  payload: unknown,
  mapping: Partial<Record<ContactFieldKey, string>> = {},
) {
  const out: Partial<Record<ContactFieldKey, string>> = {};
  const roots = ["", "contact.", "data.", "lead.", "customer."];
  for (const key of Object.keys(contactFieldLabel) as ContactFieldKey[]) {
    const mapped = mapping[key];
    if (mapped) {
      out[key] = readPath(payload, mapped);
      continue;
    }
    for (const root of roots) {
      const hit = guessKeys[key]
        .map((k) => readPath(payload, root + k))
        .find(Boolean);
      if (hit) {
        out[key] = hit;
        break;
      }
    }
  }
  // "name": "Dana Whitfield" with no last name splits on the first space.
  if (
    out.firstName &&
    !out.lastName &&
    out.firstName.includes(" ") &&
    !mapping.firstName
  ) {
    const [first, ...rest] = out.firstName.split(/\s+/);
    out.firstName = first;
    out.lastName = rest.join(" ");
  }
  return out;
}

export const logKindLabel = {
  webhook_in: "Webhook in",
  webhook_out: "Webhook out",
  app_event: "App event",
  app_action: "App action",
  api: "API",
  import: "Import",
} as const;
