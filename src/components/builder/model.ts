import type {
  BuilderColumn,
  BuilderDoc,
  BuilderElement,
  BuilderElementType,
  BuilderFieldKey,
  BuilderFont,
  BuilderRow,
  BuilderSection,
  BuilderStyle,
  BuilderTheme,
  FunnelBlock,
  FunnelStepKind,
  WebsiteBlock,
} from "@/lib/types";

/*
 * The visual builder's model. Plain module: the editor, the public renderer
 * and the server actions all import it. A page is sections > rows > columns >
 * elements, the same shape GoHighLevel uses, so anything a client has built
 * there maps one to one.
 */

/* ------------------------------ ids ------------------------------ */

let seq = 0;
export function uid(prefix = "n") {
  seq = (seq + 1) % 1e6;
  return `${prefix}${Date.now().toString(36).slice(-5)}${seq.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Fresh ids for every node, used by duplicate, paste and templates. */
export function reId<T>(node: T): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) o[k] = k === "id" && typeof x === "string" ? uid(x.slice(0, 1)) : walk(x);
      return o;
    }
    return v;
  };
  return walk(node) as T;
}

/* ------------------------------ theme ------------------------------ */

export const fonts: Record<BuilderFont, { label: string; stack: string; google?: string }> = {
  geist: { label: "Geist", stack: "var(--font-geist-sans), Geist, system-ui, sans-serif" },
  inter: { label: "Inter", stack: "'Inter', system-ui, sans-serif", google: "Inter:wght@400;500;600;700" },
  manrope: { label: "Manrope", stack: "'Manrope', system-ui, sans-serif", google: "Manrope:wght@400;500;600;700" },
  "dm-sans": { label: "DM Sans", stack: "'DM Sans', system-ui, sans-serif", google: "DM+Sans:wght@400;500;600;700" },
  "space-grotesk": { label: "Space Grotesk", stack: "'Space Grotesk', system-ui, sans-serif", google: "Space+Grotesk:wght@400;500;600;700" },
  fraunces: { label: "Fraunces", stack: "'Fraunces', Georgia, serif", google: "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700" },
  playfair: { label: "Playfair Display", stack: "'Playfair Display', Georgia, serif", google: "Playfair+Display:wght@400;600;700" },
  lora: { label: "Lora", stack: "'Lora', Georgia, serif", google: "Lora:wght@400;500;600;700" },
};

export function fontHref(theme: BuilderTheme): string | null {
  const fams = [...new Set([theme.headingFont, theme.bodyFont])].map((f) => fonts[f]?.google).filter(Boolean);
  return fams.length ? `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f}`).join("&")}&display=swap` : null;
}

export function defaultTheme(brand = "#0f1221"): BuilderTheme {
  return { primary: safeColor(brand) ?? "#0f1221", ink: "#0f1221", muted: "#4b4f63", background: "#faf9f6", headingFont: "geist", bodyFont: "geist", radius: 10, buttonRadius: 8 };
}

export function themeOf(t: Partial<BuilderTheme> | undefined, brand: string): BuilderTheme {
  const d = defaultTheme(brand);
  if (!t) return d;
  return {
    primary: safeColor(t.primary) ?? d.primary,
    ink: safeColor(t.ink) ?? d.ink,
    muted: safeColor(t.muted) ?? d.muted,
    background: safeColor(t.background) ?? d.background,
    headingFont: t.headingFont && t.headingFont in fonts ? t.headingFont : d.headingFont,
    bodyFont: t.bodyFont && t.bodyFont in fonts ? t.bodyFont : d.bodyFont,
    radius: clamp(t.radius, 0, 32) ?? d.radius,
    buttonRadius: clamp(t.buttonRadius, 0, 40) ?? d.buttonRadius,
  };
}

/* ------------------------------ sanitising ------------------------------ */

export function clamp(n: unknown, lo: number, hi: number): number | undefined {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : undefined;
}

export function safeColor(c: unknown): string | undefined {
  if (typeof c !== "string") return undefined;
  const v = c.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)$/.test(v)) return v;
  if (v === "transparent" || v === "white" || v === "black") return v;
  if (/^var\(--lb-(primary|ink|muted|bg)\)$/.test(v)) return v;
  return undefined;
}

/** Links a visitor can follow: web, mail, phone, in-page anchors and site paths. */
export function safeHref(h: unknown): string | undefined {
  if (typeof h !== "string") return undefined;
  const v = h.trim();
  if (/^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i.test(v)) return v;
  return undefined;
}

