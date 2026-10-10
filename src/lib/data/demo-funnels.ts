import type { ClientRecord, Funnel, FunnelBlock, FunnelDay, FunnelStep } from "@/lib/types";

/*
 * Funnel templates and a seeded funnel per client. Templates are plain
 * block lists so the editor, the preview and the public page share one
 * renderer. Demo data.
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

let counter = 0;
const bid = () => `b${(++counter).toString(36)}`;

export interface FunnelTemplate {
  id: string;
  name: string;
  description: string;
  mode: "marketing" | "fundraising" | "both";
  steps: (client: { name: string; industry: string; location: string }) => FunnelStep[];
}

const thankYou = (c: { name: string }, body: string): FunnelStep => ({
  id: "thanks",
  name: "Thank you",
  path: "thanks",
  blocks: [
    { id: bid(), type: "hero", eyebrow: c.name, headline: "Thank you. We're on it.", subhead: body, align: "center" },
    { id: bid(), type: "footer", text: `© ${c.name}` },
  ],
});

export const templates: FunnelTemplate[] = [
  {
    id: "quote",
    name: "Free quote",
    description: "Hero, trust points, a short quote form and a thank-you page. The lead-gen default.",
    mode: "marketing",
    steps: (c) => [
      {
        id: "landing",
        name: "Landing page",
        path: "",
        blocks: [
          { id: bid(), type: "hero", eyebrow: `${c.industry} · ${c.location}`, headline: `Get a free ${/[A-Z]{2,}/.test(c.industry) ? c.industry : c.industry.toLowerCase()} quote in 24 hours`, subhead: `Licensed, insured and local. Tell us about the job and ${c.name} will call you back today.`, buttonLabel: "Get my quote", buttonHref: "#form", align: "split" },
          { id: bid(), type: "stats", items: [{ value: "4.9", label: "Google rating" }, { value: "1,200+", label: "Jobs completed" }, { value: "24h", label: "Quote turnaround" }] },
          { id: bid(), type: "features", headline: "Why people pick us", items: [{ title: "Upfront pricing", body: "A written quote before any work starts. No surprises on the invoice." }, { title: "Local crew", body: `Our own team, based in ${c.location}. No subcontractors.` }, { title: "Workmanship guarantee", body: "If something is not right, we come back and fix it." }] },
          { id: bid(), type: "testimonial", quote: "They showed up when they said they would, quoted on the spot and finished a day early.", name: "Mike S.", detail: `Homeowner, ${c.location}` },
          { id: bid(), type: "form", headline: "Tell us about the job", subhead: "Takes a minute. We call back within the hour on weekdays.", fields: ["name", "phone", "email", "address", "message"], buttonLabel: "Get my free quote", note: "No spam, no pressure. We only call about your quote." },
          { id: bid(), type: "footer", text: `© ${c.name} · ${c.location}` },
        ],
      },
      thankYou(c, "Someone from the team will call within the hour on weekdays. Keep your phone close."),
    ],
  },
  {
    id: "booking",
    name: "Book a visit",
    description: "A tighter page that drives straight to a booking form.",
    mode: "marketing",
    steps: (c) => [
      {
        id: "landing",
        name: "Landing page",
        path: "",
        blocks: [
          { id: bid(), type: "hero", eyebrow: c.name, headline: "Book your visit online", subhead: "Pick a time that suits you. We confirm by text.", buttonLabel: "Choose a time", buttonHref: "#form", align: "center" },
          { id: bid(), type: "features", items: [{ title: "Same-week slots", body: "Most visits happen within four days." }, { title: "Text reminders", body: "A reminder the day before, and when we are on our way." }, { title: "No call-out fee", body: "You pay for the work, not the visit." }] },
          { id: bid(), type: "form", headline: "Book a visit", fields: ["name", "phone", "address", "message"], buttonLabel: "Request my slot" },
          { id: bid(), type: "footer", text: `© ${c.name}` },
        ],
      },
      thankYou(c, "We will text you to confirm the time."),
    ],
  },
  {
    id: "appeal",
    name: "Donation appeal",
    description: "A story-led page with impact numbers and a gift form.",
    mode: "fundraising",
    steps: (c) => [
      {
        id: "landing",
        name: "Appeal page",
        path: "",
        blocks: [
          { id: bid(), type: "hero", eyebrow: c.name, headline: "This winter, no one should sleep outside", subhead: "Your gift keeps the doors open, the beds warm and the kitchen running every night until spring.", buttonLabel: "Give now", buttonHref: "#form", align: "center" },
          { id: bid(), type: "stats", items: [{ value: "$42", label: "feeds a family for a week" }, { value: "92%", label: "goes straight to programs" }, { value: "6,400", label: "nights of shelter last winter" }] },
          { id: bid(), type: "text", headline: "Where your gift goes", body: "Every dollar is split between beds, meals and the caseworkers who help people move on. We publish the numbers each quarter, and you can see them any time." },
          { id: bid(), type: "testimonial", quote: "I had nowhere to go in January. They gave me a bed, then a plan, then a job.", name: "Dee", detail: "Guest, now volunteer" },
          { id: bid(), type: "form", headline: "Make a gift", subhead: "One-time or monthly. Cancel any time.", fields: ["amount", "name", "email"], buttonLabel: "Give now", note: "You will get a receipt by email straight away." },
          { id: bid(), type: "faq", items: [{ q: "Is my gift tax-deductible?", a: "Yes. You get a receipt by email straight away." }, { q: "Can I give monthly?", a: "Yes, and you can change or stop it any time from the link in your receipt." }] },
          { id: bid(), type: "footer", text: `© ${c.name}` },
        ],
      },
      thankYou(c, "Your receipt is on its way. Thank you for keeping the lights on."),
    ],
  },
  {
    id: "blank",
    name: "Blank",
    description: "A hero and a footer. Build the rest.",
    mode: "both",
    steps: (c) => [
      { id: "landing", name: "Page", path: "", blocks: [{ id: bid(), type: "hero", headline: "Headline goes here", subhead: "A sentence that says who this is for.", buttonLabel: "Get started", buttonHref: "#form", align: "center" }, { id: bid(), type: "footer", text: `© ${c.name}` }] },
    ],
  },
];

export function templateFor(id: string) {
  return templates.find((t) => t.id === id) ?? templates[templates.length - 1]!;
}

function isoDaysAgo(now: Date, n: number) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, 12);
  return d.toISOString().slice(0, 10);
}

export function demoFunnelsFor(c: ClientRecord, now: Date): Funnel[] {
  if (c.days.length === 0) return [];
  const seed = [...c.account.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const r = rng(seed * 31);
  const tpl = c.mode === "marketing" ? (r() < 0.7 ? "quote" : "booking") : "appeal";
  const t = templateFor(tpl);
  const steps = t.steps({ name: c.account.name, industry: c.industry, location: c.location });
  const days: FunnelDay[] = [];
  const base = 40 + r() * 140;
  for (let i = 59; i >= 0; i--) {
    const visitors = Math.round(base * (0.7 + r() * 0.6) * (i % 7 >= 5 ? 0.7 : 1));
    const leads = Math.round(visitors * (0.04 + r() * 0.05));
    days.push({ day: isoDaysAgo(now, i), visitors, leads });
  }
  const name = c.mode === "marketing" ? (tpl === "quote" ? "Free quote" : "Book a visit") : "Winter appeal";
  const funnels: Funnel[] = [
    {
      id: `${c.account.id}-f1`,
      accountId: c.account.id,
      name,
      slug: `${c.account.slug}-${tpl}`,
      status: "live",
      template: tpl,
      brandColor: c.account.brandColor ?? "#0f1221",
      steps,
      days,
      createdAt: new Date(now.getTime() - 40 * 86400000).toISOString(),
      updatedAt: new Date(now.getTime() - Math.floor(r() * 10) * 86400000).toISOString(),
    },
  ];
  if (r() < 0.4) {
    const t2 = templateFor("blank");
    funnels.push({
      id: `${c.account.id}-f2`,
      accountId: c.account.id,
      name: c.mode === "marketing" ? "Spring promo" : "Giving Tuesday",
      slug: `${c.account.slug}-draft`,
      status: "draft",
      template: "blank",
      brandColor: c.account.brandColor ?? "#0f1221",
      steps: t2.steps({ name: c.account.name, industry: c.industry, location: c.location }),
      days: [],
      createdAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * 86400000).toISOString(),
    });
  }
  return funnels;
}

export function newBlock(type: FunnelBlock["type"]): FunnelBlock {
  const id = bid() + Date.now().toString(36);
  switch (type) {
    case "hero": return { id, type, headline: "Headline", subhead: "Supporting sentence.", buttonLabel: "Get started", buttonHref: "#form", align: "center" };
    case "form": return { id, type, headline: "Get in touch", fields: ["name", "email", "phone"], buttonLabel: "Send" };
    case "features": return { id, type, headline: "Why us", items: [{ title: "First point", body: "One sentence." }, { title: "Second point", body: "One sentence." }, { title: "Third point", body: "One sentence." }] };
    case "stats": return { id, type, items: [{ value: "4.9", label: "rating" }, { value: "1,000+", label: "jobs" }, { value: "24h", label: "turnaround" }] };
    case "testimonial": return { id, type, quote: "What a customer said.", name: "Name", detail: "Where" };
    case "text": return { id, type, headline: "Section title", body: "A paragraph of text." };
    case "faq": return { id, type, items: [{ q: "A question?", a: "The answer." }] };
    case "cta": return { id, type, headline: "Ready?", body: "One line to push them over.", buttonLabel: "Get started", buttonHref: "#form" };
    case "footer": return { id, type, text: "© Company" };
  }
}
