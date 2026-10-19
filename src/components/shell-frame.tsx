"use client";

import Link from "next/link";
import {
  Activity,
  Blocks,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  ClipboardPen,
  FileBarChart,
  Globe,
  HeartHandshake,
  Inbox,
  KanbanSquare,
  Layers,
  LayoutGrid,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Receipt,
  Settings,
  Star,
  Users,
  Search,
  CornerDownLeft,
  Workflow,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LotusLogo } from "@/components/brand/lotus-mark";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: null,
    items: [
      { href: "/agency", label: "Daily Diagnostic", icon: Activity },
      { href: "/agency/inbox", label: "Inbox", icon: Inbox },
      { href: "/agency/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/agency/calendars", label: "Calendars", icon: CalendarDays },
      { href: "/agency/reports", label: "Reports", icon: FileBarChart },
    ],
  },
  {
    label: "Clients and CRM",
    items: [
      { href: "/agency/clients", label: "Clients", icon: LayoutGrid },
      { href: "/agency/contacts", label: "Contacts", icon: Users },
      { href: "/agency/opportunities", label: "Opportunities", icon: KanbanSquare },
      { href: "/agency/donors", label: "Donors", icon: HeartHandshake },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/agency/funnels", label: "Funnels", icon: Layers },
      { href: "/agency/websites", label: "Websites", icon: Globe },
      { href: "/agency/forms", label: "Forms", icon: ClipboardPen },
      { href: "/agency/email", label: "Email", icon: Mail },
      { href: "/agency/elements", label: "Elements", icon: Blocks },
      { href: "/agency/automations", label: "Automations", icon: Workflow },
      { href: "/agency/reputation", label: "Reputation", icon: Star },
    ],
  },
  {
    label: "Field service",
    items: [
      { href: "/agency/jobs", label: "Jobs", icon: Wrench },
      { href: "/agency/estimates", label: "Estimates", icon: ClipboardList },
      { href: "/agency/invoices", label: "Invoices", icon: Receipt },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/agency/integrations", label: "Integrations", icon: Plug },
      { href: "/agency/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

type NavItem = (typeof groups)[number]["items"][number];

export const nav: readonly NavItem[] = groups.flatMap((g): readonly NavItem[] => g.items);

export type NavHref = (typeof nav)[number]["href"];

/** localStorage key for the rail; the root layout reads it before paint. */
export const NAV_KEY = "lotus-nav";

type Item = (typeof nav)[number];

function NavLink({ item, current, rail, onNavigate }: { item: Item; current: NavHref; rail: boolean; onNavigate?: () => void }) {
  const { href, label, icon: Icon } = item;
  const active = href === current;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={rail ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/nav relative flex h-[30px] items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-150",
        rail && "navc:justify-center navc:px-0",
        active ? "bg-white/[0.08] font-medium text-rail-fg" : "text-rail-fg-2 hover:bg-white/[0.05] hover:text-rail-fg",
      )}
    >
      {active && <span aria-hidden className="absolute inset-y-1.5 -left-3 w-[3px] rounded-r bg-[#a78bfa] navc:-left-2" />}
      <Icon className={cn("size-4 shrink-0", active ? "text-[#c4b5fd]" : "text-rail-fg-2/80 group-hover/nav:text-rail-fg")} strokeWidth={1.75} />
      <span className={cn("truncate", rail && "navc:sr-only")}>{label}</span>
    </Link>
  );
}

function NavGroups({ current, rail, onNavigate }: { current: NavHref; rail: boolean; onNavigate?: () => void }) {
  return (
    <>
      {groups.map((g, i) => (
        <div key={g.label ?? i} className={cn("flex flex-col gap-px", i > 0 && "mt-4 navc:mt-3")}>
          {g.label && (
            <p className={cn("mb-1 px-2.5 text-[11px] font-medium tracking-[0.02em] text-rail-fg-2/60", rail && "navc:sr-only")}>{g.label}</p>
          )}
          {g.label && rail && <span aria-hidden className="mx-2 mb-2 hidden h-px bg-rail-line navc:block" />}
          {g.items.map((item) => (
            <NavLink key={item.href} item={item} current={current} rail={rail} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </>
  );
}

function toggleRail() {
  const root = document.documentElement;
  const collapsed = root.dataset.nav !== "collapsed";
  if (collapsed) root.dataset.nav = "collapsed";
  else delete root.dataset.nav;
  try {
    localStorage.setItem(NAV_KEY, collapsed ? "collapsed" : "open");
  } catch {}
}

const noop = () => () => {};
const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** ⌘K: jump to any page by typing part of its name. */
function JumpMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? nav.filter((n) => n.label.toLowerCase().includes(t)) : nav;
  }, [q]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-rail/40 px-4 pt-[14vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a page"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] overflow-hidden rounded-xl border border-line bg-surface text-fg shadow-[0_24px_64px_-12px_rgb(11_18_32/0.35)] motion-safe:animate-[pop-in_140ms_ease-out]"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="size-4 text-fg-3" strokeWidth={1.75} />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setAt(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setAt((i) => Math.min(i + 1, hits.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setAt((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && hits[at]) go(hits[at].href);
            }}
            placeholder="Jump to…"
            aria-label="Jump to a page"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-3"
            style={{ outline: "none" }}
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[11px] text-fg-3">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
          {hits.length === 0 && <li className="px-3 py-6 text-center text-sm text-fg-3">Nothing called “{q}”.</li>}
          {hits.map((n, i) => (
            <li key={n.href} role="option" aria-selected={i === at}>
              <button
                type="button"
                onMouseEnter={() => setAt(i)}
                onClick={() => go(n.href)}
                className={cn("flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm", i === at ? "bg-surface-2 text-fg" : "text-fg-2")}
              >
                <n.icon className="size-4 text-fg-3" strokeWidth={1.75} />
                {n.label}
                {i === at && <CornerDownLeft className="ml-auto size-3.5 text-fg-3" strokeWidth={1.75} />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Rail on desktop that folds to icons and remembers it; on phones a top bar
 * whose menu opens the same links in a drawer. The rail is the one committed
 * colour field; everything inside the content area stays on paper.
 */
export function ShellFrame({ current, account, children }: { current: NavHref; account: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [jump, setJump] = useState(false);
  const mac = useSyncExternalStore(noop, isMac, () => true);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setJump((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const jumpButton = (rail: boolean) => (
    <button
      type="button"
      onClick={() => {
        setOpen(false);
        setJump(true);
      }}
      title={rail ? "Jump to (⌘K)" : undefined}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 rounded-md border border-white/[0.07] bg-white/[0.04] px-2.5 text-[13px] text-rail-fg-2 transition-colors hover:bg-white/[0.07] hover:text-rail-fg",
        rail && "navc:justify-center navc:border-0 navc:bg-transparent navc:px-0",
      )}
    >
      <Search className="size-4 shrink-0" strokeWidth={1.75} />
      <span className={cn("flex-1 text-left", rail && "navc:sr-only")}>Jump to…</span>
      <kbd className={cn("hidden rounded bg-white/[0.08] px-1.5 py-px font-sans text-[11px] text-rail-fg-2 md:inline", rail && "navc:hidden")}>{mac ? "⌘K" : "Ctrl K"}</kbd>
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {jump && <JumpMenu onClose={() => setJump(false)} />}

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-rail px-4 py-3 text-rail-fg md:hidden">
        <Link href="/agency" aria-label="Lotus home">
          <LotusLogo />
        </Link>
        <span className="ml-3 min-w-0 truncate text-sm text-rail-fg-2">{nav.find((n) => n.href === current)?.label}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="ml-auto grid size-9 place-items-center rounded text-rail-fg-2 hover:bg-rail-2/60 hover:text-rail-fg"
        >
          <Menu className="size-5" strokeWidth={1.75} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex w-[280px] max-w-[85vw] flex-col bg-rail text-rail-fg shadow-xl motion-safe:animate-[drawer-in_200ms_ease-out]">
            <div className="flex items-center gap-2.5 px-4 py-3">
              <LotusLogo />
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="ml-auto grid size-9 place-items-center rounded text-rail-fg-2 hover:bg-rail-2/60 hover:text-rail-fg"
              >
                <X className="size-5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="px-3 pb-2">{jumpButton(false)}</div>
            <nav aria-label="Primary" className="flex flex-1 flex-col overflow-y-auto px-3 py-3">
              <NavGroups current={current} rail={false} onNavigate={() => setOpen(false)} />
            </nav>
            <div className="border-t border-rail-line">{account}</div>
          </div>
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} className="flex-1 bg-rail/40" />
        </div>
      )}

      {/* Desktop rail */}
      <aside className="hidden border-r border-black/20 bg-rail text-rail-fg md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:transition-[width] md:duration-200 navc:md:w-14">
        <div className="flex h-[66px] items-center gap-2 px-4 navc:justify-center navc:px-0">
          <Link href="/agency" className="flex min-w-0 items-center rounded-md px-1 py-1" title="Lotus" aria-label="Lotus home">
            <LotusLogo className="navc:[&>span:last-child]:sr-only" markClassName="size-7" />
          </Link>
          <button
            type="button"
            onClick={toggleRail}
            title="Collapse menu"
            aria-label="Collapse menu"
            className="ml-auto grid size-7 place-items-center rounded-md text-rail-fg-2/70 hover:bg-white/[0.06] hover:text-rail-fg navc:hidden"
          >
            <PanelLeftClose className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="px-3 pb-1 navc:px-2">{jumpButton(true)}</div>
        <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-3 pb-6 [mask-image:linear-gradient(to_bottom,black_calc(100%-24px),transparent)] [scrollbar-width:none] navc:px-2">
          <NavGroups current={current} rail />
        </nav>
        <div className="hidden border-t border-rail-line pt-2 navc:block">
          <button
            type="button"
            onClick={toggleRail}
            title="Expand menu"
            aria-label="Expand menu"
            className="mx-auto mb-2 hidden size-8 place-items-center rounded-md text-rail-fg-2 hover:bg-white/[0.06] hover:text-rail-fg navc:grid"
          >
            <PanelLeftOpen className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="border-t border-rail-line navc:hidden">{account}</div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
