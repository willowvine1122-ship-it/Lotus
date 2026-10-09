import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { WorkflowStatus } from "@/lib/types";
import type { ClientRef } from "@/components/crm/model";
import { cn, formatCount } from "@/lib/utils";
import { WorkflowStatusTag } from "./ui";

/*
 * The ink header shared by the builder and the run history: back link,
 * client, the workflow's name and status, actions on the right, and the
 * Builder | Runs tabs at the foot of the band, as on the client page.
 */

export const inkButton = "inline-flex h-8 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-3 text-sm font-medium text-rail-fg transition-colors duration-150 hover:bg-rail-line disabled:cursor-not-allowed disabled:opacity-50";

export function WorkflowHeader({
  id,
  name,
  status,
  client,
  tab,
  runs,
  meta,
  actions,
}: {
  id: string;
  name: string;
  status: WorkflowStatus;
  client: ClientRef;
  tab: "builder" | "runs";
  runs: number;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const tabs = [
    { key: "builder", label: "Builder", href: `/agency/automations/${id}` },
    { key: "runs", label: "Runs", href: `/agency/automations/${id}/runs`, count: runs },
  ] as const;
  return (
    <div className="bg-rail text-rail-fg">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 pt-5 md:px-6">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-rail-fg-2">
            <Link href={`/agency/automations?client=${client.slug}`} className="inline-flex items-center gap-1 text-rail-fg hover:underline">
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Automations
            </Link>
            <span aria-hidden>·</span>
            <Link href={`/agency/clients/${client.slug}`} className="truncate hover:text-rail-fg hover:underline">
              {client.name}
            </Link>
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-xl font-semibold leading-7 tracking-tight">{name}</h1>
            <span className="shrink-0 rounded-[4px] bg-surface">
              <WorkflowStatusTag status={status} />
            </span>
          </div>
          {meta && <div className="mt-0.5 text-xs text-rail-fg-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <nav aria-label="Workflow sections" className="flex gap-1 overflow-x-auto px-5 pt-3 md:px-6">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("flex h-9 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm transition-colors duration-150", tab === t.key ? "border-surface text-rail-fg" : "border-transparent text-rail-fg-2 hover:text-rail-fg")}
          >
            {t.label}
            {"count" in t && t.count > 0 && <span className="num rounded-[4px] bg-rail-2 px-1.5 text-2xs">{formatCount(t.count)}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
