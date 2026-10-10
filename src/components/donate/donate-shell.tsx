import { Lock } from "lucide-react";

/*
 * The public donation page frame. The client's name leads, in the same ink
 * band as the rest of Lotus; the page itself is paper so the story and the
 * checkout read like a calm document, not a dashboard.
 */
export function DonateShell({ orgName, children }: { orgName: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="bg-rail text-rail-fg">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-5 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            {orgName && (
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[5px] bg-rail-2 text-[13px] font-semibold text-white ring-1 ring-rail-line">
                {orgName.slice(0, 1)}
              </span>
            )}
            <span className="truncate text-base font-semibold tracking-tight">{orgName}</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-rail-fg-2">
            <Lock className="size-3.5" strokeWidth={1.75} />
            Secure donation
          </span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mx-auto w-full max-w-[1120px] px-5 py-6 text-xs text-fg-3 md:px-8">
        Powered by Lotus · Demo checkout: gifts are recorded and no card is charged.
      </footer>
    </div>
  );
}
