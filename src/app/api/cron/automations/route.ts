import { NextResponse } from "next/server";
import { listRuns } from "@/lib/data/automations";
import { listCampaigns } from "@/lib/data/email";
import { db } from "@/lib/server/db";
import { withAgencyWorkspace } from "@/lib/server/workspace";

/*
 * The scheduler, run by Vercel Cron (vercel.json). Opening an agency's
 * automations and email carries forward every workflow wait that has ended
 * and sends every campaign whose time has come, even when nobody has the
 * app open. Vercel sends CRON_SECRET as a bearer token; anything else is
 * turned away.
 */

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const agencies = await db<string[]>("ws.agencies", { modules: ["automations", "email"] });
  const results = await Promise.allSettled(
    [...new Set(agencies)].map((id) =>
      withAgencyWorkspace(id, null, () => {
        const now = new Date();
        listRuns(now);
        listCampaigns(now);
      }),
    ),
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  return NextResponse.json({ ok: failed === 0, agencies: results.length, failed });
}