export function safeSrc(s: unknown): string | undefined {
  if (typeof s !== "string") return undefined;
  const v = s.trim();
  return /^(https:\/\/|\/(?!\/))/i.test(v) && !/["'()\\\s<>]/.test(v) ? v : undefined;
}

/** YouTube, Vimeo or Loom links become their embed address; anything else is refused. */
export function videoEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v") ?? (u.pathname.startsWith("/embed/") ? u.pathname.slice(7) : u.pathname.startsWith("/shorts/") ? u.pathname.slice(8) : "");
      return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean).pop() ?? "";
      return /^\d{4,12}$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "loom.com") {
      const id = u.pathname.split("/").filter(Boolean).pop() ?? "";
      return /^[0-9a-f]{20,40}$/.test(id) ? `https://www.loom.com/embed/${id}` : null;
    }
  } catch {
    /* not a url */
  }
  return null;
}

const elementTypes: BuilderElementType[] = ["headline", "text", "button", "image", "video", "list", "form", "divider", "spacer", "countdown", "testimonial", "faq", "stat", "pricing", "order", "upsell", "progress", "logos", "html", "lotus_form", "calendar", "donation_element"];

/**
 * Structural check on a page coming back from the browser. Content is escaped
 * at render and every style value is checked when the CSS is written, so this
 * only guards the tree's shape and its size.
 */
export function parseDoc(json: string): BuilderDoc | null {
  if (json.length > 600_000) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  const okId = (v: unknown) => typeof v === "string" && v.length > 0 && v.length < 64;
  const sections = (v: unknown): BuilderSection[] | null => {
    if (!Array.isArray(v) || v.length > 80) return null;
    for (const s of v) {
      if (!isObj(s) || !okId(s.id) || !Array.isArray(s.rows) || s.rows.length > 24) return null;
      for (const r of s.rows) {
        if (!isObj(r) || !okId(r.id) || !Array.isArray(r.columns) || r.columns.length < 1 || r.columns.length > 6) return null;
        for (const c of r.columns) {
          if (!isObj(c) || !okId(c.id) || !Array.isArray(c.elements) || c.elements.length > 60) return null;
          for (const e of c.elements) if (!isObj(e) || !okId(e.id) || !elementTypes.includes(e.type as BuilderElementType)) return null;
        }
      }
    }
    return v as BuilderSection[];
  };
  if (!isObj(raw)) return null;
  const main = sections(raw.sections);
  if (!main) return null;
  let popup: BuilderDoc["popup"];
  if (isObj(raw.popup)) {
    const ps = sections(raw.popup.sections);
    if (!ps) return null;
    popup = { enabled: raw.popup.enabled === true, trigger: raw.popup.trigger === "delay" ? "delay" : "exit", delaySeconds: clamp(raw.popup.delaySeconds, 1, 120) ?? 8, sections: ps };
  }
  return { v: 1, sections: main, popup };
}

/* ------------------------------ catalogue ------------------------------ */

export type ElementGroup = "Text" | "Media" | "Forms" | "Sell" | "Proof" | "Layout" | "Embed";

export const elementCatalog: { type: BuilderElementType; label: string; group: ElementGroup; hint: string; site?: boolean; funnel?: boolean }[] = [
  { type: "headline", label: "Headline", group: "Text", hint: "H1 to H4" },
  { type: "text", label: "Paragraph", group: "Text", hint: "Body copy" },
  { type: "list", label: "Bullet list", group: "Text", hint: "Ticks or dots" },
  { type: "button", label: "Button", group: "Text", hint: "Link, next step or popup" },
  { type: "image", label: "Image", group: "Media", hint: "Photo or graphic" },
  { type: "video", label: "Video", group: "Media", hint: "YouTube, Vimeo, Loom" },
  { type: "logos", label: "Logo bar", group: "Media", hint: "As seen in" },
  { type: "form", label: "Opt-in form", group: "Forms", hint: "Lands in Contacts" },
  { type: "lotus_form", label: "Lotus form", group: "Forms", hint: "A form from Forms" },
  { type: "calendar", label: "Calendar", group: "Forms", hint: "Booking widget" },
  { type: "donation_element", label: "Donation element", group: "Sell", hint: "A live element from Elements" },
  { type: "order", label: "Order form", group: "Sell", hint: "Products and a bump" },
  { type: "upsell", label: "One-click upsell", group: "Sell", hint: "Yes / no offer" },
  { type: "pricing", label: "Pricing card", group: "Sell", hint: "Plan and features" },
  { type: "countdown", label: "Countdown", group: "Sell", hint: "Date or evergreen" },
  { type: "testimonial", label: "Testimonial", group: "Proof", hint: "Quote and name" },
  { type: "stat", label: "Number", group: "Proof", hint: "Big figure" },
  { type: "faq", label: "FAQ", group: "Proof", hint: "Questions" },
  { type: "progress", label: "Progress bar", group: "Proof", hint: "Goal or step" },
  { type: "divider", label: "Divider", group: "Layout", hint: "Hairline" },
  { type: "spacer", label: "Spacer", group: "Layout", hint: "Empty space" },
  { type: "html", label: "Custom code", group: "Embed", hint: "HTML in a frame" },
];

