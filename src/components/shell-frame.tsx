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
  Workflow,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const nav = [
  { href: "/agency", label: "Daily Diagnostic", icon: Activity },
  { href: "/agency/clients", label: "Clients", icon: LayoutGrid },
  { href: "/agency/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/agency/inbox", label: "Inbox", icon: Inbox },
  { href: "/agency/calendars", label: "Calendars", icon: CalendarDays },
  { href: "/agency/contacts", label: "Contacts", icon: Users },
  { href: "/agency/opportunities", label: "Opportunities", icon: KanbanSquare },
  { href: "/agency/donors", label: "Donors", icon: HeartHandshake },
  { href: "/agency/elements", label: "Elements", icon: Blocks },
  { href: "/agency/funnels", label: "Funnels", icon: Layers },
  { href: "/agency/websites", label: "Websites", icon: Globe },
  { href: "/agency/forms", label: "Forms", icon: ClipboardPen },
  { href: "/agency/email", label: "Email", icon: Mail },
  { href: "/agency/jobs", label: "Jobs", icon: Wrench },
  { href: "/agency/estimates", label: "Estimates", icon: ClipboardList },
  { href: "/agency/invoices", label: "Invoices", icon: Receipt },
  { href: "/agency/automations", label: "Automations", icon: Workflow },
  { href: "/agency/integrations", label: "Integrations", icon: Plug },
  { href: "/agency/reputation", label: "Reputation", icon: Star },
  { href: "/agency/reports", label: "Reports", icon: FileBarChart },
  { href: "/agency/settings", label: "Settings", icon: Settings },
] as const;

export type NavHref = (typeof nav)[number]["href"];

/** localStorage key for the rail; the root layout reads it before paint. */
export const NAV_KEY = "lotus-nav";

function Mark() {
  return (
    <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[5px] bg-brand text-[13px] font-semibold text-white">
      L
    </span>
  );
}

function NavLinks({ current, rail, onNavigate }: { current: NavHref; rail: boolean; onNavigate?: () => void }) {
  return (
    <>
      {nav.map(({ href, label, icon: Icon }) => {
        const active = href === current;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={rail ? label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded px-2.5 py-1.5 text-sm transition-colors duration-150",
              rail && "navc:justify-center navc:px-0",
              active ? "bg-rail-2 text-rail-fg" : "text-rail-fg-2 hover:bg-rail-2/60 hover:text-rail-fg",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            <span className={cn("truncate", rail && "navc:sr-only")}>{label}</span>
          </Link>
        );
      })}
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

/**
 * Rail on desktop that folds to icons and remembers it; on phones a top bar
 * whose menu opens the same links in a drawer. The rail is the one committed
 * colour field; everything inside the content area stays on paper.
 */
export function ShellFrame({ current, account, children }: { current: NavHref; account: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

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

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-rail px-4 py-3 text-rail-fg md:hidden">
        <Link href="/agency" className="flex items-center gap-2.5">
          <Mark />
          <span className="text-base font-semibold tracking-tight">Lotus</span>
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
            <div className="flex items-center gap-2.5 border-b border-rail-line px-4 py-3">
              <Mark />
              <span className="text-base font-semibold tracking-tight">Lotus</span>
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
            <nav aria-label="Primary" className="flex flex-1 flex-col overflow-y-auto px-3 py-3">
              <NavLinks current={current} rail={false} onNavigate={() => setOpen(false)} />
            </nav>
            <div className="border-t border-rail-line">{account}</div>
          </div>
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} className="flex-1 bg-rail/40" />
        </div>
      )}

      {/* Desktop rail */}
      <aside className="hidden bg-rail text-rail-fg md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:transition-[width] md:duration-200 navc:md:w-14">
        <div className="flex items-center gap-2.5 border-b border-rail-line px-5 py-4 navc:justify-center navc:px-0">
          <Link href="/agency" className="flex min-w-0 items-center gap-2.5" title="Lotus">
            <Mark />
            <span className="text-base font-semibold tracking-tight navc:sr-only">Lotus</span>
          </Link>
        </div>
        <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3 navc:px-2">
          <NavLinks current={current} rail />
        </nav>
        <div className="border-t border-rail-line navc:hidden">{account}</div>
        <div className="border-t border-rail-line px-3 py-2 navc:px-2">
          <button
            type="button"
            onClick={toggleRail}
            className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-sm text-rail-fg-2 hover:bg-rail-2/60 hover:text-rail-fg navc:justify-center navc:px-0"
          >
            <PanelLeftClose className="size-4 shrink-0 navc:hidden" strokeWidth={1.75} />
            <PanelLeftOpen className="hidden size-4 shrink-0 navc:block" strokeWidth={1.75} />
            <span className="navc:sr-only">
              <span className="navc:hidden">Collapse menu</span>
              <span className="hidden navc:inline">Expand menu</span>
            </span>
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
