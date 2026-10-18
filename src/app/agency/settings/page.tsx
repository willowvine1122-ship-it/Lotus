import { openWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import { connection } from "next/server";
import { SettingsBoard, type Integration } from "@/components/settings/settings-board";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { emailLive } from "@/lib/data/email";
import { listClients, teamDirectory } from "@/lib/data/store";
import { paymentsLive } from "@/lib/payments/stripe";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata = { title: "Settings" };

async function Board() {
  await connection();
  await openWorkspace();
  const now = new Date();
  const clients = listClients(now);
  const clientsPerMember: Record<string, number> = {};
  for (const c of clients) for (const a of c.assignees) clientsPerMember[a.name] = (clientsPerMember[a.name] ?? 0) + 1;
  const integrations: Integration[] = [
    { name: "Twilio", purpose: "Texts and calls from the Inbox, review requests, automations", envVar: "TWILIO_AUTH_TOKEN", live: Boolean(process.env.TWILIO_AUTH_TOKEN), demo: "Texts are recorded in the Inbox but not delivered." },
    { name: "Resend", purpose: "Email campaigns, client reports, receipts", envVar: "RESEND_API_KEY", live: emailLive(), demo: "Sends are logged with a delivered status." },
    { name: "Stripe", purpose: "Donations, invoices and card payments", envVar: "STRIPE_SECRET_KEY", live: paymentsLive(), demo: "Charges succeed instantly with a demo reference." },
    { name: "Meta", purpose: "Ad spend and lead metrics on the Daily Diagnostic, Messenger replies", envVar: "META_ACCESS_TOKEN", live: Boolean(process.env.META_ACCESS_TOKEN), demo: "Metrics come from the seeded demo data." },
    { name: "Supabase", purpose: "Sign-in, team roles and the production database", envVar: "NEXT_PUBLIC_SUPABASE_URL", live: isSupabaseConfigured(), demo: "Data lives in memory and reseeds each day." },
  ];
  return <SettingsBoard team={teamDirectory()} clientsPerMember={clientsPerMember} integrations={integrations} inboundUrl="/api/inbound" />;
}

export default function SettingsPage() {
  return (
    <Shell current="/agency/settings">
      <Suspense fallback={<PageHeader title="Settings" meta={<span className="text-fg-3">Loading…</span>} />}>
        <Board />
      </Suspense>
    </Shell>
  );
}
