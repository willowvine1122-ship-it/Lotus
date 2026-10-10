"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";
import { ArrowLeft, Check, FileStack, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { ButtonLink } from "@/components/page-header";
import { Segmented } from "@/components/diagnostic/primitives";
import { InkSelect, TopBar } from "@/components/field/ui";
import type { ActionState } from "@/app/agency/contacts/actions";
import type { EstimateTemplate, PriceBookItem } from "@/lib/types";
import { totals } from "@/lib/field";
import { cn, formatDollarsCompact, formatDollarsExact, timeAgo } from "@/lib/utils";
import { depositLabel, priceCategories } from "./model";

/*
 * The estimate builder's library for one client: the price book (what the
 * team picks lines from) and the templates (whole estimates to start from).
 * Price book rows edit in place; templates open their own editor.
 */

export type LibraryItem = Omit<PriceBookItem, "accountId">;
export type LibraryTemplate = Pick<EstimateTemplate, "id" | "name" | "title" | "options" | "addOns" | "depositPct" | "validDays" | "uses" | "updatedAt">;

interface Props {
  clients: { id: string; name: string; slug: string; taxRateBps: number }[];
  clientId: string;
  items: LibraryItem[];
  templates: LibraryTemplate[];
  tab: "book" | "templates";
  nowIso: string;
  actions: {
    saveItem: (id: string | null, input: unknown) => Promise<ActionState>;
    deleteItem: (id: string) => Promise<void>;
  };
}

const th = "whitespace-nowrap px-3 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6";
const td = "px-3 py-2 first:pl-5 md:first:pl-6 last:pr-5 md:last:pr-6";
const cell = "h-8 w-full rounded border border-line-strong bg-surface px-2 text-sm text-fg placeholder:text-fg-3 focus:border-brand focus:outline-none";

interface Draft {
  name: string;
  description: string;
  category: string;
  price: string;
  unit: string;
  kind: "item" | "addon";
}

const blank = (): Draft => ({ name: "", description: "", category: priceCategories[0], price: "", unit: "", kind: "item" });
const draftOf = (i: LibraryItem): Draft => ({ name: i.name, description: i.description ?? "", category: i.category, price: (i.unitCents / 100).toFixed(2), unit: i.unit ?? "", kind: i.kind });
const centsOf = (s: string) => Math.round(Number(s.replace(/[^0-9.]/g, "") || "0") * 100);

export function EstimateLibrary({ clients, clientId, items, templates, tab: initialTab, nowIso, actions }: Props) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const client = clients.find((c) => c.id === clientId)!;

  const q = query.trim().toLowerCase();
  const shown = items.filter((i) => !q || [i.name, i.description ?? "", i.category].some((s) => s.toLowerCase().includes(q)));
  const categories = [...new Set([...priceCategories, ...items.map((i) => i.category)])].filter((c) => shown.some((i) => i.category === c));
  const shownTemplates = templates.filter((t) => !q || [t.name, t.title].some((s) => s.toLowerCase().includes(q)));

  const switchClient = (id: string) => router.push(`/agency/estimates/library?client=${id}&tab=${tab}`);
  const begin = (i: LibraryItem) => {
    setAdding(false);
    setEditing(i.id);
    setDraft(draftOf(i));
    setError(null);
  };
  const cancel = () => {
    setEditing(null);
    setAdding(false);
    setError(null);
  };
  const save = (id: string | null) =>
    start(async () => {
      const r = await actions.saveItem(id, { accountId: clientId, name: draft.name, description: draft.description, category: draft.category, unitCents: centsOf(draft.price), unit: draft.unit, kind: draft.kind });
      if (!r?.ok) return setError(r?.message ?? "Couldn't save.");
      cancel();
      router.refresh();
    });

  const editor = (id: string | null) => (
    <tr className="border-b border-line bg-brand-soft/20">
      <td className={td} colSpan={5}>
        <form
          className="grid gap-2 py-1 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_120px_110px_auto] md:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            save(id);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <input aria-label="Name" autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Item name" maxLength={120} className={cn(cell, "font-medium")} />
            <input aria-label="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description the customer sees (optional)" maxLength={240} className={cn(cell, "text-xs")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <select aria-label="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value, kind: e.target.value === "Add-ons" ? "addon" : draft.kind })} className={cell}>
              {[...new Set([...priceCategories, draft.category])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-fg-2">
              <input type="checkbox" checked={draft.kind === "addon"} onChange={(e) => setDraft({ ...draft, kind: e.target.checked ? "addon" : "item" })} className="size-3.5 accent-[var(--rail)]" />
              Offer as an optional add-on
            </label>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-fg-3">$</span>
            <input aria-label="Price" inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="0.00" className={cn(cell, "num pl-5 text-right")} />
          </div>
          <input aria-label="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="each" maxLength={20} className={cn(cell, "num")} />
          <div className="flex items-center gap-1.5">
            <button type="submit" disabled={pending || !draft.name.trim()} className="inline-flex h-8 items-center gap-1.5 rounded bg-rail px-3 text-xs font-medium text-rail-fg hover:bg-rail-2 disabled:opacity-50">
              {pending ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2} /> : <Check className="size-3.5" strokeWidth={2.25} />}
              {id ? "Save" : "Add"}
            </button>
            <button type="button" onClick={cancel} aria-label="Cancel" className="grid size-8 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
              <X className="size-4" strokeWidth={2} />
            </button>
            {id && (
              <button
                type="button"
                aria-label="Delete item"
                onClick={() => {
                  if (!confirm(`Remove "${draft.name}" from the price book? Estimates already sent keep their prices.`)) return;
                  start(async () => {
                    await actions.deleteItem(id);
                    cancel();
                    router.refresh();
                  });
                }}
                className="grid size-8 place-items-center rounded text-fg-3 hover:bg-red-soft hover:text-red"
              >
                <Trash2 className="size-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="text-xs text-red md:col-span-5">
              {error}
            </p>
          )}
        </form>
      </td>
    </tr>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        title="Price book and templates"
        meta={
          <>
            <Link href={`/agency/estimates?client=${client.slug}`} className="inline-flex items-center gap-1 text-rail-fg hover:underline">
              <ArrowLeft className="size-3" strokeWidth={2} />
              Estimates
            </Link>{" "}
            · {items.length} prices · {templates.length} templates
          </>
        }
        search={{ value: query, onChange: setQuery, placeholder: tab === "book" ? "Search the price book" : "Search templates" }}
      >
        <InkSelect label="Client" value={clientId} onChange={switchClient} options={clients.map((c) => ({ value: c.id, label: c.name }))} className="max-w-[112px] sm:max-w-[160px]" />
        <Segmented
          label="Show"
          value={tab}
          onChange={(v) => {
            setTab(v);
            cancel();
            window.history.replaceState(null, "", `/agency/estimates/library?client=${clientId}&tab=${v}`);
          }}
          options={[
            { value: "book", label: "Price book" },
            { value: "templates", label: "Templates" },
          ]}
        />
        {tab === "book" ? (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setAdding(true);
              setDraft(blank());
              setError(null);
            }}
            className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded bg-brand px-2.5 text-xs font-medium text-white hover:bg-brand-hover"
          >
            <Plus className="size-3.5" strokeWidth={2.25} />
            <span className="hidden sm:inline">Add price</span>
            <span className="sr-only sm:hidden">Add price</span>
          </button>
        ) : (
          <ButtonLink href={`/agency/estimates/templates/new?client=${clientId}`} className="h-7 whitespace-nowrap px-2.5 text-xs">
            <Plus className="size-3.5" strokeWidth={2.25} />
            <span className="hidden sm:inline">New template</span>
            <span className="sr-only sm:hidden">New template</span>
          </ButtonLink>
        )}
      </TopBar>

      {tab === "book" ? (
        <div className="overflow-x-auto border-b border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={th}>Item</th>
                <th scope="col" className={cn(th, "hidden md:table-cell")}>Unit</th>
                <th scope="col" className={cn(th, "text-right")}>Price</th>
                <th scope="col" className={cn(th, "hidden lg:table-cell")}>Updated</th>
                <th scope="col" className={cn(th, "w-10")}>
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {adding && editor(null)}
              {categories.map((cat) => (
                <Fragment key={cat}>
                  <tr className="border-b border-line bg-surface-2/60">
                    <th scope="colgroup" colSpan={5} className="px-5 py-1.5 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-2 md:px-6">
                      {cat} <span className="num ml-1 text-fg-3">{shown.filter((i) => i.category === cat).length}</span>
                    </th>
                  </tr>
                  {shown
                    .filter((i) => i.category === cat)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((i) =>
                      editing === i.id ? (
                        <Fragment key={i.id}>{editor(i.id)}</Fragment>
                      ) : (
                        <tr key={i.id} tabIndex={0} onClick={() => begin(i)} onKeyDown={(e) => e.key === "Enter" && begin(i)} className="group h-[48px] cursor-pointer border-b border-line transition-colors duration-100 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
                          <td className={td}>
                            <span className="flex items-center gap-2">
                              <span className="truncate font-medium">{i.name}</span>
                              {i.kind === "addon" && cat !== "Add-ons" && <span className="rounded-[4px] bg-surface-2 px-1.5 text-2xs font-medium leading-5 text-fg-2">Add-on</span>}
                            </span>
                            {i.description && <span className="block max-w-[60ch] truncate text-xs text-fg-3">{i.description}</span>}
                          </td>
                          <td className={cn(td, "num hidden text-fg-2 md:table-cell")}>{i.unit ?? <span className="text-fg-3">each</span>}</td>
                          <td className={cn(td, "num text-right font-medium")}>{formatDollarsExact(i.unitCents)}</td>
                          <td className={cn(td, "hidden whitespace-nowrap text-fg-3 lg:table-cell")}>{timeAgo(i.updatedAt, now)}</td>
                          <td className={cn(td, "text-right")}>
                            <Pencil className="ml-auto size-3.5 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} aria-hidden />
                          </td>
                        </tr>
                      ),
                    )}
                </Fragment>
              ))}
              {shown.length === 0 && !adding && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-fg-3">
                    {items.length ? "Nothing matches." : "No prices yet. Add the services and parts you quote most."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto border-b border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={th}>Template</th>
                <th scope="col" className={cn(th, "hidden md:table-cell")}>Options</th>
                <th scope="col" className={cn(th, "text-right")}>Price</th>
                <th scope="col" className={cn(th, "hidden xl:table-cell")}>Add-ons</th>
                <th scope="col" className={cn(th, "hidden lg:table-cell")}>Deposit</th>
                <th scope="col" className={cn(th, "hidden text-right sm:table-cell")}>Used</th>
                <th scope="col" className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shownTemplates
                .sort((a, b) => b.uses - a.uses)
                .map((t) => {
                  const prices = t.options.map((o) => totals(o.lineItems, client.taxRateBps).total);
                  const lo = Math.min(...prices);
                  const hi = Math.max(...prices);
                  return (
                    <tr key={t.id} className="h-[52px] border-b border-line hover:bg-surface-2/60">
                      <td className={td}>
                        <Link href={`/agency/estimates/templates/${t.id}`} className="block truncate font-medium hover:underline">
                          {t.name}
                        </Link>
                        <span className="block truncate text-xs text-fg-3">Valid {t.validDays} days · edited {timeAgo(t.updatedAt, now)}</span>
                      </td>
                      <td className={cn(td, "hidden text-fg-2 md:table-cell")}>{t.options.length > 1 ? t.options.map((o) => o.name).join(" · ") : "One price"}</td>
                      <td className={cn(td, "num whitespace-nowrap text-right")}>{lo === hi ? formatDollarsCompact(lo) : `${formatDollarsCompact(lo)}–${formatDollarsCompact(hi)}`}</td>
                      <td className={cn(td, "hidden max-w-[260px] truncate text-fg-2 xl:table-cell")}>{t.addOns.length ? t.addOns.map((a) => a.name).join(", ") : <span className="text-fg-3">None</span>}</td>
                      <td className={cn(td, "hidden whitespace-nowrap text-fg-2 lg:table-cell")}>{depositLabel(t.depositPct)}</td>
                      <td className={cn(td, "num hidden text-right text-fg-2 sm:table-cell")}>{t.uses}</td>
                      <td className={cn(td, "whitespace-nowrap text-right")}>
                        <span className="inline-flex gap-1.5">
                          <Link href={`/agency/estimates/templates/${t.id}`} className="inline-flex h-7 items-center rounded border border-line-strong bg-surface px-2.5 text-xs font-medium hover:bg-surface-2">
                            Edit
                          </Link>
                          <Link href={`/agency/estimates/new?template=${t.id}`} className="inline-flex h-7 items-center gap-1.5 rounded border border-rail bg-rail px-2.5 text-xs font-medium text-rail-fg hover:bg-rail-2">
                            <FileStack className="size-3.5" strokeWidth={1.75} />
                            Use
                          </Link>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              {shownTemplates.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-fg-3">
                    {templates.length ? "Nothing matches." : "No templates yet. Save the estimates you write most so the next one takes a minute."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
