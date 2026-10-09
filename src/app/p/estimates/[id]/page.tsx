import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ApproveEstimate, CustomerShell } from "@/components/field/customer-views";
import { findEstimate } from "@/lib/data/field-store";
import { findClient, findContact } from "@/lib/data/store";
import { estimateDisplay, formatDay, localDate } from "@/lib/field";
import { customerApproveAction } from "@/app/agency/estimates/actions";

export const metadata = { title: "Your estimate" };

async function View({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const now = new Date();
  const e = findEstimate(now, id);
  const client = e ? findClient(now, e.accountId) : undefined;
  if (!e || !client) notFound();
  const contact = findContact(now, e.contactId);
  const d = estimateDisplay(e, localDate(now, client.timeZone));
  const open = d === "sent";
  return (
    <CustomerShell business={client.account.name}>
      <div className="flex flex-col gap-6">
        <div>
          <p className="num text-xs text-fg-3">
            Estimate {e.number} · {e.address}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{e.title}</h1>
          <p className="mt-1 text-sm text-fg-2">
            {contact ? `For ${contact.firstName} ${contact.lastName}. ` : ""}
            {d === "draft" ? "Preview. This estimate has not been sent to the customer yet." : d === "expired" ? `This estimate expired on ${formatDay(e.expiresOn)}. Call us for an updated price.` : d === "declined" ? "You declined this estimate. Call us if anything changes." : `Prices include tax and hold until ${formatDay(e.expiresOn, { month: "long", day: "numeric" })}.`}
          </p>
        </div>
        {e.message && <p className="max-w-[72ch] border-l border-line-strong pl-4 text-sm leading-relaxed text-fg-2">{e.message}</p>}
        <ApproveEstimate e={e} approve={customerApproveAction} open={open} />
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
