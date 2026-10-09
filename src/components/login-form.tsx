"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FormNotice, Input, SubmitButton } from "@/components/form";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ ok: boolean; message?: string; errors?: Record<string, string> } | null>(null);

  async function submit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!email) return setState({ ok: false, errors: { email: "Enter your email." } });
    if (!configured) {
      // Demo mode: no auth backend, so any sign-in opens the agency workspace.
      router.push("/agency");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setState({ ok: false, message: error.message });
    router.push("/agency");
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {!configured && (
        <p className="rounded border border-line bg-surface-2 px-3 py-2 text-xs text-fg-2">
          Demo mode. Supabase is not connected, so any email opens the demo workspace. Set the two keys in .env to turn on real sign-in.
        </p>
      )}
      <Field label="Email" htmlFor="email" error={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@agency.com" />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" placeholder={configured ? "" : "Anything in demo mode"} />
      </Field>
      <SubmitButton pendingLabel="Signing in…" className="w-full justify-center">
        Sign in
      </SubmitButton>
      <FormNotice state={state} />
    </form>
  );
}
