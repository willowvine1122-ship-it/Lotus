import type { Website, WebsiteBlock, WebsitePage } from "@/lib/types";
import { Block, FormCard } from "@/components/funnels/renderer";
import { BuilderPage, type RenderRefs } from "@/components/builder/render";
import { themeOf } from "@/components/builder/model";
import { cn } from "@/lib/utils";
import { pageHref } from "./model";

/*
 * One renderer for the editor preview and the public site: the site header
 * with navigation, the page's blocks (the funnel blocks plus an embedded
 * Lotus form), and the site footer. Internal links ("/contact") are resolved
 * against the site's base so they work on /s/<slug> and on a custom domain.
 */

export interface SiteFormRef {
  id: string;
  slug: string;
  name: string;
  live: boolean;
}

type SiteShape = Pick<
  Website,
  | "slug"
  | "name"
  | "brandColor"
  | "logoText"
  | "header"
  | "footer"
  | "pages"
  | "theme"
>;

function resolve(href: string | undefined, base: string) {
  if (!href) return href;
  if (href.startsWith("/") && !href.startsWith("//"))
    return `${base}${href === "/" ? "" : href}` || "/";
  return href;
}

function withBase(block: WebsiteBlock, base: string): WebsiteBlock {
  if (block.type === "hero" || block.type === "cta")
    return { ...block, buttonHref: resolve(block.buttonHref, base) };
  return block;
}

