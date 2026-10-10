import type { EstimateExtras, EstimateOption, LineItem } from "@/lib/types";
import { totals } from "@/lib/field";

/* Pure helpers for the estimate builder, shared by the agency pages and the customer's link. */

/** The chosen option plus the add-ons the customer ticked, with tax. */
export function approvedLines(
  option: Pick<EstimateOption, "lineItems">,
  extras: Pick<EstimateExtras, "addOns" | "chosenAddOnIds">,
  chosen = extras.chosenAddOnIds,
): LineItem[] {
  return [
    ...option.lineItems,
    ...extras.addOns.filter((a) => chosen.includes(a.id)),
  ];
}

export function approvedTotal(
  option: Pick<EstimateOption, "lineItems">,
  extras: Pick<EstimateExtras, "addOns" | "chosenAddOnIds">,
  taxRateBps: number,
  chosen?: string[],
) {
  return totals(approvedLines(option, extras, chosen), taxRateBps);
}

/** Deposits round to whole dollars, which is what people expect to see. */
export function depositFor(totalCents: number, pct: number) {
  if (pct <= 0) return 0;
  return Math.round((totalCents * pct) / 100 / 100) * 100;
}

export const depositChoices = [0, 10, 25, 33, 50, 100] as const;

export function depositLabel(pct: number) {
  return pct === 0
    ? "No deposit"
    : pct === 100
      ? "Pay in full up front"
      : `${pct}% deposit`;
}

export const priceCategories = [
  "Labor and service",
  "Equipment",
  "Materials",
  "Add-ons",
] as const;
