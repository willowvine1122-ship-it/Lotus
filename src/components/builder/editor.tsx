"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlignLeft,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Code2,
  Columns3,
  Copy,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Heading,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  List,
  Minus,
  Monitor,
  MousePointerClick,
  Palette,
  PanelTop,
  Play,
  Plus,
  Quote,
  Redo2,
  Search,
  ShoppingCart,
  Smartphone,
  Sparkles,
  SquareStack,
  Star,
  Tag,
  Timer,
  Trash2,
  TrendingUp,
  Undo2,
  X,
  HeartHandshake,
} from "lucide-react";
import type { BuilderColumn, BuilderDoc, BuilderElement, BuilderElementType, BuilderRow, BuilderSection, BuilderTheme } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ColumnContent, ContentPanel, PopupSettings, RowContent, SectionContent, StylePanel, ThemePanel, type Device } from "./inspector";
import {
  column,
  duplicateNode,
  elementCatalog,
  elementLabel,
  insertAt,
  locate,
  moveTo,
  newElement,
  removeNode,
  reId,
  row,
  rowLayouts,
  section,
  shiftNode,
  siblingInfo,
  updateNode,
  type DropTarget,
  type Node,
  type NodeKind,
} from "./model";
import { BuilderPage, type RenderRefs } from "./render";
import { sectionTemplates, type SectionGroup, type TemplateContext } from "./templates";

/*
 * The visual builder. Three panes: what you can add (and the page's layers),
 * the page itself at desktop or phone width, and the selected thing's content
 * and style. Everything on the page is selectable, draggable and editable in
 * place; the renderer marks nodes with data-lb so this file measures and hit
 * tests the real DOM rather than keeping a second layout model.
 */

export interface BuilderPageLink {
  id: string;
  name: string;
  href: string;
  meta?: string;
  active?: boolean;
}

export interface BuilderEditorProps {
  context: "funnel" | "site";
  title: string;
  meta: string;
  backHref: string;
  backLabel: string;
  initialDoc: BuilderDoc;
  initialTheme: BuilderTheme;
  refs: RenderRefs;
  pages: BuilderPageLink[];
  pagesLabel: string;
  templateContext: TemplateContext;
  previewHref: string;
  /** Split test: which version is open and how to switch. */
  variants?: { current: "a" | "b"; hrefA: string; hrefB: string };
  save: (docJson: string, themeJson: string) => Promise<{ ok: boolean; message?: string } | null>;
  /** Shown around the page on the canvas (a website's header and footer). */
  chrome?: { header?: React.ReactNode; footer?: React.ReactNode };
}

type DragPayload = { k: "element"; type: BuilderElementType } | { k: "section"; key: string } | { k: "row"; spans: number[] } | { k: "move"; id: string; kind: NodeKind };

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const DESKTOP = 1200;
const PHONE = 390;

const kindTone: Record<NodeKind, { line: string; chip: string; label: string }> = {
  section: { line: "#0b1220", chip: "bg-rail text-rail-fg", label: "Section" },
  row: { line: "#3f6ad8", chip: "bg-[#3f6ad8] text-white", label: "Row" },
  column: { line: "#c2690f", chip: "bg-[#c2690f] text-white", label: "Column" },
  element: { line: "#6d3df2", chip: "bg-brand text-white", label: "Element" },
};

const elementIcon: Record<BuilderElementType, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  headline: Heading,
  text: AlignLeft,
  list: List,
  button: MousePointerClick,
  image: ImageIcon,
  video: Play,
  logos: Tag,
  form: FileText,
  lotus_form: ClipboardList,
  calendar: CalendarDays,
  donation_element: HeartHandshake,
  order: ShoppingCart,
  upsell: Sparkles,
  pricing: SquareStack,
  countdown: Timer,
  testimonial: Quote,
  stat: TrendingUp,
  faq: PanelTop,
  progress: Minus,
  divider: Minus,
  spacer: Columns3,
  html: Code2,
};

function nodeLabel(kind: NodeKind, n: Node): string {
  if (kind === "section") return (n as BuilderSection).name || "Section";
  if (kind === "row") return `Row · ${(n as BuilderRow).columns.length} col`;
  if (kind === "column") return "Column";
  const e = n as BuilderElement;
  return elementLabel[e.type];
}

