import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  return (
    <div className="grid min-h-screen bg-rail text-rail-fg md:grid-cols-[1fr_minmax(0,480px)]">
      <div className="hidden flex-col justify-between p-10 md:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <span aria-hidden className="grid size-7 place-items-center rounded-[5px] bg-brand text-[13px] font-semibold text-white">
            L
          </span>
          <span className="text-base font-semibold tracking-tight">Lotus</span>
        </Link>
        <div className="max-w-[420px]">
          <p className="text-2xl font-semibold leading-snug tracking-tight">One screen each morning that tells you exactly where every client stands.</p>
          <p className="mt-3 text-sm text-rail-fg-2">Daily Diagnostic, CRM, inbox, funnels, automations, fundraising and payments in one place.</p>
        </div>
        <p className="text-xs text-rail-fg-2">Lotus · built for agencies</p>
      </div>
      <div className="flex items-center bg-surface px-6 py-12 text-fg md:px-12">
        <div className="mx-auto w-full max-w-[360px]">
          <Link href="/" className="mb-8 flex items-center gap-2.5 md:hidden">
            <span aria-hidden className="grid size-7 place-items-center rounded-[5px] bg-brand text-[13px] font-semibold text-white">
              L
            </span>
            <span className="text-base font-semibold tracking-tight">Lotus</span>
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-fg-3">Agency team and client logins use the same door.</p>
          <div className="mt-6">
            <LoginForm configured={configured} />
          </div>
        </div>
      </div>
    </div>
  );
}
