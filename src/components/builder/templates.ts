import type { BuilderButtonAction, BuilderDoc, BuilderElement, BuilderFieldKey, BuilderProduct, BuilderSection, BuilderStyle, FunnelStep, FunnelStepKind } from "@/lib/types";
import { column, emptyDoc, row, section, uid } from "./model";

/*
 * Ready-made content for the visual builder: single sections to drop into a
 * page, and whole funnels to start from. Every build() returns fresh ids so a
 * template can be inserted any number of times. Copy reads the client's name,
 * industry and location so a new page is close to publishable on day one.
 */

export interface TemplateContext {
  name: string;
  industry: string;
  location: string;
}

export type SectionGroup = "Hero" | "Features" | "Social proof" | "Pricing" | "Sell" | "Forms" | "Call to action" | "FAQ" | "Footer";

export interface SectionTemplate {
  key: string;
  label: string;
  group: SectionGroup;
  build: (ctx: TemplateContext) => BuilderSection;
}

/* ------------------------------ photos ------------------------------ */

/** Unsplash photos picked for these templates (served from images.unsplash.com). */
const photo = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;
export const photos = {
  ownerAtTable: photo("1531058240690-006c446962d8"),
  shopCounter: photo("1556740758-90de374c12ad"),
  craftsman: photo("1545262722-9e0d80a0bc01"),
  phoneCall: photo("1520333789090-1afc82db536a"),
  teamDark: photo("1603201667141-5a2d4c673378"),
  teamLaughing: photo("1572021335469-31706a17aaef"),
  teamTable: photo("1690378820474-b468b8ee64d3"),
  collaborating: photo("1603201667230-bd139210db18"),
  funRun: photo("1557660559-42497f78035b"),
  volunteers: photo("1560220604-1985ebfe28b1"),
  volunteerHospital: photo("1706806595136-5afefb45da1a"),
  laptopDesk: photo("1499750310107-5fef28a66643"),
  laptopWhite: photo("1558478551-1a378f63328e"),
};

/* ------------------------------ element helpers ------------------------------ */

const h = (text: string, tag: "h1" | "h2" | "h3" | "h4" = "h2", style?: BuilderStyle): BuilderElement => ({ id: uid("e"), type: "headline", tag, text, style });
const p = (text: string, style?: BuilderStyle): BuilderElement => ({ id: uid("e"), type: "text", text, style });
const muted = (text: string, style?: BuilderStyle): BuilderElement => p(text, { color: "var(--lb-muted)", ...style });
const btn = (label: string, action: BuilderButtonAction = "next", extra: { href?: string; sub?: string; variant?: "solid" | "outline"; size?: "md" | "lg"; full?: boolean; style?: BuilderStyle } = {}): BuilderElement => ({
  id: uid("e"),
  type: "button",
  label,
  action,
  href: extra.href,
  sub: extra.sub,
  variant: extra.variant ?? "solid",
  size: extra.size ?? "lg",
  full: extra.full,
  style: extra.style,
});
const img = (src: string, alt: string, ratio: "auto" | "16/9" | "4/3" | "1/1" | "3/4" = "4/3", style?: BuilderStyle): BuilderElement => ({ id: uid("e"), type: "image", src, alt, ratio, style: { radius: 14, ...style } });
const list = (items: string[], icon: "check" | "dot" | "arrow" | "x" = "check", style?: BuilderStyle): BuilderElement => ({ id: uid("e"), type: "list", items, icon, style });
const field = (key: BuilderFieldKey, label: string, required = true) => ({ key, label, required });
const form = (fields: ReturnType<typeof field>[], buttonLabel: string, note?: string): BuilderElement => ({ id: uid("e"), type: "form", fields, buttonLabel, note });
const testimonial = (quote: string, name: string, detail: string, style?: BuilderStyle): BuilderElement => ({ id: uid("e"), type: "testimonial", quote, name, detail, rating: 5, style });
const stat = (value: string, label: string): BuilderElement => ({ id: uid("e"), type: "stat", value, label });
const spacer = (height: number): BuilderElement => ({ id: uid("e"), type: "spacer", height });
const divider = (style?: BuilderStyle): BuilderElement => ({ id: uid("e"), type: "divider", style });
const countdown = (minutes: number, expired: string, style?: BuilderStyle): BuilderElement => ({ id: uid("e"), type: "countdown", mode: "evergreen", minutes, expired, style });
const product = (name: string, priceCents: number, interval: BuilderProduct["interval"] = "once"): BuilderProduct => ({ id: uid("p"), name, priceCents, interval });

const card: BuilderStyle = { bg: "#ffffff", padTop: 30, padBottom: 30, padX: 30, radius: 14, borderWidth: 1, borderColor: "#e9e7e1", shadow: "sm" };
const cardMd: BuilderStyle = { ...card, padTop: 32, padBottom: 32, padX: 32, shadow: "md" };
const featuredCard: BuilderStyle = { ...cardMd, borderWidth: 2, borderColor: "var(--lb-primary)", shadow: "lg" };
const dark = "#0f1221";
const soft = "#f3f1ec";

/** "Plumbing" reads better mid-sentence as "plumbing"; acronyms such as HVAC stay as they are. */
function trade(industry: string) {
  const v = industry.trim() || "local service";
  return /[A-Z]{2,}/.test(v) ? v : v.toLowerCase();
}

