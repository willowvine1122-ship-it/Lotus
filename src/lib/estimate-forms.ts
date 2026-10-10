import { parseLines } from "./field-forms";

/** Like parseLines, but an empty list is fine: add-ons are optional. */
export function parseOptionalLines(raw: FormDataEntryValue | null) {
  try {
    const arr = JSON.parse(String(raw ?? "[]"));
    if (Array.isArray(arr) && arr.length === 0) return { ok: true as const, items: [] };
  } catch {
    /* parseLines reports the error */
  }
  return parseLines(raw);
}
