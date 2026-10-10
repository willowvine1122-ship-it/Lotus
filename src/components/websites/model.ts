import type { AccountMode, FunnelBlock, Website, WebsiteBlock, WebsiteDay, WebsitePage } from "@/lib/types";

/*
 * Websites: the pure helpers shared by the board, the editor, the public
 * site and the server. Pages reuse the funnel blocks, plus an embedded Lotus
 * form; the header, navigation and footer belong to the site.
 */

export interface ClientRef {
  id: string;
  name: string;
  slug: string;
  mode: AccountMode;
}

const id = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
export const pageId = () => id("pg");
export const blockId = () => id("b");

/** The public address of a page: the custom domain when it's connected, else /s/<slug>. */
export function pageHref(site: Pick<Website, "slug">, page: Pick<WebsitePage, "path">, opts: { base?: string } = {}) {
  const base = opts.base ?? `/s/${site.slug}`;
  return page.path ? `${base}/${page.path}` : base || "/";
}

export function siteUrl(site: Pick<Website, "slug" | "domain">, origin: string) {
  return site.domain?.status === "connected" ? `https://${site.domain.host}` : `${origin}/s/${site.slug}`;
}

export function slugifyPath(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s/-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, 60);
}

export const RESERVED_PATHS = ["sitemap.xml", "robots.txt", "_next", "api"];

/** What's wrong with the page paths, keyed by page id. */
export function pathIssues(pages: WebsitePage[]): Record<string, string> {
  const out: Record<string, string> = {};
  const seen = new Map<string, string>();
  for (const [i, p] of pages.entries()) {
    if (i === 0 && p.path !== "") out[p.id] = "The first page is the home page and has no path";
    else if (i > 0 && !p.path) out[p.id] = "Give the page a path";
    else if (p.path && !/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(p.path)) out[p.id] = "Use lowercase letters, numbers, dashes and slashes";
    else if (RESERVED_PATHS.includes(p.path.split("/")[0]!)) out[p.id] = "That path is reserved";
    const other = seen.get(p.path);
    if (other !== undefined) out[p.id] = "Another page already uses this path";
    seen.set(p.path, p.id);
  }
  return out;
}

export function windowStats(days: WebsiteDay[], n: number) {
  const cur = days.slice(-n);
  const prev = days.slice(-2 * n, -n);
  const sum = (xs: WebsiteDay[], k: "views" | "leads") => xs.reduce((a, d) => a + d[k], 0);
  const views = sum(cur, "views");
  const leads = sum(cur, "leads");
  const pViews = sum(prev, "views");
  return { views, leads, rate: views ? leads / views : null, viewsDelta: prev.length && pViews ? (views - pViews) / pViews : null, prevViews: pViews };
}

/* ------------------------------- domains ------------------------------ */

/** Where a client's subdomain should point. One CNAME, no IPs to keep in sync. */
export const SITES_CNAME = process.env.NEXT_PUBLIC_LOTUS_SITES_CNAME || "sites.lotus.app";

export function normaliseHost(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

export function hostError(host: string): string | undefined {
  if (!host) return "Enter a domain";
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) return "That doesn't look like a domain";
  if (host.split(".").length < 3) return `Use a subdomain such as www.${host}, then forward ${host} to it at your registrar`;
  if (host.endsWith(".lotus.app") || host === SITES_CNAME) return "That domain belongs to Lotus";
  return undefined;
}

/* ------------------------------ templates ----------------------------- */

const b = <T extends FunnelBlock["type"]>(type: T, rest: Omit<Extract<FunnelBlock, { type: T }>, "id" | "type">) => ({ id: blockId(), type, ...rest }) as Extract<FunnelBlock, { type: T }>;

function page(title: string, path: string, blocks: WebsiteBlock[], seo: WebsitePage["seo"] = {}): WebsitePage {
  return { id: pageId(), title, path, blocks, inNav: true, seo };
}

export interface SiteTemplate {
  key: string;
  name: string;
  summary: string;
  modes: AccountMode[];
  build: (client: { name: string; city?: string }) => Pick<Website, "pages" | "header" | "footer" | "seo" | "brandColor">;
}

