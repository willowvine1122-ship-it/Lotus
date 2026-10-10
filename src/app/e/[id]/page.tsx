import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { elementLive } from "@/components/elements/data";
import { LiveElement } from "@/components/elements/live";
import { findElement } from "@/lib/data/elements";
import { trackElementAction } from "../actions";

/*
 * One element, alone on a transparent page. The install script loads this
 * in an iframe wherever the element is placed. A paused element renders
 * nothing, so pausing it in Lotus clears it from every site at once.
 */

export const metadata: Metadata = { title: "Donate", robots: { index: false } };

async function Element({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const now = new Date();
  const e = findElement(now, id);
  if (!e || e.status !== "live") return null;
  const live = elementLive(now, e);
  if (!live || !live.campaign.live) return null;
  return <LiveElement element={{ id: e.id, type: e.type, config: e.config }} live={live} nowIso={now.toISOString()} track={trackElementAction} />;
}

export default function ElementPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="p-px">
      <style>{"html,body{background:transparent!important;min-height:0!important}"}</style>
      <Suspense fallback={null}>
        <Element params={params} />
      </Suspense>
    </div>
  );
}
