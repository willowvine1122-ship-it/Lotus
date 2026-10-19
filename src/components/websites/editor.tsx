"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  EyeOff,
  ExternalLink,
  FileText,
  Globe,
  LayoutTemplate,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  Field,
  Input,
  Select,
  Textarea,
  controlClass,
} from "@/components/form";
import { Button } from "@/components/page-header";
import { Segmented } from "@/components/diagnostic/primitives";
import {
  BlockFields,
  ScaledPreview,
  blockTypes,
} from "@/components/funnels/editor";
import type { SiteResult } from "@/app/agency/websites/actions";
import type {
  FunnelBlock,
  FunnelBlockType,
  Website,
  WebsiteBlock,
  WebsitePage,
} from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { newBlock } from "@/lib/data/funnel-blocks";
import {
  SITES_CNAME,
  blockId as newBlockId,
  hostError,
  normaliseHost,
  pageHref,
  pageId,
  pathIssues,
  slugifyPath,
  websiteBlockLabel,
  websiteBlockSummary,
  type ClientRef,
} from "./model";
import { SitePage, type SiteFormRef } from "./site";
import { SiteStatusTag, domainLabel } from "./ui";

/*
 * The website editor: pages and the selected page's blocks on the left, the
 * page as visitors see it in the middle (header, navigation and footer
 * included), and on the right the selected block, the page's settings, the
 * site's settings or its domain. The whole site is one draft; Save writes it.
 */

export interface SiteEditorActions {
  save: (siteId: string, input: unknown) => Promise<SiteResult>;
  setStatus: (siteId: string, status: "draft" | "live") => Promise<SiteResult>;
  remove: (siteId: string) => Promise<void>;
  setDomain: (siteId: string, host: string) => Promise<SiteResult>;
  checkDomain: (siteId: string) => Promise<SiteResult>;
  removeDomain: (siteId: string) => Promise<SiteResult>;
}

type Draft = Pick<
  Website,
  | "name"
  | "slug"
  | "brandColor"
  | "logoText"
  | "header"
  | "footer"
  | "seo"
  | "analytics"
  | "pages"
>;
type Pane = "block" | "page" | "site" | "domain";

const draftOf = (s: Website): Draft => ({
  name: s.name,
  slug: s.slug,
  brandColor: s.brandColor,
  logoText: s.logoText,
  header: s.header,
  footer: s.footer,
  seo: s.seo,
  analytics: s.analytics,
  pages: s.pages,
});

function RailButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium text-rail-fg hover:bg-rail-line disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid size-6 place-items-center rounded text-fg-3 transition-colors duration-100 disabled:opacity-30",
        danger
          ? "hover:bg-red-soft hover:text-red"
          : "hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function PaneHead({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {body && <p className="text-xs text-fg-3">{body}</p>}
      </div>
      {children}
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-3.5 shrink-0 accent-[var(--rail)]"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-fg-3">{hint}</span>}
      </span>
    </label>
  );
}

