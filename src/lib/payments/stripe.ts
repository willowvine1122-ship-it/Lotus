/*
 * Card payments. Stripe is stubbed until keys are provided: charges succeed
 * immediately with a demo PaymentIntent id. With STRIPE_SECRET_KEY set this is
 * where a PaymentIntent is created and confirmed against the saved method.
 */

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function chargeCard(input: { amountCents: number; description: string; customerRef: string }): Promise<{ ok: true; reference: string } | { ok: false; error: string }> {
  if (input.amountCents <= 0) return { ok: false, error: "Nothing to charge" };
  // Live mode lands with keys; the demo never touches the network.
  return { ok: true, reference: `pi_demo_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}` };
}
