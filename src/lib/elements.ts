import type { DonationElement, DonationElementConfig, DonationElementType, ElementDay, ElementLevel } from "@/lib/types";

/*
 * Donation elements, the Fundraise Up way: one definition per element,
 * placed on any number of pages, and every edit reaches every placement.
 * Pure helpers shared by the builder, the renderer, the store and the
 * install script. No data access here.
 */

export type ElementGroup = "Buttons" | "Data" | "Forms" | "Lists" | "Overlays";

export interface ElementKind {
  type: DonationElementType;
  label: string;
  group: ElementGroup;
  /** One sentence for the type picker. */
  blurb: string;
  /** Placed on the page by a placeholder (inline), or floats over it (overlay). */
  placement: "inline" | "overlay";
}

export const elementKinds: ElementKind[] = [
  { type: "donate_button", label: "Donate button", group: "Buttons", blurb: "A button with a heart for headers, footers and calls to action.", placement: "inline" },
  { type: "button_group", label: "Button group", group: "Buttons", blurb: "A grid of preset amounts. Each one opens checkout with that gift.", placement: "inline" },
  { type: "image_card", label: "Image card", group: "Buttons", blurb: "Photo, title, short story and a donate button for one project.", placement: "inline" },
  { type: "sticky_button", label: "Sticky button", group: "Overlays", blurb: "Pinned to a corner or the edge of the window on every page.", placement: "overlay" },
  { type: "goal_meter", label: "Goal meter", group: "Data", blurb: "Live progress toward the goal, with donors and days left.", placement: "inline" },
  { type: "stat_counter", label: "Stat counter", group: "Data", blurb: "One big number that counts up: raised, donors, monthly givers.", placement: "inline" },
  { type: "donation_form", label: "Donation form", group: "Forms", blurb: "The full checkout, right on the page. The highest converting element.", placement: "inline" },
  { type: "donation_levels", label: "Donation levels", group: "Forms", blurb: "Named tiers with an amount and what it does.", placement: "inline" },
  { type: "impact_slider", label: "Impact slider", group: "Forms", blurb: "Donors slide between amounts and see the impact change.", placement: "inline" },
  { type: "recent_donations", label: "Recent donations", group: "Lists", blurb: "A live list of the latest gifts. Anonymous gifts stay hidden.", placement: "inline" },
  { type: "message_bar", label: "Message bar", group: "Overlays", blurb: "A slim bar across the top or bottom of the site.", placement: "overlay" },
  { type: "popup", label: "Popup", group: "Overlays", blurb: "A timed or exit-intent appeal with a photo and a button.", placement: "overlay" },
  { type: "social_proof", label: "Social proof", group: "Overlays", blurb: "A small toast for each new gift: who, how much, from where.", placement: "overlay" },
];

export const elementGroups: ElementGroup[] = ["Buttons", "Forms", "Data", "Lists", "Overlays"];

export function kindOf(type: DonationElementType): ElementKind {
  return elementKinds.find((k) => k.type === type)!;
}

export const isOverlay = (type: DonationElementType) => kindOf(type).placement === "overlay";

/** Accent presets a nonprofit's site is likely to use. The accent is the client's colour, not Lotus's. */
export const accentPresets = ["#e0245e", "#d1492e", "#e8731c", "#1f8a4c", "#0e7c86", "#2f6fed", "#4b3fd8", "#16181d"];

/** White or near-black text, whichever reads better on the accent. */
export function onAccent(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Contrast against white vs against #16181d.
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.0595) ? "#ffffff" : "#16181d";
}

export const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s);

/** Demo photos that ship with Lotus; any https image URL works too. */
export const stockImages = [
  { url: "/elements/water.svg", label: "Water" },
  { url: "/elements/shelter.svg", label: "Shelter" },
  { url: "/elements/school.svg", label: "School" },
  { url: "/elements/meals.svg", label: "Meals" },
];

let n = 0;
export const levelId = () => `lv-${Date.now().toString(36)}-${(n++).toString(36)}`;

const levels = (xs: [number, string, string][]): ElementLevel[] =>
  xs.map(([dollars, label, description], i) => ({ id: `lv-${i}`, amountCents: dollars * 100, label, description }));

const base: DonationElementConfig = {
  label: "Donate",
  headline: "",
  body: "",
  frequency: "campaign",
  amountCents: 0,
  levels: [],
  allowChange: true,
  metric: "raised",
  showDonors: true,
  showDeadline: false,
  offlineCents: 0,
  match: 1,
  nameStyle: "first_initial",
  showLocation: true,
  count: 5,
  accent: "#e0245e",
  theme: "light",
  size: "md",
  shape: "rounded",
  icon: true,
  pulse: false,
  fullWidth: false,
  align: "left",
  position: "bottom_right",
  trigger: "load",
  delaySeconds: 8,
  scrollPercent: 40,
  devices: "all",
  showOn: [],
  hideOn: [],
};