export const elementLabel = Object.fromEntries(elementCatalog.map((e) => [e.type, e.label])) as Record<BuilderElementType, string>;

export function newElement(type: BuilderElementType): BuilderElement {
  const id = uid("e");
  switch (type) {
    case "headline":
      return { id, type, tag: "h2", text: "A headline that says what they get" };
    case "text":
      return { id, type, text: "One or two sentences that back the headline up. Say who it is for and why it works." };
    case "button":
      return { id, type, label: "Get started", action: "next", variant: "solid", size: "lg" };
    case "image":
      return { id, type, src: "", alt: "", ratio: "4/3" };
    case "video":
      return { id, type, url: "" };
    case "list":
      return { id, type, icon: "check", items: ["The first thing they get", "The second thing they get", "The third thing they get"] };
    case "form":
      return {
        id,
        type,
        fields: [
          { key: "name", label: "Full name", required: true },
          { key: "email", label: "Email", required: true },
        ],
        buttonLabel: "Send it to me",
        note: "No spam. Unsubscribe any time.",
      };
    case "divider":
      return { id, type };
    case "spacer":
      return { id, type, height: 32 };
    case "countdown":
      return { id, type, mode: "evergreen", minutes: 15, expired: "This offer has ended." };
    case "testimonial":
      return { id, type, quote: "They did exactly what they said they would, and it showed in the numbers within a month.", name: "Jordan P.", detail: "Customer since 2024", rating: 5 };
    case "faq":
      return { id, type, items: [{ q: "How long does it take?", a: "Most people see the first result within a week." }, { q: "Can I cancel?", a: "Yes, any time, from your account." }] };
    case "stat":
      return { id, type, value: "1,200+", label: "Customers served" };
    case "pricing":
      return { id, type, name: "Standard", price: "$49", period: "/month", blurb: "Everything to get started.", features: ["First feature", "Second feature", "Third feature"], buttonLabel: "Choose Standard", action: "next" };
    case "order":
      return {
        id,
        type,
        products: [{ id: uid("p"), name: "The main offer", priceCents: 4700, interval: "once" }],
        bump: { product: { id: uid("p"), name: "Add the quick-start guide", priceCents: 1700, interval: "once" }, pitch: "Yes, add the guide to my order. One time offer." },
        buttonLabel: "Complete my order",
        guarantee: "30-day money-back guarantee",
      };
    case "upsell":
      return { id, type, product: { id: uid("p"), name: "The done-for-you upgrade", priceCents: 9700, interval: "once" }, yesLabel: "Yes, add this to my order", noLabel: "No thanks, I'll pass" };
    case "progress":
      return { id, type, value: 50, label: "Step 1 of 2 complete" };
    case "logos":
      return { id, type, names: ["Northwind", "Brightside", "Harbor & Co", "Summit"] };
    case "html":
      return { id, type, html: "<p style=\"font-family:system-ui;text-align:center\">Your code here</p>", height: 120 };
    case "lotus_form":
      return { id, type, formId: "" };
    case "calendar":
      return { id, type, calendarSlug: "" };
    case "donation_element":
      return { id, type, elementId: "" };
  }
}

export function column(span: number, elements: BuilderElement[] = [], extra: Partial<BuilderColumn> = {}): BuilderColumn {
  return { id: uid("c"), span, elements, ...extra };
}

export function row(columns: BuilderColumn[], extra: Partial<BuilderRow> = {}): BuilderRow {
  return { id: uid("r"), columns, ...extra };
}

export function section(rows: BuilderRow[], extra: Partial<BuilderSection> = {}): BuilderSection {
  return { id: uid("s"), rows, style: { padTop: 80, padBottom: 80 }, ...extra };
}

