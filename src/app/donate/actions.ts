"use server";

import { withPublicWorkspace } from "@/lib/server/workspace";
import { z } from "zod";
import { findCampaign, recordGift } from "@/lib/data/donors";
import { countries, feeToCover } from "@/lib/fundraising";
import { chargeGift } from "@/lib/payments/stripe";
import { donationReceived } from "@/lib/data/automation-events";
import { creditGift } from "@/lib/data/elements";

/*
 * The public checkout's one action. Validates the gift with zod, recomputes
 * the fee on the server (the browser's figure is never trusted), charges
 * through the payment boundary, then records donor, gift and plan.
 */

export type DonateState =
  | { ok: true; receipt: { donationId: string; totalCents: number; amountCents: number; frequency: "one_time" | "monthly"; nextChargeOn?: string; firstName: string; email: string; demo: boolean } }
  | { ok: false; errors?: Record<string, string>; message?: string }
  | null;

const schema = z.object({
  campaign: z.string().min(1),
  frequency: z.enum(["one_time", "monthly"]),
  amount: z
    .string()
    .transform((v) => Number(String(v).replace(/[^0-9.]/g, "")))
    .pipe(z.number({ message: "Choose an amount" }).min(1, "The smallest gift is $1").max(100_000, "For gifts over $100,000 please contact us directly")),
  coverFees: z.boolean(),
  designation: z.string().trim().min(1),
  firstName: z.string().trim().min(1, "Enter your first name").max(80),
  lastName: z.string().trim().min(1, "Enter your last name").max(80),
  email: z.string().trim().email("Enter an email for your receipt"),
  country: z.string().refine((c) => countries.some((x) => x.code === c), "Choose your country"),
  anonymous: z.boolean(),
});

export async function donateAction(_prev: DonateState, formData: FormData): Promise<DonateState> {
  const res = await withPublicWorkspace(`campaign:${String(formData.get("campaign") ?? "")}`, async (): Promise<DonateState> => {
    const parsed = schema.safeParse({
      campaign: formData.get("campaign"),
      frequency: formData.get("frequency"),
      amount: formData.get("amount") ?? "",
      coverFees: formData.get("coverFees") === "on",
      designation: formData.get("designation") ?? "",
      firstName: formData.get("firstName") ?? "",
      lastName: formData.get("lastName") ?? "",
      email: formData.get("email") ?? "",
      country: formData.get("country") ?? "",
      anonymous: formData.get("anonymous") === "on",
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = String(i.path[0] ?? "form");
        errors[k] ??= i.message;
      }
      return { ok: false, errors };
    }
    const d = parsed.data;
    const now = new Date();
    const found = findCampaign(now, d.campaign);
    if (!found || found.campaign.status !== "live") return { ok: false, message: "This campaign is not taking gifts right now." };
    const designation = found.campaign.designations.includes(d.designation) ? d.designation : found.campaign.designations[0];

    const amountCents = Math.round(d.amount * 100);
    const feeCoveredCents = d.coverFees ? feeToCover(amountCents) : 0;
    const charge = await chargeGift({
      accountId: found.client.account.id,
      campaignId: found.campaign.id,
      amountCents: amountCents + feeCoveredCents,
      frequency: d.frequency,
      email: d.email,
      name: `${d.firstName} ${d.lastName}`,
    });
    if (!charge.ok) return { ok: false, message: charge.message };

    const receipt = recordGift(now, {
      campaignSlug: d.campaign,
      amountCents,
      feeCoveredCents,
      frequency: d.frequency,
      designation,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      countryCode: d.country,
      anonymous: d.anonymous,
      paymentRef: charge.ref,
    });
    if (!receipt) return { ok: false, message: "We could not record your gift. You have not been charged." };
    // Gifts that came through a donation element are credited to it.
    const element = formData.get("element");
    if (typeof element === "string" && element) creditGift(now, element.slice(0, 120), receipt.donationId, amountCents);
    if (receipt.contactId) donationReceived(now, receipt.accountId, receipt.contactId, receipt.totalCents, found.campaign.title);

    return {
      ok: true,
      receipt: {
        donationId: receipt.donationId,
        totalCents: receipt.totalCents,
        amountCents,
        frequency: d.frequency,
        nextChargeOn: receipt.nextChargeOn,
        firstName: d.firstName,
        email: d.email,
        demo: charge.demo,
      },
    };
  });
  return res ?? { ok: false, message: "This campaign is not taking gifts right now." };
}
