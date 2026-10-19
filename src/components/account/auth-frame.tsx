import Link from "next/link";
import { Activity, Inbox, Layers } from "lucide-react";
import { LotusLogo, LotusMark } from "@/components/brand/lotus-mark";

/* The sign-in, sign-up and invite pages: the brand on ink on the left, the form on paper. */

const points = [
  { icon: Activity, title: "Daily Diagnostic", body: "Every client's leads, cost and pacing on one screen, flagged when something slips." },
  { icon: Inbox, title: "One inbox", body: "Texts, email, WhatsApp and Facebook for every client in a single queue." },
  { icon: Layers, title: "Build and run", body: "Websites, funnels, forms, automations, payments and fundraising, all in Lotus." },
];

export function AuthFrame({ title, sub, children, footer }: { title: string; sub?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-rail text-rail-fg md:grid-cols-[1fr_minmax(0,520px)]">
      <div className="relative hidden overflow-hidden md:flex md:flex-col md:justify-between md:p-12">
        {/* A large, quiet echo of the mark and a soft glow behind it. */}
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 size-[640px] rounded-full bg-[radial-gradient(circle,rgb(139_92_246/0.28),transparent_62%)]" />
        <LotusMark on="var(--rail)" className="pointer-events-none absolute -bottom-24 -right-16 size-[520px] opacity-[0.12]" />

        <Link href="/" className="relative w-fit" aria-label="Lotus home">
          <LotusLogo markClassName="size-8" className="[&>span:last-child]:text-xl" />
        </Link>

        <div className="relative max-w-[460px]">
          <h2 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.03em]">
            Run every client from one calm screen.
          </h2>
          <ul className="mt-10 flex flex-col gap-6">
            {points.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
                  <Icon className="size-4 text-[#c4b5fd]" strokeWidth={1.75} />
                </span>
                <span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-rail-fg-2">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-rail-fg-2/70">Lotus by The Lotus Digital</p>
      </div>

      <div className="flex items-center bg-surface px-5 py-12 text-fg sm:px-8 md:rounded-l-2xl md:px-14">
        <div className="mx-auto w-full max-w-[380px]">
          <Link href="/" className="mb-10 flex w-fit md:hidden" aria-label="Lotus home">
            <LotusLogo on="var(--surface)" markClassName="size-7" />
          </Link>
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">{title}</h1>
          {sub && <p className="mt-1.5 text-sm text-fg-3">{sub}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-line pt-5 text-sm text-fg-2">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
