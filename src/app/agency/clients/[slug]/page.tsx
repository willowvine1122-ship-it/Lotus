import { openWorkspace } from "@/lib/server/workspace";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft, Clock, ExternalLink, MapPin } from "lucide-react";
import { ClientForm } from "@/components/clients/client-form";
import { ClientOverview } from "@/components/clients/client-overview";
import { NotesTab, TasksTab, TeamTab } from "@/components/clients/client-tabs";
import { statusLabel, statusTone } from "@/components/clients/status";
import { buildRow } from "@/components/diagnostic/model";
import { AvatarStack, Tag } from "@/components/diagnostic/primitives";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { StatusChip } from "@/components/status";
import { getClientRecord } from "@/lib/data/agency";
import { teamDirectory } from "@/lib/data/store";
import { cn } from "@/lib/utils";
import { addNoteAction, addTaskAction, inviteMemberAction, removeMemberAction, toggleTaskAction, updateClientAction } from "../actions";

const tabs = [
  { key: "overview", label: "Overview" },
  { key: "notes", label: "Notes" },
  { key: "tasks", label: "Tasks" },
  { key: "team", label: "Team & access" },
  { key: "settings", label: "Settings" },
] as const;
type TabKey = (typeof tabs)[number]["key"];

async function ClientDetail({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { slug } = await params;
  const { tab: rawTab } = await searchParams;
  await connection();
  await openWorkspace();
  const now = new Date();
  const client = await getClientRecord(now, slug);
  if (!client) notFound();
  const tab: TabKey = tabs.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "overview";
  const row = buildRow(client, 30, now);
  const nowIso = now.toISOString();
  const id = client.account.id;
  const openTasks = client.tasks.filter((t) => t.status !== "done").length;
  const localTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: client.timeZone, timeZoneName: "short" }).format(now);
  const counts: Partial<Record<TabKey, number>> = { notes: client.notes.length, tasks: openTasks, team: client.assignees.length + client.clientMembers.length };

  return (
    <>
      <PageHeader
        className="pb-0"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {client.account.name}
            <StatusChip health={client.health} />
          </span>
        }
        meta={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/agency/clients" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Clients
            </Link>
            {client.status !== "active" && (
              <>
                <span aria-hidden>·</span>
                <Tag tone={statusTone[client.status]}>{statusLabel[client.status]}</Tag>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{client.mode === "marketing" ? "Digital marketing" : "Digital fundraising"}</span>
            <span aria-hidden>·</span>
            <span>{client.industry}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" strokeWidth={1.75} />
              {client.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" strokeWidth={1.75} />
              <span className="num">{localTime}</span>
            </span>
          </span>
        }
        actions={
          <>
            <AvatarStack people={client.assignees} />
            <Link
              href={`/c/${client.account.slug}`}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-3 text-sm font-medium text-rail-fg hover:bg-rail-line"
            >
              Client view
              <ExternalLink className="size-3.5" strokeWidth={2} />
            </Link>
          </>
        }
      />
      <nav aria-label="Client sections" className="flex gap-1 overflow-x-auto bg-rail px-5 pt-4 text-rail-fg md:px-8">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/agency/clients/${client.account.slug}` : `/agency/clients/${client.account.slug}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm transition-colors duration-150",
              tab === t.key ? "border-surface text-rail-fg" : "border-transparent text-rail-fg-2 hover:text-rail-fg",
            )}
          >
            {t.label}
            {counts[t.key] !== undefined && counts[t.key]! > 0 && <span className="num rounded-[4px] bg-rail-2 px-1.5 text-2xs">{counts[t.key]}</span>}
          </Link>
        ))}
      </nav>

      <div className={cn("px-5 py-6 md:px-8", tab === "settings" && "px-0 py-0 md:px-0")}>
        {tab === "overview" && <ClientOverview row={row} client={client} nowIso={nowIso} />}
        {tab === "notes" && <NotesTab client={client} nowIso={nowIso} addNote={addNoteAction.bind(null, id)} />}
        {tab === "tasks" && <TasksTab client={client} team={teamDirectory()} nowIso={nowIso} addTask={addTaskAction.bind(null, id)} toggleTask={toggleTaskAction.bind(null, id)} />}
        {tab === "team" && <TeamTab client={client} nowIso={nowIso} invite={inviteMemberAction.bind(null, id)} remove={removeMemberAction.bind(null, id)} />}
        {tab === "settings" && (
          <div className="bg-surface">
            <ClientForm action={updateClientAction.bind(null, id)} team={teamDirectory()} client={client} />
          </div>
        )}
      </div>
    </>
  );
}

export default function ClientPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  return (
    <Shell current="/agency/clients">
      <Suspense fallback={<PageHeader title="Client" meta={<span className="text-fg-3">Loading…</span>} />}>
        <ClientDetail params={params} searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
