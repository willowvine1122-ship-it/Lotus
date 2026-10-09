import type { LineItem } from "@/lib/types";
import { formatTaxRate, lineTotal, totals } from "@/lib/field";
import { cn, formatDollarsExact } from "@/lib/utils";

/*
 * Priced rows. `compact` is the panel version (name over qty × price, amount
 * right); the full version is the document table on job, estimate and
 * invoice pages and the customer's own view.
 */

function qty(q: number) {
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/0+$/, "");
}

export function LineItems({ items, taxRateBps, compact, extra }: { items: LineItem[]; taxRateBps?: number; compact?: boolean; extra?: React.ReactNode }) {
  const t = totals(items, taxRateBps ?? 0);
  if (compact) {
    return (
      <div className="rounded border border-line">
        <ul>
          {items.map((li) => (
            <li key={li.id} className="flex items-baseline justify-between gap-3 border-b border-line px-3.5 py-2">
              <div className="min-w-0">
                <span className="block truncate text-sm">{li.name}</span>
                <span className="num block text-2xs text-fg-3">
                  {qty(li.quantity)} × {formatDollarsExact(li.unitCents)}
                </span>
              </div>
              <span className="num shrink-0 text-sm">{formatDollarsExact(lineTotal(li))}</span>
            </li>
          ))}
        </ul>
        <Totals sub={t.subtotal} tax={taxRateBps === undefined ? undefined : t.tax} rate={taxRateBps} total={t.total} compact />
        {extra}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">
            <th scope="col" className="py-2 pr-3 text-left font-medium">Item</th>
            <th scope="col" className="w-16 px-3 py-2 text-right font-medium">Qty</th>
            <th scope="col" className="hidden w-28 px-3 py-2 text-right font-medium sm:table-cell">Price</th>
            <th scope="col" className="w-28 py-2 pl-3 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((li) => (
            <tr key={li.id} className="border-b border-line align-baseline">
              <td className="py-2.5 pr-3">
                <span className="block">{li.name}</span>
                {li.description && <span className="block text-xs text-fg-3">{li.description}</span>}
                <span className="num block text-xs text-fg-3 sm:hidden">@ {formatDollarsExact(li.unitCents)}</span>
              </td>
              <td className="num px-3 py-2.5 text-right">{qty(li.quantity)}</td>
              <td className="num hidden px-3 py-2.5 text-right text-fg-2 sm:table-cell">{formatDollarsExact(li.unitCents)}</td>
              <td className="num py-2.5 pl-3 text-right font-medium">{formatDollarsExact(lineTotal(li))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto mt-2 w-full max-w-[280px]">
        <Totals sub={t.subtotal} tax={taxRateBps === undefined ? undefined : t.tax} rate={taxRateBps} total={t.total} />
        {extra}
      </div>
    </div>
  );
}

export function Totals({ sub, tax, rate, total, compact }: { sub: number; tax?: number; rate?: number; total: number; compact?: boolean }) {
  const row = cn("flex items-baseline justify-between gap-3 py-1.5 text-sm", compact && "px-3.5");
  return (
    <dl className={cn(compact && "bg-surface-2/40 py-1")}>
      <div className={row}>
        <dt className="text-xs text-fg-3">Subtotal</dt>
        <dd className="num">{formatDollarsExact(sub)}</dd>
      </div>
      {tax !== undefined && (
        <div className={row}>
          <dt className="text-xs text-fg-3">Tax {rate !== undefined && <span className="num">{formatTaxRate(rate)}</span>}</dt>
          <dd className="num">{formatDollarsExact(tax)}</dd>
        </div>
      )}
      {tax !== undefined && (
        <div className={cn(row, "border-t border-line pt-2")}>
          <dt className="text-sm font-medium">Total</dt>
          <dd className="num text-base font-semibold">{formatDollarsExact(total)}</dd>
        </div>
      )}
    </dl>
  );
}
