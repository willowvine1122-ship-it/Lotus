"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CreditCard, HeartHandshake, Link2, Loader2 } from "lucide-react";
import { donateAction, type DonateState } from "@/app/donate/actions";
import { controlClass, Field, Input, Select } from "@/components/form";
import { countries, feeToCover } from "@/lib/fundraising";
import type { GiftFrequency } from "@/lib/types";
import { cn, formatDollars, formatDollarsExact } from "@/lib/utils";

/*
 * Fundraise Up style checkout: one card, three short steps (gift, details,
 * payment), then a thank-you. Everything lives in one form so the action
 * receives the whole gift; each step validates before moving on, and the
 * server re-validates and recomputes the fee.
 */

export interface CheckoutCampaign {
  slug: string;
  title: string;
  amounts: Record<GiftFrequency, number[]>;
  impact: Record<number, string>;
  defaultFrequency: GiftFrequency;
  designations: string[];
  live: boolean;
}

type Step = "amount" | "details" | "payment";
const steps: Step[] = ["amount", "details", "payment"];
const stepOf: Record<string, Step> = {
  amount: "amount",
  designation: "amount",
  frequency: "amount",
  firstName: "details",
  lastName: "details",
  email: "details",
  country: "details",
};

const money = (cents: number) => (cents % 100 === 0 ? formatDollars(cents) : formatDollarsExact(cents));

