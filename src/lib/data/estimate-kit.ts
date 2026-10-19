import { stamp } from "@/lib/ids";
import { randomBytes } from "node:crypto";
import type { EstimateExtras, EstimateTemplate, LineItem, PriceBookItem } from "@/lib/types";
import { trades } from "./trades";
import { fieldClients,} from "./field-store";
import { defineModule } from "@/lib/server/workspace";


/*
 * The estimate builder's kit: each field client's price book, reusable
 * estimate templates, and the extras an estimate carries (optional add-ons,
 * terms, deposit, the customer's signature and deposit payment). Saved per
 * agency in the "estimate-kit" module.
 */

interface KitStore {
  items: PriceBookItem[];
  templates: EstimateTemplate[];
  extras: Record<string, EstimateExtras>;
}

const kitModule = defineModule<KitStore>({ key: "estimate-kit", init: () => ({ items: [], templates: [], extras: {} }) });

const newId = (p: string) => `new-${p}-${stamp()}-${randomBytes(3).toString("hex")}`;

function kit(_now: Date): KitStore {
  return kitModule.get();
}

/* ---------------------------- starter kit ---------------------------- */

const addOnsByTrade: Record<string, [string, number, string][]> = {
  default: [
    ["Extended labor warranty, 5 years", 450, "Covers labor on this work for five years."],
    ["Priority service plan, 1 year", 199, "Two checkups and front-of-the-line booking."],
    ["Haul-away and disposal", 150, "We take the old materials with us."],
  ],
  HVAC: [
    ["Whole-home surge protector, installed", 189, "Protects the new system from power spikes."],
    ["UV air purifier, installed", 640, "Whole-home filtration at the air handler."],
    ["Priority service plan, 1 year", 199, "Two tune-ups and front-of-the-line booking."],
  ],
  Roofing: [
    ["Gutter guards, per ft", 9, "Keeps leaves out of the new gutters."],
    ["Ridge vent upgrade", 520, "Better attic airflow, longer shingle life."],
    ["Extended workmanship warranty, 10 years", 900, "Our labor covered for ten years."],
  ],
};

const categoryOf = (name: string) => (/installed|panel|heater|pump|door|opener|battery|inverter|thermostat|tank/i.test(name) ? "Equipment" : /per (ft|sq|lb|roll|yard|square)|mulch|sod|materials/i.test(name) ? "Materials" : "Labor and service");
const unitOf = (name: string) => name.match(/per (ft|sq ft|lb|roll|yard|square|hour|month|fixture)/i)?.[0];
const cleanName = (name: string) => name.replace(/,\s*per (ft|sq ft|lb|roll|yard|square|hour|month|fixture)/i, "");

export const DEFAULT_TERMS = [
  "Prices hold until the date on this estimate. Work is scheduled once it's approved.",
  "Any deposit is credited to the final invoice. The balance is due when the work is complete.",
  "If we find hidden damage, we stop and price it with you before doing more.",
  "All work carries our one-year workmanship guarantee unless a longer warranty is listed above.",
].join("\n\n");

/** Whether a client's trade has a starter price book and templates to load. */
export function hasStarterKit(now: Date, accountId: string) {
  const c = fieldClients(now).find((x) => x.account.id === accountId);
  return !!(c && trades[c.industry]);
}

/**
 * Load the typical price book and good/better/best templates for the
 * client's trade, as a starting point the team then edits. Only into a
 * client whose price book is still empty.
 */
export function loadStarterKit(now: Date, accountId: string): number {
  const s = kit(now);
  if (s.items.some((i) => i.accountId === accountId)) return 0;
  const at = now.toISOString();
  for (const c of fieldClients(now).filter((x) => x.account.id === accountId)) {
    const trade = trades[c.industry];
    if (!trade) continue;
    const acc = c.account.id;
    const items: PriceBookItem[] = trade.book.map(([name, dollars]) => ({
      id: newId("pb"),
      accountId: acc,
      name: cleanName(name),
      category: categoryOf(name),
      unitCents: Math.round(dollars * 100),
      unit: unitOf(name),
      kind: "item",
      updatedAt: at,
    }));
    const addOns = (addOnsByTrade[c.industry] ?? addOnsByTrade.default!).map(([name, dollars, description]): PriceBookItem => ({
      id: newId("pb"),
      accountId: acc,
      name: cleanName(name),
      description,
      category: "Add-ons",
      unitCents: Math.round(dollars * 100),
      unit: unitOf(name),
      kind: "addon",
      updatedAt: at,
    }));
    s.items.push(...items, ...addOns);

    const li = (uses: [number, number][], k: string): LineItem[] => uses.map(([i, q], j) => ({ id: `${k}-${j}`, name: trade.book[i]![0], quantity: q, unitCents: Math.round(trade.book[i]![1] * 100) }));
    const asLines = (xs: PriceBookItem[], k: string): LineItem[] => xs.map((x, j) => ({ id: `${k}-a${j}`, name: x.name, description: x.description, quantity: 1, unitCents: x.unitCents }));
    for (const [ti, [title, base, plus, best]] of trade.sells.entries()) {
      const id = newId(`et${ti}`);
      s.templates.push({
        id,
        accountId: acc,
        name: title,
        title,
        message: "Thanks for having us out. Better is what we recommend for most homes like yours.",
        options: [
          { name: "Good", lineItems: li(base, `${id}-g`) },
          { name: "Better", lineItems: li([...base, ...plus], `${id}-b`) },
          { name: "Best", lineItems: li([...base, ...plus, ...best], `${id}-x`) },
        ],
        addOns: asLines(addOns.slice(0, 2), id),
        terms: DEFAULT_TERMS,
        depositPct: 25,
        validDays: 30,
        uses: 0,
        updatedAt: at,
      });
    }
    const [jobTitle, jobUses] = trade.jobs[0]!;
    s.templates.push({
      id: newId("et-q"),
      accountId: acc,
      name: `${jobTitle} (one price)`,
      title: jobTitle,
      options: [{ name: "Estimate", lineItems: li(jobUses, `et-${acc}-q`) }],
      addOns: asLines(addOns.slice(-1), `et-${acc}-q`),
      terms: DEFAULT_TERMS,
      depositPct: 0,
      validDays: 14,
      uses: 0,
      updatedAt: at,
    });

  }
  return s.items.filter((i) => i.accountId === accountId).length;
}