function wrap(maxWidth: number, extra: BuilderStyle = {}): BuilderStyle {
  return { padTop: 88, padBottom: 88, maxWidth, ...extra };
}

/* ------------------------------ sections ------------------------------ */

function heroCentered(c: TemplateContext): BuilderSection {
  return section(
    [
      row([
        column(12, [
          h(`${c.location}'s most recommended ${trade(c.industry)} team`, "h1"),
          muted(`Clear prices before we start, a crew that turns up on time, and work we guarantee for a full year. That's why ${c.name} gets booked on referral.`, { fontSize: 19, marginTop: 4 }),
          spacer(12),
          btn("Get my free quote", "scroll", { href: "#form", sub: "Reply within one business hour" }),
          muted("Rated 4.9 from 300+ local reviews", { fontSize: 14, marginTop: 14 }),
        ]),
      ]),
    ],
    { name: "Hero", style: wrap(780, { padTop: 112, padBottom: 104, align: "center" }) },
  );
}

function heroSplitImage(c: TemplateContext): BuilderSection {
  return section(
    [
      row(
        [
          column(
            6,
            [
              h(`${c.industry} done properly, the first time`, "h1"),
              muted(`Most callbacks happen because a job was rushed. ${c.name} quotes in writing, finishes on the day we promise and leaves the place cleaner than we found it.`, { fontSize: 18 }),
              list(["Fixed written quote, no hourly surprises", `Local crew based in ${c.location}`, "12-month workmanship guarantee"]),
              spacer(8),
              btn("Book a free assessment", "scroll", { href: "#form" }),
            ],
            { valign: "center" },
          ),
          column(6, [img(photos.craftsman, `${c.name} at work`, "4/3")], { valign: "center" }),
        ],
        { gap: 56 },
      ),
    ],
    { name: "Hero with image", style: wrap(1120, { padTop: 96, padBottom: 96 }) },
  );
}

function heroSplitForm(c: TemplateContext): BuilderSection {
  return section(
    [
      row(
        [
          column(
            7,
            [
              h(`The ${c.location} homeowner's guide to choosing a ${trade(c.industry)} company`, "h1", { fontSize: 48 }),
              muted("Twelve questions to ask before you sign anything, the price ranges you should expect this year, and the three red flags that cost our neighbours the most money.", { fontSize: 18 }),
              list(["Read it in 10 minutes", "Printable checklist for the walkthrough", "Written by people who do the work every day"]),
            ],
            { valign: "center" },
          ),
          column(
            5,
            [h("Send me the free guide", "h3"), muted("Arrives in your inbox within a minute.", { marginBottom: 8 }), form([field("first_name", "First name"), field("email", "Email")], "Email me the guide", "One email with the guide, then a short weekly tip. Unsubscribe any time.")],
            { valign: "center", style: cardMd },
          ),
        ],
        { gap: 48 },
      ),
    ],
    { name: "Hero with opt-in", style: wrap(1120, { padTop: 96, padBottom: 96, bg: soft }) },
  );
}

function heroDarkImage(c: TemplateContext): BuilderSection {
  return section(
    [
      row([
        column(12, [
          h(`Grow ${c.name} without working longer hours`, "h1"),
          p("We build the systems that answer every enquiry, follow up automatically and book the job while you are on the tools.", { fontSize: 19, color: "#e7e6ef" }),
          spacer(12),
          btn("See how it works", "scroll", { href: "#form" }),
        ]),
      ]),
    ],
    { name: "Hero over photo", style: wrap(820, { padTop: 152, padBottom: 152, align: "center", color: "#ffffff", bg: dark, bgImage: photos.teamDark, overlay: 0.62 }) },
  );
}

function heroVideo(c: TemplateContext): BuilderSection {
  return section(
    [
      row([
        column(12, [
          h(`Watch: how ${c.name} turns a first call into a finished job in five days`, "h2", { fontSize: 44 }),
          muted("A three-minute walkthrough of exactly what happens after you get in touch.", { fontSize: 18 }),
        ]),
      ]),
      row([column(12, [{ id: uid("e"), type: "video", url: "", style: { radius: 14, marginTop: 16 } }])]),
      row([column(12, [spacer(8), btn("Start with a free quote", "next", { sub: "Takes about a minute" })])]),
    ],
    { name: "Hero with video", style: wrap(880, { align: "center", padTop: 96 }) },
  );
}

function features3(c: TemplateContext): BuilderSection {
  const feat = (title: string, body: string) => column(4, [h(title, "h4"), muted(body)], { style: card });
  return section(
    [
      row([column(12, [h(`Why ${c.location} keeps calling ${c.name}`), muted("Three promises we put in writing on every job.", { fontSize: 18 })])], { style: { align: "center", marginBottom: 24 } }),
      row(
        [
          feat("Priced before we start", "You get a fixed written quote. If the job takes longer than we planned, that's on us, not your invoice."),
          feat("On time, or the call-out is free", "We give you a two-hour arrival window and text when we're on the way. Miss it and the visit costs nothing."),
          feat("Guaranteed for a year", "If anything we touched isn't right within 12 months, we come back and fix it at no charge."),
        ],
        { gap: 24 },
      ),
    ],
    { name: "Features", style: wrap(1080) },
  );
}

