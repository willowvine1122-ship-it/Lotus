import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  Account,
  ClientOverview,
  DailyDiagnostic,
  DiagnosticNote,
  Task,
  ClientRecord,
} from "@/lib/types";
import { demoClients } from "./demo-clients";
import {
  demoAccounts,
  demoDiagnostics,
  demoNotes,
  demoOverview,
  demoTasks,
} from "./demo";

// Data access for the agency layer. Falls back to demo data when Supabase
// is not configured so the app is usable straight after `npm run dev`.

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function getClientOverviews(): Promise<ClientOverview[]> {
  if (!isSupabaseConfigured()) return demoOverview();

  const supabase = await createClient();
  const day = todayIso();
  const [{ data: accounts }, { data: diagnostics }, { data: notes }, { data: tasks }] =
    await Promise.all([
      supabase.from("accounts").select("id, agency_id, name, slug, mode, brand_color").order("name"),
      supabase.from("daily_diagnostics").select("*").eq("day", day),
      supabase
        .from("diagnostic_notes")
        .select("id, account_id, body, internal_only, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("tasks").select("id, account_id, status").neq("status", "done"),
    ]);

  return (accounts ?? []).map((row) => {
    const account: Account = {
      id: row.id,
      agencyId: row.agency_id,
      name: row.name,
      slug: row.slug,
      mode: row.mode,
      brandColor: row.brand_color ?? undefined,
    };
    const d = diagnostics?.find((x) => x.account_id === row.id);
    const n = notes?.find((x) => x.account_id === row.id);
    return {
      account,
      diagnostic: d ? mapDiagnostic(d) : null,
      latestNote: n
        ? { id: n.id, accountId: n.account_id, authorName: "Team", body: n.body, internalOnly: n.internal_only, createdAt: n.created_at }
        : null,
      openTasks: tasks?.filter((t) => t.account_id === row.id).length ?? 0,
    };
  });
}

export async function getClientDetail(accountId: string): Promise<{
  account: Account;
  diagnostics: DailyDiagnostic[];
  notes: DiagnosticNote[];
  tasks: Task[];
} | null> {
  if (!isSupabaseConfigured()) {
    const account = demoAccounts.find((a) => a.id === accountId || a.slug === accountId);
    if (!account) return null;
    return {
      account,
      diagnostics: demoDiagnostics.filter((d) => d.accountId === account.id),
      notes: demoNotes
        .filter((n) => n.accountId === account.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      tasks: demoTasks.filter((t) => t.accountId === account.id),
    };
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("accounts")
    .select("id, agency_id, name, slug, mode, brand_color")
    .or(`id.eq.${accountId},slug.eq.${accountId}`)
    .maybeSingle();
  if (!row) return null;

  const [{ data: diagnostics }, { data: notes }, { data: tasks }] = await Promise.all([
    supabase.from("daily_diagnostics").select("*").eq("account_id", row.id).order("day", { ascending: false }).limit(30),
    supabase.from("diagnostic_notes").select("*").eq("account_id", row.id).order("created_at", { ascending: false }),
    supabase.from("tasks").select("*").eq("account_id", row.id).order("created_at"),
  ]);

  return {
    account: { id: row.id, agencyId: row.agency_id, name: row.name, slug: row.slug, mode: row.mode, brandColor: row.brand_color ?? undefined },
    diagnostics: (diagnostics ?? []).map(mapDiagnostic),
    notes: (notes ?? []).map((n) => ({ id: n.id, accountId: n.account_id, authorName: "Team", body: n.body, internalOnly: n.internal_only, createdAt: n.created_at })),
    tasks: (tasks ?? []).map((t) => ({ id: t.id, accountId: t.account_id, title: t.title, status: t.status, dueOn: t.due_on ?? undefined })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDiagnostic(d: any): DailyDiagnostic {
  return {
    id: d.id,
    accountId: d.account_id,
    day: d.day,
    health: d.health,
    metrics: d.metrics,
    alerts: d.alerts ?? [],
    summary: d.summary,
  };
}

/**
 * Full client records with daily history for the Daily Diagnostic.
 * The Supabase path needs a daily-metrics table that does not exist yet,
 * so this always serves the synthetic set for now.
 */
export async function getClientRecords(now: Date): Promise<ClientRecord[]> {
  return demoClients(now);
}