/** Row presets, as 12-column spans. */
export const rowLayouts: { key: string; label: string; spans: number[] }[] = [
  { key: "1", label: "One column", spans: [12] },
  { key: "2", label: "Two equal", spans: [6, 6] },
  { key: "2l", label: "Wide left", spans: [7, 5] },
  { key: "2r", label: "Wide right", spans: [5, 7] },
  { key: "3", label: "Three", spans: [4, 4, 4] },
  { key: "4", label: "Four", spans: [3, 3, 3, 3] },
];

export function emptyDoc(): BuilderDoc {
  return { v: 1, sections: [section([row([column(12, [newElement("headline"), newElement("text")])])], { style: { padTop: 96, padBottom: 96, align: "center", maxWidth: 760 } })] };
}

/* ------------------------------ tree ------------------------------ */

export type NodeKind = "section" | "row" | "column" | "element";
export type Node = BuilderSection | BuilderRow | BuilderColumn | BuilderElement;

export interface Located {
  kind: NodeKind;
  node: Node;
  /** Ids from the section down to the node. */
  path: string[];
}

export function locate(sections: BuilderSection[], id: string): Located | null {
  for (const s of sections) {
    if (s.id === id) return { kind: "section", node: s, path: [s.id] };
    for (const r of s.rows) {
      if (r.id === id) return { kind: "row", node: r, path: [s.id, r.id] };
      for (const c of r.columns) {
        if (c.id === id) return { kind: "column", node: c, path: [s.id, r.id, c.id] };
        for (const e of c.elements) if (e.id === id) return { kind: "element", node: e, path: [s.id, r.id, c.id, e.id] };
      }
    }
  }
  return null;
}

type Mapper = (sections: BuilderSection[]) => BuilderSection[];

/** Replace one node (any depth) with the result of `fn`; returning null removes it. */
export function mapNode(id: string, fn: (n: Node) => Node | null): Mapper {
  const each = <T extends { id: string }>(xs: T[], inner: (x: T) => T): T[] =>
    xs.flatMap((x) => {
      if (x.id === id) {
        const r = fn(x as unknown as Node);
        return r ? [r as unknown as T] : [];
      }
      return [inner(x)];
    });
  return (sections) =>
    each(sections, (s) => ({
      ...s,
      rows: each(s.rows, (r) => ({ ...r, columns: each(r.columns, (c) => ({ ...c, elements: each(c.elements, (e) => e) })) })),
    }));
}

export function updateNode(id: string, patch: (n: Node) => Node): Mapper {
  return mapNode(id, patch);
}

export function removeNode(id: string): Mapper {
  return (sections) => {
    const next = mapNode(id, () => null)(sections);
    // A row keeps at least one column; a column removed from a row gives its width to the neighbours.
    return next.map((s) => ({
      ...s,
      rows: s.rows
        .filter((r) => r.columns.length > 0)
        .map((r) => {
          const total = r.columns.reduce((a, c) => a + c.span, 0);
          if (total === 12) return r;
          return { ...r, columns: spread(r.columns.length).map((span, i) => ({ ...r.columns[i]!, span })) };
        }),
    }));
  };
}

/** Even spans across n columns, remainder to the first. */
export function spread(n: number): number[] {
  const base = Math.floor(12 / n);
  return Array.from({ length: n }, (_, i) => base + (i < 12 - base * n ? 1 : 0));
}

function parentList(sections: BuilderSection[], id: string): { list: { id: string }[]; index: number } | null {
  const i = sections.findIndex((s) => s.id === id);
  if (i >= 0) return { list: sections, index: i };
  for (const s of sections) {
    const ri = s.rows.findIndex((r) => r.id === id);
    if (ri >= 0) return { list: s.rows, index: ri };
    for (const r of s.rows) {
      const ci = r.columns.findIndex((c) => c.id === id);
      if (ci >= 0) return { list: r.columns, index: ci };
      for (const c of r.columns) {
        const ei = c.elements.findIndex((e) => e.id === id);
        if (ei >= 0) return { list: c.elements, index: ei };
      }
    }
  }
  return null;
}

/** Siblings of a node, for the move buttons. */
export function siblingInfo(sections: BuilderSection[], id: string): { index: number; count: number } | null {
  const p = parentList(sections, id);
  return p ? { index: p.index, count: p.list.length } : null;
}

const clone = <T,>(v: T): T => structuredClone(v);

/** Move a node one place up or down among its siblings. */
export function shiftNode(id: string, dir: -1 | 1): Mapper {
  return (sections) => {
    const next = clone(sections);
    const p = parentList(next, id);
    if (!p) return sections;
    const j = p.index + dir;
    if (j < 0 || j >= p.list.length) return sections;
    const [x] = p.list.splice(p.index, 1);
    p.list.splice(j, 0, x!);
    return next;
  };
}

