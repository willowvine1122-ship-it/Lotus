import { formatDay } from "@/lib/field";
import type { LineItem } from "@/lib/types";
import { LineItems } from "./line-items";

/*
 * The paper version of an estimate or invoice: the client's business at the
 * top, who it is for, the dates, the priced rows. The agency page and the
 * customer's own link render the same sheet.
 */

export function DocumentSheet({
  kind,
  number,
  business,
  billTo,
  address,
  dates,
  items,
  taxRateBps,
  memo,
  children,
}: {
  kind: "Estimate" | "Invoice";
  number: string;
  business: { name: string; location: string };
  billTo: { name: string; email?: string; phone?: string };
  address?: string;
  dates: { label: string; day: string }[];
  items?: LineItem[];
  taxRateBps: number;
  memo?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="rounded border border-line bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-9 place-items-center rounded-[5px] bg-rail text-sm font-semibold text-rail-fg">
            {business.name.slice(0, 1)}
          </span>
          <div>
            <p className="text-base font-semibold leading-5">{business.name}</p>
            <p className="text-xs text-fg-3">{business.location}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold leading-6 tracking-tight">{kind}</p>
          <p className="num text-xs text-fg-3">{number}</p>
        </div>
      </header>
      <div className="grid gap-5 border-b border-line px-6 py-5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="text-sm">
          <p className="text-xs text-fg-3">{kind === "Invoice" ? "Bill to" : "Prepared for"}</p>
          <p className="mt-1 font-medium">{billTo.name}</p>
          {address && <p className="text-fg-2">{address}</p>}
          {billTo.email && <p className="text-fg-2">{billTo.email}</p>}
          {billTo.phone && <p className="num text-fg-2">{billTo.phone}</p>}
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 self-start text-sm">
          {dates.map((d) => (
            <div key={d.label} className="contents">
              <dt className="text-xs text-fg-3">{d.label}</dt>
              <dd className="num text-right">{formatDay(d.day, { month: "short", day: "numeric", year: "numeric" })}</dd>
            </div>
          ))}
        </dl>
      </div>
      {items && (
        <div className="px-6 py-4">
          <LineItems items={items} taxRateBps={taxRateBps} />
        </div>
      )}
      {children}
      {memo && <p className="border-t border-line px-6 py-4 text-sm leading-relaxed text-fg-2">{memo}</p>}
    </article>
  );
}
