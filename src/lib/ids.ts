import { randomBytes } from "node:crypto";

/** A short, unique, roughly time-ordered id fragment: safe across agencies and bulk imports. */
export function stamp() {
  return `${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
}
