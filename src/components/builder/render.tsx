import type { BuilderDoc, BuilderElement, BuilderProduct, BuilderSection, BuilderTheme } from "@/lib/types";
import { docCss, fontHref, safeHref, safeSrc, themeVars, videoEmbed } from "./model";
import { Countdown, PopupHost } from "./live";

/*
 * One renderer for the builder canvas and the public page. It is plain markup
 * plus one scoped stylesheet: the base rules below, then every node's own
 * rules from docCss(). Phones are a container query on the page root, so the
 * editor's phone frame shows exactly what a phone gets.
 *
 * Every node carries data-lb (its id) and data-lbk (section, row, column,
 * element); the editor selects, hovers and drops by reading those, so this
 * file has no editor code in it.
 */

const BASE = `
.lb-root{container:lotuspage/inline-size;background:var(--lb-bg);color:var(--lb-ink);font-family:var(--lb-body);font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;min-height:100%}
.lb-root *,.lb-root *::before,.lb-root *::after{box-sizing:border-box}
.lb-root ::selection{background:color-mix(in srgb,var(--lb-primary) 22%,transparent)}
:where(.lb-root) a{color:inherit}
.lb-sec{position:relative;padding:var(--lb-pt,80px) var(--lb-px,24px) var(--lb-pb,80px);scroll-margin-top:24px}
.lb-in{max-width:var(--lb-max,1080px);margin:0 auto}
.lb-row{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:var(--lb-gap,32px);align-items:stretch}
.lb-row+.lb-row{margin-top:40px}
.lb-col{grid-column:span var(--span,12);display:flex;flex-direction:column;min-width:0}
.lb-col[data-valign=center]{justify-content:center}
.lb-col[data-valign=bottom]{justify-content:flex-end}
.lb-el{min-width:0}
.lb-el+.lb-el{margin-top:16px}
.lb-h{font-family:var(--lb-heading);color:var(--lb-fg,var(--lb-ink));font-weight:var(--lb-w,600);letter-spacing:-.022em;line-height:var(--lb-lh,1.12);margin:0;text-wrap:balance;white-space:pre-line}
.lb-h1{font-size:var(--lb-fs,clamp(40px,5.2cqi,60px));letter-spacing:-.03em;line-height:var(--lb-lh,1.06)}
.lb-h2{font-size:var(--lb-fs,clamp(30px,3.6cqi,40px))}
.lb-h3{font-size:var(--lb-fs,24px);line-height:var(--lb-lh,1.25)}
.lb-h4{font-size:var(--lb-fs,18px);line-height:var(--lb-lh,1.35);letter-spacing:-.01em}
.lb-p{margin:0;font-size:var(--lb-fs,17px);font-weight:var(--lb-w,400);line-height:var(--lb-lh,1.65);color:var(--lb-fg,var(--lb-muted));white-space:pre-line;text-wrap:pretty}
.lb-bw{display:flex;flex-direction:column;align-items:var(--lb-justify,flex-start);gap:8px}
.lb-btn{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:48px;padding:10px 24px;border-radius:var(--lb-btn-r,var(--lb-btn-radius));background:var(--lb-btn-bg,var(--lb-primary));color:var(--lb-btn-fg,#fff);border:1.5px solid var(--lb-btn-bg,var(--lb-primary));font:inherit;font-size:var(--lb-fs,16px);font-weight:var(--lb-w,600);line-height:1.2;text-decoration:none;cursor:pointer;transition:filter .15s,transform .15s;box-shadow:0 1px 2px rgba(15,18,33,.12)}
.lb-btn:hover{filter:brightness(.93)}
.lb-btn:active{transform:translateY(1px)}
.lb-btn:focus-visible,.lb-in-field:focus-visible{outline:2px solid var(--lb-primary);outline-offset:2px}
.lb-btn-lg{min-height:58px;padding:12px 32px;font-size:var(--lb-fs,18px)}
.lb-btn-outline{background:transparent;color:var(--lb-btn-bg,var(--lb-fg,var(--lb-ink)));border-color:currentColor;box-shadow:none}
.lb-btn-full{width:100%}
.lb-btn small{font-size:13px;font-weight:400;opacity:.82}
.lb-img{display:block;width:100%;height:auto;border-radius:var(--lb-inner-r,var(--lb-radius));object-fit:cover}
.lb-ph{display:grid;place-items:center;width:100%;border-radius:var(--lb-radius);background:repeating-linear-gradient(135deg,rgba(15,18,33,.035) 0 12px,rgba(15,18,33,.06) 12px 24px);color:rgba(15,18,33,.45);font-size:13px;min-height:120px}
.lb-vid{position:relative;aspect-ratio:16/9;border-radius:var(--lb-radius);overflow:hidden;background:#0f1221}
.lb-vid iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.lb-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;font-size:var(--lb-fs,17px);color:var(--lb-fg,var(--lb-ink))}
.lb-list li{display:flex;gap:12px;align-items:flex-start;line-height:1.5}
.lb-list svg{flex:none;margin-top:3px;color:var(--lb-primary)}
.lb-form{display:flex;flex-direction:column;gap:14px;text-align:left}
.lb-lab{display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:500;color:var(--lb-fg,var(--lb-ink))}
.lb-in-field{width:100%;height:48px;padding:0 14px;border:1px solid rgba(15,18,33,.16);border-radius:calc(var(--lb-radius) * .7);background:#fff;color:#0f1221;font:inherit;font-size:16px;transition:border-color .15s,box-shadow .15s}
.lb-in-field:focus{border-color:var(--lb-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--lb-primary) 18%,transparent);outline:none}
textarea.lb-in-field{height:auto;min-height:104px;padding:12px 14px;resize:vertical}
.lb-in-field::placeholder{color:#9a9db0}
.lb-note{font-size:13px;color:var(--lb-fg,var(--lb-muted));opacity:.85;text-align:center;margin:2px 0 0}
.lb-amts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.lb-amt{display:flex;height:48px;align-items:center;justify-content:center;border:1px solid rgba(15,18,33,.16);border-radius:calc(var(--lb-radius) * .7);background:#fff;color:#0f1221;font-weight:600;cursor:pointer;font-variant-numeric:tabular-nums}
.lb-amt:has(:checked){background:var(--lb-primary);border-color:var(--lb-primary);color:#fff}
.lb-hr{border:0;border-top:1px solid currentColor;color:rgba(15,18,33,.12);margin:8px 0}
.lb-cd{display:flex;gap:10px;justify-content:var(--lb-justify,flex-start);font-variant-numeric:tabular-nums}
.lb-cd>div{min-width:72px;padding:12px 8px;border-radius:calc(var(--lb-radius) * .8);background:var(--lb-ink);color:#fff;text-align:center}
.lb-cd b{display:block;font-family:var(--lb-heading);font-size:var(--lb-fs,30px);font-weight:600;line-height:1.1;letter-spacing:-.02em}
.lb-cd span{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.7}
.lb-quote{margin:0}
.lb-quote blockquote{margin:0;font-family:var(--lb-heading);font-size:var(--lb-fs,22px);line-height:1.4;letter-spacing:-.012em;color:var(--lb-fg,var(--lb-ink));text-wrap:balance}
.lb-quote figcaption{margin-top:16px;display:flex;align-items:center;gap:12px;justify-content:var(--lb-justify,flex-start);font-size:14px;color:var(--lb-fg,var(--lb-muted))}
.lb-quote figcaption b{display:block;color:var(--lb-fg,var(--lb-ink));font-weight:600}
.lb-av{width:40px;height:40px;border-radius:999px;object-fit:cover;flex:none;background:color-mix(in srgb,var(--lb-primary) 14%,#fff);display:grid;place-items:center;font-weight:600;color:var(--lb-primary);font-size:14px}
.lb-stars{display:flex;gap:2px;margin-bottom:12px;color:#f5a524;justify-content:var(--lb-justify,flex-start)}
.lb-faq{border-top:1px solid rgba(15,18,33,.1);text-align:left}
.lb-faq details{border-bottom:1px solid rgba(15,18,33,.1);padding:18px 0}
.lb-faq summary{display:flex;justify-content:space-between;gap:16px;cursor:pointer;list-style:none;font-weight:500;font-size:var(--lb-fs,17px);color:var(--lb-fg,var(--lb-ink))}
.lb-faq summary::-webkit-details-marker{display:none}
.lb-faq summary svg{flex:none;transition:transform .2s;opacity:.55;margin-top:4px}
.lb-faq details[open] summary svg{transform:rotate(45deg)}
.lb-faq p{margin:10px 0 0;color:var(--lb-fg,var(--lb-muted));font-size:15px;line-height:1.65}
.lb-stat b{display:block;font-family:var(--lb-heading);font-size:var(--lb-fs,44px);font-weight:600;letter-spacing:-.03em;line-height:1.05;color:var(--lb-fg,var(--lb-ink));font-variant-numeric:tabular-nums}
.lb-stat span{display:block;margin-top:6px;font-size:14px;color:var(--lb-fg,var(--lb-muted))}
.lb-price{display:flex;flex-direction:column;gap:16px;height:100%;padding:28px;border:1px solid rgba(15,18,33,.1);border-radius:var(--lb-radius);background:#fff;text-align:left;color:#0f1221}
.lb-price[data-featured]{border:2px solid var(--lb-primary);box-shadow:0 2px 4px rgba(15,18,33,.05),0 16px 40px rgba(15,18,33,.12)}
.lb-price h4{margin:0;font-family:var(--lb-heading);font-size:18px;font-weight:600}
.lb-price .lb-amount{font-family:var(--lb-heading);font-size:var(--lb-fs,44px);font-weight:600;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
.lb-price .lb-amount small{font-size:16px;font-weight:400;color:#6b6f83;letter-spacing:0;margin-left:2px}
.lb-price p{margin:0;font-size:15px;color:#4b4f63}
.lb-price .lb-list{font-size:15px;flex:1}
.lb-tag{align-self:flex-start;padding:3px 10px;border-radius:999px;background:color-mix(in srgb,var(--lb-primary) 12%,#fff);color:var(--lb-primary);font-size:12px;font-weight:600}
.lb-order{display:flex;flex-direction:column;gap:16px;text-align:left;color:#0f1221}
.lb-order fieldset{border:0;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.lb-order legend{font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#6b6f83;margin-bottom:10px}
.lb-prod{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid rgba(15,18,33,.14);border-radius:calc(var(--lb-radius) * .7);background:#fff;cursor:pointer}
.lb-prod:has(:checked){border-color:var(--lb-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--lb-primary) 14%,transparent)}
.lb-prod input{accent-color:var(--lb-primary);width:18px;height:18px}
.lb-prod span{flex:1;font-weight:500}
.lb-prod b,.lb-total b{font-variant-numeric:tabular-nums;font-weight:600}
.lb-bump{display:flex;gap:12px;padding:14px 16px;border:2px dashed #e0a41b;border-radius:calc(var(--lb-radius) * .7);background:#fff8e6;cursor:pointer;font-size:15px;line-height:1.45}
.lb-bump input{accent-color:var(--lb-primary);width:18px;height:18px;margin-top:2px;flex:none}
.lb-bump b{display:block}
.lb-card{display:flex;align-items:center;gap:10px;height:48px;padding:0 14px;border:1px dashed rgba(15,18,33,.22);border-radius:calc(var(--lb-radius) * .7);background:#fafaf8;color:#6b6f83;font-size:14px}
.lb-total{display:flex;justify-content:space-between;padding-top:14px;border-top:1px solid rgba(15,18,33,.1);font-size:16px}
.lb-order:has(.lb-bump :checked) .lb-t0,.lb-order:not(:has(.lb-bump :checked)) .lb-t1{display:none}
.lb-guar{display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;color:#6b6f83}
.lb-up{display:flex;flex-direction:column;align-items:var(--lb-justify,center);gap:12px}
.lb-up .lb-btn{width:100%;max-width:520px}
.lb-no{font-size:14px;color:var(--lb-fg,var(--lb-muted));text-decoration:underline;text-underline-offset:3px;background:none;border:0;cursor:pointer}
.lb-prog{display:flex;flex-direction:column;gap:8px;font-size:14px;color:var(--lb-fg,var(--lb-muted))}
.lb-prog div{height:10px;border-radius:999px;background:rgba(15,18,33,.08);overflow:hidden}
.lb-prog i{display:block;height:100%;border-radius:inherit;background:var(--lb-primary)}
.lb-logos{display:flex;flex-wrap:wrap;gap:16px 40px;justify-content:var(--lb-justify,center);align-items:center}
.lb-logos span{font-family:var(--lb-heading);font-size:var(--lb-fs,20px);font-weight:700;letter-spacing:-.02em;color:var(--lb-fg,var(--lb-ink));opacity:.42}
.lb-frame{display:block;width:100%;border:0;border-radius:var(--lb-radius);background:#fff}
.lb-pop{position:fixed;inset:0;z-index:60;display:none;place-items:center;padding:20px;background:rgba(10,12,20,.55)}
.lb-pop[data-open]{display:grid;animation:lbfade .25s ease-out}
.lb-pop-box{position:relative;width:min(640px,100%);max-height:calc(100vh - 40px);overflow:auto;border-radius:calc(var(--lb-radius) * 1.4);background:var(--lb-bg);box-shadow:0 24px 64px rgba(10,12,20,.35)}
.lb-pop-x{position:absolute;top:10px;right:10px;z-index:1;width:36px;height:36px;border-radius:999px;border:0;background:rgba(15,18,33,.06);color:#0f1221;cursor:pointer;display:grid;place-items:center}
.lb-pop .lb-sec{padding:var(--lb-pt,40px) var(--lb-px,32px) var(--lb-pb,40px)}
.lb-empty{padding:120px 24px;text-align:center;color:#6b6f83;font-size:15px}
@keyframes lbfade{from{opacity:0}to{opacity:1}}
@container lotuspage (max-width:767px){
.lb-sec{padding:var(--lb-mpt,calc(var(--lb-pt,80px) * .62)) var(--lb-mpx,20px) var(--lb-mpb,calc(var(--lb-pb,80px) * .62))}
.lb-row{grid-template-columns:minmax(0,1fr);gap:var(--lb-gap-m,28px)}
.lb-row+.lb-row{margin-top:28px}
.lb-col{grid-column:auto}
.lb-h1{font-size:var(--lb-mfs,min(var(--lb-fs,40px),40px))}
.lb-h2{font-size:var(--lb-mfs,min(var(--lb-fs,30px),30px))}
.lb-h3{font-size:var(--lb-mfs,min(var(--lb-fs,22px),22px))}
.lb-p,.lb-list{font-size:var(--lb-mfs,var(--lb-fs,16px))}
.lb-btn-lg{min-height:54px;padding:12px 24px}
.lb-stat b{font-size:var(--lb-mfs,36px)}
.lb-cd>div{min-width:62px}
.lb-amts{grid-template-columns:repeat(2,1fr)}
}
`;

