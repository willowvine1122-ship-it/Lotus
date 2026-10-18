/*
 * Frame for the public booking pages. The client's name leads; Lotus is a
 * quiet credit. Same ink band as the rest of the product, paper below.
 */
export function BookingShell({ clientName, children }: { clientName: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between gap-4 bg-rail px-5 py-3 text-rail-fg md:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[5px] bg-brand text-[13px] font-semibold text-white">
            {clientName.slice(0, 1)}
          </span>
          <span className="truncate text-base font-semibold tracking-tight">{clientName}</span>
        </div>
        <span className="shrink-0 text-xs text-rail-fg-2">Booking by Lotus</span>
      </header>
      <main className="flex flex-1 items-start justify-center px-0 py-0 sm:px-5 sm:py-8 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
