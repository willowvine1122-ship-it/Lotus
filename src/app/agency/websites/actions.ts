"use server";

import { withPublicWorkspace } from "@/lib/server/workspace";
import { currentSession, withWorkspace } from "@/lib/server/workspace";
import { canManageTeam } from "@/lib/server/auth";
import { IMAGE_URL } from "@/lib/assets";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hostError, normaliseHost, pathIssues, siteTemplates } from "@/components/websites/model";
import { formSubmitted } from "@/lib/data/automation-events";
import { upsertContact } from "@/lib/data/integrations";
import { addActivity, findClient } from "@/lib/data/store";
import { parseDoc, themeOf } from "@/components/builder/model";
import { checkDomain, createWebsite, deleteWebsite, findWebsite, recordLead, savePageDoc, saveWebsite, setDomain, setWebsiteStatus } from "@/lib/data/websites";

/* Websites actions. zod in, { ok, message } out, like the rest of Lotus. The public one is marked. */

export type SiteResult = { ok: boolean; message?: string; errors?: Record<string, string> };

function touch(id?: string) {
  revalidatePath("/agency/websites");
  if (id) revalidatePath(`/agency/websites/${id}`);
}

const fail = (err: z.ZodError): SiteResult => {
  const errors: Record<string, string> = {};
  for (const i of err.issues) errors[i.path.join(".") || "site"] ??= i.message;
  return { ok: false, errors, message: Object.values(errors)[0] };
};

const t = (max: number) => z.string().max(max);
const opt = (max: number) => z.string().max(max).optional();
const href = z
  .string()
  .max(500)
  .refine((v) => !v || /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(v), "Links start with /, #, https://, mailto: or tel:")
  .optional();
const id = z.string().min(1).max(80);

const block = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("hero"), eyebrow: opt(120), headline: t(200), subhead: opt(600), buttonLabel: opt(60), buttonHref: href, align: z.enum(["left", "center", "split"]).optional() }),
  z.object({ id, type: z.literal("form"), headline: t(200), subhead: opt(300), fields: z.array(z.enum(["name", "email", "phone", "address", "message", "amount"])).max(6), buttonLabel: t(60), note: opt(200) }),
  z.object({ id, type: z.literal("features"), headline: opt(200), items: z.array(z.object({ title: t(120), body: t(600) })).max(12) }),
  z.object({ id, type: z.literal("stats"), items: z.array(z.object({ value: t(30), label: t(80) })).max(6) }),
  z.object({ id, type: z.literal("testimonial"), quote: t(800), name: t(80), detail: opt(120) }),
  z.object({ id, type: z.literal("text"), headline: opt(200), body: t(5000) }),
  z.object({ id, type: z.literal("faq"), items: z.array(z.object({ q: t(200), a: t(1500) })).max(30) }),
  z.object({ id, type: z.literal("cta"), headline: t(200), body: opt(600), buttonLabel: t(60), buttonHref: href }),
  z.object({ id, type: z.literal("footer"), text: t(300) }),
  z.object({ id, type: z.literal("lotus_form"), formId: z.string().max(120), headline: opt(200), subhead: opt(300) }),
]);

const page = z.object({
  id,
  title: z.string().trim().min(1, "Give every page a title").max(60),
  path: z.string().max(60),
  inNav: z.boolean(),
  blocks: z.array(block).max(40),
  seo: z.object({ title: opt(70), description: opt(170), noindex: z.boolean().optional() }),
});

/** An uploaded image (/assets/…) or any https image link. */
const imageUrl = z.union([z.string().trim().regex(IMAGE_URL, "Use an uploaded image or a full https:// link"), z.literal("")]).optional();