export function duplicateNode(id: string): { map: Mapper; newId: () => string | null } {
  let created: string | null = null;
  return {
    map: (sections) => {
      const next = clone(sections);
      const p = parentList(next, id);
      if (!p) return sections;
      const copy = reId(p.list[p.index]!);
      created = copy.id;
      p.list.splice(p.index + 1, 0, copy);
      return next;
    },
    newId: () => created,
  };
}

/** Where a dragged thing lands. */
export type DropTarget =
  | { kind: "section"; index: number }
  | { kind: "row"; sectionId: string; index: number }
  | { kind: "element"; columnId: string; index: number };

/** Take a node out of the tree (for a move), returning it and the tree without it. */
export function detach(sections: BuilderSection[], id: string): { node: Node | null; sections: BuilderSection[] } {
  const next = clone(sections);
  const p = parentList(next, id);
  if (!p) return { node: null, sections };
  const [n] = p.list.splice(p.index, 1);
  return { node: n as Node, sections: next };
}

export function insertAt(sections: BuilderSection[], target: DropTarget, node: Node): BuilderSection[] {
  const next = clone(sections);
  if (target.kind === "section") {
    next.splice(Math.min(target.index, next.length), 0, node as BuilderSection);
    return next;
  }
  if (target.kind === "row") {
    const s = next.find((s) => s.id === target.sectionId);
    if (!s) return sections;
    s.rows.splice(Math.min(target.index, s.rows.length), 0, node as BuilderRow);
    return next;
  }
  for (const s of next)
    for (const r of s.rows)
      for (const c of r.columns)
        if (c.id === target.columnId) {
          c.elements.splice(Math.min(target.index, c.elements.length), 0, node as BuilderElement);
          return next;
        }
  return sections;
}

/** Move a node to a drop target, fixing the index when it moves down within the same list. */
export function moveTo(sections: BuilderSection[], id: string, target: DropTarget): BuilderSection[] {
  const before = parentList(sections, id);
  const { node, sections: without } = detach(sections, id);
  if (!node) return sections;
  let t = target;
  if (before) {
    const listOf = (x: DropTarget) =>
      x.kind === "section" ? sections : x.kind === "row" ? sections.find((s) => s.id === x.sectionId)?.rows : sections.flatMap((s) => s.rows.flatMap((r) => r.columns)).find((c) => c.id === x.columnId)?.elements;
    const sameList = listOf(t) === before.list;
    if (sameList && t.index > before.index) t = { ...t, index: t.index - 1 } as DropTarget;
  }
  return insertAt(without, t, node);
}

/** Change a row's layout, keeping every element (extra columns fold into the last kept one). */
export function setRowLayout(r: BuilderRow, spans: number[]): BuilderRow {
  const cols = spans.map((span, i) => (r.columns[i] ? { ...r.columns[i]!, span } : column(span)));
  const extra = r.columns.slice(spans.length).flatMap((c) => c.elements);
  if (extra.length) cols[cols.length - 1] = { ...cols[cols.length - 1]!, elements: [...cols[cols.length - 1]!.elements, ...extra] };
  return { ...r, columns: cols };
}

export function countElements(doc: BuilderDoc) {
  return doc.sections.reduce((a, s) => a + s.rows.reduce((b, r) => b + r.columns.reduce((c, col) => c + col.elements.length, 0), 0), 0);
}

export function allElements(doc: BuilderDoc): BuilderElement[] {
  return [...doc.sections, ...(doc.popup?.sections ?? [])].flatMap((s) => s.rows.flatMap((r) => r.columns.flatMap((c) => c.elements)));
}

/* ------------------------------ CSS ------------------------------ */

const shadows = { none: "none", sm: "0 1px 2px rgba(15,18,33,.06),0 2px 6px rgba(15,18,33,.06)", md: "0 2px 4px rgba(15,18,33,.05),0 10px 28px rgba(15,18,33,.10)", lg: "0 4px 8px rgba(15,18,33,.06),0 24px 56px rgba(15,18,33,.16)" } as const;

