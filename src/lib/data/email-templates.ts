import type { EmailBlock, EmailTemplate } from "@/lib/types";

/*
 * Built-in starting points for a campaign. Each is a short, real email a
 * client could send today; the editor copies the blocks into the campaign.
 */

let n = 0;
const id = () => `b${(++n).toString(36)}`;
const h = (text: string): EmailBlock => ({ id: id(), type: "heading", text });
const p = (text: string): EmailBlock => ({ id: id(), type: "text", text });
const btn = (text: string, url: string): EmailBlock => ({ id: id(), type: "button", text, url });
const img = (alt: string, caption?: string): EmailBlock => ({ id: id(), type: "image", alt, caption });
const hr = (): EmailBlock => ({ id: id(), type: "divider" });

export const emailTemplates: EmailTemplate[] = [
  {
    id: "announcement",
    name: "Announcement",
    description: "One piece of news and one action. The default for most sends.",
    subject: "Something new from {{client_name}}",
    previewText: "A quick update we think you'll want to see.",
    blocks: [
      h("Hi {{first_name}}, we have news"),
      p("We wanted you to hear it from us first. Starting this month, you can book a time online in under a minute, any day of the week."),
      btn("Book a time", "https://example.com/book"),
      p("Questions? Just reply to this email and a real person will get back to you."),
    ],
  },
  {
    id: "offer",
    name: "Offer",
    description: "A time-limited promotion with a clear deadline and a single button.",
    mode: "marketing",
    subject: "{{first_name}}, 15% off ends Friday",
    previewText: "Our fall offer closes at midnight Friday.",
    blocks: [
      img("Before and after photo of a finished project", "A recent project in your area"),
      h("15% off any project booked this week"),
      p("Book a free inspection before midnight Friday and we'll take 15% off the final price. No pressure and no obligation."),
      btn("Claim the offer", "https://example.com/offer"),
      p("The offer applies to new bookings only and can't be combined with insurance work."),
    ],
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "A monthly round-up: a lead story, two short items, and a sign-off.",
    subject: "{{client_name}} this month",
    previewText: "What we've been up to, and what's next.",
    blocks: [
      h("This month at {{client_name}}"),
      p("Hi {{first_name}}, here's a short round-up of what happened this month and what's coming next."),
      hr(),
      h("The big one"),
      p("Our busiest season on record. Thank you to everyone who trusted us with their home."),
      btn("Read the full story", "https://example.com/news"),
      hr(),
      p("Until next month,\nThe {{client_name}} team"),
    ],
  },
  {
    id: "appeal",
    name: "Appeal",
    description: "A donation ask built around one story, one number and one button.",
    mode: "fundraising",
    subject: "{{first_name}}, can you help this winter?",
    previewText: "$50 keeps one family warm for a month.",
    blocks: [
      img("A volunteer handing a blanket to a child", "Winter drive, last year"),
      h("$50 keeps one family warm for a month"),
      p("Hi {{first_name}}, last winter your support helped 412 families stay warm. This year the need is higher, and we're asking our community to step in again."),
      btn("Give $50 today", "https://example.com/give"),
      p("Every gift is matched until December 31, so yours goes twice as far."),
    ],
  },
  {
    id: "thanks",
    name: "Thank you",
    description: "A warm thank-you after a gift or a finished job. No ask.",
    subject: "Thank you, {{first_name}}",
    previewText: "It meant a lot. Here's what happens next.",
    blocks: [
      h("Thank you, {{first_name}}"),
      p("We don't say it enough: thank you. It genuinely makes a difference, and we wanted you to know exactly what happens next."),
      p("If anything comes up, reply to this email. It goes straight to our team."),
    ],
  },
  {
    id: "blank",
    name: "Blank",
    description: "A heading and a paragraph. Build the rest yourself.",
    subject: "",
    previewText: "",
    blocks: [h("Your headline"), p("Start writing here.")],
  },
];

export function findTemplate(id?: string) {
  return emailTemplates.find((t) => t.id === id);
}

/** Fresh ids so two campaigns from one template never share block ids. */
export function cloneBlocks(blocks: EmailBlock[], prefix: string): EmailBlock[] {
  return blocks.map((b, i) => ({ ...b, id: `${prefix}-${i}` }));
}
