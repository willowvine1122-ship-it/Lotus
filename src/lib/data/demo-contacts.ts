import type { ActivityKind, ClientRecord, Contact, ContactActivity, ContactSource, Pipeline, PipelineStage } from "@/lib/types";

/*
 * Synthetic CRM: a pipeline per client, 20–45 contacts per client with a
 * believable activity trail (form fill, calls, texts, bookings, gifts).
 * Seeded per client so the roster is stable across requests. Demo data.
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

const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;

export const marketingStages: PipelineStage[] = [
  { id: "new", name: "New lead" },
  { id: "contacted", name: "Contacted" },
  { id: "booked", name: "Booked" },
  { id: "showed", name: "Showed" },
  { id: "won", name: "Won", outcome: "won" },
  { id: "lost", name: "Lost", outcome: "lost" },
];

export const fundraisingStages: PipelineStage[] = [
  { id: "prospect", name: "Prospect" },
  { id: "first", name: "First gift" },
  { id: "repeat", name: "Repeat donor" },
  { id: "monthly", name: "Monthly donor", outcome: "won" },
  { id: "lapsed", name: "Lapsed", outcome: "lost" },
];

export function pipelineFor(c: ClientRecord): Pipeline {
  return c.mode === "marketing"
    ? { id: `${c.account.id}-pipeline`, accountId: c.account.id, name: "Leads", stages: marketingStages }
    : { id: `${c.account.id}-pipeline`, accountId: c.account.id, name: "Donors", stages: fundraisingStages };
}

const firstNames = ["Mike", "Dana", "Priya", "Luis", "Hannah", "Omar", "Grace", "Ethan", "Nora", "Jamal", "Sofia", "Ben", "Aisha", "Tom", "Elena", "Raj", "Chloe", "Marcus", "Ivy", "Diego", "Leah", "Sam", "Maya", "Noah", "Zoe", "Caleb", "Fatima", "Owen", "Rosa", "Kai", "Amara", "Jonah", "Mei", "Victor", "Tessa", "Andre", "Lina", "Patrick", "Yara", "Felix"];
const lastNames = ["Summit", "River", "Patel", "Garcia", "Nguyen", "Okafor", "Kim", "Brooks", "Lindqvist", "Haddad", "Romero", "Clarke", "Mensah", "Fischer", "Costa", "Iyer", "Walsh", "Dubois", "Park", "Reyes", "Novak", "Bennett", "Sato", "Ali", "Hughes", "Martin", "Osei", "Larsen", "Ortiz", "Chen"];
const cities = ["Denver, CO", "Aurora, CO", "Boulder, CO", "Lakewood, CO", "Austin, TX", "Round Rock, TX", "Tampa, FL", "Orlando, FL", "Portland, OR", "Seattle, WA", "Boston, MA", "Chicago, IL", "Toronto, ON", "Atlanta, GA", "Phoenix, AZ", "San Diego, CA", "Nashville, TN", "Madison, WI", "Columbus, OH", "Pittsburgh, PA"];
const companies = ["", "", "", "Oakridge HOA", "Pine Valley Apartments", "Westside Property Mgmt", "Summit Ridge Church", "Lakeview Realty", "Northgate Offices"];

const marketingSources: ContactSource[] = ["meta", "meta", "meta", "google", "google", "website", "referral", "manual"];
const fundraisingSources: ContactSource[] = ["donation-page", "donation-page", "donation-page", "meta", "website", "referral", "import"];
const marketingTags = ["Repair", "Replacement", "Insurance claim", "Financing", "Emergency", "Commercial", "Follow up", "Spanish", "VIP"];
const fundraisingTags = ["Major donor", "Peer to peer", "Winter appeal", "Volunteer", "Corporate match", "Board", "Event", "Legacy"];

function iso(now: Date, daysAgo: number, hour: number, minute = 0) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, minute);
  return d.toISOString();
}

/** Something that happened "today" is spread over the last 48 hours so the feed reads as live. */
function recent(now: Date, r: () => number) {
  return new Date(now.getTime() - Math.floor(r() * 48 * 60) * 60000).toISOString();
}

