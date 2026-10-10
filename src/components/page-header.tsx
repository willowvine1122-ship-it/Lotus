import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Header band in the same ink as the rail, so rail and header read as one
 * frame around the paper work area, like a timetable's blue header strip.
 */
export function PageHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3 bg-rail px-5 pb-5 pt-6 text-rail-fg md:px-8",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {meta && <div className="mt-1 text-sm text-rail-fg-2">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

const buttonBase =
  "inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm font-medium transition-colors duration-150";
const buttonVariant = {
  primary: "bg-brand text-white shadow-1 hover:bg-brand-hover",
  secondary: "border border-rail-line bg-rail-2 text-rail-fg hover:bg-rail-line",
} as const;

/** Button with a route, so a primary action always goes somewhere. */
export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: keyof typeof buttonVariant;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(buttonBase, buttonVariant[variant], className)}>
      {children}
    </Link>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariant;
}) {
  return (
    <button
      className={cn(
        buttonBase,
        buttonVariant[variant],
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