function decls(st: BuilderStyle | undefined, kind: NodeKind, editing: boolean, mobile: boolean, elType?: BuilderElementType): string {
  if (!st) return "";
  const out: string[] = [];
  const num = (v: unknown, lo: number, hi: number) => clamp(v, lo, hi);
  const m = mobile ? "m" : "";
  const bg = safeColor(st.bg);
  const img = safeSrc(st.bgImage);
  const ov = typeof st.overlay === "number" ? Math.min(0.9, Math.max(0, st.overlay)) : 0;
  if (elType === "button") {
    if (bg) out.push(`--lb-btn-bg:${bg}`);
  } else if (img) out.push(`background:${ov ? `linear-gradient(rgba(10,12,20,${ov}),rgba(10,12,20,${ov})),` : ""}url("${img}") center/cover no-repeat${bg ? ` ${bg}` : ""}`);
  else if (bg) out.push(`background:${bg}`);
  const color = safeColor(st.color);
  if (color) out.push(elType === "button" ? `--lb-btn-fg:${color}` : `color:${color};--lb-fg:${color}`);
  if (kind === "section") {
    const t = num(st.padTop, 0, 400);
    const b = num(st.padBottom, 0, 400);
    const x = num(st.padX, 0, 200);
    if (t !== undefined) out.push(`--lb-${m}pt:${t}px`);
    if (b !== undefined) out.push(`--lb-${m}pb:${b}px`);
    if (x !== undefined) out.push(`--lb-${m}px:${x}px`);
    const mw = num(st.maxWidth, 280, 1600);
    if (mw !== undefined) out.push(`--lb-max:${mw}px`);
  } else {
    const t = num(st.padTop, 0, 400);
    const b = num(st.padBottom, 0, 400);
    const x = num(st.padX, 0, 200);
    if (t !== undefined) out.push(`padding-top:${t}px`);
    if (b !== undefined) out.push(`padding-bottom:${b}px`);
    if (x !== undefined) out.push(`padding-left:${x}px;padding-right:${x}px`);
  }
  const mt = num(st.marginTop, -200, 400);
  const mb = num(st.marginBottom, -200, 400);
  if (mt !== undefined) out.push(`margin-top:${mt}px`);
  if (mb !== undefined) out.push(`margin-bottom:${mb}px`);
  const r = num(st.radius, 0, 80);
  if (r !== undefined) out.push(elType === "button" ? `--lb-btn-r:${r}px` : `border-radius:${r}px;--lb-inner-r:${Math.max(0, r - 4)}px`);
  const bw = num(st.borderWidth, 0, 12);
  const bc = safeColor(st.borderColor);
  if (bw !== undefined) out.push(bw > 0 ? `border:${bw}px solid ${bc ?? "rgba(15,18,33,.12)"}` : "border:0");
  if (st.shadow && st.shadow in shadows) out.push(`box-shadow:${shadows[st.shadow]}`);
  if (st.align && ["left", "center", "right"].includes(st.align)) out.push(`text-align:${st.align};--lb-justify:${st.align === "left" ? "flex-start" : st.align === "right" ? "flex-end" : "center"}`);
  const fs = num(st.fontSize, 8, 160);
  if (fs !== undefined) out.push(kind === "element" ? `--lb-${m}fs:${fs}px` : `font-size:${fs}px`);
  if (st.weight && [400, 500, 600, 700].includes(st.weight)) out.push(kind === "element" ? `--lb-w:${st.weight}` : `font-weight:${st.weight}`);
  if (typeof st.lineHeight === "number" && st.lineHeight >= 0.8 && st.lineHeight <= 3) out.push(kind === "element" ? `--lb-lh:${st.lineHeight}` : `line-height:${st.lineHeight}`);
  return out.join(";");
}

/**
 * Every node's look as one stylesheet scoped to the page. Mobile values sit in
 * a container query on the page root, so the editor's phone frame and a real
 * phone render the same rules.
 */
export function docCss(sections: BuilderSection[], editing = false): string {
  const rules: string[] = [];
  const mobile: string[] = [];
  const desktopOnly: string[] = [];
  const hide = editing ? "opacity:.3;outline:1px dashed rgba(15,18,33,.4);outline-offset:-1px" : "display:none!important";
  const add = (id: string, kind: NodeKind, n: { style?: BuilderStyle; mobile?: BuilderStyle }, elType?: BuilderElementType) => {
    const d = decls(n.style, kind, editing, false, elType);
    if (d) rules.push(`.lb-${id}{${d}}`);
    const md = decls(n.mobile, kind, editing, true, elType);
    if (md) mobile.push(`.lb-${id}{${md}}`);
    // "Hidden" is per device: style.hidden hides on desktop only, mobile.hidden on phones only.
    if (n.style?.hidden) desktopOnly.push(`.lb-${id}{${hide}}`);
    if (n.mobile?.hidden) mobile.push(`.lb-${id}{${hide}}`);
  };
  for (const s of sections) {
    add(s.id, "section", s);
    for (const r of s.rows) {
      add(r.id, "row", r);
      const gap = clamp(r.gap, 0, 120);
      if (gap !== undefined) rules.push(`.lb-${r.id}{--lb-gap:${gap}px}`);
      for (const c of r.columns) {
        add(c.id, "column", c);
        for (const e of c.elements) add(e.id, "element", e, e.type);
      }
    }
  }
  return `${rules.join("\n")}\n@container lotuspage (min-width: 768px){${desktopOnly.join("\n")}}\n@container lotuspage (max-width: 767px){${mobile.join("\n")}}`;
}