/** How the page looks in a Google result. */
function SearchPreview({
  url,
  title,
  description,
}: {
  url: string;
  title: string;
  description: string;
}) {
  const t = title.length > 60 ? `${title.slice(0, 59)}…` : title;
  const d =
    description.length > 158 ? `${description.slice(0, 157)}…` : description;
  return (
    <div className="rounded border border-line bg-surface px-3.5 py-3">
      <p className="num truncate text-xs text-fg-3">
        {url.replace(/^https?:\/\//, "")}
      </p>
      <p className="mt-0.5 truncate text-[15px] leading-5 text-[#1a0dab]">
        {t || "Page title"}
      </p>
      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-fg-2">
        {d || (
          <span className="text-fg-3">
            Add a description so search results show your words, not a guess.
          </span>
        )}
      </p>
    </div>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span
      className={cn(
        "num text-2xs",
        value.length > max ? "text-amber" : "text-fg-3",
      )}
    >
      {value.length}/{max}
    </span>
  );
}

/* ------------------------------- editor ------------------------------ */

export function WebsiteEditor({
  site,
  client,
  forms,
  origin,
  nowIso,
  initialPane,
  actions,
}: {
  site: Website;
  client: ClientRef;
  forms: SiteFormRef[];
  origin: string;
  nowIso: string;
  initialPane?: Pane;
  actions: SiteEditorActions;
}) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [baseline, setBaseline] = useState(() => JSON.stringify(draftOf(site)));
  const [draft, setDraft] = useState<Draft>(() => draftOf(site));
  const [pageIdSel, setPageIdSel] = useState(site.pages[0]?.id ?? "");
  const [blockSel, setBlockSel] = useState<string | null>(
    site.pages[0]?.blocks[0]?.id ?? null,
  );
  const [pane, setPane] = useState<Pane>(initialPane ?? "block");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [saving, startSave] = useTransition();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(
    null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newPage, setNewPage] = useState("");

  const page = draft.pages.find((p) => p.id === pageIdSel) ?? draft.pages[0]!;
  const pageIndex = draft.pages.indexOf(page);
  const block = page.blocks.find((b) => b.id === blockSel) ?? null;
  const unsaved = JSON.stringify(draft) !== baseline;
  const issues = pathIssues(draft.pages);
  const formName = (id: string) => forms.find((f) => f.id === id)?.name;
  const base = `/s/${draft.slug}`;
  const liveUrl = (p: Pick<WebsitePage, "path">) =>
    site.domain?.status === "connected"
      ? `https://${site.domain.host}${p.path ? `/${p.path}` : ""}`
      : `${origin}${pageHref({ slug: draft.slug }, p)}`;

  const flash = (text: string, bad?: boolean) => {
    setNotice({ text, bad });
    if (!bad)
      setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 2200);
  };

  /* ------------------------------ edits ------------------------------ */

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  const patchPage = (fn: (p: WebsitePage) => WebsitePage) =>
    setDraft((d) => ({
      ...d,
      pages: d.pages.map((p) => (p.id === page.id ? fn(p) : p)),
    }));
  const setBlocks = (blocks: WebsiteBlock[]) =>
    patchPage((p) => ({ ...p, blocks }));
  const updateBlock = (b: WebsiteBlock) =>
    setBlocks(page.blocks.map((x) => (x.id === b.id ? b : x)));
  const moveBlock = (id: string, dir: -1 | 1) => {
    const bs = [...page.blocks];
    const i = bs.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= bs.length) return;
    [bs[i], bs[j]] = [bs[j]!, bs[i]!];
    setBlocks(bs);
  };
  const removeBlock = (id: string) => {
    setBlocks(page.blocks.filter((b) => b.id !== id));
    if (blockSel === id) setBlockSel(null);
  };
  const addBlock = (type: FunnelBlockType | "lotus_form") => {
    const b: WebsiteBlock =
      type === "lotus_form"
        ? {
            id: newBlockId(),
            type,
            formId: forms.find((f) => f.live)?.id ?? forms[0]?.id ?? "",
            headline: "Tell us about your project",
          }
        : newBlock(type);
    const bs = [...page.blocks];
    const i = blockSel ? bs.findIndex((x) => x.id === blockSel) + 1 : bs.length;
    bs.splice(i, 0, b);
    setBlocks(bs);
    setBlockSel(b.id);
    setPane("block");
  };

  const selectPage = (id: string) => {
    setPageIdSel(id);
    setBlockSel(draft.pages.find((p) => p.id === id)?.blocks[0]?.id ?? null);
    if (pane === "block" || pane === "page") return;
    setPane("page");
  };
  const movePage = (id: string, dir: -1 | 1) =>
    setDraft((d) => {
      const ps = [...d.pages];
      const i = ps.findIndex((p) => p.id === id);
      const j = i + dir;
      // The home page stays first.
      if (i <= 0 || j <= 0 || j >= ps.length) return d;
      [ps[i], ps[j]] = [ps[j]!, ps[i]!];
      return { ...d, pages: ps };
    });
  const removePage = (p: WebsitePage) => {
    if (
      !confirm(
        `Remove the page "${p.title}"? Links to it stop working once you save.`,
      )
    )
      return;
    setDraft((d) => ({ ...d, pages: d.pages.filter((x) => x.id !== p.id) }));
    if (p.id === page.id) selectPage(draft.pages[0]!.id);
  };
  const addPage = () => {
    const title = newPage.trim();
    if (!title) return;
    const taken = new Set(draft.pages.map((p) => p.path));
    let path = slugifyPath(title) || "page";
    for (let n = 2; taken.has(path); n++)
      path = `${slugifyPath(title) || "page"}-${n}`;
    const p: WebsitePage = {
      id: pageId(),
      title,
      path,
      inNav: true,
      seo: {},
      blocks: [
        {
          id: newBlockId(),
          type: "hero",
          headline: title,
          subhead: "",
          align: "left",
        } as FunnelBlock,
      ],
    };
    setDraft((d) => ({ ...d, pages: [...d.pages, p] }));
    setPageIdSel(p.id);
    setBlockSel(p.blocks[0]!.id);
    setNewPage("");
  };

  /* ------------------------------ server ----------------------------- */

  const save = () =>
    startSave(async () => {
      const r = await actions.save(site.id, draft);
      setErrors(r.errors ?? {});
      if (!r.ok) {
        flash(r.message ?? "Couldn't save.", true);
        const bad = Object.keys(r.errors ?? {}).find((k) =>
          k.startsWith("pages."),
        );
        if (bad) {
          const p = draft.pages[Number(bad.split(".")[1])];
          if (p) {
            setPageIdSel(p.id);
            setPane("page");
          }
        } else if (r.errors && Object.keys(r.errors).length) setPane("site");
        return;
      }
      setBaseline(JSON.stringify(draft));
      flash("Saved");
      router.refresh();
    });

  const toggleStatus = () =>
    start(async () => {
      if (site.status === "draft" && unsaved) {
        const s = await actions.save(site.id, draft);
        if (!s.ok) return flash(s.message ?? "Couldn't save.", true);
        setBaseline(JSON.stringify(draft));
      }
      const r = await actions.setStatus(
        site.id,
        site.status === "live" ? "draft" : "live",
      );
      flash(r.message ?? "", !r.ok);
      router.refresh();
    });

  /* ------------------------------ preview ---------------------------- */

  // Links inside the preview switch pages here instead of leaving the editor.
  const onPreviewClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href") ?? "";
    if (!href.startsWith(base)) return;
    const path = href.slice(base.length).replace(/^\//, "").split(/[?#]/)[0];
    const target = draft.pages.find((p) => p.path === path);
    if (target && target.id !== page.id) selectPage(target.id);
  };

  const err = (k: string) => errors[k];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-rail px-5 py-3 text-rail-fg md:px-6">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold leading-6 tracking-tight">
            <span className="truncate">{draft.name}</span>
            <span className="[&>span]:bg-rail-2 [&>span]:text-rail-fg [&>span]:border-rail-line">
              <SiteStatusTag status={site.status} />
            </span>
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-rail-fg-2">
            <Link
              href={`/agency/websites?client=${client.id}`}
              className="inline-flex items-center gap-1 text-rail-fg hover:underline"
            >
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Websites
            </Link>
            <span>·</span>
            <Link
              href={`/agency/clients/${client.slug}`}
              className="hover:underline"
            >
              {client.name}
            </Link>
            <span className="hidden md:inline">·</span>
            <span className="num hidden md:inline">
              {draft.pages.length} pages · Updated{" "}
              {timeAgo(site.updatedAt, now)}
            </span>
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {notice && (
            <span
              className={cn(
                "max-w-[36ch] truncate text-xs",
                notice.bad ? "text-amber" : "text-rail-fg-2",
              )}
              role="status"
            >
              {notice.text}
            </span>
          )}
          {site.status === "live" && (
            <a
              href={liveUrl(page)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium text-rail-fg hover:bg-rail-line"
            >
              <ExternalLink className="size-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">View live</span>
            </a>
          )}
          <RailButton
            aria-pressed={pane === "domain"}
            onClick={() => setPane(pane === "domain" ? "block" : "domain")}
            className={cn(pane === "domain" && "bg-rail-line")}
          >
            <Globe className="size-3.5" strokeWidth={1.75} />
            <span className="hidden sm:inline">Domain</span>
            {site.domain && site.domain.status !== "connected" && (
              <span
                className="size-1.5 rounded-full bg-amber"
                aria-label="Needs attention"
              />
            )}
          </RailButton>
          <RailButton
            aria-pressed={pane === "site"}
            onClick={() => setPane(pane === "site" ? "block" : "site")}
            className={cn(pane === "site" && "bg-rail-line")}
          >
            <Settings2 className="size-3.5" strokeWidth={1.75} />
            <span className="hidden sm:inline">Site settings</span>
          </RailButton>
          <button
            type="button"
            disabled={pending || saving}
            onClick={toggleStatus}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded border px-2.5 text-xs font-medium transition-colors duration-150 disabled:opacity-60",
              site.status === "live"
                ? "border-rail-line bg-rail-2 text-rail-fg hover:bg-rail-line"
                : "border-rail-fg bg-rail-fg text-rail hover:bg-rail-fg/90",
            )}
          >
            {site.status === "live"
              ? "Unpublish"
              : unsaved
                ? "Save and publish"
                : "Publish"}
          </button>
          {unsaved || saving ? (
            <Button
              onClick={save}
              disabled={saving}
              className="h-7 px-3 text-xs"
            >
              {saving && (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
              )}
              {saving ? "Saving" : "Save"}
            </Button>
          ) : notice ? null : (
            <span className="px-1 text-xs text-rail-fg-2">Saved</span>
          )}
        </div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[260px_minmax(0,1fr)_360px] xl:grid-cols-[260px_minmax(0,1fr)_384px] 2xl:grid-cols-[260px_minmax(0,1fr)_420px]">
        {/* Pages and blocks */}
        <aside className="flex flex-col border-b border-line bg-surface lg:border-b-0 lg:border-r">
          <section className="border-b border-line px-4 py-4">
            <h2 className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
              Pages
            </h2>
            <ol className="mt-2 flex flex-col gap-0.5">
              {draft.pages.map((p, i) => {
                const active = p.id === page.id;
                return (
                  <li key={p.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => selectPage(p.id)}
                      onKeyDown={(e) => e.key === "Enter" && selectPage(p.id)}
                      className={cn(
                        "group flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors duration-100",
                        active ? "bg-rail text-rail-fg" : "hover:bg-surface-2",
                      )}
                    >
                      <FileText
                        className={cn(
                          "size-3.5 shrink-0",
                          active ? "text-rail-fg-2" : "text-fg-3",
                        )}
                        strokeWidth={1.75}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 truncate font-medium">
                          {p.title || "Untitled"}
                          {!p.inNav && (
                            <EyeOff
                              className="size-3 shrink-0 opacity-60"
                              strokeWidth={2}
                              aria-label="Not in navigation"
                            />
                          )}
                          {issues[p.id] && (
                            <span
                              className="size-1.5 shrink-0 rounded-full bg-amber"
                              aria-label={issues[p.id]}
                            />
                          )}
                        </span>
                        <span
                          className={cn(
                            "num block truncate text-2xs",
                            active ? "text-rail-fg-2" : "text-fg-3",
                          )}
                        >
                          /{p.path}
                        </span>
                      </span>
                      {i > 0 && (
                        <span
                          className={cn(
                            "flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
                            active &&
                              "[&_button]:text-rail-fg-2 [&_button:hover]:bg-rail-2 [&_button:hover]:text-rail-fg",
                          )}
                        >
                          <IconButton
                            label="Move up"
                            disabled={i <= 1}
                            onClick={() => movePage(p.id, -1)}
                          >
                            <ChevronUp className="size-3.5" strokeWidth={2} />
                          </IconButton>
                          <IconButton
                            label="Move down"
                            disabled={i === draft.pages.length - 1}
                            onClick={() => movePage(p.id, 1)}
                          >
                            <ChevronDown className="size-3.5" strokeWidth={2} />
                          </IconButton>
                          <IconButton
                            label="Remove page"
                            danger
                            onClick={() => removePage(p)}
                          >
                            <Trash2 className="size-3.5" strokeWidth={2} />
                          </IconButton>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            <form
              className="mt-2 flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                addPage();
              }}
            >
              <input
                aria-label="New page title"
                value={newPage}
                onChange={(e) => setNewPage(e.target.value)}
                placeholder="Add a page"
                maxLength={60}
                className={cn(controlClass, "h-8 text-xs")}
              />
              <button
                type="submit"
                disabled={!newPage.trim() || draft.pages.length >= 30}
                aria-label="Add page"
                className="grid size-8 shrink-0 place-items-center rounded border border-line-strong bg-surface text-fg-2 hover:bg-surface-2 hover:text-fg disabled:opacity-40"
              >
                <Plus className="size-4" strokeWidth={2} />
              </button>
            </form>
          </section>

          <section className="flex-1 px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="truncate text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
                Blocks on {page.title || "this page"}
              </h2>
              <button
                type="button"
                onClick={() => setPane("page")}
                className={cn(
                  "shrink-0 text-2xs font-medium hover:text-fg",
                  pane === "page" ? "text-fg" : "text-fg-2",
                )}
              >
                Page settings
              </button>
            </div>
            {site.pages.some((p) => p.id === page.id) ? (
              <Link
                href={`/agency/websites/${site.id}/builder/${page.id}`}
                className="mt-3 flex items-center gap-2.5 rounded border border-brand/30 bg-brand-soft/50 px-3 py-2.5 transition-colors hover:border-brand/60 hover:bg-brand-soft"
              >
                <LayoutTemplate
                  className="size-4 shrink-0 text-brand"
                  strokeWidth={1.75}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-fg">
                    {page.doc
                      ? "Edit in the page builder"
                      : "Design in the page builder"}
                  </span>
                  <span className="block text-2xs leading-4 text-fg-2">
                    {page.doc
                      ? "This page is built with sections and elements."
                      : "Drag and drop sections, rows and elements."}
                  </span>
                </span>
              </Link>
            ) : (
              <p className="mt-3 rounded border border-dashed border-line-strong px-3 py-2 text-2xs text-fg-3">
                Save the site to open this page in the page builder.
              </p>
            )}
            {!page.doc && (
              <ol className="mt-2 flex flex-col gap-0.5">
                {page.blocks.map((b, i) => {
                  const active = b.id === blockSel && pane === "block";
                  return (
                    <li key={b.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setBlockSel(b.id);
                          setPane("block");
                          document
                            .querySelector(`[data-block="${b.id}"]`)
                            ?.scrollIntoView({
                              block: "nearest",
                              behavior: "smooth",
                            });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setBlockSel(b.id);
                            setPane("block");
                          }
                        }}
                        className={cn(
                          "group flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors duration-100",
                          active ? "bg-brand-soft/60" : "hover:bg-surface-2",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium">
                            {websiteBlockLabel[b.type]}
                          </span>
                          <span className="block truncate text-xs text-fg-3">
                            {websiteBlockSummary(b, formName) || "Empty"}
                          </span>
                        </span>
                        <span className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <IconButton
                            label="Move up"
                            disabled={i === 0}
                            onClick={() => moveBlock(b.id, -1)}
                          >
                            <ChevronUp className="size-3.5" strokeWidth={2} />
                          </IconButton>
                          <IconButton
                            label="Move down"
                            disabled={i === page.blocks.length - 1}
                            onClick={() => moveBlock(b.id, 1)}
                          >
                            <ChevronDown className="size-3.5" strokeWidth={2} />
                          </IconButton>
                          <IconButton
                            label="Remove block"
                            danger
                            onClick={() => removeBlock(b.id)}
                          >
                            <Trash2 className="size-3.5" strokeWidth={2} />
                          </IconButton>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {!page.doc && (
              <label className="mt-2 block">
                <span className="sr-only">Add a block</span>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      addBlock(
                        e.target.value as FunnelBlockType | "lotus_form",
                      );
                  }}
                  className={cn(controlClass, "h-8 text-xs")}
                >
                  <option value="">Add a block…</option>
                  {blockTypes
                    .filter((t) => t !== "footer")
                    .map((t) => (
                      <option key={t} value={t}>
                        {websiteBlockLabel[t]}
                      </option>
                    ))}
                  <option value="lotus_form">
                    {websiteBlockLabel.lotus_form} (from Forms)
                  </option>
                </select>
              </label>
            )}
          </section>
        </aside>

        {/* Preview */}
        <section className="flex min-w-0 flex-col bg-surface-2">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2">
            <p className="num min-w-0 truncate text-xs text-fg-3">
              {liveUrl(page).replace(/^https?:\/\//, "")}
            </p>
            <Segmented
              tone="paper"
              label="Preview width"
              value={device}
              onChange={setDevice}
              options={[
                { value: "desktop", label: "Desktop" },
                { value: "phone", label: "Phone" },
              ]}
            />
          </div>
          <div
            className="flex-1 overflow-auto p-4 md:p-6"
            onClickCapture={onPreviewClick}
          >
            <ScaledPreview key={device} width={device === "phone" ? 390 : 1200}>
              <SitePage
                site={draft}
                page={page}
                base={base}
                forms={forms}
                preview
                selectedId={pane === "block" ? blockSel : null}
                onSelectBlock={(id) => {
                  setBlockSel(id);
                  setPane("block");
                }}
              />
            </ScaledPreview>
          </div>
        </section>

        {/* Inspector */}
        <aside className="border-t border-line bg-surface lg:border-l lg:border-t-0">
          <div className="flex flex-col gap-4 px-4 py-4">
            {pane === "block" &&
              (block ? (
                <>
                  <PaneHead
                    title={websiteBlockLabel[block.type]}
                    body="Changes show in the preview as you type."
                  >
                    <IconButton
                      label="Remove block"
                      danger
                      onClick={() => removeBlock(block.id)}
                    >
                      <Trash2 className="size-3.5" strokeWidth={2} />
                    </IconButton>
                  </PaneHead>
                  {block.type === "lotus_form" ? (
                    <LotusFormFields
                      block={block}
                      forms={forms}
                      onChange={updateBlock}
                    />
                  ) : (
                    <BlockFields
                      key={block.id}
                      block={block}
                      onChange={updateBlock}
                    />
                  )}
                  {(block.type === "hero" || block.type === "cta") && (
                    <p className="text-xs leading-relaxed text-fg-3">
                      Link to another page with its path, like /contact. Use
                      #form to jump to the form on this page.
                    </p>
                  )}
                </>
              ) : (
                <div className="py-10 text-center text-sm text-fg-3">
                  Pick a block on the page or in the list to edit it.
                </div>
              ))}

            {pane === "page" && (
              <>
                <PaneHead
                  title="Page settings"
                  body={
                    pageIndex === 0
                      ? "This is the home page."
                      : "Title, address and how search engines see it."
                  }
                />
                <Field
                  label="Title"
                  htmlFor="pg-title"
                  hint="Shown in the navigation."
                >
                  <Input
                    id="pg-title"
                    value={page.title}
                    maxLength={60}
                    onChange={(e) =>
                      patchPage((p) => ({ ...p, title: e.target.value }))
                    }
                  />
                </Field>
                <Field
                  label="Path"
                  htmlFor="pg-path"
                  error={issues[page.id] ?? err(`pages.${pageIndex}.path`)}
                  hint={
                    pageIndex === 0
                      ? "The home page lives at the site's root."
                      : undefined
                  }
                >
                  <div className="flex items-center">
                    <span className="num flex h-9 items-center rounded-l border border-r-0 border-line-strong bg-surface-2 px-2.5 text-xs text-fg-3">
                      /
                    </span>
                    <Input
                      id="pg-path"
                      value={page.path}
                      disabled={pageIndex === 0}
                      onChange={(e) =>
                        patchPage((p) => ({
                          ...p,
                          path: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9/-]/g, "-")
                            .slice(0, 60),
                        }))
                      }
                      className="num rounded-l-none"
                    />
                  </div>
                </Field>
                <Toggle
                  checked={page.inNav}
                  onChange={(v) => patchPage((p) => ({ ...p, inNav: v }))}
                  label="Show in navigation"
                  hint="Hidden pages still work when linked, like a thank-you page."
                />
                <Group title="Search">
                  <Field
                    label="Search title"
                    htmlFor="pg-seo-title"
                    hint={
                      pageIndex === 0
                        ? `Empty uses "${draft.seo.siteTitle}".`
                        : `Empty uses "${page.title} | ${draft.logoText || draft.name}".`
                    }
                  >
                    <Input
                      id="pg-seo-title"
                      value={page.seo.title ?? ""}
                      maxLength={70}
                      onChange={(e) =>
                        patchPage((p) => ({
                          ...p,
                          seo: { ...p.seo, title: e.target.value },
                        }))
                      }
                    />
                  </Field>
                  <Field label="Description" htmlFor="pg-seo-desc">
                    <Textarea
                      id="pg-seo-desc"
                      value={page.seo.description ?? ""}
                      maxLength={170}
                      onChange={(e) =>
                        patchPage((p) => ({
                          ...p,
                          seo: { ...p.seo, description: e.target.value },
                        }))
                      }
                      className="min-h-[72px] text-sm"
                    />
                    <span className="-mt-1 self-end">
                      <Counter value={page.seo.description ?? ""} max={158} />
                    </span>
                  </Field>
                  <SearchPreview
                    url={liveUrl(page)}
                    title={
                      page.seo.title ||
                      (pageIndex === 0
                        ? draft.seo.siteTitle
                        : `${page.title} | ${draft.logoText || draft.name}`)
                    }
                    description={page.seo.description || draft.seo.description}
                  />
                  <Toggle
                    checked={!!page.seo.noindex}
                    onChange={(v) =>
                      patchPage((p) => ({
                        ...p,
                        seo: { ...p.seo, noindex: v },
                      }))
                    }
                    label="Hide from search engines"
                    hint="Leaves it out of the sitemap and asks search engines not to list it."
                  />
                </Group>
                {pageIndex > 0 && (
                  <div className="border-t border-line pt-4">
                    <button
                      type="button"
                      onClick={() => removePage(page)}
                      className="inline-flex h-8 items-center gap-1.5 rounded border border-line-strong px-3 text-xs font-medium text-red hover:bg-red-soft"
                    >
                      <Trash2 className="size-3.5" strokeWidth={2} />
                      Remove page
                    </button>
                  </div>
                )}
              </>
            )}

            {pane === "site" && (
              <>
                <PaneHead
                  title="Site settings"
                  body="The header, footer and search details every page shares."
                />
                <Field
                  label="Name"
                  htmlFor="st-name"
                  error={err("name")}
                  hint="Only your team sees this."
                >
                  <Input
                    id="st-name"
                    value={draft.name}
                    maxLength={80}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </Field>
                <Field
                  label="Lotus address"
                  htmlFor="st-slug"
                  error={err("slug")}
                >
                  <div className="flex items-center">
                    <span className="num flex h-9 items-center rounded-l border border-r-0 border-line-strong bg-surface-2 px-2.5 text-xs text-fg-3">
                      /s/
                    </span>
                    <Input
                      id="st-slug"
                      value={draft.slug}
                      maxLength={48}
                      onChange={(e) =>
                        set(
                          "slug",
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, "-"),
                        )
                      }
                      className="num rounded-l-none"
                    />
                  </div>
                </Field>
                <Group title="Brand">
                  <Field
                    label="Logo text"
                    htmlFor="st-logo"
                    hint="Shown top left and in the footer."
                  >
                    <Input
                      id="st-logo"
                      value={draft.logoText}
                      maxLength={60}
                      onChange={(e) => set("logoText", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Brand colour"
                    htmlFor="st-color"
                    error={err("brandColor")}
                    hint="Buttons, links and accents on every page."
                  >
                    <div className="flex items-center gap-2">
                      <input
                        id="st-color"
                        type="color"
                        value={
                          /^#[0-9a-f]{6}$/i.test(draft.brandColor)
                            ? draft.brandColor
                            : "#000000"
                        }
                        onChange={(e) => set("brandColor", e.target.value)}
                        className="size-9 shrink-0 cursor-pointer rounded border border-line-strong bg-surface p-1"
                      />
                      <Input
                        aria-label="Brand colour hex"
                        value={draft.brandColor}
                        maxLength={7}
                        onChange={(e) => set("brandColor", e.target.value)}
                        className="num"
                      />
                    </div>
                  </Field>
                </Group>
                <Group title="Header">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Button" htmlFor="st-cta">
                      <Input
                        id="st-cta"
                        value={draft.header.ctaLabel ?? ""}
                        maxLength={40}
                        placeholder="Get a quote"
                        onChange={(e) =>
                          set("header", {
                            ...draft.header,
                            ctaLabel: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Links to"
                      htmlFor="st-cta-href"
                      error={err("header.ctaHref")}
                    >
                      <Select
                        id="st-cta-href"
                        value={draft.header.ctaHref ?? ""}
                        onChange={(e) =>
                          set("header", {
                            ...draft.header,
                            ctaHref: e.target.value,
                          })
                        }
                      >
                        <option value="#form">Form on the page</option>
                        {draft.pages.map((p) => (
                          <option
                            key={p.id}
                            value={p.path ? `/${p.path}` : "/"}
                          >
                            {p.title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <Field
                    label="Phone"
                    htmlFor="st-phone"
                    hint="Tap to call on phones. Empty hides it."
                  >
                    <Input
                      id="st-phone"
                      type="tel"
                      value={draft.header.phone ?? ""}
                      maxLength={30}
                      onChange={(e) =>
                        set("header", {
                          ...draft.header,
                          phone: e.target.value,
                        })
                      }
                      className="num"
                    />
                  </Field>
                </Group>
                <Group title="Footer">
                  <Field label="Tagline" htmlFor="st-tag">
                    <Textarea
                      id="st-tag"
                      value={draft.footer.tagline ?? ""}
                      maxLength={240}
                      onChange={(e) =>
                        set("footer", {
                          ...draft.footer,
                          tagline: e.target.value,
                        })
                      }
                      className="min-h-[64px] text-sm"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Phone" htmlFor="st-fphone">
                      <Input
                        id="st-fphone"
                        value={draft.footer.phone ?? ""}
                        maxLength={30}
                        onChange={(e) =>
                          set("footer", {
                            ...draft.footer,
                            phone: e.target.value,
                          })
                        }
                        className="num"
                      />
                    </Field>
                    <Field
                      label="Email"
                      htmlFor="st-femail"
                      error={err("footer.email")}
                    >
                      <Input
                        id="st-femail"
                        type="email"
                        value={draft.footer.email ?? ""}
                        maxLength={120}
                        onChange={(e) =>
                          set("footer", {
                            ...draft.footer,
                            email: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Address" htmlFor="st-faddr">
                    <Input
                      id="st-faddr"
                      value={draft.footer.address ?? ""}
                      maxLength={160}
                      onChange={(e) =>
                        set("footer", {
                          ...draft.footer,
                          address: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Hours" htmlFor="st-fhours">
                    <Input
                      id="st-fhours"
                      value={draft.footer.hours ?? ""}
                      maxLength={160}
                      onChange={(e) =>
                        set("footer", {
                          ...draft.footer,
                          hours: e.target.value,
                        })
                      }
                    />
                  </Field>
                </Group>
                <Group title="Search and sharing">
                  <Field
                    label="Site title"
                    htmlFor="st-seo-title"
                    error={err("seo.siteTitle")}
                    hint="The home page's title in search results and browser tabs."
                  >
                    <Input
                      id="st-seo-title"
                      value={draft.seo.siteTitle}
                      maxLength={70}
                      onChange={(e) =>
                        set("seo", { ...draft.seo, siteTitle: e.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label="Description"
                    htmlFor="st-seo-desc"
                    hint="Used by any page without its own."
                  >
                    <Textarea
                      id="st-seo-desc"
                      value={draft.seo.description}
                      maxLength={170}
                      onChange={(e) =>
                        set("seo", {
                          ...draft.seo,
                          description: e.target.value,
                        })
                      }
                      className="min-h-[72px] text-sm"
                    />
                  </Field>
                  <Field
                    label="Share image"
                    htmlFor="st-og"
                    error={err("seo.ogImage")}
                    hint="Shown when a link is shared on Facebook, LinkedIn or iMessage. 1200 × 630 works best."
                  >
                    <Input
                      id="st-og"
                      type="url"
                      value={draft.seo.ogImage ?? ""}
                      placeholder="https://…"
                      onChange={(e) =>
                        set("seo", { ...draft.seo, ogImage: e.target.value })
                      }
                    />
                  </Field>
                  <p className="text-xs text-fg-3">
                    The sitemap and robots.txt update themselves:{" "}
                    <a
                      href={`${base}/sitemap.xml`}
                      target="_blank"
                      rel="noreferrer"
                      className="num font-medium text-fg-2 hover:text-fg hover:underline"
                    >
                      sitemap.xml
                    </a>
                  </p>
                </Group>
                <Group title="Tracking">
                  <Field
                    label="Google Analytics ID"
                    htmlFor="st-ga"
                    error={err("analytics.gaId")}
                  >
                    <Input
                      id="st-ga"
                      value={draft.analytics.gaId ?? ""}
                      placeholder="G-XXXXXXXXXX"
                      onChange={(e) =>
                        set("analytics", {
                          ...draft.analytics,
                          gaId: e.target.value.trim().toUpperCase(),
                        })
                      }
                      className="num"
                    />
                  </Field>
                  <Field
                    label="Meta Pixel ID"
                    htmlFor="st-px"
                    error={err("analytics.metaPixelId")}
                    hint="Visits and leads show in Lotus either way."
                  >
                    <Input
                      id="st-px"
                      value={draft.analytics.metaPixelId ?? ""}
                      inputMode="numeric"
                      onChange={(e) =>
                        set("analytics", {
                          ...draft.analytics,
                          metaPixelId: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      className="num"
                    />
                  </Field>
                </Group>
                <div className="border-t border-line pt-4">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (
                        !confirm(
                          `Delete "${site.name}"? Every page goes offline${site.domain ? ` and ${site.domain.host} stops working` : ""}.`,
                        )
                      )
                        return;
                      start(() => actions.remove(site.id));
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-line-strong px-3 text-xs font-medium text-red hover:bg-red-soft"
                  >
                    <Trash2 className="size-3.5" strokeWidth={2} />
                    Delete site
                  </button>
                </div>
              </>
            )}

            {pane === "domain" && (
              <DomainPane site={site} actions={actions} onNotice={flash} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ----------------------------- lotus form ---------------------------- */

function LotusFormFields({
  block,
  forms,
  onChange,
}: {
  block: Extract<WebsiteBlock, { type: "lotus_form" }>;
  forms: SiteFormRef[];
  onChange: (b: WebsiteBlock) => void;
}) {
  const chosen = forms.find((f) => f.id === block.formId);
  return (
    <>
      <Field
        label="Form"
        htmlFor="lf-form"
        hint={
          forms.length === 0
            ? "This client has no forms yet."
            : chosen && !chosen.live
              ? "This form is a draft. Publish it in Forms so visitors can fill it in."
              : "Answers land in the form's responses and the contact's timeline."
        }
      >
        <Select
          id="lf-form"
          value={block.formId}
          onChange={(e) => onChange({ ...block, formId: e.target.value })}
        >
          {!chosen && <option value="">Pick a form</option>}
          {forms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
              {f.live ? "" : " (draft)"}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Headline" htmlFor="lf-h">
        <Input
          id="lf-h"
          value={block.headline ?? ""}
          maxLength={200}
          onChange={(e) => onChange({ ...block, headline: e.target.value })}
        />
      </Field>
      <Field label="Subhead" htmlFor="lf-s">
        <Input
          id="lf-s"
          value={block.subhead ?? ""}
          maxLength={300}
          onChange={(e) => onChange({ ...block, subhead: e.target.value })}
        />
      </Field>
      <div className="flex gap-3 text-xs">
        {chosen && (
          <Link
            href={`/agency/forms/${chosen.id}`}
            className="font-medium text-fg-2 hover:text-fg hover:underline"
          >
            Edit {chosen.name}
          </Link>
        )}
        <Link
          href="/agency/forms/new"
          className="font-medium text-fg-2 hover:text-fg hover:underline"
        >
          New form
        </Link>
      </div>
    </>
  );
}

/* ------------------------------- domain ------------------------------ */

function CopyCell({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className="group inline-flex max-w-full items-center gap-1.5 text-left"
      title="Copy"
    >
      <span className="num truncate">{value}</span>
      {done ? (
        <Check className="size-3 shrink-0 text-green" strokeWidth={2.5} />
      ) : (
        <Copy
          className="size-3 shrink-0 text-fg-3 opacity-0 group-hover:opacity-100"
          strokeWidth={2}
        />
      )}
    </button>
  );
}

function DomainPane({
  site,
  actions,
  onNotice,
}: {
  site: Website;
  actions: SiteEditorActions;
  onNotice: (t: string, bad?: boolean) => void;
}) {
  const router = useRouter();
  const [host, setHost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const d = site.domain;
  const sub = d ? d.host.split(".")[0] : "www";
  const apex = d ? d.host.split(".").slice(1).join(".") : "";

  const run = (fn: () => Promise<SiteResult>) =>
    start(async () => {
      const r = await fn();
      if (r.errors?.host) setError(r.errors.host);
      else {
        setError(null);
        // The pane itself says what DNS returned; the header only confirms good news.
        if (r.ok && r.message) onNotice(r.message);
      }
      router.refresh();
    });

  return (
    <>
      <PaneHead
        title="Domain"
        body={`Every site works at /s/${site.slug}. Connect the client's own domain so visitors see theirs.`}
      />
      {!d ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const h = normaliseHost(host);
            const problem = hostError(h);
            if (problem) return setError(problem);
            run(() => actions.setDomain(site.id, h));
          }}
        >
          <Field
            label="Domain"
            htmlFor="dm-host"
            error={error ?? undefined}
            hint="Use the full address, like www.brightsmiledental.com."
          >
            <Input
              id="dm-host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="www.example.com"
              className="num"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Button
            type="submit"
            disabled={pending || !host.trim()}
            className="h-8 self-start px-3 text-xs"
          >
            {pending && (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            )}
            Connect domain
          </Button>
        </form>
      ) : (
        <>
          <div className="rounded border border-line">
            <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  d.status === "connected"
                    ? "bg-green"
                    : d.status === "pending"
                      ? "bg-amber"
                      : "bg-red",
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="num block truncate text-sm font-medium">
                  {d.host}
                </span>
                <span className="block text-xs text-fg-3">
                  {domainLabel(d)}
                  {d.checkedAt
                    ? ` · checked ${timeAgo(d.checkedAt, new Date())}`
                    : ""}
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => actions.checkDomain(site.id))}
                className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded border border-line-strong bg-surface px-2.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("size-3.5", pending && "animate-spin")}
                  strokeWidth={2}
                />
                Check DNS
              </button>
            </div>
            {d.found && (
              <p className="px-3.5 py-2.5 text-xs leading-relaxed text-fg-2">
                {d.found}
              </p>
            )}
          </div>

          {d.status !== "connected" && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">
                Add this record at the domain&apos;s DNS provider
              </h3>
              <div className="overflow-hidden rounded border border-line">
                <table className="w-full table-fixed text-xs">
                  <thead>
                    <tr className="border-b border-line bg-surface-2/60 text-left text-2xs uppercase tracking-[0.06em] text-fg-3">
                      <th className="w-[72px] px-3 py-1.5 font-medium">Type</th>
                      <th className="w-[72px] px-3 py-1.5 font-medium">Name</th>
                      <th className="px-3 py-1.5 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="num px-3 py-2">CNAME</td>
                      <td className="px-3 py-2">
                        <CopyCell value={sub!} />
                      </td>
                      <td className="px-3 py-2">
                        <CopyCell value={SITES_CNAME} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ol className="flex list-decimal flex-col gap-1 pl-4 text-xs leading-relaxed text-fg-2">
                <li>
                  Sign in where {apex} is managed (GoDaddy, Namecheap,
                  Cloudflare, Squarespace…).
                </li>
                <li>
                  Open its DNS settings and add the record above. Remove any
                  other record named {sub}.
                </li>
                <li>
                  Forward {apex} to https://{d.host} so both addresses work.
                </li>
                <li>
                  Come back and press Check DNS. Most changes show within an
                  hour.
                </li>
              </ol>
            </div>
          )}
          {d.status === "connected" && (
            <p className="text-xs leading-relaxed text-fg-2">
              Visitors on {d.host} see this site. Links in search results and
              the sitemap use it, and HTTPS is issued for it automatically.
            </p>
          )}
          <div className="border-t border-line pt-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (
                  !confirm(
                    `Disconnect ${d.host}? The site stays on its Lotus address.`,
                  )
                )
                  return;
                run(() => actions.removeDomain(site.id));
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-line-strong px-3 text-xs font-medium text-red hover:bg-red-soft"
            >
              Disconnect domain
            </button>
          </div>
        </>
      )}
    </>
  );
}
