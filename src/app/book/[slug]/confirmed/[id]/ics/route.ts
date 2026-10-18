import { findAppointment, findCalendar } from "@/lib/data/calendars";
import { withPublicWorkspace } from "@/lib/server/workspace";

/* An .ics file for the lead's own calendar app. */

const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (s: string) => s.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  return (await withPublicWorkspace(`calendar:${slug}`, () => ics(slug, id))) ?? new Response("Not found", { status: 404 });
}

function ics(slug: string, id: string) {
  const now = new Date();
  const cal = findCalendar(now, slug);
  const appt = findAppointment(now, id);
  if (!cal || !appt || appt.calendarId !== cal.id) return new Response("Not found", { status: 404 });
  const type = cal.types.find((t) => t.id === appt.typeId);
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lotus//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${appt.id}@lotus`,
    `DTSTAMP:${stamp(now.toISOString())}`,
    `DTSTART:${stamp(appt.startsAt)}`,
    `DTEND:${stamp(appt.endsAt)}`,
    `SUMMARY:${escape(`${type?.name ?? cal.name} with ${cal.ownerName}`)}`,
    type?.locationDetail ? `LOCATION:${escape(type.locationDetail)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="booking.ics"` },
  });
}