function featuresAlternating(c: TemplateContext): BuilderSection {
  return section(
    [
      row(
        [
          column(6, [img(photos.ownerAtTable, "Reviewing the plan with a customer")], { valign: "center" }),
          column(
            6,
            [
              h("A plan you can read before anyone picks up a tool", "h3"),
              muted(`We walk the site with you, photograph what we find and send a plain-English plan the same day. You'll know the scope, the price and the finish date before you say yes to ${c.name}.`),
            ],
            { valign: "center" },
          ),
        ],
        { gap: 56, style: { marginBottom: 64 } },
      ),
      row(
        [
          column(
            6,
            [
              h("Updates without chasing", "h3"),
              muted("Every evening you get a short message with photos of what got done and what happens tomorrow. No phone tag, no wondering where the crew went."),
              list(["Daily photo updates", "One named project lead", "Text or call, whichever you prefer"]),
            ],
            { valign: "center" },
          ),
          column(6, [img(photos.phoneCall, "Customer getting a project update by phone")], { valign: "center" }),
        ],
        { gap: 56 },
      ),
    ],
    { name: "Alternating features", style: wrap(1080) },
  );
}

function benefitChecklist(c: TemplateContext): BuilderSection {
  return section(
    [
      row(
        [
          column(5, [h("Everything included, nothing hidden", "h2"), muted(`Other quotes look cheaper until the extras show up. Every ${c.name} price already covers:`)], { valign: "center" }),
          column(
            7,
            [
              list([
                "Site visit, measurements and a written quote",
                "All materials, delivered and stored safely",
                "Permits and inspections where they're needed",
                "Full clean-up and waste removal on the last day",
                "A walkthrough with you before we call it finished",
                "12-month workmanship guarantee in writing",
              ]),
            ],
            { style: card, valign: "center" },
          ),
        ],
        { gap: 48 },
      ),
    ],
    { name: "Benefit checklist", style: wrap(1080, { bg: soft }) },
  );
}

function testimonialSingle(c: TemplateContext): BuilderSection {
  return section(
    [
      row([
        column(12, [
          testimonial(
            `We had three companies out. ${c.name} was the only one who explained what was actually wrong instead of selling us the most expensive fix. Finished a day early and the price didn't move by a cent.`,
            "Sarah M.",
            `Homeowner, ${c.location}`,
            { fontSize: 22 },
          ),
        ]),
      ]),
    ],
    { name: "Testimonial", style: wrap(760, { align: "center" }) },
  );
}

function testimonialGrid(c: TemplateContext): BuilderSection {
  const t = (q: string, n: string, d: string) => column(4, [testimonial(q, n, d)], { style: card });
  return section(
    [
      row([column(12, [h("What our customers say after the job, not during it")])], { style: { align: "center", marginBottom: 24 } }),
      row(
        [
          t("They turned up exactly when they said, quoted on the spot and were done before lunch. I've already sent two neighbours their way.", "James R.", c.location),
          t("Honest about what we didn't need. That alone earned them every job we have from now on.", "Priya K.", "Repeat customer since 2022"),
          t("The daily photo updates meant I never had to chase anyone. First contractor I'd happily hire again.", "Tom & Ellie W.", "Full renovation"),
        ],
        { gap: 24 },
      ),
    ],
    { name: "Testimonials", style: wrap(1080, { bg: soft }) },
  );
}

function statsStrip(): BuilderSection {
  return section(
    [
      row(
        [column(3, [stat("4.9", "Average Google rating")]), column(3, [stat("1,200+", "Jobs completed")]), column(3, [stat("24h", "Quote turnaround")]), column(3, [stat("12 mo", "Workmanship guarantee")])],
        { gap: 24 },
      ),
    ],
    { name: "Stats", style: { padTop: 56, padBottom: 56, maxWidth: 1080, align: "center", bg: "#ffffff", borderWidth: 1, borderColor: "#e9e7e1" } },
  );
}

function logoBar(): BuilderSection {
  return section(
    [
      row([column(12, [muted("Trusted by local businesses and featured in", { fontSize: 14 }), { id: uid("e"), type: "logos", names: ["Northwind", "Harbor & Co", "Brightside", "Summit Group", "Oakline"] }])]),
    ],
    { name: "Logo bar", style: { padTop: 48, padBottom: 48, maxWidth: 1080, align: "center" } },
  );
}

function pricing3(c: TemplateContext): BuilderSection {
  const tier = (name: string, price: string, blurb: string, features: string[], featured = false): BuilderElement => ({
    id: uid("e"),
    type: "pricing",
    name,
    price,
    period: "/month",
    blurb,
    features,
    buttonLabel: `Choose ${name}`,
    action: "next",
    featured,
  });
  return section(
    [
      row([column(12, [h("Simple plans. Cancel any time."), muted(`Pick the level of care that fits. Every ${c.name} plan includes priority booking.`, { fontSize: 18 })])], { style: { align: "center", marginBottom: 28 } }),
      row(
        [
          column(4, [tier("Essential", "$29", "For keeping on top of the basics.", ["One annual inspection", "Priority booking", "10% off repairs"])], { style: card }),
          column(4, [tier("Plus", "$59", "Our most popular plan.", ["Two inspections a year", "Same-week booking", "15% off repairs", "No call-out fees"], true)], { style: featuredCard }),
          column(4, [tier("Complete", "$99", "Total peace of mind.", ["Quarterly inspections", "Same-day emergency line", "20% off repairs", "No call-out fees", "Parts covered up to $250"])], { style: card }),
        ],
        { gap: 24 },
      ),
    ],
    { name: "Pricing", style: wrap(1080) },
  );
}