export function themeVars(t: BuilderTheme): React.CSSProperties {
  return {
    ["--lb-primary" as string]: t.primary,
    ["--lb-ink" as string]: t.ink,
    ["--lb-muted" as string]: t.muted,
    ["--lb-bg" as string]: t.background,
    ["--lb-radius" as string]: `${t.radius}px`,
    ["--lb-btn-radius" as string]: `${t.buttonRadius}px`,
    ["--lb-heading" as string]: fonts[t.headingFont].stack,
    ["--lb-body" as string]: fonts[t.bodyFont].stack,
    ["--fb" as string]: t.primary,
  };
}

/* ------------------------------ legacy blocks ------------------------------ */

const legacyField: Record<string, { key: BuilderFieldKey; label: string }> = {
  name: { key: "name", label: "Name" },
  email: { key: "email", label: "Email" },
  phone: { key: "phone", label: "Phone" },
  address: { key: "address", label: "Address" },
  message: { key: "message", label: "What do you need?" },
  amount: { key: "amount", label: "Amount" },
};

const h = (text: string, tag: "h1" | "h2" | "h3" | "h4", style?: BuilderStyle): BuilderElement => ({ id: uid("e"), type: "headline", tag, text, style });
const p = (text: string, style?: BuilderStyle): BuilderElement => ({ id: uid("e"), type: "text", text, style });

function formFrom(b: Extract<FunnelBlock, { type: "form" }>): BuilderElement[] {
  return [
    h(b.headline, "h3", { marginBottom: 4 }),
    ...(b.subhead ? [p(b.subhead, { fontSize: 14, marginBottom: 16 })] : []),
    { id: uid("e"), type: "form", fields: b.fields.map((f) => ({ ...legacyField[f]!, required: f === "name" || f === "email" || f === "phone" })), buttonLabel: b.buttonLabel, note: b.note },
  ];
}

const card: BuilderStyle = { bg: "#ffffff", padTop: 32, padBottom: 32, padX: 32, radius: 14, borderWidth: 1, borderColor: "#e9e7e1", shadow: "md" };

/**
 * Pages made before the visual builder were a list of preset blocks. Each one
 * becomes ordinary sections, rows and elements so every word stays editable.
 */
