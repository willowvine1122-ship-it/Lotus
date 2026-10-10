"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  KeyRound,
  Plus,
  Search,
} from "lucide-react";
import { ButtonLink } from "@/components/page-header";
import { Segmented, Tag } from "@/components/diagnostic/primitives";
import type {
  AccountMode,
  ApiKey,
  IncomingWebhook,
  IntegrationConnection,
  IntegrationLog,
  IntegrationLogKind,
  OutgoingWebhook,
} from "@/lib/types";
import { Kpi, KpiStrip } from "@/components/field/ui";
import { cn, formatCount, timeAgo } from "@/lib/utils";
import { apps, findApp, logKindLabel } from "./catalog";
import {
  AppPanel,
  HookInPanel,
  HookOutPanel,
  KeyPanel,
  LogPanel,
  NewHookPanel,
  NewKeyPanel,
  type PanelCtx,
} from "./panels";
import { AppMark, LogStatus } from "./ui";

/*
 * The integrations hub: one client at a time, four views (apps, webhooks,
 * API keys, activity) on the board grammar: ink top bar, KPI strip, table,
 * right panel. Connections belong to a client, so there is no "all clients".
 */

export type HubTab = "apps" | "webhooks" | "keys" | "activity";

export interface HubData {
  client: { id: string; name: string; slug: string; mode: AccountMode };
  connections: IntegrationConnection[];
  hooksIn: IncomingWebhook[];
  hooksOut: OutgoingWebhook[];
  keys: ApiKey[];
  logs: IntegrationLog[];
  contacts: Record<string, string>;
  usage: Record<string, string[]>;
}

type Selection =
  | { kind: "app" | "in" | "out" | "key" | "log"; id: string }
  | { kind: "new-hook" | "new-key" }
  | null;

const DAY = 86400000;
const inbound: IntegrationLogKind[] = ["app_event", "webhook_in"];
const th =
  "whitespace-nowrap px-3 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6";
const td = "px-3 py-1.5 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6";

function Row({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <tr
      aria-selected={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "h-[52px] cursor-pointer border-b border-line transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand",
        selected
          ? "bg-brand-soft/40 shadow-[inset_2px_0_0_var(--brand)]"
          : "hover:bg-surface-2/60",
      )}
    >
      {children}
    </tr>
  );
}

function Empty({
  cols,
  children,
}: {
  cols: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={cols} className="px-5 py-10 text-center text-sm text-fg-3">
        {children}
      </td>
    </tr>
  );
}

function Dashed({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center rounded-[4px] border border-dashed border-line-strong px-1.5 text-2xs font-medium whitespace-nowrap text-fg-3">
      {children}
    </span>
  );
}