function pricingSingle(c: TemplateContext): BuilderSection {
  return section(
    [
      row([
        column(
          12,
          [
            h(`The ${c.name} starter package`, "h3"),
            { id: uid("e"), type: "headline", tag: "h2", text: "$197", style: { fontSize: 56, marginTop: 4 } },
            muted("One payment. No subscription."),
            divider({ marginTop: 16, marginBottom: 16 }),
            list(["Full assessment and written plan", "Two follow-up sessions", "Templates and checklists to keep", "Email support for 60 days", "30-day money-back guarantee"]),
            spacer(8),
            btn("Get started today", "next", { full: true }),
          ],
          { style: featuredCard },
        ),
      ]),
    ],
    { name: "Single offer", style: wrap(520, { align: "center" }) },
  );
}

function orderTwoColumn(c: TemplateContext): BuilderSection {
  return section(
    [
      row(
        [
          column(
            6,
            [
              h("Here's everything you get", "h3"),
              list([`The complete ${c.name} program, yours to keep`, "Step-by-step video lessons you can watch at your own pace", "Done-for-you templates and checklists", "Private community and monthly live Q&A"]),
              divider({ marginTop: 12, marginBottom: 12 }),
              testimonial("Paid for itself in the first week. The templates alone saved me a weekend.", "Dana L.", "Customer"),
            ],
            { valign: "top" },
          ),
          column(
            6,
            [
              h("Complete your order", "h4"),
              {
                id: uid("e"),
                type: "order",
                products: [product(`${c.name} complete program`, 9700)],
                bump: { product: product("Add the quick-start workshop recording", 2700), pitch: "Yes, add the 90-minute workshop. Most people finish setup the same afternoon. One-time offer, not available later." },
                buttonLabel: "Complete my order",
                guarantee: "30-day money-back guarantee. Secure checkout.",
              },
            ],
            { style: cardMd },
          ),
        ],
        { gap: 48 },
      ),
    ],
    { name: "Order form", style: wrap(1080, { bg: soft }) },
  );
}

function upsellSection(c: TemplateContext): BuilderSection {
  return section(
    [
      row([
        column(12, [
          { id: uid("e"), type: "progress", value: 80, label: "Your order is almost complete" },
          spacer(16),
          h("Wait. Want us to do the setup for you?", "h1", { fontSize: 46 }),
          muted(`Most people who buy the program get stuck on the setup. For a one-time fee, the ${c.name} team will do it for you within five business days, so you start with everything already working.`, { fontSize: 18 }),
          list(["Full setup done for you", "A 30-minute handover call", "Fixes for anything that breaks in the first 30 days"]),
        ]),
      ]),
      row([
        column(12, [{ id: uid("e"), type: "upsell", product: product("Done-for-you setup", 19700), yesLabel: "Yes, set it up for me", noLabel: "No thanks, I'll do it myself" }], { style: { ...cardMd, marginTop: 16 } }),
      ]),
    ],
    { name: "One-click upsell", style: wrap(720, { align: "center" }) },
  );
}

function urgencyBar(): BuilderSection {
  return section(
    [
      row(
        [
          column(7, [p("This launch price ends when the timer hits zero.", { weight: 600, fontSize: 17 })], { valign: "center" }),
          column(5, [countdown(15, "The launch price has ended.", { color: "#ffffff" })], { valign: "center" }),
        ],
        { gap: 16 },
      ),
    ],
    { name: "Urgency bar", style: { padTop: 18, padBottom: 18, maxWidth: 960, bg: "var(--lb-primary)", color: "#ffffff", align: "center" } },
  );
}

function optinCard(c: TemplateContext): BuilderSection {
  return section(
    [
      row([
        column(
          12,
          [
            h("Get the free checklist", "h3"),
            muted(`The same 20-point checklist the ${c.name} team uses on every visit.`),
            spacer(4),
            form([field("first_name", "First name"), field("email", "Email")], "Send me the checklist", "We'll never share your email."),
          ],
          { style: cardMd },
        ),
      ]),
    ],
    { name: "Opt-in form", style: wrap(560, { align: "center" }) },
  );
}

function applicationForm(c: TemplateContext): BuilderSection {
  return section(
    [
      row([column(12, [h("Apply to work with us"), muted(`We take on a handful of new clients each month so every one gets real attention. Tell us about your situation and someone from ${c.name} will reply within one business day.`)])], { style: { align: "center", marginBottom: 20 } }),
      row([
        column(
          12,
          [
            form(
              [field("name", "Full name"), field("email", "Email"), field("phone", "Phone"), field("company", "Business name", false), field("website", "Website", false), field("message", "What would you like help with, and by when?")],
              "Submit my application",
              "Takes about two minutes. We read every one.",
            ),
          ],
          { style: cardMd },
        ),
      ]),
    ],
    { name: "Application form", style: wrap(640) },
  );
}

