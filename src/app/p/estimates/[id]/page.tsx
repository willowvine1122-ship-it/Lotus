import { openPublicWorkspace } from "@/lib/server/workspace";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { CustomerShell } from "@/components/field/customer-views";
import { EstimateSignOff } from "@/components/estimates/sign-off";
import { estimateExtras, patchEstimateExtras } from "@/lib/data/estimate-kit";
import { findEstimate } from "@/lib/data/field-store";
import { addActivity, findClient, findContact } from "@/lib/data/store";
import { estimateDisplay, formatDay, localDate } from "@/lib/field";
import { customerPayDepositAction, customerSignAction } from "@/app/agency/estimates/kit-actions";

export const metadata = { title: "Your estimate", robots: { index: false } };

async function View({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  if (!(await openPublicWorkspace(`estimate:${id}`))) notFound();
  const now = new Date();
  const e = findEstimate(now, id);
  const client = e ? findClient(now, e.accountId) : undefined;
  if (!e || !client) notFound();
  const contact = findContact(now, e.contactId);
  const extras = estimateExtras(now, e.id);
  const d = estimateDisplay(e, localDate(now, client.timeZone));
  const open = d === "sent";
  // The first time the customer opens a sent estimate, note it on their timeline.
  if (open && !extras.viewedAt) {
    // Saved with the rest of this render's changes once the page is sent.
    patchEstimateExtras(now, e.id, { viewedAt: now.toISOString() });
    addActivity(now, e.contactId, { kind: "estimate", title: `Estimate ${e.number} opened`, body: "The customer opened their link.", by: "System" });
  }
  return (
    <CustomerShell business={client.account.name}>
      <div className="flex flex-col gap-8">
        <div>
          <p className="num text-xs text-fg-3">
            Estimate {e.number} · {e.address}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{e.title}</h1>
          <p className="mt-1 text-sm text-fg-2">
            {contact ? `For ${contact.firstName} ${contact.lastName}. ` : ""}
            {d === "draft" ? "Preview. This estimate has not been sent to the customer yet." : d === "expired" ? `This estimate expired on ${formatDay(e.expiresOn)}. Call us for an updated price.` : d === "declined" ? "You declined this estimate. Call us if anything changes." : d === "sent" ? `Prices include tax and hold until ${formatDay(e.expiresOn, { month: "long", day: "numeric" })}.` : "Approved. Thank you."}
          </p>
        </div>
        {e.message && <p className="max-w-[72ch] border-l border-line-strong pl-4 text-sm leading-relaxed text-fg-2">{e.message}</p>}
        <EstimateSignOff
          e={{ id: e.id, number: e.number, options: e.options, taxRateBps: e.taxRateBps, status: e.status, approvedOptionId: e.approvedOptionId }}
          extras={{ addOns: extras.addOns, chosenAddOnIds: extras.chosenAddOnIds, terms: extras.terms, depositPct: extras.depositPct, signature: extras.signature, deposit: extras.deposit }}
          open={open}
          customerName={contact ? `${contact.firstName} ${contact.lastName}` : undefined}
          sign={customerSignAction}
          payDeposit={customerPayDepositAction}
        />
      </div>
    </CustomerShell>
  );
}

export default function CustomerEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <View params={params} />
    </Suspense>
  );
}
