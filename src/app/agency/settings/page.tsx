import { Suspense } from "react";
import { connection } from "next/server";
import { changePasswordAction, inviteAction, removeMemberAction, revokeInviteAction, setMemberAction, updateAgencyAction, updateProfileAction } from "@/app/account/actions";
import { SettingsBoard, type Integration, type InviteRow, type MemberRow, type SettingsTab } from "@/components/settings/settings-board";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { listClients, teamDirectory } from "@/lib/data/store";
import { paymentsLive } from "@/lib/payments/stripe";
import { canManageTeam } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { mailerLive } from "@/lib/server/mailer";
import { openWorkspace, workspaceMembers } from "@/lib/server/workspace";

export const metadata = { title: "Settings" };

const tabs: SettingsTab[] = ["profile", "agency", "team", "providers"];

async function Board({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  await connection();
  const s = await openWorkspace();
  const now = new Date();
  const clients = listClients(now);
  const clientsPerMember: Record<string, number> = {};
  for (const c of clients) for (const a of c.assignees) clientsPerMember[a.name] = (clientsPerMember[a.name] ?? 0) + 1;
  const people = teamDirectory();
  const members: MemberRow[] = workspaceMembers().map((m) => ({
    ...m,
    person: people.find((p) => p.name === m.name) ?? { name: m.name, initials: m.name.slice(0, 2).toUpperCase(), tone: "ink" },
    clients: clientsPerMember[m.name] ?? 0,
  }));
  const invites = canManageTeam(s.role) ? await db<InviteRow[]>("invite.list", { agency: s.agency.id }) : [];
  const integrations: Integration[] = [
    { name: "Resend", purpose: "Invites, email campaigns, client reports and receipts", envVars: ["RESEND_API_KEY", "LOTUS_EMAIL_FROM"], live: mailerLive(), off: "No email leaves Lotus. Invites give you a link to send yourself." },
    { name: "Twilio", purpose: "Texts from the Inbox, review requests and automations", envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"], live: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN), off: "Texts are saved in the Inbox but not delivered." },
    { name: "Stripe", purpose: "Donations, invoices and card payments", envVars: ["STRIPE_SECRET_KEY"], live: paymentsLive(), off: "Payment pages can't take real money yet." },
    { name: "Meta", purpose: "Ad spend and lead numbers on the Daily Diagnostic, Messenger replies", envVars: ["META_ACCESS_TOKEN"], live: Boolean(process.env.META_ACCESS_TOKEN), off: "The Daily Diagnostic shows only numbers you enter." },
  ];
  const settings = s.agency.settings;
  return (
    <SettingsBoard
      tab={tabs.includes(raw as SettingsTab) ? (raw as SettingsTab) : "team"}
      me={{ userId: s.user.id, name: s.user.name, email: s.user.email, role: s.role }}
      agency={{ name: s.agency.name, timeZone: settings.timeZone ?? "America/New_York", website: settings.website ?? "", phone: settings.phone ?? "", brandColor: settings.brandColor ?? "" }}
      members={members}
      invites={invites}
      clients={clients.map((c) => ({ id: c.account.id, name: c.account.name }))}
      integrations={integrations}
      nowIso={now.toISOString()}
      actions={{ profile: updateProfileAction, password: changePasswordAction, agency: updateAgencyAction, invite: inviteAction, revoke: revokeInviteAction, setMember: setMemberAction, remove: removeMemberAction }}
    />
  );
}

export default function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <Shell current="/agency/settings">
      <Suspense fallback={<PageHeader title="Settings" meta={<span className="text-fg-3">Loading…</span>} />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