export function Checkout({ campaign, orgName, defaultCountry }: { campaign: CheckoutCampaign; orgName: string; defaultCountry: string }) {
  const [state, formAction, pending] = useActionState<DonateState, FormData>(donateAction, null);
  const [step, setStep] = useState<Step>("amount");
  const [frequency, setFrequency] = useState<GiftFrequency>(campaign.defaultFrequency);
  const preset = (f: GiftFrequency) => campaign.amounts[f][Math.floor((campaign.amounts[f].length - 1) / 2)] ?? 5000;
  const [amountCents, setAmountCents] = useState<number>(preset(campaign.defaultFrequency));
  const [custom, setCustom] = useState("");
  const [designation, setDesignation] = useState(campaign.designations[0] ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState(countries.some((c) => c.code === defaultCountry) ? defaultCountry : "US");
  const [anonymous, setAnonymous] = useState(false);
  const [coverFees, setCoverFees] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Extract<DonateState, { ok: true }>["receipt"] | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Server result: jump back to the step that owns the first error, or show the receipt.
  const [seen, setSeen] = useState<DonateState>(null);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setDone(state.receipt);
    else if (state?.errors) {
      setErrors(state.errors);
      const first = Object.keys(state.errors).map((k) => stepOf[k]).find(Boolean);
      if (first) setStep(first);
    }
  }

  // Move focus to the new step's heading, but not on first paint.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step, done]);

  const fee = useMemo(() => feeToCover(amountCents), [amountCents]);
  const total = amountCents + (coverFees ? fee : 0);
  const per = frequency === "monthly" ? "/mo" : "";
  const impact = campaign.impact[amountCents];
  const index = steps.indexOf(step);

  const switchFrequency = (f: GiftFrequency) => {
    setFrequency(f);
    if (!custom) setAmountCents(preset(f));
  };

  const validate = (s: Step) => {
    const e: Record<string, string> = {};
    if (s === "amount") {
      if (!amountCents || amountCents < 100) e.amount = "Choose an amount of at least $1";
      else if (amountCents > 10_000_000) e.amount = "For gifts over $100,000 please contact us directly";
    }
    if (s === "details") {
      if (!firstName.trim()) e.firstName = "Enter your first name";
      if (!lastName.trim()) e.lastName = "Enter your last name";
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = "Enter an email for your receipt";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validate(step)) setStep(steps[Math.min(steps.length - 1, index + 1)]);
  };

  if (!campaign.live) {
    return (
      <div className="rounded border border-line bg-surface p-6 text-sm text-fg-2">
        This campaign is not taking gifts right now. Thank you for thinking of {orgName}.
      </div>
    );
  }

  if (done) {
    return (
      <ThankYou
        receipt={done}
        orgName={orgName}
        designation={designation}
        slug={campaign.slug}
        headingRef={headingRef}
        onAgain={() => {
          setDone(null);
          setStep("amount");
          setCustom("");
          setAmountCents(preset(frequency));
        }}
      />
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // Enter on an early step moves forward instead of submitting the gift.
        if (step !== "payment") {
          e.preventDefault();
          next();
        }
      }}
      className="overflow-hidden rounded border border-line bg-surface"
      noValidate
    >
      <input type="hidden" name="campaign" value={campaign.slug} />
      <input type="hidden" name="frequency" value={frequency} />
      <input type="hidden" name="amount" value={(amountCents / 100).toFixed(2)} />
      <input type="hidden" name="designation" value={designation} />
      <input type="hidden" name="firstName" value={firstName} />
      <input type="hidden" name="lastName" value={lastName} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="country" value={country} />
      {anonymous && <input type="hidden" name="anonymous" value="on" />}
      {coverFees && <input type="hidden" name="coverFees" value="on" />}

      <div className="grid grid-cols-3 gap-1 px-5 pt-5" aria-hidden>
        {steps.map((s, i) => (
          <span key={s} className={cn("h-0.5 rounded-[1px] transition-colors duration-200", i <= index ? "bg-rail" : "bg-line")} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          {index > 0 && (
            <button
              type="button"
              onClick={() => setStep(steps[index - 1])}
              className="-ml-1.5 grid size-8 shrink-0 place-items-center rounded text-fg-2 transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <ArrowLeft className="size-4" strokeWidth={2} />
              <span className="sr-only">Back</span>
            </button>
          )}
          <h2 ref={headingRef} tabIndex={-1} className="text-base font-semibold outline-none">
            {step === "amount" ? "Choose your gift" : step === "details" ? "Your details" : "Payment"}
          </h2>
        </div>
        {step !== "amount" && (
          <span className="num shrink-0 text-sm text-fg-2">
            <span className="font-medium text-fg">{money(amountCents)}</span>
            {per}
          </span>
        )}
      </div>

      <div className="px-5 pb-5 pt-3">
        {step === "amount" && (
          <div className="flex flex-col gap-4">
            <div role="radiogroup" aria-label="How often" className="grid h-10 grid-cols-2 rounded bg-surface-2 p-0.5">
              {(["one_time", "monthly"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={frequency === f}
                  onClick={() => switchFrequency(f)}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-[4px] text-sm font-medium transition-colors duration-150",
                    frequency === f ? "bg-rail text-rail-fg" : "text-fg-2 hover:text-fg",
                  )}
                >
                  {f === "monthly" && <HeartHandshake className="size-4" strokeWidth={1.75} />}
                  {f === "monthly" ? "Monthly" : "Give once"}
                </button>
              ))}
            </div>

            <div role="radiogroup" aria-label="Amount" className="grid grid-cols-3 gap-2">
              {campaign.amounts[frequency].map((a) => {
                const on = !custom && a === amountCents;
                return (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setCustom("");
                      setAmountCents(a);
                      setErrors({});
                    }}
                    className={cn(
                      "num h-12 rounded border text-base font-semibold transition-colors duration-150",
                      on ? "border-rail bg-rail text-rail-fg" : "border-line-strong bg-surface text-fg hover:border-fg-3",
                    )}
                  >
                    {formatDollars(a)}
                  </button>
                );
              })}
            </div>

            <Field label="Other amount" htmlFor="custom-amount" error={errors.amount}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-3">$</span>
                <input
                  id="custom-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="Enter an amount"
                  value={custom}
                  aria-invalid={Boolean(errors.amount)}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, "");
                    setCustom(v);
                    setErrors({});
                    setAmountCents(v ? Math.round(Number(v) * 100) || 0 : preset(frequency));
                  }}
                  className={cn(controlClass, "num h-10 pl-7 pr-12")}
                />
                {frequency === "monthly" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-fg-3">/mo</span>}
              </div>
            </Field>

            <p className="flex min-h-[52px] items-start gap-2.5 rounded bg-surface-2/70 px-3 py-2.5 text-sm leading-relaxed text-fg-2" aria-live="polite">
              <HeartHandshake className="mt-0.5 size-4 shrink-0 text-fg-3" strokeWidth={1.75} />
              <span>
                {impact ? (
                  <>
                    <span className="num font-medium text-fg">
                      {money(amountCents)}
                      {per}
                    </span>{" "}
                    {impact.charAt(0).toLowerCase() + impact.slice(1)}
                  </>
                ) : frequency === "monthly" ? (
                  "Monthly gifts let us plan ahead and say yes when help is needed most."
                ) : (
                  `Every gift goes to work right away at ${orgName}.`
                )}
              </span>
            </p>

            {campaign.designations.length > 1 && (
              <Field label="Direct my gift to" htmlFor="designation">
                <Select id="designation" value={designation} onChange={(e) => setDesignation(e.target.value)} className="h-10">
                  {campaign.designations.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </Field>
            )}

            <PrimaryButton type="button" onClick={next}>
              {frequency === "monthly" ? `Give ${money(amountCents)} monthly` : `Give ${money(amountCents)}`}
            </PrimaryButton>

            {frequency === "one_time" && campaign.amounts.monthly.length > 0 && (
              <button type="button" onClick={() => switchFrequency("monthly")} className="-mt-1 self-center text-sm text-fg-2 underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-fg-3">
                Make it monthly instead
              </button>
            )}
          </div>
        )}

        {step === "details" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" htmlFor="firstName" error={errors.firstName}>
                <Input id="firstName" autoComplete="given-name" value={firstName} aria-invalid={Boolean(errors.firstName)} onChange={(e) => setFirstName(e.target.value)} className="h-10" />
              </Field>
              <Field label="Last name" htmlFor="lastName" error={errors.lastName}>
                <Input id="lastName" autoComplete="family-name" value={lastName} aria-invalid={Boolean(errors.lastName)} onChange={(e) => setLastName(e.target.value)} className="h-10" />
              </Field>
            </div>
            <Field label="Email" htmlFor="email" hint="Your tax receipt goes here." error={errors.email}>
              <Input id="email" type="email" autoComplete="email" value={email} aria-invalid={Boolean(errors.email)} onChange={(e) => setEmail(e.target.value)} className="h-10" />
            </Field>
            <Field label="Country" htmlFor="country" error={errors.country}>
              <Select id="country" autoComplete="country" value={country} onChange={(e) => setCountry(e.target.value)} className="h-10">
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-fg-2">
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-0.5 size-4 accent-[var(--rail)]" />
              <span>
                Give anonymously
                <span className="block text-xs text-fg-3">Your name stays off the public list of recent gifts.</span>
              </span>
            </label>
            <PrimaryButton type="button" onClick={next}>
              Continue to payment
            </PrimaryButton>
          </div>
        )}

        {step === "payment" && (
          <div className="flex flex-col gap-4">
            <label className="flex cursor-pointer items-start gap-2.5 rounded border border-line px-3 py-2.5 text-sm text-fg-2 has-[:checked]:border-line-strong has-[:checked]:bg-surface-2/50">
              <input type="checkbox" checked={coverFees} onChange={(e) => setCoverFees(e.target.checked)} className="mt-0.5 size-4 accent-[var(--rail)]" />
              <span>
                Add <span className="num font-medium text-fg">{formatDollarsExact(fee)}</span> to cover card fees
                <span className="block text-xs text-fg-3">So {orgName} receives your full {money(amountCents)}.</span>
              </span>
            </label>

            <dl className="text-sm">
              <div className="flex justify-between border-b border-line py-2">
                <dt className="text-fg-2">Your gift</dt>
                <dd className="num">{formatDollarsExact(amountCents)}</dd>
              </div>
              {coverFees && (
                <div className="flex justify-between border-b border-line py-2">
                  <dt className="text-fg-2">Card fees covered</dt>
                  <dd className="num">{formatDollarsExact(fee)}</dd>
                </div>
              )}
              <div className="flex justify-between py-2">
                <dt className="font-medium">{frequency === "monthly" ? "Today, then monthly" : "Total today"}</dt>
                <dd className="num font-semibold">{formatDollarsExact(total)}</dd>
              </div>
            </dl>

            <div className="rounded border border-dashed border-line-strong px-3.5 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="size-4 text-fg-3" strokeWidth={1.75} />
                Card, Apple Pay or Google Pay
              </div>
              <p className="mt-1 text-xs leading-relaxed text-fg-3">
                The secure card form appears here once {orgName} connects Stripe. In this demo your gift is recorded and no card is charged.
              </p>
            </div>

            {state && !state.ok && state.message && (
              <p role="alert" className="rounded border border-red/25 bg-red-soft/60 px-3 py-2 text-sm text-red">
                {state.message}
              </p>
            )}

            <PrimaryButton type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
              {pending ? "Processing…" : `Donate ${formatDollarsExact(total)}${frequency === "monthly" ? " monthly" : ""}`}
            </PrimaryButton>
            {frequency === "monthly" && <p className="-mt-1 text-center text-xs text-fg-3">Change or cancel your monthly gift any time from your receipt email.</p>}
          </div>
        )}
      </div>
    </form>
  );
}

