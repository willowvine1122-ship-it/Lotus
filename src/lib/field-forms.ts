import { z } from "zod";
import type { LineItem } from "@/lib/types";

/* Parsing shared by the field service server actions. */

export const actor = "Afza"; // until auth lands, every write is attributed to the signed-in demo user

const lineSchema = z.object({
  name: z.string().trim().min(1, "Every line needs a name"),
  quantity: z.number().positive("Quantities must be above zero").max(100000),
  unitCents: z.number().int().min(0, "Prices cannot be negative").max(100_000_000),
});

export function parseLines(raw: FormDataEntryValue | null): { ok: true; items: LineItem[] } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(String(raw ?? "[]"));
  } catch {
    return { ok: false, error: "Could not read the line items" };
  }
  const parsed = z.array(lineSchema).min(1, "Add at least one line").safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the line items" };
  return {
    ok: true,
    items: parsed.data.map((l, i) => ({ id: `li${i}-${Date.now().toString(36)}`, name: l.name, quantity: l.quantity, unitCents: l.unitCents })),
  };
}

export function flatten(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const money = z
  .string()
  .transform((v) => Number(String(v).replace(/[^0-9.]/g, "")))
  .pipe(z.number({ message: "Enter an amount" }).positive("Enter an amount above zero"));

export const stamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time");