function ctaDark(c: TemplateContext): BuilderSection {
  return section(
    [
      row([
        column(12, [
          h(`Ready when you are, ${c.location}`),
          p(`Tell us what you need and ${c.name} will come back with a fixed price within 24 hours. No obligation, no pushy follow-up.`, { color: "#c9cad6", fontSize: 18 }),
          spacer(8),
          btn("Get my free quote", "scroll", { href: "#form" }),
        ]),
      ]),
    ],
    { name: "Call to action", style: wrap(760, { align: "center", bg: dark, color: "#ffffff" }) },
  );
}

function ctaCountdown(): BuilderSection {
  return section(
    [
      row([
        column(12, [
          h("Your discount is reserved for the next 15 minutes"),
          muted("After that the price goes back up and the bonuses come off the table.", { fontSize: 18 }),
          countdown(15, "Your reserved discount has expired.", { marginTop: 12, marginBottom: 20 }),
          btn("Claim my discount", "next"),
        ]),
      ]),
    ],
    { name: "Countdown offer", style: wrap(720, { align: "center", bg: soft }) },
  );
}

function faqSection(c: TemplateContext): BuilderSection {
  return section(
    [
      row([column(12, [h("Questions we get every week", "h2", { align: "center" })])], { style: { marginBottom: 16 } }),
      row([
        column(12, [
          {
            id: uid("e"),
            type: "faq",
            items: [
              { q: "How quickly can you start?", a: "Most jobs start within one to two weeks of saying yes. Urgent work is often same week." },
              { q: "Is the quote really fixed?", a: "Yes. The written price is the price, unless you ask us to change the scope." },
              { q: `Do you cover all of ${c.location}?`, a: `We work across ${c.location} and the surrounding area. If you're unsure, ask and we'll tell you straight away.` },
              { q: "What if something goes wrong after you leave?", a: "Every job carries a 12-month workmanship guarantee. Call us and we come back to fix it at no charge." },
              { q: "How do I pay?", a: "A small deposit to book, the rest when you've signed off the finished work. Card or bank transfer." },
            ],
          },
        ]),
      ]),
    ],
    { name: "FAQ", style: wrap(760) },
  );
}

function footerSimple(c: TemplateContext): BuilderSection {
  return section(
    [
      row(
        [
          column(6, [p(c.name, { weight: 600 }), muted(`${c.industry} · ${c.location}`, { fontSize: 14 })], { valign: "center" }),
          column(6, [muted(`© ${new Date().getFullYear()} ${c.name}. All rights reserved.`, { fontSize: 14, align: "right" })], { valign: "center", mobile: { align: "left" } }),
        ],
        { gap: 16 },
      ),
    ],
    { name: "Footer", style: { padTop: 36, padBottom: 36, maxWidth: 1080, borderWidth: 1, borderColor: "#e9e7e1" } },
  );
}

export const sectionTemplates: SectionTemplate[] = [
  { key: "hero-centered", label: "Hero, centered", group: "Hero", build: heroCentered },
  { key: "hero-split-image", label: "Hero with image", group: "Hero", build: heroSplitImage },
  { key: "hero-split-form", label: "Hero with opt-in card", group: "Hero", build: heroSplitForm },
  { key: "hero-dark-image", label: "Hero over photo", group: "Hero", build: heroDarkImage },
  { key: "hero-video", label: "Hero with video", group: "Hero", build: heroVideo },
  { key: "features-3", label: "Three features", group: "Features", build: features3 },
  { key: "features-alternating", label: "Image and text, alternating", group: "Features", build: featuresAlternating },
  { key: "benefit-checklist", label: "Benefit checklist", group: "Features", build: benefitChecklist },
  { key: "testimonial-single", label: "Single testimonial", group: "Social proof", build: testimonialSingle },
  { key: "testimonial-grid", label: "Three testimonials", group: "Social proof", build: testimonialGrid },
  { key: "stats-strip", label: "Stats strip", group: "Social proof", build: statsStrip },
  { key: "logo-bar", label: "Logo bar", group: "Social proof", build: logoBar },
  { key: "pricing-3", label: "Three pricing tiers", group: "Pricing", build: pricing3 },
  { key: "pricing-single", label: "Single offer", group: "Pricing", build: pricingSingle },
  { key: "order-two-column", label: "Order form, two columns", group: "Sell", build: orderTwoColumn },
  { key: "upsell", label: "One-click upsell", group: "Sell", build: upsellSection },
  { key: "urgency-bar", label: "Countdown bar", group: "Sell", build: urgencyBar },
  { key: "optin-card", label: "Opt-in card", group: "Forms", build: optinCard },
  { key: "application", label: "Application form", group: "Forms", build: applicationForm },
  { key: "cta-dark", label: "Dark call to action", group: "Call to action", build: ctaDark },
  { key: "cta-countdown", label: "Call to action with timer", group: "Call to action", build: ctaCountdown },
  { key: "faq", label: "FAQ", group: "FAQ", build: faqSection },
  { key: "footer", label: "Simple footer", group: "Footer", build: footerSimple },
];

/* ------------------------------ funnels ------------------------------ */

export interface FunnelTemplateDef {
  key: string;
  label: string;
  blurb: string;
  mode: "marketing" | "fundraising" | "both";
  steps: { name: string; kind: FunnelStepKind }[];
  build: (ctx: TemplateContext) => FunnelStep[];
}

