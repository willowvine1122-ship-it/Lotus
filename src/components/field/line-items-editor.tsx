"use client";

import { useId } from "react";
import { Plus, X } from "lucide-react";
import { formatTaxRate } from "@/lib/field";
import { cn, formatDollarsExact } from "@/lib/utils";

/*
 * Editable priced rows. Serialised into one hidden input as JSON so the
 * server action parses and validates the whole set with zod. Names come with
 * the client's price book as suggestions; picking one fills its price.
 */

export interface DraftLine {
  key: string;
  name: string;
  quantity: string;
  unit: string; // dollars as typed
}

export interface BookItem {
  name: string;
  unitCents: number;
}

let counter = 0;
const nextKey = () => `l${++counter}-${Math.random().toString(36).slice(2, 7)}`;

export function draftFrom(items: { name: string; quantity: number; unitCents: number }[]): DraftLine[] {
  return items.map((li) => ({ key: nextKey(), name: li.name, quantity: String(li.quantity), unit: (li.unitCents / 100).toFixed(2) }));
}

export const emptyLine = (): DraftLine => ({ key: nextKey(), name: "", quantity: "1", unit: "" });

function cents(unit: string) {
  const n = Number(unit.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function amount(l: DraftLine) {
  const q = Number(l.quantity);
  return Number.isFinite(q) ? Math.round(q * cents(l.unit)) : 0;
}

export function serialise(lines: DraftLine[]) {
  return JSON.stringify(
    lines
      .filter((l) => l.name.trim() || l.unit)
      .map((l) => ({ name: l.name.trim(), quantity: Number(l.quantity), unitCents: cents(l.unit) })),
  );
}

const cell = "h-9 w-full rounded border border-line-strong bg-surface px-2.5 text-sm text-fg placeholder:text-fg-3 transition-colors duration-150 hover:border-fg-3 focus:border-brand focus:outline-none";

export function LineItemsEditor({ name, lines, onChange, book, taxRateBps, error }: { name: string; lines: DraftLine[]; onChange: (l: DraftLine[]) => void; book: BookItem[]; taxRateBps?: number; error?: string }) {
  const listId = useId();
  const sub = lines.reduce((a, l) => a + amount(l), 0);
  const tax = taxRateBps ? Math.round((sub * taxRateBps) / 10000) : 0;
  const set = (key: string, patch: Partial<DraftLine>) =>
    onChange(
      lines.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (patch.name !== undefined) {
          const hit = book.find((b) => b.name === patch.name);
          if (hit && !l.unit) next.unit = (hit.unitCents / 100).toFixed(2);
        }
        return next;
      }),
    );

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={serialise(lines)} />
      <datalist id={listId}>
        {book.map((b) => (
          <option key={b.name} value={b.name}>
            {formatDollarsExact(b.unitCents)}
          </option>
        ))}
      </datalist>
      <div className="hidden grid-cols-[minmax(0,1fr)_72px_112px_96px_28px] gap-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 sm:grid">
        <span>Item</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
        <span />
      </div>
      <ol className="flex flex-col gap-2">
        {lines.map((l, i) => (
          <li key={l.key} className="grid grid-cols-[minmax(0,1fr)_28px] gap-2 rounded border border-line bg-surface-2/40 p-2 sm:grid-cols-[minmax(0,1fr)_72px_112px_96px_28px] sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
            <input aria-label={`Item ${i + 1}`} list={listId} value={l.name} onChange={(e) => set(l.key, { name: e.target.value })} placeholder={book[i % Math.max(1, book.length)]?.name ?? "Service or part"} className={cell} />
            <button type="button" onClick={() => onChange(lines.filter((x) => x.key !== l.key))} disabled={lines.length === 1} aria-label={`Remove item ${i + 1}`} className="grid size-7 place-items-center self-center rounded text-fg-3 hover:bg-surface-2 hover:text-red disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-3 sm:order-last">
              <X className="size-4" strokeWidth={1.75} />
            </button>
            <div className="col-span-2 grid grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 sm:contents">
              <input aria-label={`Quantity ${i + 1}`} inputMode="decimal" value={l.quantity} onChange={(e) => set(l.key, { quantity: e.target.value })} className={cn(cell, "num text-right")} />
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-fg-3">$</span>
                <input aria-label={`Price ${i + 1}`} inputMode="decimal" value={l.unit} onChange={(e) => set(l.key, { unit: e.target.value })} placeholder="0.00" className={cn(cell, "num pl-6 text-right")} />
              </div>
              <span className="num text-right text-sm font-medium">{formatDollarsExact(amount(l))}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-start justify-between gap-3 pt-1">
        <button type="button" onClick={() => onChange([...lines, emptyLine()])} className="inline-flex h-8 items-center gap-1.5 rounded border border-dashed border-line-strong px-2.5 text-xs font-medium text-fg-2 hover:border-fg-3 hover:text-fg">
          <Plus className="size-3.5" strokeWidth={2} />
          Add line
        </button>
        <dl className="min-w-[220px] text-sm">
          <div className="flex justify-between gap-6 py-0.5">
            <dt className="text-xs text-fg-3">Subtotal</dt>
            <dd className="num">{formatDollarsExact(sub)}</dd>
          </div>
          {taxRateBps !== undefined && (
            <>
              <div className="flex justify-between gap-6 py-0.5">
                <dt className="text-xs text-fg-3">Tax {formatTaxRate(taxRateBps)}</dt>
                <dd className="num">{formatDollarsExact(tax)}</dd>
              </div>
              <div className="mt-1 flex justify-between gap-6 border-t border-line pt-1.5">
                <dt className="font-medium">Total</dt>
                <dd className="num font-semibold">{formatDollarsExact(sub + tax)}</dd>
              </div>
            </>
          )}
        </dl>
      </div>
      {error && (
        <p className="text-xs text-red" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
