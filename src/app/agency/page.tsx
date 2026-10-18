import { Suspense } from "react";
import { connection } from "next/server";
import { dismissSetupAction } from "@/app/account/actions";
import { Diagnostic } from "@/components/diagnostic/diagnostic";
import { SetupChecklist, type SetupStep } from "@/components/setup-checklist";
import { Shell } from "@/components/shell";
import { getClientRecords } from "@/lib/data/agency";
import { listContacts } from "@/lib/data/store";
import { canManageTeam } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { mailerLive } from "@/lib/server/mailer";
import { openWorkspace, workspaceMembers } from "@/lib/server/workspace";

export const metadata = { title: "Daily Diagnostic" };

async function Board() {
  await connection();
  const s = await openWorkspace();
  const now = new Date();
  const clients = await getClientRecords(now);
  const members = workspaceMembers();
  const manage = canManageTeam(s.role);
  const invites = manage ? await db<{ role: string }[]>("invite.list", { agency: s.agency.id }) : [];
  const steps: SetupStep[] = [
    { key: "client", title: "Add your first client", body: "Each client is a sub-account with its own contacts, inbox, calendars, funnels and numbers.", href: "/agency/clients/new", cta: "Add client", done: clients.length > 0 },
    { key: "contacts", title: "Add or import contacts", body: "Type them in, upload a CSV, or connect a form or webhook so leads arrive on their own.", href: "/agency/contacts/new", cta: "Add contact", done: listContacts(now).length > 0 },
    { key: "team", title: "Invite your team", body: "Admins and team members see every client. You choose each person's role.", href: "/agency/settings?tab=team", cta: "Invite", done: members.some((m) => m.role !== "client" && m.userId !== s.user.id) || invites.some((i) => i.role !== "client") },
    { key: "portal", title: "Give a client their login", body: "Clients sign in to see their own results, reviews and reports, and nothing else.", href: "/agency/settings?tab=team", cta: "Invite client", done: members.some((m) => m.role === "client") || invites.some((i) => i.role === "client") },
    { key: "email", title: "Connect email", body: "Add a Resend key so invites, campaigns and reports are delivered for real.", href: "/agency/settings?tab=providers", cta: "See how", done: mailerLive() },
  ];
  const showSetup = manage && !s.agency.settings.setupDismissed && steps.some((x) => !x.done);
  return (
    <Diagnostic
      clients={clients}
      nowIso={now.toISOString()}
      banner={showSetup ? <SetupChecklist steps={steps} compact={clients.length > 0} dismiss={clients.length > 0 ? dismissSetupAction : undefined} /> : undefined}
    />
  );
}

export default function AgencyHome() {
  return (
    <Shell current="/agency">
      <Suspense
        fallback={
          <header className="bg-rail px-5 py-3 text-rail-fg md:px-6">
            <h1 className="text-lg font-semibold leading-6 tracking-tight">Daily Diagnostic</h1>
            <p className="text-xs text-rail-fg-2">Loading clients…</p>
          </header>
        }
      >
        <Board />
      </Suspense>
    </Shell>
  );
}
