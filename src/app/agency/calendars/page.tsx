import { openWorkspace } from "@/lib/server/workspace";
import { Suspense } from "react";
import { connection } from "next/server";
import { CalendarsWorkspace, type ClientLite, type View } from "@/components/calendars/workspace";
import { Shell } from "@/components/shell";
import { getClientRecords } from "@/lib/data/agency";
import { listAppointments, listCalendars } from "@/lib/data/calendars";

export const metadata = { title: "Calendars" };

async function Workspace({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: raw } = await searchParams;
  await connection();
  await openWorkspace();
  const now = new Date();
  const clients: ClientLite[] = (await getClientRecords(now)).map((c) => ({
    id: c.account.id,
    name: c.account.name,
    slug: c.account.slug,
    mode: c.mode,
    timeZone: c.timeZone,
    health: c.health,
  }));
  const view: View = raw === "calendars" ? "calendars" : "bookings";
  return <CalendarsWorkspace view={view} calendars={listCalendars(now)} appointments={listAppointments(now)} clients={clients} nowIso={now.toISOString()} />;
}

export default function CalendarsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  return (
    <Shell current="/agency/calendars">
      <Suspense fallback={<header className="h-[104px] bg-rail" />}>
        <Workspace searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