export interface RenderRefs {
  /** Where "Next step" buttons and forms go. */
  nextHref?: string;
  forms?: { id: string; slug: string; name: string; live: boolean }[];
  calendars?: { slug: string; name: string }[];
  elements?: { id: string; name: string; typeLabel: string; live: boolean; overlay: boolean }[];
}

export interface RenderActions {
  form?: (fd: FormData) => void | Promise<void>;
  order?: (fd: FormData) => void | Promise<void>;
  upsell?: (fd: FormData) => void | Promise<void>;
}

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const per = (p: BuilderProduct) => (p.interval === "month" ? "/mo" : p.interval === "year" ? "/yr" : "");

const fieldMeta: Record<string, { type: string; placeholder: string; auto?: string }> = {
  name: { type: "text", placeholder: "Your full name", auto: "name" },
  first_name: { type: "text", placeholder: "Your first name", auto: "given-name" },
  email: { type: "email", placeholder: "you@example.com", auto: "email" },
  phone: { type: "tel", placeholder: "(555) 555-0142", auto: "tel" },
  address: { type: "text", placeholder: "Street, city", auto: "street-address" },
  company: { type: "text", placeholder: "Company name", auto: "organization" },
  website: { type: "url", placeholder: "https://", auto: "url" },
  message: { type: "textarea", placeholder: "A sentence or two" },
  amount: { type: "amount", placeholder: "" },
};