const doc = (...sections: BuilderSection[]): BuilderDoc => ({ v: 1, sections });
const step = (name: string, path: string, kind: FunnelStepKind, d: BuilderDoc): FunnelStep => ({ id: uid("s"), name, path, kind, blocks: [], doc: d });

/** A centred confirmation block with an optional follow-on element. */
function confirmation(headline: string, body: string, after: BuilderElement[] = []): BuilderSection {
  return section([row([column(12, [h(headline, "h1", { fontSize: 46 }), muted(body, { fontSize: 18 }), ...after])])], { name: "Confirmation", style: wrap(700, { align: "center", padTop: 120, padBottom: 120 }) });
}

function formSection(headline: string, body: string, el: BuilderElement, bg?: string): BuilderSection {
  return section([row([column(12, [h(headline, "h3"), muted(body), spacer(4), el], { style: cardMd })])], { name: "Form", style: wrap(560, { align: "left", bg }) });
}

function leadMagnet(c: TemplateContext): FunnelStep[] {
  return [
    step("Opt-in", "", "optin", doc(heroSplitForm(c), statsStrip(), testimonialSingle(c), footerSimple(c))),
    step(
      "Thank you",
      "thank-you",
      "thankyou",
      doc(
        confirmation("Check your inbox. Your guide is on its way.", "It can take a minute or two. If you can't see it, look in your promotions or spam folder and drag it into your inbox so the next one lands properly.", [
          spacer(12),
          h("Want a second opinion on your project?", "h4"),
          muted(`Book a free 15-minute call with ${c.name} and we'll tell you what we'd do in your shoes.`),
          btn("Book a free call", "link", { href: "#", variant: "outline", size: "md" }),
        ]),
        footerSimple(c),
      ),
    ),
  ];
}

function webinar(c: TemplateContext): FunnelStep[] {
  const reg = section(
    [
      row(
        [
          column(
            7,
            [
              h(`Free live training: how ${c.location} ${trade(c.industry)} businesses are booking 30% more jobs without more ads`, "h1", { fontSize: 44 }),
              muted("A 45-minute session with real numbers from real local businesses. Stay to the end for the live Q&A.", { fontSize: 18 }),
              list(["The follow-up sequence that wins back half of the quotes you lose", "Why your missed calls cost more than your ad spend", "The one page that does the selling before you arrive"], "arrow"),
            ],
            { valign: "center" },
          ),
          column(
            5,
            [
              h("Save my seat", "h3"),
              muted("Thursday at 12pm. Seats are limited to 100."),
              countdown(60 * 24, "Registration has closed.", { marginTop: 8, marginBottom: 8 }),
              form([field("first_name", "First name"), field("email", "Email")], "Register free", "We'll send the link and a reminder an hour before."),
            ],
            { style: cardMd, valign: "center" },
          ),
        ],
        { gap: 48 },
      ),
    ],
    { name: "Registration", style: wrap(1120, { bg: soft }) },
  );
  return [
    step("Registration", "", "webinar", doc(reg, features3(c), faqSection(c), footerSimple(c))),
    step(
      "Confirmation",
      "confirmed",
      "thankyou",
      doc(
        confirmation("You're registered. See you Thursday.", "The joining link is in your inbox. Add it to your calendar now so you don't miss the start; the best part is the first ten minutes.", [
          spacer(8),
          countdown(60 * 24, "We're live now. Check your email for the link.", { marginTop: 8 }),
        ]),
        footerSimple(c),
      ),
    ),
  ];
}

function productFunnel(c: TemplateContext): FunnelStep[] {
  return [
    step("Sales page", "", "sales", doc(heroDarkImage(c), featuresAlternating(c), testimonialGrid(c), pricingSingle(c), faqSection(c), footerSimple(c))),
    step("Order form", "order", "order", doc(urgencyBar(), orderTwoColumn(c), footerSimple(c))),
    step("Upsell", "upsell", "upsell", doc(upsellSection(c))),
    step(
      "Thank you",
      "thank-you",
      "thankyou",
      doc(confirmation("Your order is confirmed.", "Your receipt and login details are on their way to your inbox. Start with lesson one; it takes 12 minutes and gets you your first result today."), footerSimple(c)),
    ),
  ];
}

function bookCall(c: TemplateContext): FunnelStep[] {
  return [
    step("Application", "", "application", doc(heroCentered(c), benefitChecklist(c), applicationForm(c), footerSimple(c))),
    step(
      "Book a call",
      "book",
      "custom",
      doc(
        section(
          [
            row([column(12, [h("Thanks. Now pick a time that suits you.", "h1", { fontSize: 44 }), muted("A 30-minute video call. We'll review your answers beforehand so we can spend the time on solutions.", { fontSize: 18 })])], { style: { align: "center", marginBottom: 24 } }),
            row([column(12, [{ id: uid("e"), type: "calendar", calendarSlug: "" }], { style: cardMd })]),
          ],
          { name: "Calendar", style: wrap(820) },
        ),
      ),
    ),
    step(
      "Confirmed",
      "confirmed",
      "thankyou",
      doc(confirmation("Your call is booked.", `A calendar invite is on its way. Before we talk, jot down the one result that would make the next 90 days a win for you. The ${c.name} team will take it from there.`), footerSimple(c)),
    ),
  ];
}