function snippet(e: BuilderElement): string {
  switch (e.type) {
    case "headline":
    case "text":
      return e.text;
    case "button":
      return e.label;
    case "testimonial":
      return e.name;
    case "stat":
      return e.value;
    case "pricing":
      return e.name;
    case "order":
      return e.products.map((p) => p.name).join(", ");
    case "upsell":
      return e.product.name;
    default:
      return "";
  }
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

/* ------------------------------ history ------------------------------ */

function useHistory(initial: BuilderDoc) {
  const [state, setState] = useState({ doc: initial, past: [] as BuilderDoc[], future: [] as BuilderDoc[] });
  const last = useRef<{ key: string; at: number } | null>(null);
  const commit = useCallback((next: BuilderDoc | ((d: BuilderDoc) => BuilderDoc), key?: string) => {
    setState((s) => {
      const doc = typeof next === "function" ? next(s.doc) : next;
      if (doc === s.doc) return s;
      const now = Date.now();
      const merge = key && last.current && last.current.key === key && now - last.current.at < 900;
      last.current = key ? { key, at: now } : null;
      return { doc, past: merge ? s.past : [...s.past.slice(-99), s.doc], future: [] };
    });
  }, []);
  const undo = useCallback(() => {
    last.current = null;
    setState((s) => (s.past.length ? { doc: s.past[s.past.length - 1]!, past: s.past.slice(0, -1), future: [s.doc, ...s.future] } : s));
  }, []);
  const redo = useCallback(() => {
    last.current = null;
    setState((s) => (s.future.length ? { doc: s.future[0]!, past: [...s.past, s.doc], future: s.future.slice(1) } : s));
  }, []);
  return { doc: state.doc, canUndo: state.past.length > 0, canRedo: state.future.length > 0, commit, undo, redo };
}

/* ------------------------------ editor ------------------------------ */

export function BuilderEditor(props: BuilderEditorProps) {
  const { context, initialDoc, initialTheme, refs, templateContext } = props;
  const { doc, canUndo, canRedo, commit, undo, redo } = useHistory(initialDoc);
  const [theme, setTheme] = useState(initialTheme);
  const [saved, setSaved] = useState(() => JSON.stringify([initialDoc, initialTheme]));
  const dirty = useMemo(() => JSON.stringify([doc, theme]) !== saved, [doc, theme, saved]);
  const [device, setDevice] = useState<Device>("desktop");
  const [mode, setMode] = useState<"page" | "popup">("page");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [inlineId, setInlineId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<"add" | "layers" | "pages">("add");
  const [rightTab, setRightTab] = useState<"content" | "style">("content");
  const [themeOpen, setThemeOpen] = useState(false);
  const [sheet, setSheet] = useState<"left" | "right" | null>(null);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [saving, startSave] = useTransition();
  const [clip, setClip] = useState<{ kind: NodeKind; node: Node } | null>(null);
  const [insertAfter, setInsertAfter] = useState<number | null>(null);

  const sections = useMemo(() => (mode === "popup" ? (doc.popup?.sections ?? []) : doc.sections), [doc, mode]);
  const applySections = useCallback(
    (fn: (s: BuilderSection[]) => BuilderSection[], key?: string) =>
      commit((d) => {
        if (mode === "popup") {
          const popup = d.popup ?? { enabled: false, trigger: "exit" as const, delaySeconds: 8, sections: [] };
          const next = fn(popup.sections);
          return next === popup.sections ? d : { ...d, popup: { ...popup, sections: next } };
        }
        const next = fn(d.sections);
        return next === d.sections ? d : { ...d, sections: next };
      }, key),
    [commit, mode],
  );

  const selected = selectedId ? locate(sections, selectedId) : null;

  /* ---------- save ---------- */
  const doSave = useCallback(
    (then?: () => void) => {
      const snapshot = JSON.stringify([doc, theme]);
      startSave(async () => {
        const r = await props.save(JSON.stringify(doc), JSON.stringify(theme));
        if (r?.ok) {
          setSaved(snapshot);
          setNotice({ text: r.message ?? "Saved" });
          then?.();
        } else setNotice({ text: r?.message ?? "Could not save", bad: true });
      });
    },
    [doc, theme, props],
  );

  useEffect(() => {
    if (!notice || notice.bad) return;
    const t = window.setTimeout(() => setNotice(null), 2200);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  /* ---------- mutations ---------- */
  const updateSelected = useCallback(
    (n: Node, key = "edit") => {
      applySections(updateNode(n.id, () => n), `${key}:${n.id}`);
    },
    [applySections],
  );

  const remove = useCallback(
    (id: string) => {
      const loc = locate(sections, id);
      applySections(removeNode(id));
      setSelectedId(loc && loc.path.length > 1 ? loc.path[loc.path.length - 2]! : null);
      setInlineId(null);
    },
    [applySections, sections],
  );

  const duplicate = useCallback(
    (id: string) => {
      const d = duplicateNode(id);
      applySections(d.map);
      requestAnimationFrame(() => {
        const nid = d.newId();
        if (nid) setSelectedId(nid);
      });
    },
    [applySections],
  );

  const shift = useCallback((id: string, dir: -1 | 1) => applySections(shiftNode(id, dir)), [applySections]);

  const buildPayload = useCallback(
    (p: DragPayload): { kind: NodeKind; node: Node } | null => {
      if (p.k === "element") return { kind: "element", node: newElement(p.type) };
      if (p.k === "row") return { kind: "row", node: row(p.spans.map((s) => column(s))) };
      if (p.k === "section") {
        if (p.key === "blank") return { kind: "section", node: section([row([column(12)])], { name: "New section" }) };
        const t = sectionTemplates.find((x) => x.key === p.key);
        return t ? { kind: "section", node: t.build(templateContext) } : null;
      }
      return null;
    },
    [templateContext],
  );

  /** Wraps anything that can't go where it was dropped so it still lands somewhere sensible. */
  const place = useCallback(
    (list: BuilderSection[], target: DropTarget, kind: NodeKind, node: Node): BuilderSection[] => {
      if (kind === "section") return insertAt(list, target.kind === "section" ? target : { kind: "section", index: list.length }, node);
      if (kind === "row") {
        if (target.kind === "row") return insertAt(list, target, node);
        return insertAt(list, { kind: "section", index: target.kind === "section" ? target.index : list.length }, section([node as BuilderRow]));
      }
      if (kind === "column") return list; // columns move with their row
      if (target.kind === "element") return insertAt(list, target, node);
      const wrap = section([row([column(12, [node as BuilderElement])])], { style: { padTop: 48, padBottom: 48 } });
      if (target.kind === "row") {
        const s = list.find((x) => x.id === target.sectionId);
        return s ? insertAt(list, target, row([column(12, [node as BuilderElement])])) : list;
      }
      return insertAt(list, target, wrap);
    },
    [],
  );

  /** Click-to-add: lands next to whatever is selected. */
  const addByClick = useCallback(
    (p: DragPayload) => {
      const made = buildPayload(p);
      if (!made) return;
      const sel = selectedId ? locate(sections, selectedId) : null;
      let target: DropTarget;
      if (made.kind === "section") {
        const si = sel ? sections.findIndex((s) => s.id === sel.path[0]) : -1;
        target = { kind: "section", index: insertAfter !== null ? insertAfter + 1 : si >= 0 ? si + 1 : sections.length };
      } else if (made.kind === "row") {
        const s = sel ? sections.find((x) => x.id === sel.path[0]) : sections[sections.length - 1];
        if (!s) target = { kind: "section", index: sections.length };
        else {
          const ri = sel && sel.path[1] ? s.rows.findIndex((r) => r.id === sel.path[1]) : s.rows.length - 1;
          target = { kind: "row", sectionId: s.id, index: ri + 1 };
        }
      } else {
        let col: BuilderColumn | undefined;
        let index = 0;
        if (sel && sel.path.length >= 3) {
          const s = sections.find((x) => x.id === sel.path[0])!;
          const r = s.rows.find((x) => x.id === sel.path[1])!;
          col = r.columns.find((x) => x.id === sel.path[2]);
          index = sel.kind === "element" && col ? col.elements.findIndex((e) => e.id === sel.path[3]) + 1 : (col?.elements.length ?? 0);
        } else if (sel) {
          const s = sections.find((x) => x.id === sel.path[0]);
          const r = sel.kind === "row" ? s?.rows.find((x) => x.id === sel.path[1]) : s?.rows[s.rows.length - 1];
          col = r?.columns[r.columns.length - 1];
          index = col?.elements.length ?? 0;
        }
        target = col ? { kind: "element", columnId: col.id, index } : { kind: "section", index: sections.length };
      }
      applySections((list) => place(list, target, made.kind, made.node));
      setSelectedId(made.node.id);
      setInsertAfter(null);
      setSheet(null);
      setRightTab("content");
      requestAnimationFrame(() => frameRef.current?.querySelector(`[data-lb="${made.node.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    },
    [buildPayload, selectedId, sections, insertAfter, applySections, place],
  );

  /* ---------- canvas measuring ---------- */
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(DESKTOP);
  const [rects, setRects] = useState<{ sel?: Rect; hover?: Rect; drop?: Rect; addAt?: Rect & { index: number } }>({});
  const [, force] = useState(0);
  const frameWidth = device === "phone" ? PHONE : DESKTOP;
  // Fit the frame to the canvas, so a phone-sized editor still shows the whole page width.
  const zoom = Math.min(1, Math.max(0.25, (avail - (avail < 600 ? 24 : 48)) / frameWidth));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => force((n) => n + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rectOf = useCallback((id: string | null): Rect | undefined => {
    if (!id) return undefined;
    const el = frameRef.current?.querySelector(`[data-lb="${CSS.escape(id)}"]`);
    const stage = stageRef.current;
    if (!el || !stage) return undefined;
    const r = el.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    return { top: r.top - s.top, left: r.left - s.left, width: r.width, height: r.height };
  }, []);

  useLayoutEffect(() => {
    const sel = rectOf(selectedId);
    const hover = hoverId && hoverId !== selectedId ? rectOf(hoverId) : undefined;
    let addAt: (Rect & { index: number }) | undefined;
    const hoverLoc = hoverId ? locate(sections, hoverId) : null;
    const secId = hoverLoc?.path[0] ?? (selected?.path[0] || null);
    if (secId) {
      const r = rectOf(secId);
      const i = sections.findIndex((s) => s.id === secId);
      if (r) addAt = { ...r, index: i };
    }
    // Outlines follow the real DOM, so they can only be measured after it renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRects((prev) => ({ ...prev, sel, hover, addAt }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, hoverId, doc, device, zoom, mode, theme, rectOf]);

  /* ---------- inline text ---------- */
  useEffect(() => {
    if (!inlineId) return;
    const el = frameRef.current?.querySelector<HTMLElement>(`[data-lb="${CSS.escape(inlineId)}"] [data-lb-edit]`);
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [inlineId]);

  const onInlineCommit = useCallback(
    (id: string, text: string) => {
      setInlineId(null);
      const loc = locate(sections, id);
      if (!loc || loc.kind !== "element") return;
      const e = loc.node as BuilderElement;
      if (e.type === "headline" || e.type === "text") {
        if (text && text !== e.text) applySections(updateNode(id, () => ({ ...e, text })));
      } else if (e.type === "button") {
        if (text && text !== e.label) applySections(updateNode(id, () => ({ ...e, label: text })));
      }
    },
    [sections, applySections],
  );

  /* ---------- pointer ---------- */
  const hitId = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.("[data-lb]")?.getAttribute("data-lb") ?? null;

  const onCanvasClick = (ev: React.MouseEvent) => {
    if ((ev.target as HTMLElement).closest("[data-lb-edit]")) return;
    const id = hitId(ev.target);
    if (inlineId && id !== inlineId) (document.activeElement as HTMLElement | null)?.blur?.();
    setSelectedId(id);
    setInsertAfter(null);
    setThemeOpen(false);
    if (id) setRightTab((t) => t);
  };

  const onCanvasDouble = (ev: React.MouseEvent) => {
    const id = hitId(ev.target);
    const loc = id ? locate(sections, id) : null;
    if (loc?.kind === "element" && ["headline", "text", "button"].includes((loc.node as BuilderElement).type)) {
      setSelectedId(id);
      setInlineId(id);
    }
  };

  /* ---------- drag and drop ---------- */
  const drag = useRef<DragPayload | null>(null);
  const [dragging, setDragging] = useState(false);
  const dropTarget = useRef<DropTarget | null>(null);

  const startDrag = useCallback(
    (p: DragPayload) => (ev: React.DragEvent) => {
      drag.current = p;
      ev.dataTransfer.effectAllowed = p.k === "move" ? "move" : "copy";
      ev.dataTransfer.setData("text/plain", p.k);
      setDragging(true);
      setInlineId(null);
    },
    [],
  );

  const endDrag = () => {
    drag.current = null;
    dropTarget.current = null;
    setDragging(false);
    setRects((r) => ({ ...r, drop: undefined }));
  };

  const dragKind = (p: DragPayload): NodeKind => (p.k === "move" ? p.kind : p.k === "row" ? "row" : p.k === "section" ? "section" : "element");

  const computeDrop = (x: number, y: number): { target: DropTarget; line: Rect } | null => {
    const p = drag.current;
    const stage = stageRef.current;
    const frame = frameRef.current;
    if (!p || !stage || !frame) return null;
    const s = stage.getBoundingClientRect();
    const kind = dragKind(p);
    const under = document.elementFromPoint(x, y) as HTMLElement | null;
    const rel = (r: DOMRect, at: number): Rect => ({ top: at - s.top - 1, left: r.left - s.left, width: r.width, height: 3 });
    const indexIn = (els: Element[]) => {
      let i = 0;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (y > r.top + r.height / 2) i++;
      }
      return i;
    };
    const lineAt = (container: Element, els: Element[], i: number) => {
      const cr = container.getBoundingClientRect();
      if (!els.length) return rel(cr, cr.top + cr.height / 2);
      if (i >= els.length) {
        const r = els[els.length - 1]!.getBoundingClientRect();
        return rel(cr, r.bottom + 2);
      }
      const r = els[i]!.getBoundingClientRect();
      return rel(cr, r.top - 2);
    };
    const secEls = Array.from(frame.querySelectorAll(":scope .lb-root > [data-lbk=section], :scope .lb-pop-box > [data-lbk=section]"));
    if (kind === "element") {
      const colEl = under?.closest("[data-lbk=column]");
      if (colEl && frame.contains(colEl)) {
        const els = Array.from(colEl.querySelectorAll(":scope > [data-lbk=element]")).filter((e) => !(p.k === "move" && e.getAttribute("data-lb") === p.id));
        const i = indexIn(els);
        const all = Array.from(colEl.querySelectorAll(":scope > [data-lbk=element]"));
        // Index in the real list (a moved element still counts until it's detached; moveTo corrects it).
        const realIndex = i < els.length ? all.indexOf(els[i]!) : all.length;
        return { target: { kind: "element", columnId: colEl.getAttribute("data-lb")!, index: realIndex }, line: lineAt(colEl, els, i) };
      }
    }
    if (kind === "element" || kind === "row") {
      const secEl = under?.closest("[data-lbk=section]");
      if (secEl && frame.contains(secEl) && kind === "row") {
        const inner = secEl.querySelector(":scope > .lb-in")!;
        const els = Array.from(inner.querySelectorAll(":scope > [data-lbk=row]"));
        const i = indexIn(els);
        return { target: { kind: "row", sectionId: secEl.getAttribute("data-lb")!, index: i }, line: lineAt(inner, els, i) };
      }
    }
    const i = indexIn(secEls);
    const fr = frame.getBoundingClientRect();
    const line = secEls.length ? lineAt(frame, secEls, i) : rel(fr, fr.top + 40);
    return { target: { kind: "section", index: i }, line: { ...line, left: fr.left - s.left, width: fr.width } };
  };

  const onDragOver = (ev: React.DragEvent) => {
    if (!drag.current) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = drag.current.k === "move" ? "move" : "copy";
    const d = computeDrop(ev.clientX, ev.clientY);
    dropTarget.current = d?.target ?? null;
    setRects((r) => (r.drop?.top === d?.line.top && r.drop?.left === d?.line.left ? r : { ...r, drop: d?.line }));
  };

  const onDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    const p = drag.current;
    const t = dropTarget.current;
    endDrag();
    if (!p || !t) return;
    if (p.k === "move") {
      const loc = locate(sections, p.id);
      if (!loc) return;
      const compatible = (loc.kind === "element" && t.kind === "element") || (loc.kind === "row" && t.kind === "row") || (loc.kind === "section" && t.kind === "section");
      if (compatible) applySections((list) => moveTo(list, p.id, t));
      else if (loc.kind === "element" || loc.kind === "row") {
        applySections((list) => {
          const node = locate(list, p.id)!.node;
          return place(removeNode(p.id)(list), t, loc.kind, node);
        });
      }
      setSelectedId(p.id);
      return;
    }
    const made = buildPayload(p);
    if (!made) return;
    applySections((list) => place(list, t, made.kind, made.node));
    setSelectedId(made.node.id);
    setRightTab("content");
  };

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        doSave();
        return;
      }
      if (isTyping(e.target)) return;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (!selectedId) return;
      const loc = locate(sections, selectedId);
      if (!loc) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove(selectedId);
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate(selectedId);
      } else if (mod && e.key.toLowerCase() === "c") {
        setClip({ kind: loc.kind, node: loc.node });
        setNotice({ text: `${kindTone[loc.kind].label} copied` });
      } else if (mod && e.key.toLowerCase() === "v" && clip) {
        e.preventDefault();
        const copy = reId(clip.node);
        let t: DropTarget;
        if (clip.kind === "section") t = { kind: "section", index: sections.findIndex((s) => s.id === loc.path[0]) + 1 };
        else if (clip.kind === "row") {
          const s = sections.find((x) => x.id === loc.path[0])!;
          t = { kind: "row", sectionId: s.id, index: loc.path[1] ? s.rows.findIndex((r) => r.id === loc.path[1]) + 1 : s.rows.length };
        } else if (clip.kind === "element" && loc.path.length >= 3) {
          const col = locate(sections, loc.path[2]!)!.node as BuilderColumn;
          t = { kind: "element", columnId: col.id, index: loc.kind === "element" ? col.elements.findIndex((x) => x.id === loc.path[3]) + 1 : col.elements.length };
        } else return;
        applySections((list) => place(list, t, clip.kind, copy));
        setSelectedId(copy.id);
      } else if (e.key === "Escape") {
        setSelectedId(loc.path.length > 1 ? loc.path[loc.path.length - 2]! : null);
      } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        shift(selectedId, e.key === "ArrowUp" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, sections, clip, doSave, undo, redo, remove, duplicate, shift, applySections, place]);

  /* ---------- derived ---------- */
  const sib = selectedId ? siblingInfo(sections, selectedId) : null;
  const crumbs = selected ? selected.path.map((id) => locate(sections, id)!).filter(Boolean) : [];
  const counts = useMemo(() => {
    const els = doc.sections.flatMap((s) => s.rows.flatMap((r) => r.columns.flatMap((c) => c.elements)));
    return { sections: doc.sections.length, elements: els.length };
  }, [doc]);

  const leftPanel = (
    <aside className={cn("w-[288px] shrink-0 flex-col border-r border-line bg-surface", sheet === "left" ? "fixed inset-y-0 left-0 top-14 z-40 flex shadow-2xl" : "hidden lg:flex")} aria-label="Add and layers">
      <div className="flex h-11 shrink-0 items-end gap-4 border-b border-line px-4">
        {(
          [
            ["add", "Add"],
            ["layers", "Layers"],
            ["pages", props.pagesLabel],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setLeftTab(k)} className={cn("-mb-px h-full border-b-2 text-[13px] font-medium transition-colors", leftTab === k ? "border-fg text-fg" : "border-transparent text-fg-3 hover:text-fg")}>
            {l}
          </button>
        ))}
        {sheet === "left" && (
          <button type="button" aria-label="Close" onClick={() => setSheet(null)} className="ml-auto mb-2.5 grid size-7 place-items-center rounded text-fg-3 hover:bg-surface-2">
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {leftTab === "add" && <AddPanel context={context} insertAfter={insertAfter} onAdd={addByClick} startDrag={startDrag} endDrag={endDrag} />}
        {leftTab === "layers" && (
          <LayersPanel
            sections={sections}
            selectedId={selectedId}
            device={device}
            onSelect={(id) => {
              setSelectedId(id);
              requestAnimationFrame(() => frameRef.current?.querySelector(`[data-lb="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
            }}
            onHover={setHoverId}
            onToggleHidden={(id) => {
              const loc = locate(sections, id);
              if (!loc) return;
              const n = loc.node as Node & { style?: { hidden?: boolean }; mobile?: { hidden?: boolean } };
              const key = device === "phone" ? "mobile" : "style";
              const cur = n[key] ?? {};
              applySections(updateNode(id, () => ({ ...n, [key]: { ...cur, hidden: cur.hidden ? undefined : true } }) as Node));
            }}
            startDrag={startDrag}
            endDrag={endDrag}
          />
        )}
        {leftTab === "pages" && <PagesPanel pages={props.pages} dirty={dirty} variants={props.variants} />}
      </div>
    </aside>
  );

  const rightPanel = (
    <aside className={cn("w-[320px] shrink-0 flex-col border-l border-line bg-surface xl:w-[340px]", sheet === "right" ? "fixed inset-y-0 right-0 top-14 z-40 flex max-w-[100vw] shadow-2xl" : "hidden lg:flex")} aria-label="Inspector">
      {themeOpen ? (
        <>
          <PanelHead title="Theme" sub={`Shared by every ${context === "funnel" ? "step in this funnel" : "page on this site"}.`} onClose={() => setThemeOpen(false)} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ThemePanel theme={theme} onChange={setTheme} />
          </div>
        </>
      ) : selected ? (
        <>
          <div className="shrink-0 border-b border-line px-4 pb-0 pt-3">
            <nav aria-label="Selection" className="flex flex-wrap items-center gap-0.5 text-xs">
              {crumbs.map((c, i) => (
                <span key={c.node.id} className="flex items-center gap-0.5">
                  {i > 0 && <ChevronRight className="size-3 text-fg-3" />}
                  <button type="button" onClick={() => setSelectedId(c.node.id)} className={cn("rounded px-1 py-0.5", i === crumbs.length - 1 ? "font-semibold text-fg" : "text-fg-3 hover:bg-surface-2 hover:text-fg")}>
                    {i === crumbs.length - 1 ? nodeLabel(c.kind, c.node) : kindTone[c.kind].label}
                  </button>
                </span>
              ))}
              <button type="button" aria-label="Close" onClick={() => setSelectedId(null)} className="ml-auto grid size-6 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
                <X className="size-3.5" />
              </button>
            </nav>
            <div className="mt-2 flex gap-4">
              {(
                [
                  ["content", "Content"],
                  ["style", "Style"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setRightTab(k)} className={cn("-mb-px border-b-2 pb-2 text-[13px] font-medium", rightTab === k ? "border-fg text-fg" : "border-transparent text-fg-3 hover:text-fg")}>
                  {l}
                  {k === "style" && device === "phone" && <span className="ml-1 inline-block size-1.5 rounded-full bg-amber align-middle" aria-label="phone" />}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rightTab === "content" ? (
              <>
                {selected.kind === "element" && <ContentPanel key={selected.node.id} e={selected.node as BuilderElement} refs={refs} context={context} onChange={(n) => updateSelected(n)} />}
                {selected.kind === "section" && <SectionContent s={selected.node as BuilderSection} onChange={(n) => updateSelected(n)} />}
                {selected.kind === "row" && <RowContent r={selected.node as BuilderRow} onChange={(n) => updateSelected(n, "layout")} />}
                {selected.kind === "column" && <ColumnContent c={selected.node as BuilderColumn} onChange={(n) => updateSelected(n)} />}
                <div className="flex flex-wrap gap-1.5 px-4 py-4">
                  <SmallButton onClick={() => duplicate(selected.node.id)} icon={Copy}>
                    Duplicate
                  </SmallButton>
                  <SmallButton onClick={() => remove(selected.node.id)} icon={Trash2} danger>
                    Delete
                  </SmallButton>
                </div>
              </>
            ) : (
              <StylePanel
                key={`${selected.node.id}-${device}`}
                kind={selected.kind}
                node={selected.node}
                elType={selected.kind === "element" ? (selected.node as BuilderElement).type : undefined}
                device={device}
                theme={theme}
                onChange={(n) => updateSelected({ ...selected.node, ...n } as Node, "style")}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <PanelHead title={mode === "popup" ? "Popup" : "Page"} sub={mode === "popup" ? "Opens over the page." : "Select anything on the page to edit it."} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {mode === "popup" && (
              <PopupSettings popup={doc.popup ?? { enabled: false, trigger: "exit", delaySeconds: 8, sections: [] }} onChange={(popup) => commit((d) => ({ ...d, popup }), "popup")} />
            )}
            <div className="flex flex-col gap-3 px-4 py-4 text-[13px] text-fg-2">
              <p className="num text-xs text-fg-3">
                {counts.sections} sections · {counts.elements} elements
              </p>
              <ul className="flex flex-col gap-2 text-xs leading-5 text-fg-2">
                <li className="flex gap-2">
                  <Plus className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
                  Drag sections, rows and elements from Add onto the page, or click one to drop it after the selection.
                </li>
                <li className="flex gap-2">
                  <MousePointerClick className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
                  Click to select, double-click text to type in place. Esc selects the parent.
                </li>
                <li className="flex gap-2">
                  <Smartphone className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
                  Switch to phone to set phone-only sizes, spacing and visibility.
                </li>
              </ul>
              <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 rounded border border-line bg-surface-2/40 p-3 text-xs">
                {[
                  ["Undo / redo", "⌘Z / ⇧⌘Z"],
                  ["Duplicate", "⌘D"],
                  ["Copy / paste", "⌘C / ⌘V"],
                  ["Move up / down", "⌥↑ / ⌥↓"],
                  ["Delete", "⌫"],
                  ["Save", "⌘S"],
                ].map(([a, b]) => (
                  <div key={a} className="contents">
                    <dt className="text-fg-3">{a}</dt>
                    <dd className="num text-right font-medium text-fg-2">{b}</dd>
                  </div>
                ))}
              </dl>
              <button type="button" onClick={() => setThemeOpen(true)} className="flex items-center gap-2 rounded border border-line-strong px-3 py-2 text-left text-xs font-medium text-fg hover:bg-surface-2">
                <Palette className="size-3.5 text-fg-3" strokeWidth={1.75} />
                Theme: fonts, colours, corners
                <ChevronRight className="ml-auto size-3.5 text-fg-3" />
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );

  const selTone = selected ? kindTone[selected.kind] : null;
  const hoverLoc = hoverId ? locate(sections, hoverId) : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      {/* ---------- top bar ---------- */}
      <header className="z-30 flex h-14 shrink-0 items-center gap-2 bg-rail px-3 text-rail-fg md:gap-3 md:px-4">
        <Link href={props.backHref} onClick={(e) => dirty && !confirm("Leave without saving your changes?") && e.preventDefault()} className="grid size-8 shrink-0 place-items-center rounded text-rail-fg-2 hover:bg-rail-2 hover:text-rail-fg" aria-label={`Back to ${props.backLabel}`} title={`Back to ${props.backLabel}`}>
          <ArrowLeft className="size-4" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1 md:flex-none md:max-w-[280px]">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold leading-5 tracking-tight">{props.title}</h1>
            {props.variants && <span className="shrink-0 rounded bg-rail-2 px-1.5 py-px text-[11px] font-semibold text-rail-fg">Version {props.variants.current.toUpperCase()}</span>}
          </div>
          <p className="num truncate text-xs text-rail-fg-2">{dirty ? "Unsaved changes" : props.meta}</p>
        </div>

        <div className="mx-auto hidden items-center gap-2 md:flex">
          <InkSeg
            label="Device"
            value={device}
            onChange={(d) => {
              setDevice(d);
              setInlineId(null);
            }}
            options={[
              { value: "desktop", icon: Monitor, label: "Desktop" },
              { value: "phone", icon: Smartphone, label: "Phone" },
            ]}
          />
          <InkSeg
            label="Editing"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setSelectedId(null);
            }}
            options={[
              { value: "page", icon: LayoutTemplate, label: "Page" },
              { value: "popup", icon: SquareStack, label: "Popup" },
            ]}
          />
          <div className="flex items-center rounded border border-rail-line bg-rail-2">
            <InkIcon label="Undo" onClick={undo} disabled={!canUndo} icon={Undo2} />
            <InkIcon label="Redo" onClick={redo} disabled={!canRedo} icon={Redo2} />
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {notice && (
            <span role="status" className={cn("hidden text-xs xl:inline", notice.bad ? "text-[#ffb4bd]" : "text-rail-fg-2")}>
              {notice.text}
            </span>
          )}
          <button type="button" onClick={() => setSheet(sheet === "left" ? null : "left")} className="inline-flex h-8 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium hover:bg-rail-line lg:hidden">
            <Plus className="size-3.5" /> Add
          </button>
          <button type="button" onClick={() => setSheet(sheet === "right" ? null : "right")} className="inline-flex h-8 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium hover:bg-rail-line lg:hidden">
            <Layers className="size-3.5" /> Edit
          </button>
          <button type="button" onClick={() => setThemeOpen((o) => !o)} aria-pressed={themeOpen} className={cn("hidden h-8 items-center gap-1.5 rounded border border-rail-line px-2.5 text-xs font-medium transition-colors lg:inline-flex", themeOpen ? "bg-rail-line" : "bg-rail-2 hover:bg-rail-line")}>
            <Palette className="size-3.5" strokeWidth={1.75} />
            Theme
          </button>
          <button
            type="button"
            onClick={() => {
              const w = window.open("about:blank", "_blank");
              const go = () => {
                if (w) w.location.href = props.previewHref;
              };
              if (dirty) doSave(go);
              else go();
            }}
            className="hidden h-8 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-2.5 text-xs font-medium hover:bg-rail-line sm:inline-flex"
          >
            <Eye className="size-3.5" strokeWidth={1.75} />
            Preview
          </button>
          <button type="button" onClick={() => doSave()} disabled={saving || !dirty} className="inline-flex h-8 items-center rounded bg-brand px-3.5 text-xs font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.15)_inset] transition-colors hover:bg-brand-hover disabled:cursor-default disabled:bg-rail-2 disabled:text-rail-fg-2">
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {leftPanel}

        {/* ---------- canvas ---------- */}
        <main
          ref={scrollRef}
          className="relative min-w-0 flex-1 overflow-auto bg-surface-2 [background-image:radial-gradient(rgba(15,18,33,0.07)_1px,transparent_1px)] [background-size:16px_16px]"
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) setRects((r) => ({ ...r, drop: undefined }));
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <div className="flex items-center justify-center gap-2 pt-4 md:hidden">
            <InkSegLight value={device} onChange={setDevice} />
          </div>
          <div ref={stageRef} className="relative mx-auto px-3 pb-24 pt-5 md:px-6 md:pt-6" style={{ width: frameWidth * zoom + (avail < 600 ? 24 : 48) }}>
            {mode === "popup" && !doc.popup?.sections.length && (
              <div className="mb-4 rounded border border-dashed border-line-strong bg-surface p-6 text-center text-[13px] text-fg-2">
                No popup yet. Drag a section here, or add the Opt-in card from Add.
              </div>
            )}
            <div
              ref={frameRef}
              className={cn("lb-editing relative overflow-hidden bg-white shadow-[0_1px_2px_rgba(15,18,33,0.06),0_12px_32px_rgba(15,18,33,0.1)]", device === "phone" ? "rounded-[28px] ring-[10px] ring-rail" : "rounded-md")}
              style={{ width: frameWidth, zoom, minHeight: device === "phone" ? 760 : 640 }}
              onClick={onCanvasClick}
              onDoubleClick={onCanvasDouble}
              onMouseMove={(e) => {
                if (dragging) return;
                const id = hitId(e.target);
                if (id !== hoverId) setHoverId(id);
              }}
              onMouseLeave={() => setHoverId(null)}
            >
              <style>{`.lb-editing input,.lb-editing textarea,.lb-editing select,.lb-editing iframe,.lb-editing summary{pointer-events:none}.lb-editing a{cursor:default}.lb-editing [contenteditable]{outline:none;cursor:text;caret-color:${theme.primary}}.lb-editing [data-lbk=column]:empty{min-height:72px;border:1px dashed rgba(15,18,33,.18);border-radius:6px}.lb-editing [data-lbk=column]:empty::after{content:"Drop elements here";margin:auto;font-size:13px;color:#8a8ea0}`}</style>
              <BuilderPage doc={mode === "popup" ? { ...doc, sections: [] } : doc} theme={theme} refs={refs} editing popupOpen={mode === "popup"} inline={inlineId ? { id: inlineId, onCommit: onInlineCommit } : undefined} header={mode === "page" ? props.chrome?.header : undefined} footer={mode === "page" ? props.chrome?.footer : undefined} />
            </div>

            {/* ---------- overlay ---------- */}
            <div className="pointer-events-none absolute inset-0" aria-hidden={!selected}>
              {rects.hover && hoverLoc && (
                <div className="absolute rounded-[2px]" style={{ ...rects.hover, outline: `1px dashed ${kindTone[hoverLoc.kind].line}`, outlineOffset: -1 }}>
                  <span className={cn("absolute -top-[18px] left-0 rounded-t px-1.5 text-[10px] font-semibold leading-[18px] opacity-90", kindTone[hoverLoc.kind].chip)}>{nodeLabel(hoverLoc.kind, hoverLoc.node)}</span>
                </div>
              )}
              {rects.sel && selected && selTone && (
                <div className="absolute" style={{ ...rects.sel, outline: `2px solid ${selTone.line}`, outlineOffset: -2 }}>
                  <div className={cn("pointer-events-auto absolute left-0 flex items-center overflow-hidden rounded shadow-[0_2px_8px_rgba(15,18,33,0.25)]", rects.sel.top < 30 ? "top-1 left-1" : "-top-[30px]", selTone.chip)}>
                    <span
                      draggable
                      onDragStart={startDrag({ k: "move", id: selected.node.id, kind: selected.kind })}
                      onDragEnd={endDrag}
                      className="flex h-7 cursor-grab items-center gap-1 pl-1.5 pr-2 text-[11px] font-semibold active:cursor-grabbing"
                      title="Drag to move"
                    >
                      <GripVertical className="size-3.5 opacity-80" />
                      {nodeLabel(selected.kind, selected.node)}
                    </span>
                    <span className="h-7 w-px bg-white/20" />
                    <ToolIcon label="Move up" icon={ArrowUp} disabled={!sib || sib.index === 0} onClick={() => shift(selected.node.id, -1)} />
                    <ToolIcon label="Move down" icon={ArrowDown} disabled={!sib || sib.index >= sib.count - 1} onClick={() => shift(selected.node.id, 1)} />
                    <ToolIcon label="Duplicate" icon={Copy} onClick={() => duplicate(selected.node.id)} />
                    <ToolIcon label="Delete" icon={Trash2} onClick={() => remove(selected.node.id)} />
                  </div>
                </div>
              )}
              {!dragging && rects.addAt && mode === "page" && (
                <button
                  type="button"
                  className="pointer-events-auto absolute z-10 flex h-6 -translate-x-1/2 items-center gap-1 rounded-full bg-rail px-2.5 text-[11px] font-semibold text-rail-fg opacity-0 shadow-[0_2px_8px_rgba(15,18,33,0.3)] transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 [main:hover_&]:opacity-80"
                  style={{ top: rects.addAt.top + rects.addAt.height - 12, left: rects.addAt.left + rects.addAt.width / 2 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInsertAfter(rects.addAt!.index);
                    setLeftTab("add");
                    setSheet(avail < 900 ? "left" : null);
                    document.getElementById("lb-add-sections")?.scrollIntoView({ block: "start", behavior: "smooth" });
                  }}
                >
                  <Plus className="size-3" strokeWidth={2.5} /> Add section
                </button>
              )}
              {rects.drop && <div className="absolute rounded-full bg-brand shadow-[0_0_0_3px_rgba(109,61,242,0.18)]" style={rects.drop} />}
            </div>
          </div>
        </main>

        {rightPanel}
        {sheet && <button type="button" aria-label="Close panel" className="fixed inset-0 top-14 z-30 bg-rail/40 lg:hidden" onClick={() => setSheet(null)} />}
      </div>
    </div>
  );
}

/* ------------------------------ small parts ------------------------------ */

function PanelHead({ title, sub, onClose }: { title: string; sub?: string; onClose?: () => void }) {
  return (
    <div className="flex shrink-0 items-start gap-2 border-b border-line px-4 py-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-[13px] font-semibold text-fg">{title}</h2>
        {sub && <p className="text-xs text-fg-3">{sub}</p>}
      </div>
      {onClose && (
        <button type="button" aria-label="Close" onClick={onClose} className="grid size-6 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function SmallButton({ children, onClick, icon: Icon, danger }: { children: React.ReactNode; onClick: () => void; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex h-7 items-center gap-1.5 rounded border border-line-strong px-2.5 text-xs font-medium transition-colors", danger ? "text-red hover:border-red/40 hover:bg-red-soft/50" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}>
      <Icon className="size-3.5" strokeWidth={1.75} />
      {children}
    </button>
  );
}

function ToolIcon({ label, icon: Icon, onClick, disabled }: { label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; onClick: () => void; disabled?: boolean }) {
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
      className="grid h-7 w-7 place-items-center transition-colors hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent"
    >
      <Icon className="size-3.5" strokeWidth={2} />
    </button>
  );
}

function InkIcon({ label, icon: Icon, onClick, disabled }: { label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid h-[30px] w-8 place-items-center text-rail-fg transition-colors hover:bg-rail-line disabled:text-rail-fg-2/40 disabled:hover:bg-transparent">
      <Icon className="size-3.5" strokeWidth={2} />
    </button>
  );
}

function InkSeg<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-8 items-center rounded border border-rail-line bg-rail-2 p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} title={o.label} onClick={() => onChange(o.value)} className={cn("flex h-full items-center gap-1.5 rounded-[4px] px-2.5 text-xs font-medium transition-colors", value === o.value ? "bg-rail-fg text-rail" : "text-rail-fg-2 hover:text-rail-fg")}>
          <o.icon className="size-3.5" strokeWidth={1.75} />
          <span className="hidden xl:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function InkSegLight({ value, onChange }: { value: Device; onChange: (d: Device) => void }) {
  return (
    <div role="radiogroup" aria-label="Device" className="flex h-8 rounded border border-line-strong bg-surface p-0.5">
      {(
        [
          ["desktop", Monitor, "Desktop"],
          ["phone", Smartphone, "Phone"],
        ] as const
      ).map(([v, Icon, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cn("flex items-center gap-1.5 rounded-[4px] px-2.5 text-xs font-medium", value === v ? "bg-rail text-rail-fg" : "text-fg-3")}>
          <Icon className="size-3.5" strokeWidth={1.75} />
          {l}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ add panel ------------------------------ */

function SectionThumb({ group }: { group: SectionGroup | "Blank" }) {
  // A tiny schematic per group so the list scans by shape, not just by name.
  const bar = (w: string, h = 3, o = 0.5) => <span className="block rounded-[1px] bg-current" style={{ width: w, height: h, opacity: o }} />;
  const box = (cls: string) => <span className={cn("block rounded-[2px] bg-current", cls)} />;
  return (
    <span className="grid h-[46px] w-[64px] shrink-0 place-items-center rounded border border-line bg-surface-2/60 p-1.5 text-fg-3">
      {group === "Hero" ? (
        <span className="flex w-full gap-1">
          <span className="flex flex-1 flex-col gap-[3px]">
            {bar("90%", 4, 0.75)}
            {bar("70%")}
            {bar("40%", 5, 0.9)}
          </span>
          {box("h-[26px] w-[22px] opacity-30")}
        </span>
      ) : group === "Features" || group === "Social proof" ? (
        <span className="grid w-full grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex flex-col gap-[3px]">
              {box("h-[10px] opacity-25")}
              {bar("90%")}
              {bar("60%", 2, 0.35)}
            </span>
          ))}
        </span>
      ) : group === "Pricing" ? (
        <span className="grid w-full grid-cols-3 items-end gap-1">
          {box("h-[22px] opacity-25")}
          {box("h-[28px] opacity-60")}
          {box("h-[22px] opacity-25")}
        </span>
      ) : group === "Sell" || group === "Forms" ? (
        <span className="flex w-[70%] flex-col gap-[3px]">
          {box("h-[6px] opacity-25")}
          {box("h-[6px] opacity-25")}
          {box("h-[8px] opacity-80")}
        </span>
      ) : group === "Call to action" ? (
        <span className="flex w-full flex-col items-center gap-[3px] rounded-[2px] bg-current/80 py-1.5" style={{ background: "currentColor" }}>
          <span className="block h-[3px] w-[60%] rounded-[1px] bg-white/80" />
          <span className="block h-[5px] w-[30%] rounded-[1px] bg-white" />
        </span>
      ) : group === "FAQ" ? (
        <span className="flex w-full flex-col gap-[4px]">
          {bar("100%", 2, 0.3)}
          {bar("80%")}
          {bar("100%", 2, 0.3)}
          {bar("70%")}
        </span>
      ) : group === "Footer" ? (
        <span className="mt-auto flex w-full justify-between">
          {bar("30%")}
          {bar("40%", 3, 0.3)}
        </span>
      ) : (
        <span className="grid size-5 place-items-center rounded border border-dashed border-current opacity-60">
          <Plus className="size-3" />
        </span>
      )}
    </span>
  );
}

function AddPanel({ context, insertAfter, onAdd, startDrag, endDrag }: { context: "funnel" | "site"; insertAfter: number | null; onAdd: (p: DragPayload) => void; startDrag: (p: DragPayload) => (e: React.DragEvent) => void; endDrag: () => void }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const els = elementCatalog.filter((e) => (context === "site" ? e.type !== "upsell" : true)).filter((e) => !query || e.label.toLowerCase().includes(query) || e.group.toLowerCase().includes(query) || e.hint.toLowerCase().includes(query));
  const secs = sectionTemplates.filter((s) => !query || s.label.toLowerCase().includes(query) || s.group.toLowerCase().includes(query));
  const groups = [...new Set(els.map((e) => e.group))];
  const secGroups = [...new Set(secs.map((s) => s.group))];
  const tile = "group flex cursor-grab select-none items-center gap-2 rounded border border-line bg-surface text-left transition-[border-color,box-shadow,background-color] duration-150 hover:border-line-strong hover:shadow-[0_1px_3px_rgba(15,18,33,0.08)] active:cursor-grabbing";
  return (
    <div className="flex flex-col pb-6">
      <div className="sticky top-0 z-10 border-b border-line bg-surface px-3 py-2.5">
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-3" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search elements and sections" className="h-8 w-full rounded border border-line-strong bg-surface pl-8 pr-2 text-[13px] placeholder:text-fg-3/80 focus:border-brand focus:outline-none" />
        </label>
      </div>

      {groups.length > 0 && (
        <div className="px-3 pt-3">
          <h3 className="px-1 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Elements</h3>
          {groups.map((g) => (
            <div key={g} className="mt-2.5">
              <p className="px-1 pb-1.5 text-[11px] font-medium text-fg-3">{g}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {els
                  .filter((e) => e.group === g)
                  .map((e) => {
                    const Icon = elementIcon[e.type];
                    return (
                      <button key={e.type} type="button" draggable onDragStart={startDrag({ k: "element", type: e.type })} onDragEnd={endDrag} onClick={() => onAdd({ k: "element", type: e.type })} className={cn(tile, "h-10 px-2.5")} title={e.hint}>
                        <Icon className="size-4 shrink-0 text-fg-3 transition-colors group-hover:text-brand" strokeWidth={1.75} />
                        <span className="truncate text-xs font-medium text-fg">{e.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!query && (
        <div className="px-3 pt-5">
          <h3 className="px-1 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Rows</h3>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {rowLayouts.map((l) => (
              <button key={l.key} type="button" draggable onDragStart={startDrag({ k: "row", spans: l.spans })} onDragEnd={endDrag} onClick={() => onAdd({ k: "row", spans: l.spans })} title={l.label} aria-label={`Row: ${l.label}`} className={cn(tile, "h-10 px-2 text-fg-3 hover:text-brand")}>
                <span className="flex h-4 w-full gap-[2px]">
                  {l.spans.map((n, i) => (
                    <span key={i} className="h-full rounded-[2px] bg-current opacity-50" style={{ flex: n }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div id="lb-add-sections" className="scroll-mt-14 px-3 pt-5">
        <div className="flex items-baseline justify-between px-1">
          <h3 className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">Sections</h3>
          {insertAfter !== null && <span className="text-[11px] font-medium text-brand">Adds after section {insertAfter + 1}</span>}
        </div>
        {!query && (
          <button type="button" draggable onDragStart={startDrag({ k: "section", key: "blank" })} onDragEnd={endDrag} onClick={() => onAdd({ k: "section", key: "blank" })} className={cn(tile, "mt-2 w-full p-1.5 pr-2.5")}>
            <SectionThumb group="Blank" />
            <span className="text-xs font-medium text-fg">Blank section</span>
          </button>
        )}
        {secGroups.map((g) => (
          <div key={g} className="mt-3">
            <p className="px-1 pb-1.5 text-[11px] font-medium text-fg-3">{g}</p>
            <div className="flex flex-col gap-1.5">
              {secs
                .filter((s) => s.group === g)
                .map((s) => (
                  <button key={s.key} type="button" draggable onDragStart={startDrag({ k: "section", key: s.key })} onDragEnd={endDrag} onClick={() => onAdd({ k: "section", key: s.key })} className={cn(tile, "w-full p-1.5 pr-2.5")}>
                    <SectionThumb group={s.group} />
                    <span className="min-w-0 text-xs font-medium text-fg">{s.label}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      {query && !els.length && !secs.length && <p className="px-4 py-8 text-center text-xs text-fg-3">Nothing matches “{q}”.</p>}
    </div>
  );
}

/* ------------------------------ layers ------------------------------ */

function LayersPanel({
  sections,
  selectedId,
  device,
  onSelect,
  onHover,
  onToggleHidden,
  startDrag,
  endDrag,
}: {
  sections: BuilderSection[];
  selectedId: string | null;
  device: Device;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onToggleHidden: (id: string) => void;
  startDrag: (p: DragPayload) => (e: React.DragEvent) => void;
  endDrag: () => void;
}) {
  const hiddenNow = (n: { style?: { hidden?: boolean }; mobile?: { hidden?: boolean } }) => !!(device === "phone" ? n.mobile?.hidden : n.style?.hidden);
  const Line = ({ id, kind, depth, label, sub, icon: Icon, n }: { id: string; kind: NodeKind; depth: number; label: string; sub?: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; n: { style?: { hidden?: boolean }; mobile?: { hidden?: boolean } } }) => {
    const hidden = hiddenNow(n);
    return (
      <div
        draggable={kind !== "column"}
        onDragStart={kind !== "column" ? startDrag({ k: "move", id, kind }) : undefined}
        onDragEnd={endDrag}
        onMouseEnter={() => onHover(id)}
        onMouseLeave={() => onHover(null)}
        className={cn("group flex h-8 items-center gap-1.5 rounded pr-1 text-xs", selectedId === id ? "bg-brand-soft/70 text-fg" : "text-fg-2 hover:bg-surface-2")}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <button type="button" onClick={() => onSelect(id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <Icon className={cn("size-3.5 shrink-0", kind === "section" ? "text-fg" : "text-fg-3")} strokeWidth={1.75} />
          <span className={cn("shrink-0", kind === "section" ? "font-semibold" : "font-medium", hidden && "opacity-50")}>{label}</span>
          {sub && <span className="truncate text-fg-3">{sub}</span>}
        </button>
        <button type="button" aria-label={hidden ? "Show" : "Hide"} title={hidden ? `Hidden on ${device}` : `Hide on ${device}`} onClick={() => onToggleHidden(id)} className={cn("grid size-6 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface hover:text-fg", hidden ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100")}>
          {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
    );
  };
  if (!sections.length) return <p className="px-4 py-8 text-center text-xs text-fg-3">Nothing on this page yet.</p>;
  return (
    <div className="flex flex-col gap-px p-2">
      {sections.map((s, si) => (
        <div key={s.id} className="flex flex-col gap-px">
          <Line id={s.id} kind="section" depth={0} label={s.name || `Section ${si + 1}`} icon={LayoutTemplate} n={s} />
          {s.rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-px">
              {(s.rows.length > 1 || r.columns.length > 1) && <Line id={r.id} kind="row" depth={1} label="Row" sub={r.columns.map((c) => c.span).join(" · ")} icon={Columns3} n={r} />}
              {r.columns.map((c, ci) => (
                <div key={c.id} className="flex flex-col gap-px">
                  {r.columns.length > 1 && <Line id={c.id} kind="column" depth={2} label={`Column ${ci + 1}`} icon={Star} n={c} />}
                  {c.elements.map((e) => (
                    <Line key={e.id} id={e.id} kind="element" depth={r.columns.length > 1 ? 3 : s.rows.length > 1 ? 2 : 1} label={elementLabel[e.type]} sub={snippet(e)} icon={elementIcon[e.type]} n={e} />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ pages ------------------------------ */

function PagesPanel({ pages, dirty, variants }: { pages: BuilderPageLink[]; dirty: boolean; variants?: BuilderEditorProps["variants"] }) {
  const guard = (e: React.MouseEvent) => dirty && !confirm("Leave without saving your changes?") && e.preventDefault();
  return (
    <div className="flex flex-col gap-4 p-3">
      {variants && (
        <div className="rounded border border-line bg-surface-2/40 p-3">
          <p className="text-xs font-semibold text-fg">Split test running</p>
          <p className="mt-0.5 text-[11px] leading-4 text-fg-3">Each version is its own page. Visitors are split between them.</p>
          <div className="mt-2 flex h-[30px] rounded border border-line-strong bg-surface p-0.5">
            {(["a", "b"] as const).map((v) => (
              <Link key={v} href={v === "a" ? variants.hrefA : variants.hrefB} onClick={guard} className={cn("flex flex-1 items-center justify-center rounded-[4px] text-xs font-medium", variants.current === v ? "bg-rail text-rail-fg" : "text-fg-3 hover:text-fg")}>
                Version {v.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
      )}
      <ol className="flex flex-col gap-px">
        {pages.map((p, i) => (
          <li key={p.id}>
            <Link href={p.href} onClick={guard} aria-current={p.active ? "page" : undefined} className={cn("flex items-center gap-2.5 rounded px-2 py-2", p.active ? "bg-rail text-rail-fg" : "text-fg hover:bg-surface-2")}>
              <span className={cn("num grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold", p.active ? "bg-rail-fg text-rail" : "bg-surface-2 text-fg-2")}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{p.name}</span>
                {p.meta && <span className={cn("block truncate text-[11px]", p.active ? "text-rail-fg-2" : "text-fg-3")}>{p.meta}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
