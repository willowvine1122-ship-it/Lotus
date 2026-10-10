import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import Script from "next/script";
import type { Website } from "@/lib/types";
import { submitSiteFormAction } from "@/app/agency/websites/actions";
import { listForms } from "@/lib/data/forms";
import { findPage, findWebsiteByHost, findWebsiteBySlug, recordView } from "@/lib/data/websites";
import { pageHref, siteUrl } from "./model";
import { builderRefs } from "@/components/builder/refs";
import { SitePage } from "./site";

/*
 * The public side of a website, shared by the Lotus address (/s/<slug>/…)
 * and the custom-domain route (/d/<host>/…, reached through src/proxy.ts).
 * "base" is the path prefix internal links get: "/s/<slug>" or "".
 */

export type SiteRef = { kind: "slug"; slug: string } | { kind: "host"; host: string };

function load(now: Date, ref: SiteRef) {
  return ref.kind === "slug" ? findWebsiteBySlug(now, ref.slug) : findWebsiteByHost(now, decodeURIComponent(ref.host));
}

const baseFor = (site: Website, ref: SiteRef) => (ref.kind === "slug" ? `/s/${site.slug}` : "");

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
}

export async function siteMetadata(ref: SiteRef, segments: string[] | undefined): Promise<Metadata> {
  await connection();
  const now = new Date();
  const site = load(now, ref);
  const page = site && findPage(site, segments);
  if (!site || !page || site.status !== "live") return { title: "Page not found", robots: { index: false } };
  const isHome = page.path === "";
  const title = page.seo.title || (isHome ? site.seo.siteTitle : `${page.title} | ${site.logoText || site.name}`);
  const description = page.seo.description || site.seo.description || undefined;
  const canonical = `${siteUrl(site, await origin())}${page.path ? `/${page.path}` : ""}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: page.seo.noindex ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url: canonical, siteName: site.logoText || site.name, type: "website", images: site.seo.ogImage ? [site.seo.ogImage] : undefined },
    twitter: { card: site.seo.ogImage ? "summary_large_image" : "summary", title, description },
  };
}

export async function SiteRoute({ refP, segments, sent }: { refP: SiteRef; segments: string[] | undefined; sent: boolean }) {
  await connection();
  const now = new Date();
  const site = load(now, refP);
  if (!site || site.status !== "live") notFound();
  const page = findPage(site, segments);
  if (!page) notFound();
  const base = baseFor(site, refP);
  const forms = listForms(now, site.accountId).map((f) => ({ id: f.id, slug: f.slug, name: f.name, live: f.status === "live" }));
  const back = pageHref(site, page, { base });
  after(() => recordView(new Date(), site.id, page.id));
  const { gaId, metaPixelId } = site.analytics;
  return (
    <div className="min-h-dvh">
      <SitePage site={site} page={page} base={base} forms={forms} refs={builderRefs(now, site.accountId)} sent={sent} formAction={submitSiteFormAction.bind(null, site.id, page.id, back)} />
      {gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${JSON.stringify(gaId)});`}</Script>
        </>
      )}
      {metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(metaPixelId)});fbq('track','PageView');`}</Script>
      )}
    </div>
  );
}

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

async function root(ref: SiteRef, site: Website) {
  return ref.kind === "slug" ? siteUrl(site, await origin()) : `https://${site.domain!.host}`;
}

export async function sitemapResponse(ref: SiteRef) {
  await connection();
  const site = load(new Date(), ref);
  if (!site || site.status !== "live") return new Response("Not found", { status: 404 });
  const r = await root(ref, site);
  const lastmod = site.updatedAt.slice(0, 10);
  const urls = site.pages
    .filter((p) => !p.seo.noindex)
    .map((p) => `  <url><loc>${xmlEscape(`${r}${p.path ? `/${p.path}` : ""}`)}</loc><lastmod>${lastmod}</lastmod><priority>${p.path ? "0.7" : "1.0"}</priority></url>`)
    .join("\n");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}

export async function robotsResponse(ref: SiteRef) {
  await connection();
  const site = load(new Date(), ref);
  if (!site || site.status !== "live") return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
  const r = await root(ref, site);
  const base = ref.kind === "slug" && site.domain?.status !== "connected" ? `/s/${site.slug}` : "";
  const blocked = site.pages.filter((p) => p.seo.noindex).map((p) => `Disallow: ${base}/${p.path}\n`).join("");
  return new Response(`User-agent: *\nAllow: /\n${blocked}\nSitemap: ${r}/sitemap.xml\n`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
}