function PrimaryButton({ className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-brand px-4 text-base font-medium text-white shadow-1 transition-colors duration-150 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

function ThankYou({
  receipt,
  orgName,
  designation,
  slug,
  headingRef,
  onAgain,
}: {
  receipt: Extract<DonateState, { ok: true }>["receipt"];
  orgName: string;
  designation: string;
  slug: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onAgain: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const monthly = receipt.frequency === "monthly";
  const next = receipt.nextChargeOn ? new Date(`${receipt.nextChargeOn}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/donate/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="rounded border border-line bg-surface p-5" role="status">
      <span className="grid size-10 place-items-center rounded-full bg-green-soft text-green">
        <Check className="size-5" strokeWidth={2.5} />
      </span>
      <h2 ref={headingRef} tabIndex={-1} className="mt-4 text-xl font-semibold tracking-tight outline-none">
        Thank you, {receipt.firstName}.
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-2">
        {monthly
          ? `Your monthly gift of ${money(receipt.amountCents)} to ${orgName} has started.`
          : `Your gift of ${money(receipt.amountCents)} is on its way to ${orgName}.`}{" "}
        A receipt is going to {receipt.email}.
      </p>
      <dl className="mt-4 text-sm">
        <div className="flex justify-between gap-4 border-b border-line py-2">
          <dt className="text-fg-2">Charged today</dt>
          <dd className="num font-medium">{formatDollarsExact(receipt.totalCents)}</dd>
        </div>
        {monthly && next && (
          <div className="flex justify-between gap-4 border-b border-line py-2">
            <dt className="text-fg-2">Next gift</dt>
            <dd className="num">{next}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 border-b border-line py-2">
          <dt className="text-fg-2">Directed to</dt>
          <dd className="text-right">{designation}</dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-fg-2">Receipt</dt>
          <dd className="num truncate text-fg-3">{receipt.donationId.split("-").pop()?.toUpperCase()}</dd>
        </div>
      </dl>
      {receipt.demo && <p className="mt-2 text-xs text-fg-3">Demo checkout: nothing was charged.</p>}
      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded border border-line-strong bg-surface text-sm font-medium transition-colors duration-150 hover:bg-surface-2"
        >
          {copied ? <Check className="size-4 text-green" strokeWidth={2.25} /> : <Link2 className="size-4" strokeWidth={1.75} />}
          {copied ? "Link copied" : "Share this campaign"}
        </button>
        <button type="button" onClick={onAgain} className="h-9 text-sm text-fg-2 underline decoration-line-strong underline-offset-4 hover:text-fg">
          Make another gift
        </button>
      </div>
    </div>
  );
}
