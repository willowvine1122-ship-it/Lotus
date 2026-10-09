import type { Funnel, FunnelBlock, FunnelBlockType, FunnelDay } from "@/lib/types";

/* Shared helpers for the funnels screens. Plain module so server and client both import it. */

export interface ClientRef {
  id: string;
  name: string;
  slug: string;
  mode: "marketing" | "fundraising";
}

export const templateLabel: Record<string, string> = {
  quote: "Free quote",
  booking: "Book a visit",
  appeal: "Donation appeal",
  blank: "Blank",
};

export const blockLabel: Record<FunnelBlockType, string> = {
  hero: "Hero",
  form: "Form",
  features: "Feature points",
  stats: "Numbers",
  testimonial: "Testimonial",
  text: "Text",
  faq: "FAQ",
  cta: "Call to action",
  footer: "Footer",
};

/** One-line summary of a block for the editor's block list. */
export function blockSummary(b: FunnelBlock): string {
  switch (b.type) {
    case "hero":
    case "form":
    case "cta":
      return b.headline;
    case "features":
      return b.headline || `${b.items.length} points`;
    case "stats":
      return b.items.map((i) => i.value).join(" · ");
    case "testimonial":
      return b.name;
    case "text":
      return b.headline || b.body.slice(0, 48);
    case "faq":
      return `${b.items.length} questions`;
    case "footer":
      return b.text;
  }
}

/** Sum of visitors and leads over the last `n` days, with the previous window beside it. */
export function windowStats(days: FunnelDay[], n: number) {
  const cur = days.slice(-n);
  const prev = days.slice(-2 * n, -n);
  const sum = (xs: FunnelDay[], k: "visitors" | "leads") => xs.reduce((a, d) => a + d[k], 0);
  const visitors = sum(cur, "visitors");
  const leads = sum(cur, "leads");
  const pVisitors = sum(prev, "visitors");
  const pLeads = sum(prev, "leads");
  return {
    visitors,
    leads,
    rate: visitors ? leads / visitors : null,
    visitorsDelta: prev.length && pVisitors ? (visitors - pVisitors) / pVisitors : null,
    leadsDelta: prev.length && pLeads ? (leads - pLeads) / pLeads : null,
  };
}

export function publicPath(f: Funnel, stepPath = "") {
  return `/f/${f.slug}${stepPath ? `/${stepPath}` : ""}`;
}
