"use client";

import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";
import { Field, FormNotice, Input, SubmitButton } from "@/components/form";
import type { AccountState } from "@/app/account/actions";

type Action = (prev: AccountState, formData: FormData) => Promise<AccountState>;

/** The browser's own time zone, so a new agency starts on the owner's clock. */
const noSubscribe = () => () => {};
function useTimeZone() {
  return useSyncExternalStore(noSubscribe, () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "", () => "");
}

export function SignInForm({ action, next }: { action: Action; next?: string }) {
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className="flex flex-col gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" htmlFor="email" error={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@agency.com" defaultValue={state?.values?.email} required aria-invalid={!!state?.errors?.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={state?.errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!state?.errors?.password} />
      </Field>
      <Link href="/forgot" className="-mt-2 self-end text-xs font-medium text-brand hover:underline">
        Forgot password?
      </Link>
      <SubmitButton pendingLabel="Signing in…" className="w-full justify-center">
        Sign in
      </SubmitButton>
      <FormNotice state={state} />
    </form>
  );
}

export function SignUpForm({ action }: { action: Action }) {
  const [state, run] = useActionState(action, null);
  const tz = useTimeZone();
  return (
    <form action={run} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="timeZone" value={tz} />
      <Field label="Your name" htmlFor="name" error={state?.errors?.name}>
        <Input id="name" name="name" autoComplete="name" defaultValue={state?.values?.name} required aria-invalid={!!state?.errors?.name} />
      </Field>
      <Field label="Agency name" htmlFor="agency" hint="Your clients see this on reports and their dashboard." error={state?.errors?.agency}>
        <Input id="agency" name="agency" autoComplete="organization" defaultValue={state?.values?.agency} required aria-invalid={!!state?.errors?.agency} />
      </Field>
      <Field label="Work email" htmlFor="email" error={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@agency.com" defaultValue={state?.values?.email} required aria-invalid={!!state?.errors?.email} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters." error={state?.errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!state?.errors?.password} />
      </Field>
      <SubmitButton pendingLabel="Creating your agency…" className="w-full justify-center">
        Create agency account
      </SubmitButton>
      <FormNotice state={state} />
    </form>
  );
}

export function CreateAgencyForm({ action }: { action: Action }) {
  const [state, run] = useActionState(action, null);
  const tz = useTimeZone();
  return (
    <form action={run} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="timeZone" value={tz} />
      <Field label="Agency name" htmlFor="agency" error={state?.errors?.agency}>
        <Input id="agency" name="agency" autoComplete="organization" defaultValue={state?.values?.agency} required aria-invalid={!!state?.errors?.agency} />
      </Field>
      <SubmitButton pendingLabel="Creating…" className="w-full justify-center">
        Create agency
      </SubmitButton>
      <FormNotice state={state} />
    </form>
  );
}

/** Accepting an invite: a new person sets a name and password; someone with an account confirms their password. */
export function AcceptInviteForm({ action, email, mode, defaultName }: { action: Action; email: string; mode: "signed-in" | "existing" | "new"; defaultName?: string }) {
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className="flex flex-col gap-4" noValidate>
      <Field label="Email" htmlFor="invite-email">
        <Input id="invite-email" value={email} readOnly className="bg-surface-2 text-fg-2" />
      </Field>
      {mode === "new" && (
        <>
          <Field label="Your name" htmlFor="name" error={state?.errors?.name}>
            <Input id="name" name="name" autoComplete="name" defaultValue={state?.values?.name ?? defaultName} required aria-invalid={!!state?.errors?.name} />
          </Field>
          <Field label="Choose a password" htmlFor="password" hint="At least 10 characters." error={state?.errors?.password}>
            <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!state?.errors?.password} />
          </Field>
        </>
      )}
      {mode === "existing" && (
        <Field label="Your Lotus password" htmlFor="password" error={state?.errors?.password}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!state?.errors?.password} />
        </Field>
      )}
      <SubmitButton pendingLabel="Joining…" className="w-full justify-center">
        Accept invite
      </SubmitButton>
      <FormNotice state={state} />
    </form>
  );
}

export function ForgotPasswordForm({ action }: { action: Action }) {
  const [state, run] = useActionState(action, null);
  if (state?.ok) return <FormNotice state={state} />;
  return (
    <form action={run} className="flex flex-col gap-4" noValidate>
      <Field label="Email" htmlFor="email" error={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@agency.com" defaultValue={state?.values?.email} required aria-invalid={!!state?.errors?.email} />
      </Field>
      <SubmitButton pendingLabel="Sending…" className="w-full justify-center">
        Email me a reset link
      </SubmitButton>
      <FormNotice state={state} />
    </form>
  );
}

export function ResetPasswordForm({ action, token, email }: { action: Action; token: string; email: string }) {
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <Field label="Email" htmlFor="reset-email">
        <Input id="reset-email" value={email} readOnly autoComplete="username" className="bg-surface-2 text-fg-2" />
      </Field>
      <Field label="New password" htmlFor="password" hint="At least 10 characters." error={state?.errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required autoFocus aria-invalid={!!state?.errors?.password} />
      </Field>
      <SubmitButton pendingLabel="Saving…" className="w-full justify-center">
        Save password and sign in
      </SubmitButton>
      <FormNotice state={state} />
    </form>
  );
}