const patch = z.object({
  name: z.string().trim().min(1, "Give the site a name").max(80),
  slug: z
    .string()
    .trim()
    .min(3, "The address needs at least 3 characters")
    .max(48)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes"),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #1f6fd1"),
  logoText: z.string().trim().max(60),
  logoImage: imageUrl,
  favicon: imageUrl,
  header: z.object({ ctaLabel: opt(40), ctaHref: href, phone: opt(30) }),
  footer: z.object({ tagline: opt(240), phone: opt(30), email: z.union([z.email("That email doesn't look right"), z.literal("")]).optional(), address: opt(160), hours: opt(160) }),
  seo: z.object({ siteTitle: z.string().trim().min(1, "Give the site a title for search").max(70), description: t(170), ogImage: z.union([z.url("Use a full https:// image link"), z.literal("")]).optional() }),
  analytics: z.object({
    gaId: z.union([z.string().regex(/^G-[A-Z0-9]{4,12}$/, "Google Analytics IDs look like G-XXXXXXX"), z.literal("")]).optional(),
    metaPixelId: z.union([z.string().regex(/^\d{8,20}$/, "Meta Pixel IDs are 8 to 20 digits"), z.literal("")]).optional(),
    headCode: z.string().max(20000, "Keep pasted code under 20,000 characters").optional(),
    bodyCode: z.string().max(20000, "Keep pasted code under 20,000 characters").optional(),
  }),
  pages: z.array(page).min(1, "A site needs a home page").max(30),
});

export async function createWebsiteAction(_prev: SiteResult | null, formData: FormData): Promise<SiteResult> {
  return withWorkspace(async () => {
    const p = z
      .object({ accountId: id, name: z.string().trim().min(1, "Give the site a name").max(80), template: z.string().refine((k) => siteTemplates.some((x) => x.key === k), "Pick a template") })
      .safeParse({ accountId: formData.get("accountId"), name: formData.get("name"), template: formData.get("template") });
    if (!p.success) return fail(p.error);
    const now = new Date();
    if (!findClient(now, p.data.accountId)) return { ok: false, errors: { accountId: "Pick a client" }, message: "Pick a client" };
    const site = createWebsite(now, p.data.accountId, p.data.name, p.data.template);
    if (!site) return { ok: false, message: "That client does not exist." };
    touch();
    redirect(`/agency/websites/${site.id}`);
  });
}

export async function saveWebsiteAction(siteId: string, input: unknown): Promise<SiteResult> {
  return withWorkspace(async () => {
    const p = patch.safeParse(input);
    if (!p.success) return fail(p.error);
    const issues = pathIssues(p.data.pages);
    const firstBad = Object.entries(issues)[0];
    if (firstBad) {
      const i = p.data.pages.findIndex((x) => x.id === firstBad[0]);
      return { ok: false, errors: { [`pages.${i}.path`]: firstBad[1] }, message: `${p.data.pages[i]!.title}: ${firstBad[1].toLowerCase()}` };
    }
    // Pasted code runs on the site's pages, so only owners and admins may change it.
    const before = findWebsite(new Date(), siteId);
    const codeChanged = (before?.analytics.headCode ?? "") !== (p.data.analytics.headCode ?? "") || (before?.analytics.bodyCode ?? "") !== (p.data.analytics.bodyCode ?? "");
    if (codeChanged && !canManageTeam(currentSession()?.role ?? null)) return { ok: false, errors: { "analytics.headCode": "Only the owner or an admin can change pasted code." }, message: "Only the owner or an admin can change pasted code." };
    const { site, slugTaken } = saveWebsite(new Date(), siteId, p.data);
    if (slugTaken) return { ok: false, errors: { slug: "Another site already uses this address" }, message: "Another site already uses this address" };
    if (!site) return { ok: false, message: "That site was deleted." };
    touch(site.id);
    revalidatePath(`/s/${site.slug}`, "layout");
    return { ok: true, message: "Saved" };
  });
}

export async function savePageDocAction(siteId: string, pageId: string, docJson: string, themeJson: string): Promise<SiteResult> {
  return withWorkspace(async () => {
    const doc = parseDoc(docJson);
    if (!doc) return { ok: false, message: "Could not read the page. Nothing was saved." };
    const now = new Date();
    let theme;
    try {
      theme = themeOf(JSON.parse(themeJson), findWebsite(now, siteId)?.brandColor ?? "#0f1221");
    } catch {
      return { ok: false, message: "Could not read the theme." };
    }
    const site = savePageDoc(now, siteId, pageId, doc, theme);
    if (!site) return { ok: false, message: "That page no longer exists." };
    touch(site.id);
    revalidatePath(`/s/${site.slug}`, "layout");
    return { ok: true, message: "Saved" };
  });
}

