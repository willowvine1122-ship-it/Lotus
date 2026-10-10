import Link from "next/link";
import { Plus } from "lucide-react";
import { SectionTitle } from "@/components/diagnostic/primitives";
import type { Opportunity, Pipeline } from "@/lib/types";
import { formatDollars } from "@/lib/utils";
import { stageFor, statusLabel } from "./model";

/** A contact's opportunities across every pipeline, for the contact page. */
export function ContactOpportunities({
  contactId,
  clientSlug,
  opportunities,
  pipelines,
}: {
  contactId: string;
  clientSlug: string;
  opportunities: Opportunity[];
  pipelines: Pipeline[];
}) {
  const sorted = [...opportunities].sort(
    (a, b) =>
      (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle
        aside={
          <Link
            href={`/agency/opportunities/new?client=${clientSlug}&contact=${contactId}`}
            className="inline-flex items-center gap-1 text-xs text-fg-2 hover:text-fg"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Add
          </Link>
        }
      >
        Opportunities
      </SectionTitle>
      {sorted.length === 0 ? (
        <p className="rounded border border-dashed border-line-strong px-3.5 py-4 text-center text-xs text-fg-3">
          No opportunities yet.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded border border-line">
          {sorted.map((o) => {
            const p = pipelines.find((x) => x.id === o.pipelineId);
            return (
              <li key={o.id}>
                <Link
                  href={`/agency/opportunities?client=${clientSlug}&pipeline=${o.pipelineId}&opp=${o.id}`}
                  className="flex items-baseline gap-3 px-3 py-2 hover:bg-surface-2/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {o.name}
                    </span>
                    <span className="block truncate text-xs text-fg-3">
                      {p?.name} ·{" "}
                      {o.status === "open"
                        ? stageFor(p, o.stageId).name
                        : statusLabel[o.status]}
                    </span>
                  </span>
                  <span className="num shrink-0 text-sm">
                    {o.valueCents ? (
                      formatDollars(o.valueCents)
                    ) : (
                      <span className="text-fg-3">–</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
