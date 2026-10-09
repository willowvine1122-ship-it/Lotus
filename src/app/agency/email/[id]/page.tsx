import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { CampaignEditor } from "@/components/email/campaign-editor";
import { CampaignReport, type RecipientRow } from "@/components/email/campaign-report";
import { audienceRows, campaignRow, contactsLite, emailClients } from "@/components/email/data";
import { fullName } from "@/components/crm/model";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { findCampaign, listSends } from "@/lib/data/email";
import { findContact, listContacts } from "@/lib/data/store";
import { deleteCampaignAction, duplicateCampaignAction, saveCampaignAction, scheduleCampaignAction, sendCampaignAction } from "../actions";

async function CampaignView({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string }> }) {
  const { id } = await params;
  const { sent } = await searchParams;
  await connection();
  const now = new Date();
  const campaign = findCampaign(now, id);
  if (!campaign) notFound();
  const client = emailClients(now).find((c) => c.id === campaign.accountId);
  if (!client) notFound();
  const sends = listSends(now, id);
  const row = campaignRow(now, campaign, new Map([[client.id, listContacts(now, client.id)]]), new Map([[id, sends]]));

  if (campaign.status === "sent") {
    const recipients: RecipientRow[] = sends.map((s) => {
      const c = findContact(now, s.contactId);
      return {
        contactId: s.contactId,
        name: c ? fullName(c) : s.email,
        email: s.email,
        bounced: s.status === "bounced",
        openedAt: s.openedAt,
        clickedAt: s.clickedAt,
        clickedUrl: s.clickedUrl,
        unsubscribedAt: s.unsubscribedAt,
      };
    });
    return <CampaignReport row={row} client={client} recipients={recipients} nowIso={now.toISOString()} justSent={sent !== undefined ? Number(sent) || 0 : undefined} duplicate={duplicateCampaignAction} />;
  }

  return (
    <CampaignEditor
      key={campaign.updatedAt}
      campaign={row}
      audienceId={campaign.audienceId}
      client={client}
      audiences={audienceRows(now).filter((a) => a.accountId === client.id)}
      contacts={contactsLite(now, client.id)}
      nowIso={now.toISOString()}
      actions={{ save: saveCampaignAction, schedule: scheduleCampaignAction, send: sendCampaignAction, remove: deleteCampaignAction }}
    />
  );
}

export default function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string }> }) {
  return (
    <Shell current="/agency/email">
      <Suspense fallback={<PageHeader title="Campaign" meta={<span className="text-fg-3">Loading…</span>} />}>
        <CampaignView params={params} searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