/* ----------------------------- price book ----------------------------- */

export function listPriceBook(now: Date, accountId?: string) {
  const all = kit(now).items;
  return accountId ? all.filter((i) => i.accountId === accountId) : all;
}

export type PriceItemInput = Pick<PriceBookItem, "accountId" | "name" | "description" | "category" | "unitCents" | "unit" | "kind">;

export function savePriceItem(now: Date, id: string | null, input: PriceItemInput): PriceBookItem {
  const s = kit(now);
  const at = now.toISOString();
  const existing = id ? s.items.find((i) => i.id === id && i.accountId === input.accountId) : undefined;
  if (existing) {
    Object.assign(existing, input, { updatedAt: at });
    return existing;
  }
  const item: PriceBookItem = { ...input, id: newId("pb"), updatedAt: at };
  s.items.push(item);
  return item;
}

export function deletePriceItem(now: Date, id: string) {
  const s = kit(now);
  s.items = s.items.filter((i) => i.id !== id);
}

/* ------------------------------ templates ----------------------------- */

export function listTemplates(now: Date, accountId?: string) {
  const all = kit(now).templates;
  return accountId ? all.filter((t) => t.accountId === accountId) : all;
}

export function findTemplate(now: Date, id: string) {
  return kit(now).templates.find((t) => t.id === id);
}

export type TemplateInput = Omit<EstimateTemplate, "id" | "uses" | "updatedAt">;

export function saveTemplate(now: Date, id: string | null, input: TemplateInput): EstimateTemplate {
  const s = kit(now);
  const at = now.toISOString();
  const existing = id ? s.templates.find((t) => t.id === id && t.accountId === input.accountId) : undefined;
  if (existing) {
    Object.assign(existing, input, { updatedAt: at });
    return existing;
  }
  const t: EstimateTemplate = { ...input, id: newId("et"), uses: 0, updatedAt: at };
  s.templates.push(t);
  return t;
}

export function deleteTemplate(now: Date, id: string) {
  const s = kit(now);
  s.templates = s.templates.filter((t) => t.id !== id);
}

/* -------------------------------- extras ------------------------------ */

export function estimateExtras(now: Date, estimateId: string): EstimateExtras {
  return kit(now).extras[estimateId] ?? { estimateId, addOns: [], chosenAddOnIds: [], depositPct: 0 };
}

export function setEstimateExtras(now: Date, ex: EstimateExtras) {
  const s = kit(now);
  s.extras[ex.estimateId] = ex;
  if (ex.templateId) {
    const t = s.templates.find((x) => x.id === ex.templateId);
    if (t) t.uses++;
  }
  return ex;
}

export function patchEstimateExtras(now: Date, estimateId: string, patch: Partial<EstimateExtras>) {
  const s = kit(now);
  const ex = { ...estimateExtras(now, estimateId), ...patch, estimateId };
  s.extras[estimateId] = ex;
  return ex;
}

/* --------------------------- downstream links -------------------------- */

/** The ticked add-ons ride along when an approved estimate becomes a job. */
export function carryAddOns(now: Date, estimateId: string, job: { lineItems: LineItem[] }) {
  const ex = estimateExtras(now, estimateId);
  for (const a of ex.addOns) {
    if (ex.chosenAddOnIds.includes(a.id) && !job.lineItems.some((l) => l.id === a.id)) job.lineItems.push({ ...a });
  }
}

/** A paid deposit shows up as a payment on the estimate's invoice, once. */
export function creditDeposit(now: Date, estimateId: string | undefined, invoiceId: string, record: (now: Date, id: string, cents: number, method: "card", reference: string, by: string) => unknown, hasReference: (ref: string) => boolean) {
  if (!estimateId) return;
  const d = estimateExtras(now, estimateId).deposit;
  if (!d || hasReference(d.reference)) return;
  record(now, invoiceId, d.amountCents, "card", d.reference, "Deposit");
}
