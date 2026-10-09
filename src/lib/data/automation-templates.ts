import type { AccountMode, WorkflowStep, WorkflowTrigger } from "@/lib/types";

/*
 * Starting points for a new workflow. Each one is a complete, sensible
 * recipe the team can turn on as it is or edit. Step ids are local; they are
 * re-issued per workflow by cloneSteps.
 */

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  mode?: AccountMode;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
}

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "speed-to-lead",
    name: "Speed to lead",
    description: "Text new ad leads within a minute, alert the owner, and follow up the next day if nobody booked.",
    mode: "marketing",
    trigger: { type: "contact_created" },
    steps: [
      { id: "1", type: "send_sms", body: "Hi {{first_name}}, thanks for reaching out to {{client_name}}! When's a good time for a quick call to get you a quote?" },
      { id: "2", type: "notify", to: "Sara", message: "New lead {{first_name}} {{last_name}} just came in. Call within 5 minutes." },
      { id: "3", type: "add_tag", tag: "Follow up" },
      { id: "4", type: "wait", amount: 1, unit: "days" },
      {
        id: "5",
        type: "branch",
        condition: { field: "stage", op: "is", value: "new" },
        yes: [
          { id: "5y1", type: "send_sms", body: "Hi {{first_name}}, just checking in. Want me to hold a time for you this week?" },
          { id: "5y2", type: "create_task", title: "Call {{first_name}} {{last_name}}, no reply yet", assigneeName: "Sara", dueInDays: 0 },
        ],
        no: [{ id: "5n1", type: "remove_tag", tag: "Follow up" }],
      },
    ],
  },
  {
    id: "booking-confirmation",
    name: "Booking confirmation",
    description: "Confirm every booking by text and email, and move the contact to Booked.",
    mode: "marketing",
    trigger: { type: "appointment_booked" },
    steps: [
      { id: "1", type: "move_stage", stageId: "booked" },
      { id: "2", type: "send_sms", body: "You're booked, {{first_name}}! We'll text you a reminder the day before. Reply C to confirm." },
      { id: "3", type: "send_email", subject: "Your appointment with {{client_name}}", body: "Hi {{first_name}},\n\nThanks for booking. We'll see you soon. If you need to move the time, just reply to this email.\n\n{{client_name}}" },
    ],
  },
  {
    id: "no-show-recovery",
    name: "No-show recovery",
    description: "When someone misses an appointment, offer a new time, then hand it to a person after a day.",
    mode: "marketing",
    trigger: { type: "appointment_no_show" },
    steps: [
      { id: "1", type: "send_sms", body: "Hi {{first_name}}, we missed you today. Want to pick a new time? Reply with a day that works." },
      { id: "2", type: "add_tag", tag: "No-show" },
      { id: "3", type: "wait", amount: 1, unit: "days" },
      { id: "4", type: "move_stage", stageId: "contacted" },
      { id: "5", type: "create_task", title: "Rebook {{first_name}} {{last_name}}", assigneeName: "Mahad", dueInDays: 0 },
    ],
  },
  {
    id: "review-request",
    name: "Review request",
    description: "Two days after a job is won, ask for a Google review.",
    mode: "marketing",
    trigger: { type: "stage_changed", stageId: "won" },
    steps: [
      { id: "1", type: "wait", amount: 2, unit: "days" },
      { id: "2", type: "send_sms", body: "Thanks for choosing {{client_name}}, {{first_name}}! Would you leave us a quick review? It really helps a small business." },
      { id: "3", type: "add_tag", tag: "Review asked" },
    ],
  },
  {
    id: "donation-thanks",
    name: "Gift thank-you",
    description: "Thank every donor by email the same day, and route major gifts to a person for a call.",
    mode: "fundraising",
    trigger: { type: "donation_received" },
    steps: [
      { id: "1", type: "send_email", subject: "Thank you, {{first_name}}", body: "Dear {{first_name}},\n\nYour gift to {{client_name}} arrived today. Thank you. We'll write soon to show you what it made possible.\n\nWith gratitude,\n{{client_name}}" },
      { id: "2", type: "add_tag", tag: "Thanked" },
      {
        id: "3",
        type: "branch",
        condition: { field: "value", op: "gte", value: "500" },
        yes: [
          { id: "3y1", type: "add_tag", tag: "Major donor" },
          { id: "3y2", type: "create_task", title: "Thank-you call to {{first_name}} {{last_name}}", assigneeName: "Afza", dueInDays: 2 },
          { id: "3y3", type: "notify", to: "Afza", message: "{{first_name}} {{last_name}} passed $500 in lifetime giving." },
        ],
        no: [],
      },
    ],
  },
  {
    id: "lapsed-winback",
    name: "Lapsed donor win-back",
    description: "When a donor lapses, send a warm note, wait a week, then a second ask.",
    mode: "fundraising",
    trigger: { type: "stage_changed", stageId: "lapsed" },
    steps: [
      { id: "1", type: "send_email", subject: "We miss you, {{first_name}}", body: "Dear {{first_name}},\n\nIt's been a while, and we wanted to share what's happened since your last gift.\n\n{{client_name}}" },
      { id: "2", type: "wait", amount: 7, unit: "days" },
      {
        id: "3",
        type: "branch",
        condition: { field: "stage", op: "is", value: "lapsed" },
        yes: [{ id: "3y1", type: "send_email", subject: "Would you come back this winter?", body: "Dear {{first_name}},\n\nA gift of any size this month keeps our winter program open.\n\n{{client_name}}" }],
        no: [{ id: "3n1", type: "add_tag", tag: "Won back" }],
      },
    ],
  },
  {
    id: "monthly-upgrade",
    name: "Monthly giving invite",
    description: "Invite repeat donors to give monthly three days after their gift.",
    mode: "fundraising",
    trigger: { type: "donation_received" },
    steps: [
      {
        id: "1",
        type: "branch",
        condition: { field: "stage", op: "is", value: "repeat" },
        yes: [
          { id: "1y1", type: "wait", amount: 3, unit: "days" },
          { id: "1y2", type: "send_email", subject: "Make it monthly, {{first_name}}?", body: "Dear {{first_name}},\n\nMonthly donors keep {{client_name}} steady all year. Would you join them?\n\n{{client_name}}" },
        ],
        no: [],
      },
    ],
  },
  {
    id: "reply-handoff",
    name: "Reply hand-off",
    description: "When a contact writes in, assign an owner if there is none and tell them.",
    trigger: { type: "message_received" },
    steps: [
      {
        id: "1",
        type: "branch",
        condition: { field: "owner", op: "is", value: "" },
        yes: [{ id: "1y1", type: "assign_owner", ownerName: "Sara" }],
        no: [],
      },
      { id: "2", type: "notify", to: "Sara", message: "{{first_name}} {{last_name}} just replied. Answer in the inbox." },
    ],
  },
  {
    id: "email-clicked",
    name: "Hot from email",
    description: "Tag anyone who clicks a campaign link and queue a call.",
    trigger: { type: "email_clicked" },
    steps: [
      { id: "1", type: "add_tag", tag: "Clicked email" },
      { id: "2", type: "create_task", title: "Call {{first_name}} {{last_name}}, clicked our email", assigneeName: "Mahad", dueInDays: 1 },
    ],
  },
];

export function findWorkflowTemplate(id: string) {
  return workflowTemplates.find((t) => t.id === id);
}

/** Fresh ids so two workflows from one template never share step ids. */
export function cloneSteps(steps: WorkflowStep[], prefix: string): WorkflowStep[] {
  return steps.map((s) => {
    const id = `${prefix}-${s.id}`;
    return s.type === "branch" ? { ...s, id, condition: { ...s.condition }, yes: cloneSteps(s.yes, prefix), no: cloneSteps(s.no, prefix) } : { ...s, id };
  });
}