export const siteTemplates: SiteTemplate[] = [
  {
    key: "local",
    name: "Local service business",
    summary: "Home, Services, About, Reviews and Contact, with a quote form on the home page.",
    modes: ["marketing"],
    build: ({ name, city }) => ({
      brandColor: "#1f6fd1",
      header: { ctaLabel: "Get a free quote", ctaHref: "/contact" },
      footer: { tagline: `Family-run and fully insured${city ? `, serving ${city}` : ""}.`, phone: "(303) 555-0142", email: "hello@example.com", address: city ?? "", hours: "Mon to Fri 8am to 6pm · Sat 9am to 1pm" },
      seo: { siteTitle: name, description: `${name}: fast, friendly and fairly priced${city ? ` in ${city}` : ""}. Get a free quote today.` },
      pages: [
        page("Home", "", [
          b("hero", { eyebrow: city ? `Serving ${city} and nearby` : "Local and fully insured", headline: `${name}, done right the first time`, subhead: "Clear prices up front, on-time arrivals, and a one-year guarantee on every job.", buttonLabel: "Get a free quote", buttonHref: "#form", align: "split" }),
          b("form", { headline: "Get a free quote", subhead: "We reply within one business hour.", fields: ["name", "phone", "email", "message"], buttonLabel: "Send my request", note: "No spam. No obligation." }),
          b("stats", { items: [{ value: "4.9", label: "Google rating" }, { value: "2,400+", label: "Jobs completed" }, { value: "1 hr", label: "Average reply time" }] }),
          b("features", { headline: "Why neighbours choose us", items: [{ title: "Upfront pricing", body: "You approve the price before we start. No surprises on the invoice." }, { title: "On time, every time", body: "Two-hour arrival windows and a text when we're on the way." }, { title: "Guaranteed work", body: "If something isn't right within a year, we come back and fix it." }] }),
          b("testimonial", { quote: "They came the same day, explained everything, and the price was exactly what they quoted.", name: "Maria G.", detail: "Google review" }),
          b("cta", { headline: "Ready when you are", body: "Tell us what's going on and we'll get you a price today.", buttonLabel: "Get a free quote", buttonHref: "/contact" }),
        ], { title: `${name}${city ? ` in ${city}` : ""}`, description: `Fast, friendly service from ${name}. Upfront pricing and a one-year guarantee.` }),
        page("Services", "services", [
          b("hero", { headline: "What we do", subhead: "Repairs, replacements and new installs, plus maintenance plans that keep small problems small.", align: "left" }),
          b("features", { items: [{ title: "Repairs", body: "Same-day visits for most repairs, with parts on the truck." }, { title: "Replacements", body: "Options at three price points, with financing on approval." }, { title: "Maintenance plans", body: "Twice-yearly checkups and priority booking." }] }),
          b("faq", { items: [{ q: "Do you charge for quotes?", a: "No. Quotes are free and good for 30 days." }, { q: "Are you licensed and insured?", a: "Yes, fully licensed and insured. We'll send proof on request." }, { q: "Do you offer financing?", a: "Yes, on approved credit, from 0% for 12 months." }] }),
          b("cta", { headline: "Not sure what you need?", buttonLabel: "Ask us", buttonHref: "/contact" }),
        ]),
        page("About", "about", [
          b("text", { headline: `About ${name}`, body: "We started with one van and a simple promise: do the job we'd want done in our own homes. Fifteen years on, that's still how we work." }),
          b("stats", { items: [{ value: "15", label: "Years in business" }, { value: "24", label: "Team members" }, { value: "100%", label: "Background checked" }] }),
          b("testimonial", { quote: "Polite, tidy, and they explained every step. I've already recommended them to two neighbours.", name: "James T.", detail: "Facebook review" }),
        ]),
        page("Reviews", "reviews", [
          b("hero", { headline: "What customers say", subhead: "Over 600 five-star reviews on Google and Facebook.", align: "center" }),
          b("testimonial", { quote: "Showed up early, fixed it fast, and left the place cleaner than they found it.", name: "Priya R.", detail: "Google review" }),
          b("testimonial", { quote: "Honest advice. They told me I didn't need a replacement yet, which saved me thousands.", name: "Daniel K.", detail: "Google review" }),
          b("cta", { headline: "Join them", buttonLabel: "Get a free quote", buttonHref: "/contact" }),
        ]),
        page("Contact", "contact", [
          b("form", { headline: "Tell us about the job", subhead: "We reply within one business hour.", fields: ["name", "phone", "email", "address", "message"], buttonLabel: "Send my request" }),
          b("text", { headline: "Prefer to call?", body: "Ring (303) 555-0142, Monday to Friday 8am to 6pm and Saturday 9am to 1pm." }),
        ], { title: `Contact ${name}`, description: `Get a free quote from ${name}.` }),
      ],
    }),
  },
  {
    key: "nonprofit",
    name: "Nonprofit",
    summary: "Home, About, Our work, Get involved and Donate, with a gift form.",
    modes: ["fundraising"],
    build: ({ name }) => ({
      brandColor: "#0f7a5c",
      header: { ctaLabel: "Donate", ctaHref: "/donate" },
      footer: { tagline: "A registered 501(c)(3) charity. Gifts are tax deductible.", email: "hello@example.org", address: "" },
      seo: { siteTitle: name, description: `${name} turns every gift into lasting change. See where your money goes and give today.` },
      pages: [
        page("Home", "", [
          b("hero", { eyebrow: "Every gift goes further", headline: "Real help for families, this week", subhead: "Your gift funds meals, safe beds and the support that gets families back on their feet.", buttonLabel: "Give today", buttonHref: "/donate", align: "center" }),
          b("stats", { items: [{ value: "12,400", label: "Meals served this year" }, { value: "86%", label: "Of every dollar to programs" }, { value: "340", label: "Volunteers" }] }),
          b("features", { headline: "Where your gift goes", items: [{ title: "$25", body: "A week of school lunches for one child." }, { title: "$100", body: "A night of safe shelter for a family." }, { title: "$250", body: "A month of job coaching for one parent." }] }),
          b("testimonial", { quote: "When we had nowhere else to go, they found us a bed the same night.", name: "Angela", detail: "Program participant" }),
          b("cta", { headline: "Help a family this week", buttonLabel: "Donate", buttonHref: "/donate" }),
        ]),
        page("About", "about", [b("text", { headline: `About ${name}`, body: "We were founded by neighbours who saw families falling through the gaps. Today we run three programs and publish every dollar we spend." })]),
        page("Our work", "our-work", [b("features", { headline: "Our programs", items: [{ title: "Food", body: "Hot meals and grocery boxes, six days a week." }, { title: "Shelter", body: "Emergency beds and help finding a home." }, { title: "Work", body: "Coaching, training and introductions to local employers." }] })]),
        page("Get involved", "get-involved", [b("form", { headline: "Volunteer with us", subhead: "Tell us a little about yourself and we'll be in touch.", fields: ["name", "email", "phone", "message"], buttonLabel: "Sign me up" })]),
        page("Donate", "donate", [b("form", { headline: "Make a gift", subhead: "Choose an amount. You'll get a receipt by email.", fields: ["amount", "name", "email"], buttonLabel: "Give now", note: "Secure payment. Cancel a monthly gift any time." })]),
      ],
    }),
  },
  {
    key: "onepage",
    name: "One page",
    summary: "Everything on a single scrolling page: hero, proof, services, FAQ and a form.",
    modes: ["marketing", "fundraising"],
    build: ({ name }) => ({
      brandColor: "#6d4ae8",
      header: { ctaLabel: "Contact us", ctaHref: "#form" },
      footer: { tagline: "", email: "hello@example.com" },
      seo: { siteTitle: name, description: `${name}. Get in touch today.` },
      pages: [
        page("Home", "", [
          b("hero", { headline: name, subhead: "One sentence about what you do and who it's for.", buttonLabel: "Get in touch", buttonHref: "#form", align: "center" }),
          b("stats", { items: [{ value: "4.9", label: "Rating" }, { value: "1,000+", label: "Customers" }, { value: "24h", label: "Reply time" }] }),
          b("features", { headline: "What we offer", items: [{ title: "First", body: "One sentence." }, { title: "Second", body: "One sentence." }, { title: "Third", body: "One sentence." }] }),
          b("faq", { items: [{ q: "A common question?", a: "A clear answer." }] }),
          b("form", { headline: "Get in touch", fields: ["name", "email", "message"], buttonLabel: "Send" }),
        ]),
      ],
    }),
  },
  {
    key: "blank",
    name: "Start from scratch",
    summary: "A home page with a headline. Add pages and blocks as you go.",
    modes: ["marketing", "fundraising"],
    build: ({ name }) => ({
      brandColor: "#141821",
      header: {},
      footer: {},
      seo: { siteTitle: name, description: "" },
      pages: [page("Home", "", [b("hero", { headline: name, subhead: "", align: "center" })])],
    }),
  },
];

export const websiteBlockLabel = {
  hero: "Hero",
  form: "Contact form",
  lotus_form: "Lotus form",
  features: "Feature points",
  stats: "Numbers",
  testimonial: "Testimonial",
  text: "Text",
  faq: "FAQ",
  cta: "Call to action",
  footer: "Footer note",
} as const;

export function websiteBlockSummary(block: WebsiteBlock, formName?: (id: string) => string | undefined): string {
  if (block.type === "lotus_form") return formName?.(block.formId) ?? "Pick a form";
  switch (block.type) {
    case "hero":
    case "form":
    case "cta":
      return block.headline;
    case "features":
      return block.headline || `${block.items.length} points`;
    case "stats":
      return block.items.map((i) => i.value).join(" · ");
    case "testimonial":
      return block.name;
    case "text":
      return block.headline || block.body.slice(0, 48);
    case "faq":
      return `${block.items.length} questions`;
    case "footer":
      return block.text;
  }
}
