"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "./page-header";
import { cn } from "@/lib/utils";

/*
 * Form primitives on paper: a label above the control, the hint or error
 * beneath, hairline borders, 36px controls. Errors use the red signal.
 */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const controlClass =
  "h-9 w-full rounded border border-line-strong bg-surface px-3 text-sm text-fg placeholder:text-fg-3 transition-colors duration-150 hover:border-fg-3 focus:border-brand focus:outline-none aria-invalid:border-red";

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClass, "pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, "h-auto min-h-[96px] py-2 leading-relaxed", className)} {...rest} />;
}

/** Money input with a fixed $ prefix. */
export function MoneyInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-3">$</span>
      <input inputMode="decimal" className={cn(controlClass, "num pl-7", className)} {...rest} />
    </div>
  );
}

export function CheckboxChip({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: React.ReactNode;
  defaultChecked?: boolean;
}) {
  return (
    <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded border border-line-strong bg-surface px-2.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft/60">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="size-3.5 accent-[var(--brand)]" />
      {label}
    </label>
  );
}

export function SubmitButton({ children, variant = "primary", className, pendingLabel }: { children: React.ReactNode; variant?: "primary" | "secondary"; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={cn(variant === "secondary" && "border-line-strong bg-surface text-fg hover:bg-surface-2", className)}>
      {pending && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-line py-6 last:border-b-0 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 max-w-[36ch] text-xs leading-relaxed text-fg-3">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function FormNotice({ state }: { state: { ok: boolean; message?: string } | null }) {
  if (!state?.message) return null;
  return (
    <p role="status" className={cn("rounded border px-3 py-2 text-sm", state.ok ? "border-green/25 bg-green-soft/60 text-green" : "border-red/25 bg-red-soft/60 text-red")}>
      {state.message}
    </p>
  );
}