export function demoContactsFor(c: ClientRecord, now: Date): { contacts: Contact[]; activities: ContactActivity[] } {
  const seedBase = [...c.account.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const r = rng(seedBase * 7919);
  const contacts: Contact[] = [];
  const activities: ContactActivity[] = [];
  if (c.days.length === 0) return { contacts, activities };
  const n = 20 + Math.floor(r() * 26);
  const owners = c.assignees.map((a) => a.name);
  const homeCity = c.location;

  for (let i = 0; i < n; i++) {
    const first = pick(r, firstNames);
    const last = pick(r, lastNames);
    const id = `${c.account.id}-c${i + 1}`;
    const createdDaysAgo = Math.floor(Math.pow(r(), 1.4) * 85); // skewed recent
    const createdAt = createdDaysAgo === 0 ? recent(now, r) : iso(now, createdDaysAgo, 8 + Math.floor(r() * 10), Math.floor(r() * 60));
    const nearby = r() < 0.6 ? homeCity : pick(r, cities);
    const email = r() < 0.85 ? `${first}.${last}@example.com`.toLowerCase() : undefined;
    const phone = r() < 0.8 ? `(${300 + Math.floor(r() * 600)}) 555-0${100 + Math.floor(r() * 900)}` : undefined;
    const tags = r() < 0.55 ? [pick(r, c.mode === "marketing" ? marketingTags : fundraisingTags)] : [];
    if (r() < 0.15) tags.push(pick(r, c.mode === "marketing" ? marketingTags : fundraisingTags));
    const owner = owners.length && r() < 0.8 ? pick(r, owners) : undefined;
    const acts: Omit<ContactActivity, "id" | "contactId">[] = [];
    let stageId: string;
    let valueCents = 0;
    let recurring: boolean | undefined;
    let lastAt = createdAt;
    const push = (kind: ActivityKind, title: string, daysAgo: number, extra: Partial<ContactActivity> = {}) => {
      const at = daysAgo <= 0 ? recent(now, r) : iso(now, daysAgo, 9 + Math.floor(r() * 9), Math.floor(r() * 60));
      if (at > lastAt) lastAt = at;
      acts.push({ kind, title, at, ...extra });
    };

    if (c.mode === "marketing") {
      const src = pick(r, marketingSources);
      push("form", src === "meta" ? "Submitted the Meta lead form" : src === "google" ? "Called from the Google ad" : src === "website" ? "Filled the website quote form" : src === "referral" ? "Referred by a past customer" : "Added by hand", createdDaysAgo, { by: "System" });
      const progress = r();
      const avgJob = c.avgJobValueCents;
      stageId = "new";
      if (progress > 0.25 || createdDaysAgo > 3) {
        stageId = "contacted";
        push(r() < 0.5 ? "call" : "sms", r() < 0.5 ? "Called, left a voicemail" : "Texted to confirm details", createdDaysAgo - 1, { by: owner });
      }
      if (stageId === "contacted" && (progress > 0.5 || createdDaysAgo > 8)) {
        stageId = "booked";
        push("appointment", `Estimate booked for ${pick(r, ["Tue 10:00", "Wed 2:30", "Thu 9:00", "Fri 1:00", "Mon 11:30"])}`, createdDaysAgo - 2, { by: owner });
        valueCents = Math.round(avgJob * (0.6 + r() * 0.9));
      }
      if (stageId === "booked" && (progress > 0.68 || createdDaysAgo > 14)) {
        stageId = "showed";
        push("note", "Visit done, estimate sent", createdDaysAgo - 5, { by: owner, body: pick(r, ["Full replacement, wants financing options.", "Repair only for now, will call back in spring.", "Insurance adjuster coming next week.", "Comparing two other quotes."]) });
      }
      if (stageId === "showed" && createdDaysAgo > 16) {
        if (r() < 0.45) {
          stageId = "won";
          valueCents = Math.round(avgJob * (0.7 + r() * 0.8));
          push("stage", "Marked won", createdDaysAgo - 9, { by: owner, amountCents: valueCents });
        } else if (r() < 0.6) {
          stageId = "lost";
          push("stage", "Marked lost", createdDaysAgo - 10, { by: owner, body: pick(r, ["Went with a cheaper quote.", "No response after three follow-ups.", "Postponed until next year."]) });
        }
      }
      const srcForContact = src;
      contacts.push({
        id, accountId: c.account.id, firstName: first, lastName: last, email, phone, company: r() < 0.25 ? pick(r, companies) || undefined : undefined, city: nearby,
        tags, source: srcForContact, stageId, ownerName: owner, valueCents, doNotContact: { email: r() < 0.04, sms: r() < 0.08, call: false }, createdAt, lastActivityAt: lastAt,
      });
    } else {
      const src = pick(r, fundraisingSources);
      push("form", src === "donation-page" ? "Gave on the donation page" : src === "meta" ? "Signed up from the Meta campaign" : src === "website" ? "Joined the email list" : src === "import" ? "Imported from the old CRM" : "Referred by a volunteer", createdDaysAgo, { by: "System" });
      const gifts = src === "import" ? Math.floor(r() * 6) : 1 + Math.floor(r() * r() * 7);
      const gift = Math.round((40 + r() * r() * 400) * 100);
      stageId = gifts === 0 ? "prospect" : gifts === 1 ? "first" : "repeat";
      for (let g = 0; g < gifts; g++) {
        const amt = Math.round(gift * (0.7 + r() * 0.6));
        valueCents += amt;
        push("donation", g === 0 ? "First gift" : "Gift", Math.max(0, createdDaysAgo - g * (10 + Math.floor(r() * 30))), { by: "System", amountCents: amt });
      }
      if (gifts >= 2 && r() < 0.45) {
        stageId = "monthly";
        recurring = true;
        push("stage", `Started monthly giving at $${(Math.round(gift * 0.4) / 100).toFixed(0)}`, Math.max(0, createdDaysAgo - 20), { by: "System" });
      } else if (gifts >= 1 && createdDaysAgo > 60 && r() < 0.3) {
        stageId = "lapsed";
      }
      if (r() < 0.3) push("email", "Thank-you email sent", Math.max(0, createdDaysAgo - 1), { by: owner ?? "System" });
      if (r() < 0.15) push("call", "Thank-you call", Math.max(0, createdDaysAgo - 3), { by: owner, body: "Loves the winter shelter work. Asked for the impact report." });
      contacts.push({
        id, accountId: c.account.id, firstName: first, lastName: last, email, phone, city: nearby,
        tags, source: src, stageId, ownerName: owner, valueCents, recurring, doNotContact: { email: r() < 0.05, sms: r() < 0.1, call: r() < 0.05 }, createdAt, lastActivityAt: lastAt,
      });
    }
    acts.forEach((a, k) => activities.push({ ...a, id: `${id}-a${k + 1}`, contactId: id }));
  }
  activities.sort((a, b) => b.at.localeCompare(a.at));
  return { contacts, activities };
}
