import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { NewCalendarForm } from "@/components/calendars/calendar-forms";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { getClientRecords } from "@/lib/data/agency";
import { createCalendarAction } from "../actions";

export const metadata = { title: "New calendar" };

async function Form({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await connection();
  const clients = (await getClientRecords(new Date()))
    .map((c) => ({ id: c.account.id, name: c.account.name, slug: c.account.slug, mode: c.mode, timeZone: c.timeZone, health: c.health }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const preset = clients.find((c) => c.id === client || c.slug === client)?.id;
  return <NewCalendarForm action={createCalendarAction} clients={clients} defaultClientId={preset} />;
}

export default function NewCalendarPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Shell current="/agency/calendars">
      <PageHeader
        title="New calendar"
        meta={
          <Link href="/agency/calendars?view=calendars" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Calendars
          </Link>
        }
      />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 bg-surface">
          <Suspense fallback={<div className="h-[480px]" />}>
            <Form searchParams={searchParams} />
          </Suspense>
        </div>
        <aside className="border-t border-line px-5 py-6 text-sm leading-relaxed text-fg-2 lg:border-l lg:border-t-0 lg:px-6">
          <h2 className="text-sm font-semibold text-fg">What happens next</h2>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-4">
            <li>The calendar opens Monday to Friday, 9am to 5pm in the client&apos;s time zone. Change the hours on the next screen.</li>
            <li>It gets a public booking page you can link from ads, funnels and emails.</li>
            <li>Every booking lands under Bookings with the lead&apos;s details, and on the contact&apos;s timeline.</li>
          </ol>
        </aside>
      </div>
    </Shell>
  );
}
