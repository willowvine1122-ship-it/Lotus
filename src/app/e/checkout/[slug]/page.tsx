import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { elementLive } from "@/components/elements/data";
import { FramedCheckout } from "@/components/elements/framed-checkout";
import { findCampaign } from "@/lib/data/donors";
import { campaignFor, findElement } from "@/lib/data/elements";
import { isHex } from "@/lib/elements";

/*
 * The checkout the install script opens over a client's site when someone
 * clicks an element: full window, transparent, the gift prefilled from the
 * element (?amount=5000&frequency=monthly&element=…).
 */

export const metadata: Metadata = { title: "Donate", robots: { index: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Page({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  await connection();
  const now = new Date();
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const elementId = one("element");
  const element = elementId ? findElement(now, elementId) : undefined;
  // Donate links only know the element; "el" means "the element's campaign".
  const found = slug === "el" ? (element ? campaignFor(now, element) : null) : findCampaign(now, slug);
  if (!found) notFound();
  const live = elementLive(now, { accountId: found.client.account.id, campaignId: found.campaign.id });
  if (!live) notFound();
  const amount = Number(one("amount"));
  const frequency = one("frequency");
  const accent = one("accent");
  return (
    <FramedCheckout
      live={live}
      accent={accent && isHex(accent) ? accent : (element?.config.accent ?? "#e0245e")}
      start={{
        amountCents: Number.isFinite(amount) && amount >= 100 ? Math.min(amount, 10_000_000) : undefined,
        frequency: frequency === "monthly" || frequency === "one_time" ? frequency : undefined,
        elementId: element?.id,
      }}
    />
  );
}

export default function CheckoutPage(props: Props) {
  return (
    <>
      <style>{"html,body{background:transparent!important}"}</style>
      <Suspense fallback={null}>
        <Page {...props} />
      </Suspense>
    </>
  );
}
