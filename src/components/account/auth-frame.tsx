import Link from "next/link";

/* The sign-in, sign-up and invite pages: the rail on the left, the form on paper. */

function Mark() {
  return (
    <span aria-hidden className="grid size-7 place-items-center rounded-[5px] bg-brand text-[13px] font-semibold text-white">
      L
    </span>
  );
}

export function AuthFrame({ title, sub, children, footer }: { title: string; sub?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-rail text-rail-fg md:grid-cols-[1fr_minmax(0,480px)]">
      <div className="hidden flex-col justify-between p-10 md:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="text-base font-semibold tracking-tight">Lotus</span>
        </Link>
        <div className="max-w-[420px]">
          <p className="text-2xl font-semibold leading-snug tracking-tight">One screen each morning that tells you exactly where every client stands.</p>
          <p className="mt-3 text-sm text-rail-fg-2">Daily Diagnostic, CRM, inbox, funnels, automations, fundraising and payments in one place.</p>
        </div>
        <p className="text-xs text-rail-fg-2">Lotus · built for agencies</p>
      </div>
      <div className="flex items-center bg-surface px-4 py-12 text-fg sm:px-6 md:px-12">
        <div className="mx-auto w-full max-w-[360px]">
          <Link href="/" className="mb-8 flex items-center gap-2.5 md:hidden">
            <Mark />
            <span className="text-base font-semibold tracking-tight">Lotus</span>
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {sub && <p className="mt-1 text-sm text-fg-3">{sub}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t border-line pt-4 text-sm text-fg-2">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