/** A sensible starting point for each type, so a new element looks finished before it is edited. */
export function defaultConfig(type: DonationElementType, campaign?: { title: string; amounts?: { one_time: number[]; monthly: number[] }; impact?: Record<number, string> }): DonationElementConfig {
  const amounts = campaign?.amounts?.one_time?.length ? campaign.amounts.one_time : [2500, 5000, 10000, 25000, 50000, 100000];
  const impact = campaign?.impact ?? {};
  const tiers = amounts.slice(0, 3);
  switch (type) {
    case "donate_button":
      return { ...base, label: "Donate", pulse: true };
    case "button_group":
      return {
        ...base,
        headline: "Choose your gift",
        frequency: "one_time",
        levels: amounts.slice(0, 6).map((a, i) => ({ id: `lv-${i}`, amountCents: a, label: "", description: "" })),
      };
    case "image_card":
      return { ...base, headline: campaign?.title ?? "Fund a project", body: "Your gift goes straight to work where it is needed most this season.", label: "Donate", amountCents: amounts[1] ?? 5000, frequency: "one_time", imageUrl: stockImages[0].url };
    case "sticky_button":
      return { ...base, label: "Donate", position: "bottom_right", trigger: "scroll", scrollPercent: 20, shape: "pill", size: "md" };
    case "goal_meter":
      return { ...base, headline: campaign?.title ?? "Our goal", showDeadline: true, metric: "raised" };
    case "stat_counter":
      return { ...base, headline: "raised so far", metric: "raised", align: "center", size: "lg" };
    case "donation_form":
      return { ...base, frequency: "campaign" };
    case "donation_levels":
      return {
        ...base,
        headline: "Pick a level",
        frequency: "one_time",
        levels: tiers.length === 3
          ? tiers.map((a, i) => ({ id: `lv-${i}`, amountCents: a, label: ["Friend", "Champion", "Hero"][i], description: impact[a / 100] ?? impact[a] ?? "Keeps the work going for another week." }))
          : levels([[50, "Friend", "A week of support."], [100, "Champion", "A month of support."], [250, "Hero", "A season of support."]]),
      };
    case "impact_slider":
      return {
        ...base,
        headline: "See what your gift does",
        frequency: "one_time",
        levels: amounts.slice(0, 5).map((a, i) => ({ id: `lv-${i}`, amountCents: a, label: "", description: impact[a / 100] ?? impact[a] ?? "" })),
      };
    case "recent_donations":
      return { ...base, headline: "Recent gifts", count: 5, nameStyle: "first_initial" };
    case "message_bar":
      return { ...base, headline: "Every gift is matched until Friday.", label: "Give now", position: "top", icon: false, size: "sm" };
    case "popup":
      return { ...base, headline: campaign?.title ?? "Will you give today?", body: "A gift today keeps the work going through the hardest months.", label: "Donate now", imageUrl: stockImages[1].url, trigger: "delay", delaySeconds: 8 };
    case "social_proof":
      return { ...base, position: "bottom_left", label: "Donate", trigger: "delay", delaySeconds: 4 };
  }
}

/* ------------------------------ install ----------------------------- */

/** The one script a site loads, in its <head>. */
export function installScript(origin: string, accountId: string) {
  return `<script src="${origin}/embed/lotus.js?account=${accountId}" async></script>`;
}

/** Where an inline element goes on the page; the script swaps it for the element. */
export function placeholder(id: string) {
  return `<a href="#lotus-${id}" style="display:none"></a>`;
}

/** A plain link on the client's own site that opens checkout from this element. */
export function donateLink(id: string) {
  return `#lotus-donate-${id}`;
}

/** Overlay URL rules: * matches anything, "never" wins. */
export function urlAllowed(path: string, showOn: string[], hideOn: string[]) {
  const test = (pattern: string) => {
    const re = new RegExp(`^${pattern.trim().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`, "i");
    return re.test(path);
  };
  if (hideOn.some((p) => p.trim() && test(p))) return false;
  if (showOn.filter((p) => p.trim()).length === 0) return true;
  return showOn.some((p) => p.trim() && test(p));
}

/* ------------------------------- stats ------------------------------ */

export interface ElementTotals {
  views: number;
  opens: number;
  gifts: number;
  raisedCents: number;
  openRate: number | null;
  conversion: number | null; // gifts per view
}

export function totals(days: ElementDay[]): ElementTotals {
  const views = days.reduce((a, d) => a + d.views, 0);
  const opens = days.reduce((a, d) => a + d.opens, 0);
  const gifts = days.reduce((a, d) => a + d.gifts, 0);
  const raisedCents = days.reduce((a, d) => a + d.raisedCents, 0);
  return { views, opens, gifts, raisedCents, openRate: views ? opens / views : null, conversion: views ? gifts / views : null };
}

/** Recent-gift names the way the element is set to show them. */
export function displayName(first: string, last: string, style: DonationElementConfig["nameStyle"]) {
  if (style === "hidden") return "Someone";
  if (style === "initials") return `${first.slice(0, 1)}. ${last.slice(0, 1)}.`.trim();
  return `${first} ${last.slice(0, 1)}.`.trim();
}

/** What the builder and board show under an element's name. */
export function elementSummary(e: Pick<DonationElement, "type" | "config">): string {
  const c = e.config;
  const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
  switch (e.type) {
    case "donate_button":
    case "sticky_button":
      return `“${c.label}”${c.amountCents ? ` · ${dollars(c.amountCents)}` : ""}`;
    case "button_group":
    case "impact_slider":
      return c.levels.map((l) => dollars(l.amountCents)).join(" · ");
    case "donation_levels":
      return c.levels.map((l) => l.label || dollars(l.amountCents)).join(" · ");
    case "image_card":
    case "popup":
    case "message_bar":
    case "goal_meter":
      return c.headline;
    case "stat_counter":
      return { raised: "Amount raised", donors: "Donors", gifts: "Gifts", monthly_donors: "Monthly donors", monthly_value: "Monthly giving" }[c.metric];
    case "donation_form":
      return "Full checkout";
    case "recent_donations":
      return `Last ${c.count} gifts`;
    case "social_proof":
      return "A toast per new gift";
  }
}
