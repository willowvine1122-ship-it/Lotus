import Link from "next/link";
import {
  Activity,
  CheckSquare,
  Inbox,
  LayoutGrid,
  Settings,
  Users,
} from "lucide-react";

const nav = [
  { href: "/agency", label: "Daily Diagnostic", icon: Activity },
  { href: "/agency/clients", label: "Clients", icon: LayoutGrid },
  { href: "/agency/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/agency/inbox", label: "Inbox", icon: Inbox },
  { href: "/agency/contacts", label: "Contacts", icon: Users },
  { href: "/agency/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-white font-semibold">
          L
        </span>
        <span className="text-lg font-semibold tracking-tight">Lotus</span>
      </div>
      <nav className="flex flex-col gap-0.5 px-3">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto px-5 py-4 text-xs text-muted">Agency workspace</div>
    </aside>
  );
}
