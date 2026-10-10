import { trackElementAction } from "@/app/e/actions";
import { findElement, listElements } from "@/lib/data/elements";
import { isOverlay, kindOf } from "@/lib/elements";
import type { DonationElementBlock } from "@/lib/types";
import { elementLive } from "./data";
import { LiveElement } from "./live";

/*
 * Donation elements on Lotus's own funnels and websites. The funnel and
 * website editors add a { type: "donation_element", elementId } block and
 * render it with this; no install script is involved. Pages that use it
 * are dynamic already (they read the store after connection()).
 */

export function DonationElementBlockView({
  block,
  now = new Date(),
}: {
  block: DonationElementBlock;
  now?: Date;
}) {
  const e = findElement(now, block.elementId);
  if (!e || e.status !== "live") return null;
  const live = elementLive(now, e);
  if (!live || !live.campaign.live) return null;
  const el = (
    <LiveElement
      element={{ id: e.id, type: e.type, config: e.config }}
      live={live}
      nowIso={now.toISOString()}
      track={trackElementAction}
    />
  );
  // Overlays float over the page, so they need no section of their own.
  if (isOverlay(e.type)) return el;
  return (
    <section className="mx-auto w-full max-w-[760px] px-5 py-8 md:px-8">
      {el}
    </section>
  );
}

/** The elements an editor can offer for a client's page, live first. */
export function elementOptions(now: Date, accountId: string) {
  return listElements(now)
    .filter((e) => e.accountId === accountId)
    .sort(
      (a, b) =>
        Number(a.status !== "live") - Number(b.status !== "live") ||
        a.name.localeCompare(b.name),
    )
    .map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      typeLabel: kindOf(e.type).label,
      status: e.status,
    }));
}
