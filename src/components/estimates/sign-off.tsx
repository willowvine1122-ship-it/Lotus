"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, CreditCard, Eraser, Loader2, Lock } from "lucide-react";
import type { ActionState } from "@/app/agency/contacts/actions";
import type { SignResult } from "@/app/agency/estimates/kit-actions";
import { LineItems } from "@/components/field/line-items";
import { formatTaxRate, totals } from "@/lib/field";
import type { Estimate, EstimateExtras } from "@/lib/types";
import { cn, formatDollarsExact } from "@/lib/utils";
import { approvedLines, depositFor } from "./model";

/*
 * The customer's side of an estimate: pick an option, tick any add-ons, read
 * the terms, sign (typed name plus a drawn signature), then pay the deposit
 * if one is asked. One violet action at a time.
 */

type View = Pick<
  Estimate,
  "id" | "number" | "options" | "taxRateBps" | "status" | "approvedOptionId"
>;

function SignaturePad({
  onChange,
  disabled,
}: {
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const inked = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const fit = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      const ctx = c.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0f1221";
    };
    fit();
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    inked.current = false;
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "relative h-[150px] rounded border bg-surface",
          disabled ? "border-line opacity-60" : "border-line-strong",
        )}
      >
        <canvas
          ref={canvas}
          aria-label="Draw your signature"
          className="absolute inset-0 size-full touch-none cursor-crosshair"
          onPointerDown={(e) => {
            if (disabled) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            const ctx = e.currentTarget.getContext("2d")!;
            const p = point(e);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + 0.1, p.y + 0.1);
            ctx.stroke();
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = e.currentTarget.getContext("2d")!;
            const p = point(e);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            inked.current = true;
          }}
          onPointerUp={(e) => {
            if (!drawing.current) return;
            drawing.current = false;
            if (inked.current) {
              setHasInk(true);
              onChange(e.currentTarget.toDataURL("image/png"));
            }
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-line-strong"
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-fg-3">
            Sign here with your finger or mouse
          </span>
        )}
      </div>
      {hasInk && (
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1.5 self-start text-xs text-fg-2 hover:text-fg"
        >
          <Eraser className="size-3.5" strokeWidth={1.75} />
          Clear and sign again
        </button>
      )}
    </div>
  );
}

