import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BookingFlow } from "@/components/booking/booking-flow";
import { BookingShell } from "@/components/booking/booking-shell";
import { busyFrom } from "@/lib/calendars";
import { getClientRecord } from "@/lib/data/agency";
import { findCalendar, listAppointments } from "@/lib/data/calendars";
import { bookAction } from "./actions";

export const metadata: Metadata = { title: "Book a time", robots: { index: false } };

async function Booking({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ type?: string }> }) {
  const { slug } = await params;
  const { type } = await searchParams;
  await connection();
  const now = new Date();
  const cal = findCalendar(now, slug);
  if (!cal) notFound();
  const client = await getClientRecord(now, cal.accountId);
  // Only start and end times leave the server; never who booked them.
  const busy = busyFrom(listAppointments(now), cal.id);
  return (
    <BookingShell clientName={client?.account.name ?? cal.name}>
      <BookingFlow calendar={cal} busy={busy} nowIso={now.toISOString()} action={bookAction.bind(null, cal.slug)} initialTypeId={type} />
    </BookingShell>
  );
}

export default function BookingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ type?: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <Booking params={params} searchParams={searchParams} />
    </Suspense>
  );
}