function Icon({ name, size = 18 }: { name: "check" | "dot" | "arrow" | "x" | "plus" | "star" | "image" | "play" | "lock" | "shield"; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "check":
      return (
        <svg {...p}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "dot":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...p}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case "x":
      return (
        <svg {...p}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    case "plus":
      return (
        <svg {...p}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "star":
      return (
        <svg {...p} fill="currentColor" stroke="none">
          <path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
        </svg>
      );
    case "image":
      return (
        <svg {...p} strokeWidth={1.6}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="m21 16-5-5-9 9" />
        </svg>
      );
    case "play":
      return (
        <svg {...p} strokeWidth={1.6}>
          <circle cx="12" cy="12" r="9" />
          <path d="m10 8.5 5 3.5-5 3.5z" fill="currentColor" />
        </svg>
      );
    case "lock":
      return (
        <svg {...p} strokeWidth={1.8}>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
    case "shield":
      return (
        <svg {...p} strokeWidth={1.8}>
          <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
  }
}

interface Ctx {
  refs: RenderRefs;
  actions: RenderActions;
  editing: boolean;
  /** The first form or order element answers to #form. */
  formAnchor?: string;
  inline?: { id: string; onCommit: (id: string, text: string) => void };
}

function buttonHref(e: { action: string; href?: string }, ctx: Ctx) {
  if (e.action === "next") return ctx.refs.nextHref ?? "#";
  if (e.action === "popup") return "#lb-popup";
  if (e.action === "scroll") return safeHref(e.href) ?? "#form";
  return safeHref(e.href) ?? "#";
}

/** Text an editor can type into straight on the canvas. */
function Editable({ id, field, text, ctx, as: Tag, className }: { id: string; field: string; text: string; ctx: Ctx; as: "h1" | "h2" | "h3" | "h4" | "p" | "span"; className?: string }) {
  const live = ctx.inline?.id === id;
  if (!live) return <Tag className={className}>{text}</Tag>;
  return (
    <Tag
      className={className}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      data-lb-edit={field}
      spellCheck
      onBlur={(ev: React.FocusEvent<HTMLElement>) => ctx.inline!.onCommit(id, ev.currentTarget.innerText.replace(/\n{3,}/g, "\n\n").trim())}
      onKeyDown={(ev: React.KeyboardEvent<HTMLElement>) => {
        if (ev.key === "Escape") (ev.currentTarget as HTMLElement).blur();
        ev.stopPropagation();
      }}
    >
      {text}
    </Tag>
  );
}

function ElementView({ e, ctx }: { e: BuilderElement; ctx: Ctx }) {
  switch (e.type) {
    case "headline":
      return <Editable id={e.id} field="text" text={e.text} ctx={ctx} as={e.tag} className={`lb-h lb-${e.tag}`} />;
    case "text":
      return <Editable id={e.id} field="text" text={e.text} ctx={ctx} as="p" className="lb-p" />;
    case "button": {
      const cls = `lb-btn${e.size === "lg" ? " lb-btn-lg" : ""}${e.variant === "outline" ? " lb-btn-outline" : ""}${e.full ? " lb-btn-full" : ""}`;
      return (
        <div className="lb-bw">
          <a href={buttonHref(e, ctx)} className={cls} data-lb-popup={e.action === "popup" ? "" : undefined} onClick={ctx.editing ? (ev) => ev.preventDefault() : undefined}>
            <Editable id={e.id} field="label" text={e.label} ctx={ctx} as="span" />
            {e.sub && <small>{e.sub}</small>}
          </a>
        </div>
      );
    }
    case "image": {
      const src = safeSrc(e.src);
      const ratio = e.ratio !== "auto" ? e.ratio : undefined;
      if (!src)
        return (
          <div className="lb-ph" style={{ aspectRatio: ratio ?? "4/3" }}>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <Icon name="image" size={28} />
              {ctx.editing ? "Add an image in the panel" : ""}
            </span>
          </div>
        );
      // eslint-disable-next-line @next/next/no-img-element
      const img = <img src={src} alt={e.alt} loading="lazy" className="lb-img" style={{ aspectRatio: ratio }} />;
      const href = safeHref(e.href);
      return href && !ctx.editing ? <a href={href}>{img}</a> : img;
    }
    case "video": {
      const src = e.url ? videoEmbed(e.url) : null;
      if (!src)
        return (
          <div className="lb-ph" style={{ aspectRatio: "16/9" }}>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <Icon name="play" size={32} />
              {ctx.editing ? "Paste a YouTube, Vimeo or Loom link" : ""}
            </span>
          </div>
        );
      return (
        <div className="lb-vid">
          <iframe src={src} title="Video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen style={ctx.editing ? { pointerEvents: "none" } : undefined} />
        </div>
      );
    }
    case "list":
      return (
        <ul className="lb-list">
          {e.items.map((it, i) => (
            <li key={i}>
              <Icon name={e.icon} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      );
    case "form":
      return (
        <form action={ctx.editing ? undefined : ctx.actions.form} className="lb-form" onSubmit={ctx.editing ? (ev) => ev.preventDefault() : undefined}>
          {e.fields.map((f) => {
            const m = fieldMeta[f.key] ?? fieldMeta.name!;
            return (
              <label key={f.key} className="lb-lab">
                <span>
                  {f.label}
                  {!f.required && <span style={{ fontWeight: 400, opacity: 0.6 }}> (optional)</span>}
                </span>
                {m.type === "textarea" ? (
                  <textarea name={f.key} placeholder={m.placeholder} required={f.required} className="lb-in-field" />
                ) : m.type === "amount" ? (
                  <div className="lb-amts">
                    {["25", "50", "100", "250"].map((a) => (
                      <label key={a} className="lb-amt">
                        <input type="radio" name={f.key} value={a} defaultChecked={a === "50"} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />${a}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input name={f.key} type={m.type} placeholder={m.placeholder} autoComplete={m.auto} required={f.required} className="lb-in-field" />
                )}
              </label>
            );
          })}
          <button type="submit" className="lb-btn lb-btn-lg lb-btn-full" style={{ marginTop: 4 }}>
            {e.buttonLabel}
          </button>
          {e.note && <p className="lb-note">{e.note}</p>}
        </form>
      );
    case "divider":
      return <hr className="lb-hr" />;
    case "spacer":
      return <div aria-hidden style={{ height: Math.max(4, Math.min(400, e.height)) }} />;
    case "countdown":
      return <Countdown mode={e.mode} until={e.until} minutes={e.minutes} expired={e.expired} storageKey={e.id} />;
    case "testimonial": {
      const avatar = safeSrc(e.avatar);
      const initials = e.name
        .split(/\s+/)
        .filter((w) => /^\p{L}/u.test(w))
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      return (
        <figure className="lb-quote">
          {!!e.rating && (
            <div className="lb-stars" aria-label={`${e.rating} out of 5`}>
              {Array.from({ length: Math.min(5, e.rating) }, (_, i) => (
                <Icon key={i} name="star" size={17} />
              ))}
            </div>
          )}
          <blockquote>“{e.quote}”</blockquote>
          <figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatar ? <img src={avatar} alt="" className="lb-av" /> : <span className="lb-av">{initials}</span>}
            <span style={{ textAlign: "left" }}>
              <b>{e.name}</b>
              {e.detail}
            </span>
          </figcaption>
        </figure>
      );
    }
    case "faq":
      return (
        <div className="lb-faq">
          {e.items.map((it, i) => (
            <details key={i} open={ctx.editing && i === 0}>
              <summary>
                {it.q}
                <Icon name="plus" />
              </summary>
              <p>{it.a}</p>
            </details>
          ))}
        </div>
      );
    case "stat":
      return (
        <div className="lb-stat">
          <b>{e.value}</b>
          <span>{e.label}</span>
        </div>
      );
    case "pricing":
      return (
        <div className="lb-price" data-featured={e.featured ? "" : undefined}>
          {e.featured && <span className="lb-tag">Most popular</span>}
          <h4>{e.name}</h4>
          <div className="lb-amount">
            {e.price}
            {e.period && <small>{e.period}</small>}
          </div>
          {e.blurb && <p>{e.blurb}</p>}
          <ul className="lb-list">
            {e.features.map((f, i) => (
              <li key={i}>
                <Icon name="check" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <a href={buttonHref(e, ctx)} className={`lb-btn lb-btn-full${e.featured ? "" : " lb-btn-outline"}`} onClick={ctx.editing ? (ev) => ev.preventDefault() : undefined}>
            {e.buttonLabel}
          </a>
        </div>
      );
    case "order": {
      const first = e.products[0];
      const bump = e.bump?.product;
      return (
        <form action={ctx.editing ? undefined : ctx.actions.order} className="lb-order" onSubmit={ctx.editing ? (ev) => ev.preventDefault() : undefined}>
          <input type="hidden" name="elementId" value={e.id} />
          <fieldset>
            <legend>Your details</legend>
            <input name="name" required placeholder="Full name" autoComplete="name" className="lb-in-field" aria-label="Full name" />
            <input name="email" type="email" required placeholder="Email address" autoComplete="email" className="lb-in-field" aria-label="Email" />
            <input name="phone" type="tel" placeholder="Phone (optional)" autoComplete="tel" className="lb-in-field" aria-label="Phone" />
          </fieldset>
          <fieldset>
            <legend>Your order</legend>
            {e.products.map((pr, i) => (
              <label key={pr.id} className="lb-prod">
                <input type="radio" name="product" value={pr.id} defaultChecked={i === 0} />
                <span>{pr.name}</span>
                <b>
                  {money(pr.priceCents)}
                  {per(pr)}
                </b>
              </label>
            ))}
            {e.bump && bump && (
              <label className="lb-bump">
                <input type="checkbox" name="bump" value={bump.id} />
                <span>
                  <b>
                    {e.bump.pitch} {money(bump.priceCents)}
                  </b>
                  {bump.name}
                </span>
              </label>
            )}
          </fieldset>
          <fieldset>
            <legend>Payment</legend>
            <div className="lb-card">
              <Icon name="lock" size={16} />
              Card details appear here once Stripe is connected. Test mode: no card is charged.
            </div>
          </fieldset>
          {first && (
            <div className="lb-total">
              <span>Total today</span>
              <b className="lb-t0">{money(first.priceCents)}</b>
              {bump && <b className="lb-t1">{money(first.priceCents + bump.priceCents)}</b>}
            </div>
          )}
          <button type="submit" className="lb-btn lb-btn-lg lb-btn-full">
            {e.buttonLabel}
          </button>
          {e.guarantee && (
            <p className="lb-guar">
              <Icon name="shield" size={16} />
              {e.guarantee}
            </p>
          )}
        </form>
      );
    }
    case "upsell":
      return (
        <form action={ctx.editing ? undefined : ctx.actions.upsell} className="lb-up" onSubmit={ctx.editing ? (ev) => ev.preventDefault() : undefined}>
          <input type="hidden" name="elementId" value={e.id} />
          <button type="submit" name="take" value="yes" className="lb-btn lb-btn-lg">
            <span>{e.yesLabel}</span>
            <small>
              {e.product.name} · {money(e.product.priceCents)}
              {per(e.product)}, added to the card you just used
            </small>
          </button>
          <button type="submit" name="take" value="no" className="lb-no" formNoValidate>
            {e.noLabel}
          </button>
        </form>
      );
    case "progress": {
      const v = Math.max(0, Math.min(100, e.value));
      return (
        <div className="lb-prog">
          {e.label && <span>{e.label}</span>}
          <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${v}%` }} />
          </div>
        </div>
      );
    }
    case "logos":
      return (
        <div className="lb-logos">
          {e.names.map((n, i) => (
            <span key={i}>{n}</span>
          ))}
        </div>
      );
    case "html":
      return <iframe className="lb-frame" title="Custom code" sandbox="allow-scripts allow-popups allow-forms" srcDoc={e.html} style={{ height: Math.max(40, Math.min(2000, e.height)), pointerEvents: ctx.editing ? "none" : undefined }} />;
    case "lotus_form": {
      const f = ctx.refs.forms?.find((x) => x.id === e.formId);
      if (f && f.live && !ctx.editing) return <iframe className="lb-frame" src={`/form/${f.slug}?embed=1`} title={f.name} loading="lazy" style={{ height: 560 }} />;
      return <div className="lb-ph" style={{ minHeight: 240 }}>{f ? (f.live ? `${f.name} shows here on the live page.` : `${f.name} is a draft. Publish it in Forms to show it here.`) : "Pick a form in the panel."}</div>;
    }
    case "calendar": {
      const c = ctx.refs.calendars?.find((x) => x.slug === e.calendarSlug);
      if (c && !ctx.editing) return <iframe className="lb-frame" src={`/book/${c.slug}`} title={c.name} loading="lazy" style={{ height: 720 }} />;
      return <div className="lb-ph" style={{ minHeight: 320 }}>{c ? `${c.name} booking calendar shows here on the live page.` : "Pick a calendar in the panel."}</div>;
    }
    case "donation_element": {
      const x = ctx.refs.elements?.find((y) => y.id === e.elementId);
      if (x && x.live && !ctx.editing) return <iframe className="lb-frame" src={`/e/${x.id}`} title={x.name} loading="lazy" style={{ height: x.overlay ? 160 : 640 }} />;
      return <div className="lb-ph" style={{ minHeight: 160 }}>{x ? (x.live ? `${x.name} (${x.typeLabel}) shows here on the live page.` : `${x.name} is paused. Turn it on in Elements to show it here.`) : "Pick a donation element in the panel."}</div>;
    }
  }
}

function Sections({ sections, ctx }: { sections: BuilderSection[]; ctx: Ctx }) {
  return sections.map((s) => (
    <section key={s.id} id={s.id} className={`lb-sec lb-${s.id}`} data-lb={s.id} data-lbk="section">
      <div className="lb-in">
        {s.rows.map((r) => (
          <div key={r.id} className={`lb-row lb-${r.id}`} data-lb={r.id} data-lbk="row">
            {r.columns.map((c) => (
              <div key={c.id} className={`lb-col lb-${c.id}`} style={{ ["--span" as string]: c.span }} data-valign={c.valign} data-lb={c.id} data-lbk="column">
                {c.elements.map((e) => (
                  <div key={e.id} id={e.id === ctx.formAnchor ? "form" : undefined} className={`lb-el lb-${e.id}`} data-lb={e.id} data-lbk="element" data-lbt={e.type}>
                    <ElementView e={e} ctx={ctx} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  ));
}

export function BuilderPage({
  doc,
  theme,
  refs = {},
  actions = {},
  editing = false,
  popupOpen,
  inline,
  header,
  footer,
  className,
}: {
  doc: BuilderDoc;
  theme: BuilderTheme;
  refs?: RenderRefs;
  actions?: RenderActions;
  editing?: boolean;
  /** Editor: show the popup over the page instead of the page. */
  popupOpen?: boolean;
  inline?: Ctx["inline"];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const all = [...doc.sections, ...(doc.popup?.sections ?? [])];
  // "Scroll to form" buttons land on the first form, or on the offer when the page has no form.
  const els = doc.sections.flatMap((s) => s.rows.flatMap((r) => r.columns.flatMap((c) => c.elements)));
  const anchor = (els.find((e) => e.type === "form" || e.type === "order" || e.type === "lotus_form") ?? els.find((e) => e.type === "pricing" || e.type === "upsell"))?.id;
  const ctx: Ctx = { refs, actions, editing, formAnchor: anchor, inline };
  const href = fontHref(theme);
  const showPopup = !!doc.popup && (doc.popup.enabled || editing) && doc.popup.sections.length > 0;
  return (
    <div className={`lb-root${className ? ` ${className}` : ""}`} style={themeVars(theme)}>
      {href && <link rel="stylesheet" href={href} precedence="default" />}
      <style>{`${BASE}\n${docCss(all, editing)}`}</style>
      {header}
      {!(editing && popupOpen) && <Sections sections={doc.sections} ctx={ctx} />}
      {!(editing && popupOpen) && doc.sections.length === 0 && <p className="lb-empty">{editing ? "Drag a section here to start." : "This page is empty."}</p>}
      {footer}
      {showPopup &&
        (editing ? (
          popupOpen && (
            <div style={{ padding: "48px 20px", minHeight: "100%", background: "rgba(10,12,20,.55)", display: "grid", placeItems: "start center" }}>
              <div className="lb-pop-box">
                <Sections sections={doc.popup!.sections} ctx={ctx} />
              </div>
            </div>
          )
        ) : (
          <PopupHost trigger={doc.popup!.trigger} delaySeconds={doc.popup!.delaySeconds ?? 8} enabled={doc.popup!.enabled}>
            <Sections sections={doc.popup!.sections} ctx={ctx} />
          </PopupHost>
        ))}
    </div>
  );
}