function quoteFunnel(c: TemplateContext): FunnelStep[] {
  return [
    step(
      "Free quote",
      "",
      "optin",
      doc(
        heroSplitImage(c),
        statsStrip(),
        features3(c),
        testimonialSingle(c),
        formSection(
          "Tell us about the job",
          "Takes a minute. We call back within the hour on weekdays.",
          form([field("name", "Full name"), field("phone", "Phone"), field("email", "Email"), field("address", "Job address", false), field("message", "What needs doing?", false)], "Get my free quote", "No spam, no pressure. We only call about your quote."),
          soft,
        ),
        footerSimple(c),
      ),
    ),
    step("Thank you", "thank-you", "thankyou", doc(confirmation("Thanks. We're on it.", `Someone from ${c.name} will call you within the hour on weekdays, or first thing tomorrow if it's after 5pm.`), footerSimple(c))),
  ];
}

function bookingFunnel(c: TemplateContext): FunnelStep[] {
  return [
    step(
      "Book a visit",
      "",
      "optin",
      doc(
        section(
          [
            row(
              [
                column(
                  6,
                  [
                    h(`Book your ${c.location} visit in under a minute`, "h1", { fontSize: 46 }),
                    muted(`Pick a time that suits you and ${c.name} will confirm by text. Evening and Saturday slots available.`, { fontSize: 18 }),
                    list(["Free, no-obligation visit", "Text confirmation and reminder", "Reschedule any time with one tap"]),
                  ],
                  { valign: "center" },
                ),
                column(6, [img(photos.shopCounter, `The ${c.name} team`)], { valign: "center" }),
              ],
              { gap: 48 },
            ),
          ],
          { name: "Hero", style: wrap(1120) },
        ),
        section([row([column(12, [h("Choose a time", "h3", { align: "center" }), { id: uid("e"), type: "calendar", calendarSlug: "" }], { style: cardMd })])], { name: "Calendar", style: wrap(820, { bg: soft }) }),
        testimonialGrid(c),
        footerSimple(c),
      ),
    ),
    step("Confirmed", "confirmed", "thankyou", doc(confirmation("You're booked in.", "We've sent a text and an email with the details. Need to change it? Use the link in either message."), footerSimple(c))),
  ];
}

function appealFunnel(c: TemplateContext): FunnelStep[] {
  return [
    step(
      "Donation appeal",
      "",
      "optin",
      doc(
        section([row([column(12, [h(`Help ${c.name} reach every family in ${c.location} this winter`, "h1"), p("Last year 1 in 6 families we met went without a hot meal at least once a week. Your gift changes that this month.", { fontSize: 19, color: "#e7e6ef" }), spacer(12), btn("Give now", "scroll", { href: "#form" })])])], {
          name: "Hero",
          style: wrap(820, { align: "center", padTop: 140, padBottom: 140, color: "#ffffff", bg: dark, bgImage: photos.volunteers, overlay: 0.58 }),
        }),
        section(
          [
            row([column(12, [{ id: uid("e"), type: "progress", value: 68, label: "$34,000 raised of our $50,000 goal" }])], { style: { marginBottom: 32 } }),
            row(
              [
                column(4, [stat("$25", "Feeds a family for a week")], { style: card }),
                column(4, [stat("$60", "Stocks a pantry shelf for a month")], { style: card }),
                column(4, [stat("$150", "Funds a volunteer driver route")], { style: card }),
              ],
              { gap: 24 },
            ),
          ],
          { name: "Impact", style: wrap(1000, { align: "center" }) },
        ),
        section(
          [
            row(
              [
                column(6, [img(photos.volunteerHospital, "A volunteer at work")], { valign: "center" }),
                column(
                  6,
                  [
                    h("Every dollar stays local", "h3"),
                    muted(`${c.name} is run by volunteers from ${c.location}. 92 cents of every dollar goes straight to food, transport and the families who need it.`),
                    testimonial("When my hours were cut, they were there within a day. No forms, no judgement.", "Maria", "Helped in 2025"),
                  ],
                  { valign: "center" },
                ),
              ],
              { gap: 48 },
            ),
          ],
          { name: "Story", style: wrap(1080, { bg: soft }) },
        ),
        formSection(
          "Make your gift",
          "Secure and tax-deductible. You'll get a receipt by email.",
          form([field("amount", "Gift amount"), field("name", "Full name"), field("email", "Email")], "Give now", "Your details are only used to send your receipt and an update on the impact."),
        ),
        footerSimple(c),
      ),
    ),
    step(
      "Thank you",
      "thank-you",
      "thankyou",
      doc(
        confirmation("Thank you. You just made this winter easier for a family.", `Your receipt is on its way. In a few weeks we'll email you a short update showing exactly where your gift went. With gratitude, everyone at ${c.name}.`, [
          spacer(8),
          btn("Share the appeal", "link", { href: "#", variant: "outline", size: "md" }),
        ]),
        footerSimple(c),
      ),
    ),
  ];
}