export function blocksToDoc(blocks: WebsiteBlock[]): BuilderDoc {
  const sections: BuilderSection[] = [];
  const hero = blocks[0];
  const splitForm = hero?.type === "hero" && hero.align === "split" ? blocks.find((b) => b.type === "form") : undefined;
  for (const b of blocks) {
    if (b === splitForm) continue;
    switch (b.type) {
      case "hero": {
        const left: BuilderElement[] = [
          ...(b.eyebrow ? [p(b.eyebrow, { fontSize: 15, weight: 500, marginBottom: 12 })] : []),
          h(b.headline, "h1"),
          ...(b.subhead ? [p(b.subhead, { fontSize: 19, marginTop: 20 })] : []),
          ...(b.buttonLabel ? [{ id: uid("e"), type: "button", label: b.buttonLabel, action: b.buttonHref && b.buttonHref !== "#form" ? "link" : "scroll", href: b.buttonHref || "#form", variant: "solid", size: "lg", style: { marginTop: 32 } } as BuilderElement] : []),
        ];
        const cols = splitForm && splitForm.type === "form" ? [column(7, left), column(5, formFrom(splitForm), { style: card })] : [column(12, left)];
        sections.push(section([row(cols, { gap: 48 })], { name: "Hero", style: { padTop: 80, padBottom: 96, maxWidth: b.align === "center" ? 760 : 1040, align: b.align === "center" ? "center" : undefined } }));
        break;
      }
      case "stats":
        sections.push(section([row(b.items.map((it) => column(Math.floor(12 / Math.max(1, b.items.length)), [{ id: uid("e"), type: "stat", value: it.value, label: it.label }])))], { name: "Numbers", style: { bg: "#ffffff", padTop: 40, padBottom: 40, align: "center", maxWidth: 900, borderWidth: 0 } }));
        break;
      case "features":
        sections.push(
          section(
            [
              ...(b.headline ? [row([column(12, [h(b.headline, "h2", { marginBottom: 8 })])])] : []),
              row(b.items.slice(0, 4).map((it) => column(Math.floor(12 / Math.max(1, Math.min(4, b.items.length))), [{ id: uid("e"), type: "divider", style: { color: "var(--lb-primary)" } }, h(it.title, "h4", { marginTop: 4 }), p(it.body, { fontSize: 15 })])), { gap: 32 }),
            ],
            { name: "Features", style: { padTop: 72, padBottom: 72, maxWidth: 960 } },
          ),
        );
        break;
      case "testimonial":
        sections.push(section([row([column(12, [{ id: uid("e"), type: "testimonial", quote: b.quote, name: b.name, detail: b.detail }])])], { name: "Testimonial", style: { bg: "#ffffff", padTop: 72, padBottom: 72, maxWidth: 760, align: "center" } }));
        break;
      case "text":
        sections.push(section([row([column(12, [...(b.headline ? [h(b.headline, "h2")] : []), p(b.body, { fontSize: 18, marginTop: 12 })])])], { name: "Text", style: { padTop: 56, padBottom: 56, maxWidth: 680 } }));
        break;
      case "faq":
        sections.push(section([row([column(12, [{ id: uid("e"), type: "faq", items: b.items }])])], { name: "FAQ", style: { padTop: 56, padBottom: 56, maxWidth: 680 } }));
        break;
      case "cta":
        sections.push(
          section(
            [
              row([
                column(12, [h(b.headline, "h2", { color: "#ffffff" }), ...(b.body ? [p(b.body, { color: "rgba(255,255,255,.75)", marginTop: 12 })] : []), { id: uid("e"), type: "button", label: b.buttonLabel, action: b.buttonHref && b.buttonHref !== "#form" ? "link" : "scroll", href: b.buttonHref || "#form", variant: "solid", size: "lg", style: { marginTop: 28 } }], {
                  style: { bg: "#0f1221", padTop: 48, padBottom: 48, padX: 32, radius: 16 },
                }),
              ]),
            ],
            { name: "Call to action", style: { padTop: 64, padBottom: 64, maxWidth: 760, align: "center" } },
          ),
        );
        break;
      case "form":
        sections.push(section([row([column(12, formFrom(b), { style: card })])], { name: "Form", style: { padTop: 72, padBottom: 72, maxWidth: 560 } }));
        break;
      case "footer":
        sections.push(section([row([column(12, [p(`${b.text}  ·  Built with Lotus`, { fontSize: 13 })])])], { name: "Footer", style: { padTop: 40, padBottom: 40, align: "center" } }));
        break;
      case "lotus_form":
        sections.push(section([row([column(12, [...(b.headline ? [h(b.headline, "h2")] : []), ...(b.subhead ? [p(b.subhead)] : []), { id: uid("e"), type: "lotus_form", formId: b.formId }])])], { name: "Form", style: { padTop: 64, padBottom: 64, maxWidth: 640 } }));
        break;
    }
  }
  return { v: 1, sections };
}

/* ------------------------------ step kinds ------------------------------ */

export const stepKinds: { kind: FunnelStepKind; label: string; goal: string; verb: string }[] = [
  { kind: "optin", label: "Opt-in", goal: "Collect a name and email", verb: "Opt-ins" },
  { kind: "sales", label: "Sales page", goal: "Sell before the order form", verb: "Clicks to order" },
  { kind: "order", label: "Order form", goal: "Take the payment", verb: "Sales" },
  { kind: "upsell", label: "Upsell", goal: "One-click add-on after the sale", verb: "Upsells taken" },
  { kind: "downsell", label: "Downsell", goal: "A smaller offer after a no", verb: "Downsells taken" },
  { kind: "webinar", label: "Webinar sign-up", goal: "Register for a live event", verb: "Registrations" },
  { kind: "application", label: "Application", goal: "Qualify before a call", verb: "Applications" },
  { kind: "thankyou", label: "Thank you", goal: "Confirm and point to next", verb: "Views" },
  { kind: "custom", label: "Custom page", goal: "Anything else", verb: "Conversions" },
];

export const stepKindLabel = Object.fromEntries(stepKinds.map((k) => [k.kind, k.label])) as Record<FunnelStepKind, string>;

/** Which split-test version a new visitor sees; `split` is the percent sent to B. */
export function chooseVariant(split: number): "a" | "b" {
  return Math.random() * 100 < split ? "b" : "a";
}
