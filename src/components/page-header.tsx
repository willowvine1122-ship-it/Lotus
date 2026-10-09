import { cn } from "@/lib/utils";

/**
 * Header band. Sits on paper, separated from the board by a single rule,
 * so the page reads top to bottom: title, what the numbers say, the board.
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
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line bg-surface px-5 pb-4 pt-6 md:px-8",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {meta && <div className="mt-1 text-sm text-fg-3">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary"
          ? "bg-brand text-white shadow-1 hover:bg-brand-hover"
          : "border border-line-strong bg-surface text-fg hover:bg-surface-2",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
