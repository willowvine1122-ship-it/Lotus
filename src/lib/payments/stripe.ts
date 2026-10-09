
/*
 * Payment boundary for donations. In demo mode (no STRIPE_SECRET_KEY) a gift
 * is recorded with a demo reference and nothing is charged. Wiring Stripe
 * means: create a PaymentIntent (one-time) or a Customer + Subscription
 * (monthly) on the client's connected account, confirm it with Payment
 * Element on the checkout, and record the gift from the webhook instead of
 * from the action. The shape returned here is what the action records.
 */

export interface ChargeRequest {
  accountId: string;
  campaignId: string;
  amountCents: number; // gift plus any fees covered
  frequency: "one_time" | "monthly";
  email: string;
  name: string;
}

export type ChargeResult = { ok: true; ref: string; demo: boolean } | { ok: false; message: string };

export function paymentsLive() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function chargeGift(req: ChargeRequest): Promise<ChargeResult> {
  if (req.amountCents < 100) return { ok: false, message: "The smallest gift we can process is $1." };
  if (paymentsLive()) {
    return { ok: false, message: "Card payments are being connected. Please try again shortly." };
  }
  const prefix = req.frequency === "monthly" ? "sub_demo_" : "pi_demo_";
  return { ok: true, ref: `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, demo: true };
}
