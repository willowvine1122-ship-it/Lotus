"use client";

import { Diagnosis, FundraisingPanel, MarketingPanel, NotesFeed } from "@/components/diagnostic/panel";
import type { Row } from "@/components/diagnostic/model";
import type { ClientRecord } from "@/lib/types";

/*
 * The overview tab lays the client panel's sections out at page width:
 * numbers and charts on the left, the latest notes on the right.
 */
export function ClientOverview({ row, client, nowIso }: { row: Row; client: ClientRecord; nowIso: string }) {
  const now = new Date(nowIso);
  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex max-w-[640px] flex-col gap-6">
        <Diagnosis client={client} />
        {row.mode === "marketing" ? <MarketingPanel row={row} now={now} /> : <FundraisingPanel row={row} now={now} />}
      </div>
      <aside>
        <NotesFeed notes={client.notes.slice(0, 5)} now={now} />
      </aside>
    </div>
  );
}