export async function setWebsiteStatusAction(siteId: string, status: "draft" | "live"): Promise<SiteResult> {
  return withWorkspace(async () => {
    const site = setWebsiteStatus(new Date(), z.string().max(80).parse(siteId), status);
    if (!site) return { ok: false, message: "That site was deleted." };
    touch(site.id);
    return { ok: true, message: status === "live" ? "Published. The site is live." : "Unpublished. Visitors see a not-found page." };
  });
}

export async function deleteWebsiteAction(siteId: string): Promise<void> {
  return withWorkspace(async () => {
    const now = new Date();
    const site = findWebsite(now, siteId);
    deleteWebsite(now, siteId);
    touch();
    redirect(`/agency/websites${site ? `?client=${site.accountId}` : ""}`);
  });
}

export async function setDomainAction(siteId: string, raw: string): Promise<SiteResult> {
  return withWorkspace(async () => {
    const host = normaliseHost(z.string().max(260).parse(raw));
    const err = hostError(host);
    if (err) return { ok: false, errors: { host: err }, message: err };
    const now = new Date();
    const r = setDomain(now, siteId, host);
    if (!r) return { ok: false, message: "That site was deleted." };
    if ("taken" in r) return { ok: false, errors: { host: "Another site already uses this domain" }, message: "Another site already uses this domain" };
    const d = await checkDomain(now, siteId);
    touch(siteId);
    return { ok: true, message: d?.status === "connected" ? `${host} is connected.` : `${host} added. Add the DNS record below, then check again.` };
  });
}

export async function checkDomainAction(siteId: string): Promise<SiteResult> {
  return withWorkspace(async () => {
    const d = await checkDomain(new Date(), z.string().max(80).parse(siteId));
    touch(siteId);
    if (!d) return { ok: false, message: "No domain to check." };
    return { ok: d.status === "connected", message: d.status === "connected" ? `${d.host} is connected.` : d.found };
  });
}

export async function removeDomainAction(siteId: string): Promise<SiteResult> {
  return withWorkspace(async () => {
    setDomain(new Date(), z.string().max(80).parse(siteId), null);
    touch(siteId);
    return { ok: true, message: "Domain removed. The site stays on its Lotus address." };
  });
}

/** Public: a visitor sent a contact form on a site page. */
export async function submitSiteFormAction(siteId: string, pageId: string, back: string, formData: FormData): Promise<void> {
  await withPublicWorkspace(`site-id:${siteId}`, async () => {
    const now = new Date();
    const site = findWebsite(now, siteId);
    const pg = site?.pages.find((p) => p.id === pageId);
    if (!site || site.status !== "live" || !pg) return;
    const values: Record<string, string> = {};
    for (const [k, v] of formData.entries()) if (typeof v === "string" && v.trim() && !k.startsWith("$")) values[k] = v.trim().slice(0, 1000);
    // Builder forms send first_name and last_name; the older blocks send name.
    const [firstName, ...rest] = (values.name ?? [values.first_name, values.last_name].filter(Boolean).join(" ")).split(/\s+/);
    const email = values.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) ? values.email.toLowerCase() : undefined;
    const { contact, created } = upsertContact(now, site.accountId, { firstName: firstName || undefined, lastName: rest.join(" ") || undefined, email, phone: values.phone, city: values.address }, "website", ["Website lead"]);
    if (contact) {
      addActivity(now, contact.id, {
        kind: values.amount ? "donation" : "form",
        title: values.amount ? `Pledged $${values.amount} on the ${pg.title} page` : `Sent the ${pg.title} form on the website`,
        body: values.message,
        by: "System",
      });
      formSubmitted(now, contact, `${site.name}: ${pg.title}`, created);
      recordLead(now, site.id);
    }
    revalidatePath("/agency/contacts");
    revalidatePath("/agency/websites");
    const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "/";
    redirect(`${safeBack}${safeBack.includes("?") ? "&" : "?"}sent=1`);
  });
}