function PrimaryButton({
  children,
  pending,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  pending: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={pending || disabled}
      onClick={onClick}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-brand px-5 text-sm font-medium text-white shadow-1 transition-colors duration-150 hover:bg-brand-hover disabled:opacity-60 sm:w-auto"
    >
      {pending && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
      {children}
    </button>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2.5 text-base font-semibold">
        <span className="num grid size-6 place-items-center rounded-full bg-rail text-xs text-rail-fg">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function EstimateSignOff({
  e,
  extras,
  open,
  customerName,
  sign,
  payDeposit,
}: {
  e: View;
  extras: Pick<
    EstimateExtras,
    | "addOns"
    | "chosenAddOnIds"
    | "terms"
    | "depositPct"
    | "signature"
    | "deposit"
  >;
  open: boolean;
  customerName?: string;
  sign: (id: string, input: unknown) => Promise<SignResult>;
  payDeposit: (id: string) => Promise<ActionState>;
}) {
  const recommended =
    e.options.find((o) => o.name === "Better")?.id ?? e.options[0]!.id;
  const [choice, setChoice] = useState(e.approvedOptionId ?? recommended);
  const [addOnIds, setAddOnIds] = useState<string[]>(extras.chosenAddOnIds);
  const [name, setName] = useState(customerName ?? "");
  const [image, setImage] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(e.status === "approved");
  const [paid, setPaid] = useState(!!extras.deposit);
  const [pending, start] = useTransition();
  const router = useRouter();

  const option = e.options.find((o) => o.id === choice)!;
  const lines = approvedLines(option, extras, addOnIds);
  const t = totals(lines, e.taxRateBps);
  const deposit = depositFor(t.total, extras.depositPct);
  const locked = !open || signed;
  const step = (k: number) =>
    k + (e.options.length > 1 ? 1 : 0) + (extras.addOns.length ? 1 : 0);

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await sign(e.id, {
        optionId: choice,
        addOnIds,
        name,
        image: image ?? undefined,
        agree,
      });
      if (!r?.ok) return setError(r?.message ?? "Couldn't sign. Try again.");
      setSigned(true);
      router.refresh();
    });

  const pay = () =>
    start(async () => {
      setError(null);
      const r = await payDeposit(e.id);
      if (!r?.ok)
        return setError(r?.message ?? "The payment didn't go through.");
      setPaid(true);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-8">
      {e.options.length > 1 && (
        <Step n={1} title="Choose an option">
          <div
            role="radiogroup"
            aria-label="Options"
            className="flex flex-col gap-3"
          >
            {e.options.map((o) => {
              const active = o.id === choice;
              return (
                <label
                  key={o.id}
                  className={cn(
                    "flex flex-col gap-3 rounded border bg-surface p-4 transition-colors duration-150",
                    active
                      ? "border-brand bg-brand-soft/20 ring-1 ring-brand"
                      : "border-line hover:border-line-strong",
                    locked ? "cursor-default" : "cursor-pointer",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="option"
                      value={o.id}
                      checked={active}
                      disabled={locked}
                      onChange={() => setChoice(o.id)}
                      className="size-4 accent-[var(--brand)]"
                    />
                    <span className="text-base font-semibold">{o.name}</span>
                    {o.id === recommended && (
                      <span className="rounded-[4px] bg-surface-2 px-1.5 text-2xs font-medium leading-5 text-fg-2">
                        Most chosen
                      </span>
                    )}
                    <span className="num ml-auto text-base font-semibold">
                      {formatDollarsExact(
                        totals(o.lineItems, e.taxRateBps).total,
                      )}
                    </span>
                  </span>
                  <LineItems
                    items={o.lineItems}
                    taxRateBps={e.taxRateBps}
                    compact
                  />
                </label>
              );
            })}
          </div>
        </Step>
      )}

      {extras.addOns.length > 0 && (
        <Step
          n={e.options.length > 1 ? 2 : 1}
          title="Add extras, if you'd like"
        >
          <ul className="flex flex-col divide-y divide-line rounded border border-line bg-surface">
            {extras.addOns.map((a) => {
              const on = addOnIds.includes(a.id);
              return (
                <li key={a.id}>
                  <label
                    className={cn(
                      "flex items-start gap-3 px-4 py-3",
                      locked
                        ? "cursor-default"
                        : "cursor-pointer hover:bg-surface-2/40",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={locked}
                      onChange={() =>
                        setAddOnIds(
                          on
                            ? addOnIds.filter((x) => x !== a.id)
                            : [...addOnIds, a.id],
                        )
                      }
                      className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {a.name}
                      </span>
                      {a.description && (
                        <span className="block text-xs text-fg-3">
                          {a.description}
                        </span>
                      )}
                    </span>
                    <span className="num shrink-0 text-sm">
                      +{formatDollarsExact(a.unitCents * a.quantity)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Step>
      )}

      <section className="rounded border border-line bg-surface">
        <dl className="text-sm">
          <div className="flex items-baseline justify-between gap-3 px-4 py-2">
            <dt className="text-fg-2">
              {e.options.length > 1 ? option.name : "Estimate"}
            </dt>
            <dd className="num">
              {formatDollarsExact(totals(option.lineItems, 0).subtotal)}
            </dd>
          </div>
          {extras.addOns
            .filter((a) => addOnIds.includes(a.id))
            .map((a) => (
              <div
                key={a.id}
                className="flex items-baseline justify-between gap-3 px-4 py-1"
              >
                <dt className="text-fg-2">{a.name}</dt>
                <dd className="num">
                  {formatDollarsExact(a.unitCents * a.quantity)}
                </dd>
              </div>
            ))}
          <div className="flex items-baseline justify-between gap-3 px-4 py-2">
            <dt className="text-xs text-fg-3">
              Tax {formatTaxRate(e.taxRateBps)}
            </dt>
            <dd className="num">{formatDollarsExact(t.tax)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-line px-4 py-3">
            <dt className="font-semibold">Total</dt>
            <dd className="num text-lg font-semibold">
              {formatDollarsExact(t.total)}
            </dd>
          </div>
          {deposit > 0 && (
            <div className="flex items-baseline justify-between gap-3 border-t border-line bg-surface-2/50 px-4 py-2.5">
              <dt className="text-fg-2">
                {extras.depositPct === 100
                  ? "Due when you sign"
                  : `Deposit due when you sign (${extras.depositPct}%)`}
              </dt>
              <dd className="num font-medium">{formatDollarsExact(deposit)}</dd>
            </div>
          )}
        </dl>
      </section>

      {extras.terms && (
        <Step n={step(1)} title="Terms">
          <div
            className="max-h-[200px] overflow-y-auto whitespace-pre-line rounded border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-fg-2"
            tabIndex={0}
          >
            {extras.terms}
          </div>
        </Step>
      )}

      {signed ? (
        <div className="flex flex-col gap-4">
          <p
            role="status"
            className="flex items-start gap-2 rounded border border-green/25 bg-green-soft/60 px-4 py-3 text-sm text-green"
          >
            <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
            <span>
              Approved and signed
              {extras.signature?.name || name
                ? ` by ${extras.signature?.name ?? name}`
                : ""}
              . Thank you.{" "}
              {deposit > 0 && !paid
                ? "One last step: the deposit."
                : "We'll call you to book a day."}
            </span>
          </p>
          {extras.signature?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={extras.signature.image}
              alt={`Signature of ${extras.signature.name}`}
              className="h-20 w-auto self-start rounded border border-line bg-surface px-3"
            />
          )}
          {deposit > 0 &&
            (paid ? (
              <p
                role="status"
                className="flex items-start gap-2 rounded border border-green/25 bg-green-soft/60 px-4 py-3 text-sm text-green"
              >
                <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
                Deposit of{" "}
                {formatDollarsExact(
                  extras.deposit?.amountCents ?? deposit,
                )}{" "}
                paid. It comes off your final invoice. We&apos;ll call to book a
                day.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <PrimaryButton pending={pending} onClick={pay}>
                  <CreditCard className="size-4" strokeWidth={1.75} />
                  Pay deposit · {formatDollarsExact(deposit)}
                </PrimaryButton>
                <p className="inline-flex items-center gap-1.5 text-xs text-fg-3">
                  <Lock className="size-3" strokeWidth={2} />
                  Card payments are processed by Stripe. Demo mode: no card is
                  charged.
                </p>
              </div>
            ))}
        </div>
      ) : open ? (
        <Step n={step(extras.terms ? 2 : 1)} title="Sign to approve">
          <div className="flex flex-col gap-4 rounded border border-line bg-surface p-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Full name</span>
              <input
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                autoComplete="name"
                maxLength={80}
                className="h-10 rounded border border-line-strong bg-surface px-3 text-base text-fg focus:border-brand focus:outline-none"
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Signature</span>
              <SignaturePad onChange={setImage} />
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={agree}
                onChange={(ev) => setAgree(ev.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
              />
              <span>
                I approve{" "}
                {e.options.length > 1
                  ? `the ${option.name} option`
                  : "this estimate"}
                {addOnIds.length ? " with the extras I ticked" : ""} for{" "}
                {formatDollarsExact(t.total)}
                {extras.terms ? " and accept the terms above" : ""}.
              </span>
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <PrimaryButton
                pending={pending}
                disabled={!agree || name.trim().length < 2 || !image}
                onClick={submit}
              >
                <Check className="size-4" strokeWidth={2.25} />
                Approve and sign
              </PrimaryButton>
              <p className="text-xs text-fg-3">
                {!image
                  ? "Draw your signature to continue."
                  : deposit > 0
                    ? `You'll pay the ${formatDollarsExact(deposit)} deposit next.`
                    : "Approving books nothing yet. We'll call to agree a day."}
              </p>
            </div>
          </div>
        </Step>
      ) : null}
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
