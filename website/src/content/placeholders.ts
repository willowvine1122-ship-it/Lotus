/**
 * PLACEHOLDER COPY.
 * Every string in this file is scaffolding so the build can be reviewed. None of it is final.
 * The copywriting thread writes every word on the site; its files land in website/copy/ and
 * replace this module. Rules kept here on purpose: US English, no founder names, no reused
 * library lines. The pages show a visible "placeholder copy" chip while this file is in use.
 */
export const COPY_IS_PLACEHOLDER = true;

export const placeholders = {
  site: {
    name: "Lotus",
    // Official tagline from the brand strategy; the only line here that is not a placeholder.
    tagline: "Growth you can count.",
    description: "[Placeholder] Fundraising, marketing and simple systems for small organizations that do good work.",
  },
  nav: [
    { label: "Fundraising", href: "#fundraising" },
    { label: "Marketing", href: "#marketing" },
    { label: "Builds", href: "#builds" },
    { label: "Pricing", href: "/pricing" },
    { label: "About", href: "/about" },
  ],
  header: {
    cta: "Book a call",
  },
  hero: {
    eyebrow: "An agency for organizations that do good work",
    headline: "Growth you can count.",
    sub: "[Placeholder] Ads, pages and simple systems for small charities, home care agencies and small teams. One number, agreed up front, reported every Monday.",
    primaryCta: "Book a call",
    secondaryCta: "See the three ways",
    // The counting number is a placeholder figure. The copy thread decides the real "one number".
    number: { value: 90, label: "[Placeholder] the one number goes here" },
    petals: ["Fundraising", "Marketing", "Builds"],
  },
  threeWays: {
    heading: "[Placeholder] Three ways to grow",
    cards: [
      {
        id: "fundraising",
        section: "fundraising",
        name: "Lotus Fundraising",
        line: "[Placeholder] who it is for, the one number, the price from, the free first step.",
      },
      {
        id: "marketing",
        section: "marketing",
        name: "Lotus Marketing",
        line: "[Placeholder] who it is for, the one number, the price from, the free first step.",
      },
      {
        id: "builds",
        section: "builds",
        name: "Lotus Builds",
        line: "[Placeholder] who it is for, the one number, the price from, the free first step. Includes Lotus CRM.",
      },
    ],
  },
  notFound: {
    heading: "[Placeholder] This page is next on the build list.",
    link: "Back to the start",
  },
  footer: {
    note: "[Placeholder] Giant wordmark, section links, legal and contact land here.",
  },
} as const;
