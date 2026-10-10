import type { Website, WebsiteDomain } from "@/lib/types";
import { cn } from "@/lib/utils";

/* Small pieces shared by the websites screens. */

/** Live is the normal state: neutral with a small green dot. Draft is the dashed outline. */
export function SiteStatusTag({ status }: { status: Website["status"] }) {
  if (status === "draft")
    return (
      <span className="inline-flex h-5 items-center whitespace-nowrap rounded-[4px] border border-dashed border-line-strong px-1.5 text-2xs font-medium text-fg-3">
        Draft
      </span>
    );
  return (
    <span className="inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-[4px] bg-surface-2 px-1.5 text-2xs font-medium text-fg-2">
      <span className="size-1.5 rounded-full bg-green" aria-hidden />
      Live
    </span>
  );
}

/** Connected is quiet; waiting is amber; wrong DNS is red. */
export function DomainTag({
  domain,
  className,
}: {
  domain?: WebsiteDomain;
  className?: string;
}) {
  if (!domain)
    return (
      <span className={cn("text-xs text-fg-3", className)}>Lotus address</span>
    );
  const tone =
    domain.status === "connected"
      ? "bg-green"
      : domain.status === "pending"
        ? "bg-amber"
        : "bg-red";
  const label =
    domain.status === "connected"
      ? "Connected"
      : domain.status === "pending"
        ? "Waiting for DNS"
        : "DNS needs fixing";
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
      title={domain.found}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", tone)}
        aria-hidden
      />
      <span className="num truncate text-fg-2">{domain.host}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function domainLabel(d: WebsiteDomain) {
  return d.status === "connected"
    ? "Connected"
    : d.status === "pending"
      ? "Waiting for DNS"
      : "DNS needs fixing";
}
