"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Globe, Pencil, Plus, Search, X } from "lucide-react";
import { Sparkline } from "@/components/charts";
import { ButtonLink } from "@/components/page-header";
import { ChangeArrow } from "@/components/diagnostic/primitives";
import { CopyField } from "@/components/integrations/ui";
import { inkButton, smallButton } from "@/components/forms/ui";
import { Kpi, KpiStrip } from "@/components/field/ui";
import { cn, formatCount, formatRate, timeAgo } from "@/lib/utils";
import { useDetailPanel } from "@/lib/use-detail-panel";
import type { BoardSite } from "./data";
import { pageHref, type ClientRef } from "./model";
import { DomainTag, SiteStatusTag, domainLabel } from "./ui";

/*
 * Websites board: ink top bar, KPI strip, the table and a site panel, on the
 * same grammar as Funnels and Forms.
 */

const th =
  "whitespace-nowrap px-3 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6";
const td = "px-3 py-1.5 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6";

export function WebsitesBoard({
  sites,
  clients,
  origin,
  nowIso,
  initialClientId,
}: {
  sites: BoardSite[];
  clients: ClientRef[];
  origin: string;
  nowIso: string;
  initialClientId?: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [clientId, setClientId] = useState(initialClientId ?? "all");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "live" | "draft">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const panel = useDetailPanel();
  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  );

  const inClient = sites.filter(
    (s) => clientId === "all" || s.site.accountId === clientId,
  );
  const q = query.trim().toLowerCase();
  const rows = inClient
    .filter((s) => scope === "all" || s.site.status === scope)
    .filter(
      (s) =>
        !q ||
        [
          s.site.name,
          s.site.slug,
          s.site.domain?.host ?? "",
          clientById.get(s.site.accountId)?.name ?? "",
        ].some((x) => x.toLowerCase().includes(q)),
    )
    .sort(
      (a, b) =>
        Number(a.site.status !== "live") - Number(b.site.status !== "live") ||
        b.views7 - a.views7 ||
        a.site.name.localeCompare(b.site.name),
    );
  const selected =
    rows.find((s) => s.site.id === selectedId) ?? rows[0] ?? null;

  const live = inClient.filter((s) => s.site.status === "live").length;
  const views = inClient.reduce((a, s) => a + s.views7, 0);
  const prev = inClient.reduce((a, s) => a + s.viewsPrev7, 0);
  const leads = inClient.reduce((a, s) => a + s.leads7, 0);
  const domainsNeedingWork = inClient.filter(
    (s) => s.site.domain && s.site.domain.status !== "connected",
  ).length;
  const clientName =
    clientId === "all" ? undefined : clientById.get(clientId)?.name;
  const newHref = `/agency/websites/new${clientId !== "all" ? `?client=${clientId}` : ""}`;

  const select = (id: string) => {
    setSelectedId(id);
    panel.show();
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-3 bg-rail px-5 py-3 text-rail-fg md:flex-nowrap md:px-6">
          <div className="min-w-0 md:shrink-0">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">
              Websites
            </h1>
            <p className="num text-xs text-rail-fg-2 md:whitespace-nowrap">
              {clientName ?? "All clients"} · {formatCount(inClient.length)}{" "}
              sites · {formatCount(live)} live
            </p>
          </div>
          <label className="relative order-last w-full md:order-none md:ml-2 md:w-auto md:min-w-[160px] md:max-w-[280px] md:flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-rail-fg-2"
              strokeWidth={1.75}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sites or domains"
              className="h-8 w-full rounded border border-rail-line bg-rail-2 pl-8 pr-3 text-sm text-rail-fg placeholder:text-rail-fg-2/80 focus:border-rail-fg-2 focus:outline-none"
            />
          </label>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <select
              aria-label="Status"
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
              className="hidden h-7 rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none sm:block"
            >
              <option value="all">Every status</option>
              <option value="live">Live</option>
              <option value="draft">Draft</option>
            </select>
            <select
              aria-label="Client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setSelectedId(null);
              }}
              className="h-7 max-w-[160px] rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none"
            >
              <option value="all">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ButtonLink
              href={newHref}
              className="h-7 whitespace-nowrap px-2.5 text-xs"
            >
              <Plus className="size-3.5" strokeWidth={2.25} />
              <span className="hidden sm:inline">New site</span>
              <span className="sr-only sm:hidden">New site</span>
            </ButtonLink>
          </div>
        </header>

        <KpiStrip>
          <Kpi
            label="Live sites"
            value={formatCount(live)}
            aside={`of ${formatCount(inClient.length)}`}
          />
          <Kpi
            label="Visits · 7 days"
            value={formatCount(views)}
            aside={
              <span className="inline-flex items-center gap-1">
                <ChangeArrow value={prev ? (views - prev) / prev : null} />
                was {formatCount(prev)}
              </span>
            }
          />
          <Kpi
            label="Leads · 7 days"
            value={formatCount(leads)}
            aside="from site forms"
          />
          <Kpi
            label="Visit to lead"
            value={formatRate(views ? leads / views : null)}
            aside={
              domainsNeedingWork
                ? `${domainsNeedingWork} domain${domainsNeedingWork === 1 ? "" : "s"} waiting`
                : "7 days"
            }
            tone={domainsNeedingWork ? "amber" : undefined}
          />
        </KpiStrip>

        <div className="overflow-x-auto border-y border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={th}>
                  Site
                </th>
                <th scope="col" className={cn(th, "hidden md:table-cell")}>
                  Client
                </th>
                <th scope="col" className={cn(th, "hidden sm:table-cell")}>
                  Status
                </th>
                <th
                  scope="col"
                  className={cn(th, "hidden text-right 2xl:table-cell")}
                >
                  Pages
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  Visits 7d
                </th>
                <th
                  scope="col"
                  className={cn(th, "hidden text-right xl:table-cell")}
                >
                  Leads 7d
                </th>
                <th scope="col" className={cn(th, "hidden xl:table-cell")}>
                  Domain
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const on = selected?.site.id === s.site.id;
                return (
                  <tr
                    key={s.site.id}
                    aria-selected={on}
                    tabIndex={0}
                    onClick={() => select(s.site.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        select(s.site.id);
                      }
                    }}
                    className={cn(
                      "h-[52px] cursor-pointer border-b border-line transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand",
                      on
                        ? "bg-brand-soft/40 shadow-[inset_2px_0_0_var(--brand)]"
                        : "hover:bg-surface-2/60",
                    )}
                  >
                    <td className={td}>
                      <span className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-[3px]"
                          style={{ background: s.site.brandColor }}
                        />
                        <span className="min-w-0">
                          <span className="block max-w-[34ch] truncate font-medium">
                            {s.site.name}
                          </span>
                          <span className="num block max-w-[34ch] truncate text-xs text-fg-3">
                            {s.site.domain?.status === "connected"
                              ? s.site.domain.host
                              : `/s/${s.site.slug}`}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td
                      className={cn(
                        td,
                        "hidden whitespace-nowrap text-fg-2 md:table-cell",
                      )}
                    >
                      {clientById.get(s.site.accountId)?.name}
                    </td>
                    <td className={cn(td, "hidden sm:table-cell")}>
                      <SiteStatusTag status={s.site.status} />
                    </td>
                    <td
                      className={cn(
                        td,
                        "num hidden text-right text-fg-2 2xl:table-cell",
                      )}
                    >
                      {s.pages.length}
                    </td>
                    <td className={cn(td, "text-right")}>
                      <span className="inline-flex items-center justify-end gap-3">
                        <span className="hidden lg:block">
                          {s.views30 > 0 && (
                            <Sparkline
                              values={s.daily.slice(-14)}
                              color="var(--chart-1)"
                              width={56}
                              height={18}
                            />
                          )}
                        </span>
                        <span className="num min-w-[3ch]">
                          {s.views7 ? (
                            formatCount(s.views7)
                          ) : (
                            <span className="text-fg-3">–</span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td
                      className={cn(
                        td,
                        "num hidden text-right text-fg-2 xl:table-cell",
                      )}
                    >
                      {s.leads7 ? (
                        formatCount(s.leads7)
                      ) : (
                        <span className="text-fg-3">–</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        td,
                        "hidden max-w-[220px] text-xs xl:table-cell",
                      )}
                    >
                      <DomainTag domain={s.site.domain} />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-fg-3"
                  >
                    {inClient.length === 0 ? (
                      <>
                        No websites yet.{" "}
                        <Link
                          href={newHref}
                          className="font-medium text-fg underline-offset-2 hover:underline"
                        >
                          Build the first one
                        </Link>
                      </>
                    ) : (
                      "Nothing matches."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <>
          {panel.docked && (
          <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[384px] 2xl:w-[420px]">
            <SitePanel
              item={selected}
              client={clientById.get(selected.site.accountId)}
              origin={origin}
              now={now}
              onClose={panel.close}
            />
          </aside>
          )}
          {panel.open && (
            <div
              className="fixed inset-0 z-20 flex lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label={selected.site.name}
            >
              <button
                type="button"
                aria-label="Close panel"
                onClick={panel.close}
                className="flex-1 bg-rail/40"
              />
              <aside className="h-full w-[min(100%,420px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                <SitePanel
                  item={selected}
                  client={clientById.get(selected.site.accountId)}
                  origin={origin}
                  now={now}
                  onClose={panel.close}
                />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SitePanel({
  item,
  client,
  origin,
  now,
  onClose,
}: {
  item: BoardSite;
  client?: ClientRef;
  origin: string;
  now: Date;
  onClose?: () => void;
}) {
  const { site } = item;
  const lotusUrl = `${origin}/s/${site.slug}`;
  const pages = [...item.pages].sort((a, b) => b.views - a.views);
  const top = pages[0]?.views || 1;
  return (
    <div>
      <div className="sticky top-0 z-[1] border-b border-line bg-surface px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold leading-6 tracking-tight">
              {site.name}
            </h2>
            <p className="mt-0.5 truncate text-xs text-fg-3">
              {client?.name} · {item.pages.length}{" "}
              {item.pages.length === 1 ? "page" : "pages"}
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              aria-label="Close panel"
              title="Close (Esc)"
              onClick={onClose}
              className="grid size-8 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <SiteStatusTag status={site.status} />
          <span className="text-xs text-fg-3">
            Edited {timeAgo(site.updatedAt, now)}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/agency/websites/${site.id}`} className={inkButton}>
            <Pencil className="size-3.5" strokeWidth={2} />
            Edit site
          </Link>
          <Link
            href={`/agency/websites/${site.id}?tab=domain`}
            className={smallButton}
          >
            <Globe className="size-3.5" strokeWidth={2} />
            Domain
          </Link>
          {site.status === "live" && (
            <a
              href={`/s/${site.slug}`}
              target="_blank"
              rel="noreferrer"
              className={smallButton}
            >
              <ExternalLink className="size-3.5" strokeWidth={2} />
              Open
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 px-5 py-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold">Address</h3>
          {site.domain?.status === "connected" ? (
            <CopyField
              value={`https://${site.domain.host}`}
              label="Site address"
            />
          ) : (
            <CopyField value={lotusUrl} label="Site address" />
          )}
          <p className="mt-1.5 text-xs leading-relaxed text-fg-3">
            {site.status === "draft"
              ? "Publish the site from the editor to switch the address on."
              : site.domain
                ? site.domain.status === "connected"
                  ? `Also answers on /s/${site.slug}.`
                  : `${site.domain.host}: ${domainLabel(site.domain).toLowerCase()}. Open Domain to see the record to add.`
                : "Connect the client's own domain from Domain."}
          </p>
        </section>

        <section>
          <h3 className="text-sm font-semibold">Last 30 days</h3>
          <div className="mt-2 grid grid-cols-3 divide-x divide-line rounded border border-line">
            {[
              { label: "Visits", value: formatCount(item.views30) },
              { label: "Leads", value: formatCount(item.leads30) },
              {
                label: "Visit to lead",
                value: formatRate(
                  item.views30 ? item.leads30 / item.views30 : null,
                ),
              },
            ].map((t) => (
              <div key={t.label} className="px-3 py-2.5">
                <div className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
                  {t.label}
                </div>
                <div className="num mt-0.5 text-base font-semibold">
                  {t.value}
                </div>
              </div>
            ))}
          </div>
          {item.views30 > 0 && (
            <div className="mt-3 flex items-end justify-between gap-3">
              <Sparkline
                values={item.daily}
                color="var(--chart-1)"
                width={260}
                height={36}
              />
              <span className="num shrink-0 text-xs text-fg-3">per day</span>
            </div>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold">Pages</h3>
          <p className="mt-0.5 text-xs text-fg-3">
            Visits in the last 30 days.
          </p>
          <ol className="mt-3 flex flex-col gap-2">
            {pages.map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  {site.status === "live" ? (
                    <a
                      href={pageHref(site, p)}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-medium text-fg hover:underline"
                    >
                      {p.title}
                    </a>
                  ) : (
                    <span className="truncate font-medium text-fg">
                      {p.title}
                    </span>
                  )}
                  <span className="num truncate text-fg-3">/{p.path}</span>
                  {!p.inNav && (
                    <span className="shrink-0 text-2xs text-fg-3">Hidden</span>
                  )}
                </span>
                <span className="num text-fg">{formatCount(p.views)}</span>
                <span
                  className="col-span-2 block h-1.5 rounded-[2px] bg-surface-2"
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-[2px] bg-[var(--chart-1)]"
                    style={{ width: `${(p.views / top) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