export function IntegrationsHub({
  clients,
  data,
  origin,
  nowIso,
  initialTab,
}: {
  clients: { id: string; name: string }[];
  data: HubData;
  origin: string;
  nowIso: string;
  initialTab: HubTab;
}) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [tab, setTab] = useState<HubTab>(initialTab);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | IntegrationLogKind | "failed">(
    "all",
  );
  const [selection, setSelection] = useState<Selection>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const { client, connections, hooksIn, hooksOut, keys, logs } = data;
  const q = query.trim().toLowerCase();

  const connectedIds = useMemo(
    () => new Set(connections.map((c) => c.appId)),
    [connections],
  );
  const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString();
  const week = logs.filter((l) => l.at >= weekAgo);
  const eventsIn = week.filter((l) => inbound.includes(l.kind)).length;
  const actionsOut = week.filter(
    (l) => !inbound.includes(l.kind) && l.kind !== "import",
  ).length;
  const failed = week.filter((l) => l.status === "failed").length;
  const lastAt = (ref: string) => logs.find((l) => l.ref === ref)?.at;
  const count7 = (ref: string) => week.filter((l) => l.ref === ref).length;
  const failed7 = (ref: string) =>
    week.filter((l) => l.ref === ref && l.status === "failed").length;

  const sourceName = (l: IntegrationLog) =>
    findApp(l.ref)?.name ??
    hooksIn.find((h) => h.id === l.ref)?.name ??
    hooksOut.find((h) => h.id === l.ref)?.name ??
    keys.find((k) => k.id === l.ref)?.label ??
    "Removed";

  /* ----- rows per tab ----- */
  const appRows = useMemo(
    () =>
      apps
        .filter(
          (a) =>
            !q ||
            [a.name, a.category, a.blurb].some((s) =>
              s.toLowerCase().includes(q),
            ),
        )
        .sort(
          (a, b) =>
            Number(connectedIds.has(b.id)) - Number(connectedIds.has(a.id)) ||
            a.name.localeCompare(b.name),
        ),
    [q, connectedIds],
  );
  const hookRows = useMemo(
    () =>
      [
        ...hooksIn.map((h) => ({
          dir: "in" as const,
          id: h.id,
          name: h.name,
          endpoint: `/api/hooks/${h.token.slice(0, 6)}…`,
          createdAt: h.createdAt,
        })),
        ...hooksOut.map((h) => ({
          dir: "out" as const,
          id: h.id,
          name: h.name,
          endpoint: h.url,
          createdAt: h.createdAt,
        })),
      ].filter(
        (h) =>
          !q || [h.name, h.endpoint].some((s) => s.toLowerCase().includes(q)),
      ),
    [hooksIn, hooksOut, q],
  );
  const keyRows = keys
    .filter((k) => !q || k.label.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        Number(!!a.revokedAt) - Number(!!b.revokedAt) ||
        b.createdAt.localeCompare(a.createdAt),
    );
  const logRows = logs
    .filter(
      (l) =>
        (kind === "all" ||
          (kind === "failed" ? l.status === "failed" : l.kind === kind)) &&
        (!q ||
          [
            l.title,
            l.detail,
            sourceName(l),
            data.contacts[l.contactId ?? ""] ?? "",
          ].some((s) => s.toLowerCase().includes(q))),
    )
    .slice(0, 200);

  /* ----- the selected thing, falling back to the first row ----- */
  const fallback: Selection =
    tab === "apps"
      ? appRows[0]
        ? { kind: "app", id: appRows[0].id }
        : null
      : tab === "webhooks"
        ? hookRows[0]
          ? { kind: hookRows[0].dir, id: hookRows[0].id }
          : { kind: "new-hook" }
        : tab === "keys"
          ? keyRows[0]
            ? { kind: "key", id: keyRows[0].id }
            : { kind: "new-key" }
          : logRows[0]
            ? { kind: "log", id: logRows[0].id }
            : null;
  const belongs = (s: Selection) =>
    !!s &&
    (tab === "apps"
      ? s.kind === "app"
      : tab === "webhooks"
        ? s.kind === "in" || s.kind === "out" || s.kind === "new-hook"
        : tab === "keys"
          ? s.kind === "key" || s.kind === "new-key"
          : s.kind === "log");
  const current = belongs(selection) ? selection : fallback;
  const select = (s: Selection) => {
    setSelection(s);
    setPanelOpen(true);
  };
  const isSel = (k: string, id: string) =>
    !!current && "id" in current && current.kind === k && current.id === id;

  const switchTab = (t: HubTab) => {
    setTab(t);
    setSelection(null);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
  };

  const ctx: PanelCtx = {
    clientId: client.id,
    clientName: client.name,
    origin,
    now,
    logs,
    contacts: data.contacts,
    usage: data.usage,
    onClose: undefined,
  };
  const panel = (onClose?: () => void) => {
    const c = { ...ctx, onClose };
    if (!current) return null;
    switch (current.kind) {
      case "app": {
        const app = findApp(current.id);
        return app ? (
          <AppPanel
            key={app.id}
            app={app}
            connection={connections.find((x) => x.appId === app.id)}
            ctx={c}
          />
        ) : null;
      }
      case "in": {
        const h = hooksIn.find((x) => x.id === current.id);
        return h ? (
          <HookInPanel
            key={h.id}
            hook={h}
            ctx={c}
            onDeleted={() => setSelection(null)}
          />
        ) : null;
      }
      case "out": {
        const h = hooksOut.find((x) => x.id === current.id);
        return h ? (
          <HookOutPanel
            key={h.id}
            hook={h}
            ctx={c}
            onDeleted={() => setSelection(null)}
          />
        ) : null;
      }
      case "new-hook":
        return (
          <NewHookPanel
            ctx={c}
            onCreated={(id) =>
              setSelection({ kind: id.startsWith("new-in") ? "in" : "out", id })
            }
          />
        );
      case "key": {
        const k = keys.find((x) => x.id === current.id);
        return k ? <KeyPanel key={k.id} apiKey={k} ctx={c} /> : null;
      }
      case "new-key":
        return (
          <NewKeyPanel
            ctx={c}
            onCreated={(id) => setSelection({ kind: "key", id })}
          />
        );
      case "log": {
        const l = logs.find((x) => x.id === current.id);
        return l ? (
          <LogPanel key={l.id} entry={l} source={sourceName(l)} ctx={c} />
        ) : null;
      }
    }
  };

  const panelKey = current
    ? `${current.kind}-${"id" in current ? current.id : ""}`
    : "none";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-rail text-rail-fg">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-5 pt-3 md:flex-nowrap md:px-6">
            <div className="min-w-0 md:shrink-0">
              <h1 className="text-lg font-semibold leading-6 tracking-tight">
                Integrations
              </h1>
              <p className="num text-xs text-rail-fg-2 md:whitespace-nowrap">
                {client.name} · {formatCount(connections.length)}{" "}
                {connections.length === 1 ? "app" : "apps"} connected
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
                placeholder={
                  tab === "apps"
                    ? "Search apps"
                    : tab === "activity"
                      ? "Search activity"
                      : tab === "keys"
                        ? "Search keys"
                        : "Search webhooks"
                }
                className="h-8 w-full rounded border border-rail-line bg-rail-2 pl-8 pr-3 text-sm text-rail-fg placeholder:text-rail-fg-2/80 focus:border-rail-fg-2 focus:outline-none"
              />
            </label>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <select
                aria-label="Client"
                value={client.id}
                onChange={(e) =>
                  router.push(
                    `/agency/integrations?client=${e.target.value}&tab=${tab}`,
                  )
                }
                className="h-7 max-w-[170px] rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ButtonLink
                href={`/agency/automations/new?client=${client.id}`}
                className="h-7 whitespace-nowrap px-2.5 text-xs"
              >
                <Plus className="size-3.5" strokeWidth={2.25} />
                <span className="hidden xl:inline">New workflow</span>
                <span className="sr-only xl:hidden">New workflow</span>
              </ButtonLink>
            </div>
          </div>
          <nav
            aria-label="Integration sections"
            className="mt-2 flex gap-1 overflow-x-auto px-3 md:px-4"
          >
            {(
              [
                { key: "apps", label: "Apps", count: connections.length },
                {
                  key: "webhooks",
                  label: "Webhooks",
                  count: hooksIn.length + hooksOut.length,
                },
                {
                  key: "keys",
                  label: "API keys",
                  count: keys.filter((k) => !k.revokedAt).length,
                },
                { key: "activity", label: "Activity", count: failed || null },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => switchTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-1.5 whitespace-nowrap border-b-2 px-2 text-sm transition-colors duration-150",
                  tab === t.key
                    ? "border-surface text-rail-fg"
                    : "border-transparent text-rail-fg-2 hover:text-rail-fg",
                )}
              >
                {t.label}
                {t.count !== null && (
                  <span
                    className={cn(
                      "num rounded-[4px] px-1.5 text-2xs",
                      t.key === "activity" ? "bg-red text-white" : "bg-rail-2",
                    )}
                  >
                    {t.key === "activity" ? `${t.count} failed` : t.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </header>

        <KpiStrip>
          <Kpi
            label="Connected apps"
            value={formatCount(connections.length)}
            aside={`of ${apps.length}`}
          />
          <Kpi
            label="Events in · 7 days"
            value={formatCount(eventsIn)}
            aside="leads, payments, posts"
          />
          <Kpi
            label="Sent out · 7 days"
            value={formatCount(actionsOut)}
            aside="app steps, webhooks, API"
          />
          <Kpi
            label="Failures · 7 days"
            value={formatCount(failed)}
            aside={failed ? "needs a look" : "all clear"}
            tone={failed ? "red" : undefined}
          />
        </KpiStrip>

        {tab === "webhooks" && (
          <div className="flex items-center gap-2 px-5 pb-3 md:px-6">
            <p className="min-w-0 flex-1 text-xs text-fg-3">
              Incoming webhooks turn any tool&apos;s posts into contacts.
              Outgoing ones send contacts from a workflow step.
            </p>
            <button
              type="button"
              onClick={() => select({ kind: "new-hook" })}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded border border-line-strong bg-surface px-2.5 text-xs font-medium hover:bg-surface-2"
            >
              <Plus className="size-3.5" strokeWidth={2} />
              New webhook
            </button>
          </div>
        )}
        {tab === "keys" && (
          <div className="flex items-center gap-2 px-5 pb-3 md:px-6">
            <p className="min-w-0 flex-1 text-xs text-fg-3">
              Keys open the REST API at{" "}
              <span className="num text-fg-2">/api/v1/contacts</span> for{" "}
              {client.name} only.
            </p>
            <button
              type="button"
              onClick={() => select({ kind: "new-key" })}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded border border-line-strong bg-surface px-2.5 text-xs font-medium hover:bg-surface-2"
            >
              <Plus className="size-3.5" strokeWidth={2} />
              New key
            </button>
          </div>
        )}
        {tab === "activity" && (
          <div className="flex flex-wrap items-center gap-2 px-5 pb-3 md:px-6">
            <Segmented
              label="Kind"
              tone="paper"
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "All" },
                ...(
                  [
                    "app_event",
                    "app_action",
                    "webhook_in",
                    "webhook_out",
                    "api",
                  ] as const
                ).map((k) => ({ value: k, label: logKindLabel[k] })),
                { value: "failed", label: "Failed" },
              ]}
            />
            <span className="num ml-auto text-xs text-fg-3">
              Last 30 days · {formatCount(logRows.length)} shown
            </span>
          </div>
        )}

        <div className="overflow-x-auto border-y border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            {tab === "apps" && (
              <>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>
                      App
                    </th>
                    <th scope="col" className={cn(th, "hidden xl:table-cell")}>
                      Category
                    </th>
                    <th scope="col" className={cn(th, "hidden 2xl:table-cell")}>
                      Adds
                    </th>
                    <th scope="col" className={th}>
                      Status
                    </th>
                    <th
                      scope="col"
                      className={cn(th, "hidden text-right sm:table-cell")}
                    >
                      7 days
                    </th>
                    <th scope="col" className={cn(th, "hidden 2xl:table-cell")}>
                      Last activity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {appRows.map((a) => {
                    const conn = connections.find((c) => c.appId === a.id);
                    const last = lastAt(a.id);
                    return (
                      <Row
                        key={a.id}
                        selected={isSel("app", a.id)}
                        onSelect={() => select({ kind: "app", id: a.id })}
                      >
                        <td className={td}>
                          <span className="flex min-w-0 items-center gap-3">
                            <AppMark appId={a.id} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">
                                {a.name}
                              </span>
                              <span className="block max-w-[20ch] sm:max-w-[36ch] truncate text-xs text-fg-3">
                                {conn ? conn.accountLabel : a.blurb}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td
                          className={cn(
                            td,
                            "hidden whitespace-nowrap text-fg-2 xl:table-cell",
                          )}
                        >
                          {a.category}
                        </td>
                        <td
                          className={cn(
                            td,
                            "hidden whitespace-nowrap text-xs text-fg-2 2xl:table-cell",
                          )}
                        >
                          {[
                            a.triggers.length &&
                              `${a.triggers.length} ${a.triggers.length === 1 ? "trigger" : "triggers"}`,
                            a.actions.length &&
                              `${a.actions.length} ${a.actions.length === 1 ? "step" : "steps"}`,
                            a.importLabel && "import",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </td>
                        <td className={td}>
                          {conn ? (
                            <Tag tone="neutral">Connected</Tag>
                          ) : (
                            <Dashed>Not connected</Dashed>
                          )}
                        </td>
                        <td
                          className={cn(
                            td,
                            "num hidden text-right sm:table-cell",
                          )}
                        >
                          {conn ? (
                            formatCount(count7(a.id))
                          ) : (
                            <span className="text-fg-3">–</span>
                          )}
                        </td>
                        <td
                          className={cn(
                            td,
                            "hidden whitespace-nowrap text-fg-2 2xl:table-cell",
                          )}
                        >
                          {last ? (
                            timeAgo(last, now)
                          ) : (
                            <span className="text-fg-3">–</span>
                          )}
                        </td>
                      </Row>
                    );
                  })}
                  {appRows.length === 0 && (
                    <Empty cols={6}>No apps match “{query}”.</Empty>
                  )}
                </tbody>
              </>
            )}

            {tab === "webhooks" && (
              <>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>
                      Webhook
                    </th>
                    <th scope="col" className={cn(th, "hidden sm:table-cell")}>
                      Direction
                    </th>
                    <th scope="col" className={cn(th, "text-right")}>
                      7 days
                    </th>
                    <th
                      scope="col"
                      className={cn(th, "hidden text-right md:table-cell")}
                    >
                      Failed
                    </th>
                    <th scope="col" className={cn(th, "hidden xl:table-cell")}>
                      Last
                    </th>
                    <th scope="col" className={cn(th, "hidden 2xl:table-cell")}>
                      Workflows
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {hookRows.map((h) => {
                    const last = lastAt(h.id);
                    const f = failed7(h.id);
                    return (
                      <Row
                        key={h.id}
                        selected={isSel(h.dir, h.id)}
                        onSelect={() => select({ kind: h.dir, id: h.id })}
                      >
                        <td className={td}>
                          <span className="block truncate font-medium">
                            {h.name}
                          </span>
                          <span className="num block max-w-[44ch] truncate text-xs text-fg-3">
                            {h.endpoint}
                          </span>
                        </td>
                        <td
                          className={cn(
                            td,
                            "hidden whitespace-nowrap text-fg-2 sm:table-cell",
                          )}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {h.dir === "in" ? (
                              <ArrowDownLeft
                                className="size-3.5 text-fg-3"
                                strokeWidth={1.75}
                              />
                            ) : (
                              <ArrowUpRight
                                className="size-3.5 text-fg-3"
                                strokeWidth={1.75}
                              />
                            )}
                            {h.dir === "in" ? "Incoming" : "Outgoing"}
                          </span>
                        </td>
                        <td className={cn(td, "num text-right")}>
                          {formatCount(count7(h.id))}
                        </td>
                        <td
                          className={cn(
                            td,
                            "num hidden text-right md:table-cell",
                            f ? "font-medium text-red" : "text-fg-3",
                          )}
                        >
                          {f}
                        </td>
                        <td
                          className={cn(
                            td,
                            "hidden whitespace-nowrap text-fg-2 xl:table-cell",
                          )}
                        >
                          {last ? (
                            timeAgo(last, now)
                          ) : (
                            <span className="text-fg-3">Never</span>
                          )}
                        </td>
                        <td
                          className={cn(
                            td,
                            "num hidden text-fg-2 2xl:table-cell",
                          )}
                        >
                          {data.usage[h.id]?.length ?? 0}
                        </td>
                      </Row>
                    );
                  })}
                  {hookRows.length === 0 && (
                    <Empty cols={6}>
                      {q
                        ? `No webhooks match “${query}”.`
                        : "No webhooks yet. Create one to receive leads from any tool."}
                    </Empty>
                  )}
                </tbody>
              </>
            )}

            {tab === "keys" && (
              <>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>
                      Key
                    </th>
                    <th scope="col" className={cn(th, "hidden sm:table-cell")}>
                      Made
                    </th>
                    <th scope="col" className={th}>
                      Last used
                    </th>
                    <th scope="col" className={th}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {keyRows.map((k) => (
                    <Row
                      key={k.id}
                      selected={isSel("key", k.id)}
                      onSelect={() => select({ kind: "key", id: k.id })}
                    >
                      <td className={td}>
                        <span className="flex items-center gap-2.5">
                          <KeyRound
                            className="size-4 shrink-0 text-fg-3"
                            strokeWidth={1.75}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {k.label}
                            </span>
                            <span className="num block text-xs text-fg-3">
                              {k.prefix}…
                            </span>
                          </span>
                        </span>
                      </td>
                      <td
                        className={cn(
                          td,
                          "hidden whitespace-nowrap text-fg-2 sm:table-cell",
                        )}
                      >
                        {k.createdBy} · {timeAgo(k.createdAt, now)}
                      </td>
                      <td className={cn(td, "whitespace-nowrap text-fg-2")}>
                        {k.lastUsedAt ? (
                          timeAgo(k.lastUsedAt, now)
                        ) : (
                          <span className="text-fg-3">Never</span>
                        )}
                      </td>
                      <td className={td}>
                        {k.revokedAt ? (
                          <Dashed>Revoked</Dashed>
                        ) : (
                          <Tag tone="neutral">Active</Tag>
                        )}
                      </td>
                    </Row>
                  ))}
                  {keyRows.length === 0 && (
                    <Empty cols={4}>No API keys yet.</Empty>
                  )}
                </tbody>
              </>
            )}

            {tab === "activity" && (
              <>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>
                      When
                    </th>
                    <th scope="col" className={th}>
                      What
                    </th>
                    <th scope="col" className={cn(th, "hidden md:table-cell")}>
                      Source
                    </th>
                    <th scope="col" className={cn(th, "hidden xl:table-cell")}>
                      Contact
                    </th>
                    <th scope="col" className={cn(th, "text-right")}>
                      Result
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logRows.map((l) => (
                    <Row
                      key={l.id}
                      selected={isSel("log", l.id)}
                      onSelect={() => select({ kind: "log", id: l.id })}
                    >
                      <td className={cn(td, "num whitespace-nowrap text-fg-2")}>
                        {timeAgo(l.at, now)}
                      </td>
                      <td className={cn(td, "max-w-0 w-full")}>
                        <span className="block truncate font-medium">
                          {l.title}
                        </span>
                        <span className="block truncate text-xs text-fg-3">
                          {l.detail}
                        </span>
                      </td>
                      <td
                        className={cn(
                          td,
                          "hidden whitespace-nowrap md:table-cell",
                        )}
                      >
                        <span className="flex items-center gap-2 text-fg-2">
                          {findApp(l.ref) ? (
                            <AppMark appId={l.ref} size="sm" />
                          ) : null}
                          <span className="max-w-[160px] truncate">
                            {sourceName(l)}
                          </span>
                        </span>
                      </td>
                      <td
                        className={cn(
                          td,
                          "hidden max-w-[160px] truncate whitespace-nowrap text-fg-2 xl:table-cell",
                        )}
                      >
                        {l.contactId ? (
                          (data.contacts[l.contactId] ?? (
                            <span className="text-fg-3">Deleted</span>
                          ))
                        ) : (
                          <span className="text-fg-3">–</span>
                        )}
                      </td>
                      <td className={cn(td, "text-right")}>
                        <LogStatus log={l} />
                      </td>
                    </Row>
                  ))}
                  {logRows.length === 0 && (
                    <Empty cols={5}>
                      Nothing in the last 30 days
                      {kind !== "all" || q ? " matches" : ""}.
                    </Empty>
                  )}
                </tbody>
              </>
            )}
          </table>
        </div>
      </div>

      {current && (
        <>
          <aside
            key={panelKey}
            className="sticky top-0 hidden h-screen w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block xl:w-[384px] 2xl:w-[420px]"
          >
            {panel()}
          </aside>
          {panelOpen && (
            <div
              className="fixed inset-0 z-20 flex lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Details"
            >
              <button
                type="button"
                aria-label="Close panel"
                onClick={() => setPanelOpen(false)}
                className="flex-1 bg-rail/40"
              />
              <aside className="h-full w-[min(100%,420px)] overflow-y-auto border-l border-line bg-surface shadow-2">
                {panel(() => setPanelOpen(false))}
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