function LotusFormBlock({
  block,
  form,
  preview,
}: {
  block: Extract<WebsiteBlock, { type: "lotus_form" }>;
  form?: SiteFormRef;
  preview?: boolean;
}) {
  return (
    <section id="form" className="px-6 py-16 @md:py-20">
      <div className="mx-auto max-w-[760px]">
        {block.headline && (
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-[#0f1221] @md:text-3xl">
            {block.headline}
          </h2>
        )}
        {block.subhead && (
          <p className="mt-2 text-base text-[#4b4f63]">{block.subhead}</p>
        )}
        <div
          className={cn(
            "overflow-hidden rounded-xl border border-[#e9e7e1] bg-white shadow-[0_1px_2px_rgba(15,18,33,0.04),0_8px_24px_rgba(15,18,33,0.06)]",
            (block.headline || block.subhead) && "mt-6",
          )}
        >
          {form && form.live && !preview ? (
            <iframe
              src={`/form/${form.slug}?embed=1`}
              title={form.name}
              loading="lazy"
              className="block h-[560px] w-full border-0"
            />
          ) : (
            <div className="grid h-[320px] place-items-center px-6 text-center text-sm text-[#6b6f83]">
              {form
                ? form.live
                  ? `${form.name} shows here on the live site.`
                  : `${form.name} is in draft. Publish it in Forms to show it here.`
                : "Pick a form for this block."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function SitePage({
  site,
  page,
  base,
  forms = [],
  refs,
  formAction,
  preview,
  sent,
  selectedId,
  onSelectBlock,
}: {
  site: SiteShape;
  page: WebsitePage;
  /** "/s/<slug>" on Lotus, "" on a custom domain. */
  base: string;
  forms?: SiteFormRef[];
  /** Forms and calendars for pages designed in the builder. */
  refs?: RenderRefs;
  formAction?: (fd: FormData) => void | Promise<void>;
  preview?: boolean;
  sent?: boolean;
  selectedId?: string | null;
  onSelectBlock?: (id: string) => void;
}) {
  const blocks = page.blocks.map((b) => withBase(b, base));
  const hero = blocks[0];
  const splitForm =
    hero?.type === "hero" && hero.align === "split"
      ? blocks.find((b) => b.type === "form")
      : undefined;

  const render = (b: WebsiteBlock) =>
    b.type === "lotus_form" ? (
      <LotusFormBlock
        block={b}
        form={forms.find((f) => f.id === b.formId)}
        preview={preview}
      />
    ) : (
      <Block
        block={b}
        formAction={formAction}
        preview={preview}
        aside={
          b === hero && splitForm?.type === "form" ? (
            <SplitAside
              block={splitForm}
              formAction={formAction}
              preview={preview}
            />
          ) : undefined
        }
      />
    );

  return (
    <div
      className="@container flex min-h-full flex-col bg-[#faf9f6] font-sans text-[#0f1221] antialiased"
      style={{ ["--fb" as string]: site.brandColor }}
    >
      <SiteHeader site={site} page={page} base={base} />

      {sent && (
        <div
          role="status"
          className="border-b border-[#cfe6d8] bg-[#ecf7f0] px-6 py-3 text-center text-sm font-medium text-[#14532d]"
        >
          Thanks, we&apos;ve got your message and will be in touch shortly.
        </div>
      )}

      <main className="flex-1">
        {page.doc ? (
          <BuilderPage
            doc={page.doc}
            theme={themeOf(site.theme, site.brandColor)}
            refs={refs ?? { forms }}
            actions={{ form: formAction }}
            editing={preview}
          />
        ) : (
          <>
            {blocks
              .filter((b) => b !== splitForm)
              .map((b) =>
                onSelectBlock ? (
                  <div
                    key={b.id}
                    data-block={b.id}
                    onClick={() => onSelectBlock(b.id)}
                    className={cn(
                      "relative cursor-pointer outline-offset-[-2px] transition-[outline-color] duration-100",
                      selectedId === b.id
                        ? "outline outline-2 outline-[#7c3aed]"
                        : "hover:outline hover:outline-2 hover:outline-[#7c3aed]/40",
                    )}
                  >
                    {render(b)}
                  </div>
                ) : (
                  <div key={b.id}>{render(b)}</div>
                ),
              )}
            {blocks.length === 0 && (
              <p className="px-6 py-24 text-center text-sm text-[#6b6f83]">
                This page has no blocks yet.
              </p>
            )}
          </>
        )}
      </main>

      <SiteFooter site={site} base={base} />
    </div>
  );
}

function SplitAside({
  block,
  formAction,
  preview,
}: {
  block: Extract<WebsiteBlock, { type: "form" }>;
  formAction?: (fd: FormData) => void | Promise<void>;
  preview?: boolean;
}) {
  return <FormCard block={block} formAction={formAction} preview={preview} />;
}

/** The site's header and navigation, shared by the public site and the page builder canvas. */
export function SiteHeader({
  site,
  page,
  base,
}: {
  site: SiteShape;
  page?: Pick<WebsitePage, "id">;
  base: string;
}) {
  const nav = site.pages.filter((p) => p.inNav);
  const home = pageHref(site, { path: "" }, { base });
  return (
    <header className="sticky top-0 z-10 border-b border-[#e9e7e1] bg-[#faf9f6]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-6 px-6">
        <a
          href={home}
          className="truncate text-[17px] font-semibold tracking-tight text-[#0f1221]"
        >
          {site.logoText || site.name}
        </a>
        <nav
          aria-label="Main"
          className="ml-auto hidden items-center gap-1 @3xl:flex"
        >
          {nav.map((p) => (
            <a
              key={p.id}
              href={pageHref(site, p, { base })}
              aria-current={p.id === page?.id ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-[15px] transition-colors",
                p.id === page?.id
                  ? "font-medium text-[#0f1221]"
                  : "text-[#4b4f63] hover:text-[#0f1221]",
              )}
            >
              {p.title}
            </a>
          ))}
        </nav>
        {site.header.phone && (
          <a
            href={`tel:${site.header.phone.replace(/[^\d+]/g, "")}`}
            className="hidden text-[15px] font-medium text-[#0f1221] @5xl:block"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {site.header.phone}
          </a>
        )}
        {site.header.ctaLabel && (
          <a
            href={resolve(site.header.ctaHref, base) || "#form"}
            className="ml-auto hidden h-10 shrink-0 items-center rounded-md bg-[var(--fb)] px-4 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 @md:inline-flex @3xl:ml-0"
          >
            {site.header.ctaLabel}
          </a>
        )}
        {nav.length > 1 && (
          <details className="group relative ml-auto @md:ml-0 @3xl:hidden">
            <summary
              className="grid size-10 cursor-pointer list-none place-items-center rounded-md border border-[#e9e7e1] text-[#0f1221]"
              aria-label="Menu"
            >
              <span aria-hidden className="flex w-4 flex-col gap-[3px]">
                <span className="h-[1.5px] bg-current" />
                <span className="h-[1.5px] bg-current" />
                <span className="h-[1.5px] bg-current" />
              </span>
            </summary>
            <div className="absolute right-0 top-12 w-56 rounded-lg border border-[#e9e7e1] bg-white p-1.5 shadow-[0_8px_24px_rgba(15,18,33,0.12)]">
              {nav.map((p) => (
                <a
                  key={p.id}
                  href={pageHref(site, p, { base })}
                  className={cn(
                    "block rounded-md px-3 py-2.5 text-[15px]",
                    p.id === page?.id
                      ? "bg-[#f3f2ee] font-medium"
                      : "hover:bg-[#f7f6f2]",
                  )}
                >
                  {p.title}
                </a>
              ))}
              {site.header.ctaLabel && (
                <a
                  href={resolve(site.header.ctaHref, base) || "#form"}
                  className="mt-1 flex h-10 items-center justify-center rounded-md bg-[var(--fb)] text-[15px] font-semibold text-white @md:hidden"
                >
                  {site.header.ctaLabel}
                </a>
              )}
            </div>
          </details>
        )}
      </div>
    </header>
  );
}

export function SiteFooter({ site, base }: { site: SiteShape; base: string }) {
  const nav = site.pages.filter((p) => p.inNav);
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[#e9e7e1] bg-white">
      <div className="mx-auto grid max-w-[1120px] gap-8 px-6 py-12 @3xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="text-[17px] font-semibold tracking-tight">
            {site.logoText || site.name}
          </p>
          {site.footer.tagline && (
            <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-[#4b4f63]">
              {site.footer.tagline}
            </p>
          )}
        </div>
        {nav.length > 1 && (
          <nav aria-label="Footer">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b6f83]">
              Pages
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {nav.map((p) => (
                <li key={p.id}>
                  <a
                    href={pageHref(site, p, { base })}
                    className="text-[#4b4f63] hover:text-[#0f1221]"
                  >
                    {p.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {(site.footer.phone ||
          site.footer.email ||
          site.footer.address ||
          site.footer.hours) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b6f83]">
              Contact
            </p>
            <ul
              className="mt-3 flex flex-col gap-2 text-sm text-[#4b4f63]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {site.footer.phone && (
                <li>
                  <a
                    href={`tel:${site.footer.phone.replace(/[^\d+]/g, "")}`}
                    className="hover:text-[#0f1221]"
                  >
                    {site.footer.phone}
                  </a>
                </li>
              )}
              {site.footer.email && (
                <li>
                  <a
                    href={`mailto:${site.footer.email}`}
                    className="hover:text-[#0f1221]"
                  >
                    {site.footer.email}
                  </a>
                </li>
              )}
              {site.footer.address && <li>{site.footer.address}</li>}
              {site.footer.hours && <li>{site.footer.hours}</li>}
            </ul>
          </div>
        )}
      </div>
      <div className="border-t border-[#e9e7e1] px-6 py-5 text-center text-xs text-[#6b6f83]">
        © {year} {site.logoText || site.name} · Built with Lotus
      </div>
    </footer>
  );
}
