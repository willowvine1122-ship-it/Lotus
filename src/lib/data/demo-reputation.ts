import type { ClientRecord, Contact, ReportConfig, ReportSend, ReputationSettings, Review, ReviewRequest, ReviewSource } from "@/lib/types";

/*
 * Synthetic reviews, review requests, request settings and weekly report
 * configs per client. Deterministic per client id and calendar day, like the
 * other demo generators. Demo data.
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

const seedOf = (id: string) => [...id].reduce((a, ch) => a + ch.charCodeAt(0) * 7, 0);
const iso = (now: Date, daysAgo: number, hour: number, minute = 0) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, minute);
  return d.toISOString();
};

const authors = ["Mike S.", "Dana R.", "Priya K.", "Tom H.", "Lena M.", "Carlos V.", "Jess W.", "Omar A.", "Hannah B.", "Ravi P.", "Nicole T.", "Ben G.", "Sofia L.", "Grace O.", "Noah F.", "Aisha M.", "Patrick K.", "Mei C.", "Chloe D.", "Marcus J."];

const marketingGood = [
  "Showed up on time, explained everything and the price matched the quote. Would use again.",
  "Fast, friendly and tidy. The crew cleaned up like they were never here.",
  "Booked online, got a text when they were on the way. Easy from start to finish.",
  "Second time using them. Same great service as last year.",
  "Honest advice. They talked me out of work I didn't need.",
  "Great communication. The estimate was clear and the work was done a day early.",
];
const marketingMid = ["Good work but the appointment ran late and nobody called ahead.", "Job was fine. Pricing felt a bit high compared to the first quote I got.", "Solid service, took two visits to finish though."];
const marketingBad = ["Missed the first appointment and I had to chase for a reschedule.", "Invoice was higher than the estimate with no heads-up.", "Left a mess in the driveway. Work itself seems okay."];

const fundraisingGood = [
  "Transparent about where the money goes. The quarterly updates are the best I've seen.",
  "Donating was quick and the receipt came straight away. Monthly giving was one click.",
  "Visited the site in person. Everything they say they do, they do.",
  "Volunteered last winter. The staff are the real thing.",
  "Love the impact emails. I actually know what my gift did.",
];
const fundraisingMid = ["Great cause. The website was a bit slow on my phone when I gave.", "Good organisation, wish the thank-you came sooner."];
const fundraisingBad = ["Got three emails in one week after a single gift. Too much.", "Couldn't find how to cancel my monthly gift without emailing."];

const firstNames = ["Mike", "Dana", "Priya", "Tom", "Lena", "Carlos", "Jess", "Omar", "Hannah", "Ravi"];

export function demoReviewsFor(c: ClientRecord, now: Date): Review[] {
  if (c.days.length === 0) return [];
  const r = rng(seedOf(c.account.id) * 13);
  const started = Math.min(180, c.days.length);
  // Roughly one review every 3 to 7 days, better clients get more.
  const perWeek = c.mode === "marketing" ? 1.2 + r() * 1.4 : 0.8 + r() * 1.0;
  const total = Math.max(3, Math.round((started / 7) * perWeek));
  const bias = 0.55 + r() * 0.35; // share of five-star reviews
  const out: Review[] = [];
  for (let i = 0; i < total; i++) {
    const daysAgo = Math.floor(r() * started);
    const roll = r();
    const rating: Review["rating"] = roll < bias ? 5 : roll < bias + 0.2 ? 4 : roll < bias + 0.32 ? 3 : roll < bias + 0.4 ? 2 : 1;
    const pool = c.mode === "marketing" ? (rating >= 4 ? marketingGood : rating === 3 ? marketingMid : marketingBad) : rating >= 4 ? fundraisingGood : rating === 3 ? fundraisingMid : fundraisingBad;
    const source: ReviewSource = r() < 0.72 ? "google" : "facebook";
    const at = iso(now, daysAgo, 8 + Math.floor(r() * 12), Math.floor(r() * 60));
    const replied = daysAgo > 7 ? r() < (rating <= 3 ? 0.95 : 0.85) : daysAgo > 2 ? r() < 0.55 : r() < 0.15;
    const author = authors[(i * 7 + Math.floor(r() * 3)) % authors.length]!;
    const replyBody = rating >= 4 ? `Thank you, ${author.split(" ")[0]}. It was a pleasure, and we're glad it went smoothly.` : `Thanks for telling us. That is not the experience we want. We've reached out directly to put it right.`;
    out.push({
      id: `${c.account.id}-rv${i}`,
      accountId: c.account.id,
      source,
      rating,
      author,
      body: pool[Math.floor(r() * pool.length)]!,
      at,
      reply: replied ? { body: replyBody, by: c.assignees[0]?.name ?? "Afza", at: iso(now, Math.max(0, daysAgo - 1), 9 + Math.floor(r() * 8)) } : undefined,
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function demoRequestsFor(c: ClientRecord, now: Date, contacts: Contact[], reviews: Review[]): ReviewRequest[] {
  if (c.days.length === 0) return [];
  const r = rng(seedOf(c.account.id) * 29);
  const out: ReviewRequest[] = [];
  const pool = contacts.length ? contacts : [];
  const perDay = c.mode === "marketing" ? 0.6 : 1.1;
  let reviewIdx = 0;
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const n = Math.floor(perDay + r() * perDay);
    for (let k = 0; k < n; k++) {
      const contact = pool[Math.floor(r() * pool.length)];
      const name = contact ? `${contact.firstName} ${contact.lastName}` : `${firstNames[Math.floor(r() * firstNames.length)]} ${["Lee", "Ortiz", "Nguyen", "Khan"][Math.floor(r() * 4)]}`;
      const roll = r();
      const status: ReviewRequest["status"] = daysAgo === 0 ? "sent" : roll < 0.22 ? "reviewed" : roll < 0.6 ? "opened" : "sent";
      const review = status === "reviewed" ? reviews[reviewIdx++ % Math.max(1, reviews.length)] : undefined;
      out.push({
        id: `${c.account.id}-rq${daysAgo}-${k}`,
        accountId: c.account.id,
        contactId: contact?.id ?? `${c.account.id}-unknown`,
        contactName: name,
        channel: r() < 0.7 ? "sms" : "email",
        trigger: c.mode === "marketing" ? (r() < 0.75 ? "job" : "appointment") : "donation",
        status,
        sentAt: iso(now, daysAgo, 10 + Math.floor(r() * 9), Math.floor(r() * 60)),
        reviewId: review?.id,
      });
    }
  }
  return out.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function defaultReputationSettings(c: ClientRecord): ReputationSettings {
  const slug = c.account.slug;
  return {
    accountId: c.account.id,
    autoAfter: { job: c.mode === "marketing", appointment: false, donation: c.mode === "fundraising" },
    channel: c.mode === "marketing" ? "sms" : "email",
    delayHours: c.mode === "marketing" ? 2 : 24,
    googleUrl: `https://g.page/r/${slug}/review`,
    facebookUrl: c.mode === "marketing" ? `https://facebook.com/${slug}/reviews` : undefined,
    message: c.mode === "marketing" ? "Hi {first}, thanks for choosing {client}. Would you leave us a quick review? It takes a minute and helps a lot." : "Hi {first}, thank you for your gift to {client}. If you have a minute, a short review helps others trust us too.",
  };
}

export function defaultReportConfig(c: ClientRecord): ReportConfig {
  const n = Number(c.account.id.replace(/\D/g, "")) || 1;
  return {
    accountId: c.account.id,
    enabled: c.status !== "paused" && n % 7 !== 0,
    range: 30,
    sections: c.mode === "marketing" ? ["summary", "performance", "volume", "months", "reviews", "note"] : ["summary", "performance", "volume", "months", "countries", "note"],
    recipients: c.clientMembers.map((m) => m.email),
    weekday: [1, 1, 2, 1, 3, 1, 5][n % 7]!,
    hour: n % 4 === 0 ? 9 : 8,
    note: n % 3 === 0 ? "Quick note from your account manager: spend is being held flat this month while the new creative settles in. Call me with any questions." : undefined,
  };
}

export function demoReportSendsFor(c: ClientRecord, config: ReportConfig, now: Date): ReportSend[] {
  if (!config.enabled || c.days.length === 0) return [];
  const out: ReportSend[] = [];
  const weeks = Math.min(8, Math.floor(c.days.length / 7));
  // Walk back to the most recent scheduled weekday.
  const back = (now.getDay() - config.weekday + 7) % 7;
  for (let w = 0; w < weeks; w++) {
    const daysAgo = back + w * 7;
    if (daysAgo === 0 && now.getHours() < config.hour) continue;
    out.push({ id: `${c.account.id}-rs${w}`, accountId: c.account.id, at: iso(now, daysAgo, config.hour), recipients: config.recipients, range: config.range, kind: "schedule" });
  }
  return out;
}