function tripwire(c: TemplateContext): FunnelStep[] {
  const orderPage = section(
    [
      row(
        [
          column(
            6,
            [
              h(`The ${c.industry} quick-start kit, today only $7`, "h1", { fontSize: 42 }),
              muted("The exact checklists, scripts and templates we use with every client, for less than a coffee and a sandwich.", { fontSize: 18 }),
              img(photos.laptopDesk, "The quick-start kit on a laptop", "16/9", { marginTop: 8, marginBottom: 8 }),
              list(["27 ready-to-use templates", "The 5-minute weekly review sheet", "Lifetime updates included"]),
            ],
            { valign: "top" },
          ),
          column(
            6,
            [
              countdown(15, "The $7 price has ended.", { marginBottom: 12 }),
              {
                id: uid("e"),
                type: "order",
                products: [product("Quick-start kit", 700)],
                bump: { product: product("Add the video walkthroughs", 1900), pitch: "Yes, add 6 short videos that show each template being filled in. Only available on this page." },
                buttonLabel: "Get instant access for $7",
                guarantee: "Love it or get every cent back within 30 days.",
              },
            ],
            { style: cardMd },
          ),
        ],
        { gap: 48 },
      ),
    ],
    { name: "Order", style: wrap(1080, { bg: soft }) },
  );
  const downsell = section(
    [
      row([
        column(12, [
          h("No problem. How about just the essentials?", "h1", { fontSize: 42 }),
          muted("Get the monthly toolkit on its own: new templates every month and the members-only Q&A. Cancel any time.", { fontSize: 18 }),
        ]),
      ]),
      row([column(12, [{ id: uid("e"), type: "upsell", product: product("Monthly toolkit", 1900, "month"), yesLabel: "Yes, add the monthly toolkit", noLabel: "No thanks, take me to my order" }], { style: { ...cardMd, marginTop: 16 } })]),
    ],
    { name: "Downsell", style: wrap(700, { align: "center" }) },
  );
  return [
    step("Order form", "", "order", doc(orderPage, testimonialGrid(c), footerSimple(c))),
    step("Upsell", "upsell", "upsell", doc(upsellSection(c))),
    step("Downsell", "downsell", "downsell", doc(downsell)),
    step("Thank you", "thank-you", "thankyou", doc(confirmation("You're in. Check your inbox.", "Your download link and receipt are on their way. Start with the weekly review sheet; it takes five minutes."), footerSimple(c))),
  ];
}

export const funnelTemplates: FunnelTemplateDef[] = [
  {
    key: "lead-magnet",
    label: "Lead magnet",
    blurb: "Offer a free guide in exchange for an email, then thank them and invite a call.",
    mode: "both",
    steps: [
      { name: "Opt-in", kind: "optin" },
      { name: "Thank you", kind: "thankyou" },
    ],
    build: leadMagnet,
  },
  {
    key: "webinar",
    label: "Webinar",
    blurb: "Registration page with a countdown and a confirmation page that gets them to show up.",
    mode: "marketing",
    steps: [
      { name: "Registration", kind: "webinar" },
      { name: "Confirmation", kind: "thankyou" },
    ],
    build: webinar,
  },
  {
    key: "product",
    label: "Product launch",
    blurb: "Long sales page, order form with an order bump, a one-click upsell and a thank-you page.",
    mode: "marketing",
    steps: [
      { name: "Sales page", kind: "sales" },
      { name: "Order form", kind: "order" },
      { name: "Upsell", kind: "upsell" },
      { name: "Thank you", kind: "thankyou" },
    ],
    build: productFunnel,
  },
  {
    key: "book-call",
    label: "Application and call",
    blurb: "Qualify people with an application, then let the good fits book a call straight away.",
    mode: "marketing",
    steps: [
      { name: "Application", kind: "application" },
      { name: "Book a call", kind: "custom" },
      { name: "Confirmed", kind: "thankyou" },
    ],
    build: bookCall,
  },
  {
    key: "quote",
    label: "Free quote",
    blurb: "Hero, proof, a short quote form and a thank-you page. The local lead-gen default.",
    mode: "marketing",
    steps: [
      { name: "Free quote", kind: "optin" },
      { name: "Thank you", kind: "thankyou" },
    ],
    build: quoteFunnel,
  },
  {
    key: "booking",
    label: "Book a visit",
    blurb: "A short pitch and a booking calendar on one page, then a confirmation.",
    mode: "marketing",
    steps: [
      { name: "Book a visit", kind: "optin" },
      { name: "Confirmed", kind: "thankyou" },
    ],
    build: bookingFunnel,
  },
  {
    key: "appeal",
    label: "Donation appeal",
    blurb: "A story-led appeal with a progress bar, impact cards and a donation form.",
    mode: "fundraising",
    steps: [
      { name: "Donation appeal", kind: "optin" },
      { name: "Thank you", kind: "thankyou" },
    ],
    build: appealFunnel,
  },
  {
    key: "tripwire",
    label: "Tripwire offer",
    blurb: "A low-price order page with a bump, then an upsell, a downsell and a thank-you page.",
    mode: "marketing",
    steps: [
      { name: "Order form", kind: "order" },
      { name: "Upsell", kind: "upsell" },
      { name: "Downsell", kind: "downsell" },
      { name: "Thank you", kind: "thankyou" },
    ],
    build: tripwire,
  },
  {
    key: "blank",
    label: "Blank",
    blurb: "One empty page. Build it from sections and elements.",
    mode: "both",
    steps: [{ name: "Custom page", kind: "custom" }],
    build: () => [step("Custom page", "", "custom", emptyDoc())],
  },
];

export function funnelTemplate(key: string): FunnelTemplateDef {
  return funnelTemplates.find((t) => t.key === key) ?? funnelTemplates[funnelTemplates.length - 1];
}
