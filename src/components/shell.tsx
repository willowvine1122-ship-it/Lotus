import Link from "next/link";
import {
  Activity,
  CalendarDays,
  CheckSquare,
  ClipboardPen,
  ClipboardList,
  FileBarChart,
  Globe,
  HeartHandshake,
  Inbox,
  KanbanSquare,
  Layers,
  LayoutGrid,
  Mail,
  Plug,
  Receipt,
  Settings,
  Star,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/agency", label: "Daily Diagnostic", icon: Activity },
  { href: "/agency/clients", label: "Clients", icon: LayoutGrid },
  { href: "/agency/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/agency/inbox", label: "Inbox", icon: Inbox },
  { href: "/agency/calendars", label: "Calendars", icon: CalendarDays },
  { href: "/agency/contacts", label: "Contacts", icon: Users },
  { href: "/agency/opportunities", label: "Opportunities", icon: KanbanSquare },
  { href: "/agency/donors", label: "Donors", icon: HeartHandshake },
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

function Mark() {
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-[5px] bg-brand text-[13px] font-semibold text-white"
    >
      L
    </span>
  );
}

/**
 * Rail on desktop, top bar on mobile. The rail is the one committed colour
 * field on the screen; everything inside the content area stays on paper.
 */
export function Shell({
  current,
  children,
}: {
  current: (typeof nav)[number]["href"];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex items-center gap-2 bg-rail px-4 py-3 text-rail-fg md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:flex-col md:items-stretch md:gap-0 md:px-0 md:py-0">
        <Link
          href="/agency"
          className="flex items-center gap-2.5 md:border-b md:border-rail-line md:px-5 md:py-4"
        >
          <Mark />
          <span className="text-base font-semibold tracking-tight">Lotus</span>
        </Link>

        <nav
          aria-label="Primary"
          className="relative ml-auto flex min-w-0 gap-1 overflow-x-auto md:ml-0 md:flex-col md:gap-0 md:px-3 md:py-3"
        >
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === current;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded px-2.5 py-1.5 text-sm transition-colors duration-150",
                  active
                    ? "bg-rail-2 text-rail-fg"
                    : "text-rail-fg-2 hover:bg-rail-2/60 hover:text-rail-fg",
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="hidden md:inline">{label}</span>
                <span className="sr-only md:hidden">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden border-t border-rail-line px-5 py-4 text-xs text-rail-fg-2 md:block">
          <div>Lotus agency</div>
          <p className="mt-2 leading-relaxed text-rail-fg-2/70">Demo data. Client names, numbers and notes are synthetic until live feeds are connected.</p>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
