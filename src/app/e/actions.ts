"use server";

import { z } from "zod";
import { trackElement } from "@/lib/data/elements";

/* Public: a placed element reports that it was seen, or that it opened checkout. */

const input = z.object({ id: z.string().min(1).max(120), kind: z.enum(["view", "open"]) });

export async function trackElementAction(id: string, kind: "view" | "open") {
  const p = input.safeParse({ id, kind });
  if (!p.success) return;
  trackElement(new Date(), p.data.id, p.data.kind);
}
